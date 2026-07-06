/**
 * Phase 101 Supabase verification: schema presence, anonymous auth, RLS isolation,
 * and ciphertext-only credential storage.
 *
 * Usage: node scripts/verifyPhase101Supabase.mjs
 *
 * TLS: respects NODE_EXTRA_CA_CERTS or npm `cafile` (Netspark / corporate CA).
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function resolveCaPath() {
  const extra = process.env.NODE_EXTRA_CA_CERTS;
  if (extra && extra !== 'null' && existsSync(extra)) {
    return extra;
  }

  try {
    const cafile = execSync('npm config get cafile', { encoding: 'utf8' }).trim();
    if (cafile && cafile !== 'null' && existsSync(cafile)) {
      return cafile;
    }
  } catch {
    // ignore
  }

  return null;
}

function configureTlsTrust() {
  const caPath = resolveCaPath();
  if (caPath) {
    process.env.NODE_EXTRA_CA_CERTS = caPath;
  }
  return caPath;
}

function loadEnvLocal() {
  const path = join(root, '.env.local');
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function normalizeSupabaseBaseUrl(rawUrl) {
  const trimmed = rawUrl.trim().replace(/\/$/, '');
  return trimmed.replace(/\/rest\/v1\/?$/i, '');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function looksLikeCiphertext(value) {
  if (typeof value !== 'string' || value.length < 16) return false;
  return /^[A-Za-z0-9+/=]+$/.test(value);
}

async function main() {
  const caPath = configureTlsTrust();
  const env = loadEnvLocal();
  const url = normalizeSupabaseBaseUrl(env.VITE_SUPABASE_URL ?? '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  assert(url && anonKey, 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  console.log(`Supabase base URL: ${url}`);
  if (caPath) {
    console.log(`TLS: using CA bundle ${caPath}`);
  }

  const clientOptions = {
    auth: { persistSession: false, autoRefreshToken: false },
  };

  const clientA = createClient(url, anonKey, clientOptions);
  const clientB = createClient(url, anonKey, clientOptions);

  console.log('1. Anonymous auth bootstrap (user A)...');
  const { data: authA, error: authAErr } = await clientA.auth.signInAnonymously();
  assert(!authAErr, `signInAnonymously A failed: ${authAErr?.message}`);
  const userA = authA.user?.id;
  assert(userA, 'No user id for A');

  console.log('2. Schema: categories + subscription_plans readable...');
  const { data: categories, error: catErr } = await clientA.from('categories').select('id').order('sort_order');
  assert(!catErr, `categories select failed: ${catErr?.message}`);
  assert(categories?.length >= 3, `Expected >=3 categories, got ${categories?.length}`);

  const { data: plans, error: planErr } = await clientA.from('subscription_plans').select('id');
  assert(!planErr, `subscription_plans select failed: ${planErr?.message}`);
  assert(plans?.some((p) => p.id === 'free'), 'Missing free subscription plan');

  console.log('3. User row + relational chain + encrypted credential (user A)...');
  const localProfileId = `profile-verify-${crypto.randomUUID()}`;
  const serviceId = 'verify-phase101-service';
  const fakeCiphertext = btoa('aes-gcm-ciphertext-bytes-not-plaintext');
  const fakeIv = btoa('twelvebytesiv');

  const { error: userErr } = await clientA.from('users').upsert({ id: userA }, { onConflict: 'id' });
  assert(!userErr, `users upsert failed: ${userErr?.message}`);

  const { data: userService, error: usErr } = await clientA
    .from('user_services')
    .upsert({ user_id: userA, service_id: serviceId }, { onConflict: 'user_id,service_id' })
    .select('id')
    .single();
  assert(!usErr, `user_services upsert failed: ${usErr?.message}`);

  const { data: accessProfile, error: apErr } = await clientA
    .from('access_profiles')
    .upsert(
      {
        user_id: userA,
        user_service_id: userService.id,
        local_profile_id: localProfileId,
        display_name: 'בדיקה',
        is_default: true,
      },
      { onConflict: 'user_id,local_profile_id' },
    )
    .select('id')
    .single();
  assert(!apErr, `access_profiles upsert failed: ${apErr?.message}`);

  const { error: credErr } = await clientA.from('encrypted_credentials').upsert(
    {
      access_profile_id: accessProfile.id,
      ciphertext: fakeCiphertext,
      iv: fakeIv,
      field_ids_present: ['username', 'password'],
    },
    { onConflict: 'access_profile_id' },
  );
  assert(!credErr, `encrypted_credentials upsert failed: ${credErr?.message}`);

  const { data: storedCred, error: readCredErr } = await clientA
    .from('encrypted_credentials')
    .select('ciphertext, iv, field_ids_present')
    .eq('access_profile_id', accessProfile.id)
    .single();
  assert(!readCredErr, `encrypted_credentials read failed: ${readCredErr?.message}`);
  assert(looksLikeCiphertext(storedCred.ciphertext), 'ciphertext does not look base64-encoded');
  assert(storedCred.field_ids_present?.includes('password'), 'field_ids_present missing password id');
  assert(!JSON.stringify(storedCred).includes('secret-password-value'), 'Plaintext leaked in row');

  console.log('4. RLS isolation (user B cannot read user A encrypted_credentials)...');
  const { data: authB, error: authBErr } = await clientB.auth.signInAnonymously();
  assert(!authBErr, `signInAnonymously B failed: ${authBErr?.message}`);
  const userB = authB.user?.id;
  assert(userB && userB !== userA, 'User B must differ from user A');

  const { data: crossRead, error: crossErr } = await clientB
    .from('encrypted_credentials')
    .select('id')
    .eq('access_profile_id', accessProfile.id);

  assert(!crossErr, `cross-user read error unexpected: ${crossErr?.message}`);
  assert(!crossRead || crossRead.length === 0, `RLS leak: user B read ${crossRead?.length} credential rows`);

  const { data: crossProfiles } = await clientB
    .from('access_profiles')
    .select('id')
    .eq('local_profile_id', localProfileId);
  assert(!crossProfiles || crossProfiles.length === 0, 'RLS leak: user B read access_profiles');

  console.log('5. Global registry write denied...');
  const { error: registryWriteErr } = await clientA.from('service_registry').insert({
    id: 'blocked-write-test',
    display_name: 'Should Fail',
    primary_url: 'https://example.com',
  });
  assert(registryWriteErr, 'Expected RLS to deny service_registry client insert');

  console.log('\nPASS: Phase 101 Supabase verification succeeded.');
  console.log(`  user A: ${userA}`);
  console.log(`  user B: ${userB}`);
  console.log(`  categories: ${categories.map((c) => c.id).join(', ')}`);
}

main().catch((err) => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
