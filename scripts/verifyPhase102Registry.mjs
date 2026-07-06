/**
 * Phase 102 registry verification: seed count, RLS, RPC, custom row, user UPDATE.
 *
 * Usage:
 *   set NODE_EXTRA_CA_CERTS=<netspark-ca-bundle.pem>
 *   node scripts/verifyPhase102Registry.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const EXPECTED_BUILTIN_SEED_COUNT = 13;

const VALID_TEST_LOGIN_FIELDS = [
  { id: 'username', label: 'שם משתמש', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];

const VALID_CUSTOM_LOGIN_FIELDS = [
  { id: 'email', label: 'מייל', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];

function resolveCaPath() {
  const extra = process.env.NODE_EXTRA_CA_CERTS;
  if (extra && extra !== 'null' && existsSync(extra)) return extra;
  try {
    const cafile = execSync('npm config get cafile', { encoding: 'utf8' }).trim();
    if (cafile && cafile !== 'null' && existsSync(cafile)) return cafile;
  } catch {
    // ignore
  }
  return null;
}

function configureTlsTrust() {
  const caPath = resolveCaPath();
  if (caPath) process.env.NODE_EXTRA_CA_CERTS = caPath;
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
  return rawUrl.trim().replace(/\/$/, '').replace(/\/rest\/v1\/?$/i, '');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const caPath = configureTlsTrust();
  const env = loadEnvLocal();
  const url = normalizeSupabaseBaseUrl(env.VITE_SUPABASE_URL ?? '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  assert(url && anonKey, 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');

  if (caPath) console.log(`TLS: using CA bundle ${caPath}`);

  const clientA = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const clientB = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('1. Anonymous auth (user A)...');
  const { data: authA, error: authAErr } = await clientA.auth.signInAnonymously();
  assert(!authAErr, `signInAnonymously A failed: ${authAErr?.message}`);
  const userA = authA.user?.id;
  assert(userA, 'No user id for A');

  console.log('2. Built-in seed count + sample metadata...');
  const { data: builtins, error: builtinErr } = await clientA
    .from('service_registry')
    .select('id, primary_url, login_url, category_id, icon, metadata, login_url_status, owner_user_id, source_type')
    .is('owner_user_id', null)
    .eq('source_type', 'built_in')
    .eq('service_status', 'active');

  assert(!builtinErr, `built-in select failed: ${builtinErr?.message}`);
  assert(
    builtins?.length === EXPECTED_BUILTIN_SEED_COUNT,
    `Expected ${EXPECTED_BUILTIN_SEED_COUNT} built-in rows, got ${builtins?.length}`,
  );
  assert(!builtins?.some((row) => row.id === 'hub-practice-login'), 'practice service must not be seeded');

  const hapoalim = builtins?.find((row) => row.id === 'hapoalim');
  assert(hapoalim?.primary_url, 'hapoalim missing primary_url');
  assert(hapoalim?.category_id === 'banking', 'hapoalim category mismatch');
  assert(hapoalim?.icon, 'hapoalim missing icon');

  console.log('3. RPC updates global row when login_url missing...');
  const rpcTarget = builtins?.find(
    (row) => !row.login_url || row.login_url_status === 'invalid',
  );
  assert(rpcTarget, 'No built-in row available for RPC positive test (need null/invalid login_url)');

  const testLoginUrl = `https://example-phase102.test/login?run=${crypto.randomUUID()}`;
  const { error: rpcOkErr } = await clientA.rpc('persist_discovered_login_url', {
    p_service_id: rpcTarget.id,
    p_login_url: testLoginUrl,
    p_login_fields: VALID_TEST_LOGIN_FIELDS,
  });
  assert(!rpcOkErr, `RPC allowed update failed: ${rpcOkErr?.message}`);

  const { data: rpcTargetAfter, error: rpcTargetReadErr } = await clientA
    .from('service_registry')
    .select('login_url, login_url_status')
    .eq('id', rpcTarget.id)
    .single();
  assert(!rpcTargetReadErr, rpcTargetReadErr?.message);
  assert(rpcTargetAfter.login_url === testLoginUrl, 'RPC did not persist login_url');
  assert(rpcTargetAfter.login_url_status === 'valid', 'RPC did not set login_url_status valid');

  console.log('3b. Reset built-in RPC test artifact...');
  const { error: resetRpcErr } = await clientA.rpc('reset_built_in_verify_discovery', {
    p_service_id: rpcTarget.id,
  });
  assert(!resetRpcErr, `reset_built_in_verify_discovery failed: ${resetRpcErr?.message}`);

  console.log('4. RPC rejects update when login_url already valid...');
  const rpcRejectTarget = builtins?.find(
    (row) => row.login_url && row.login_url_status === 'valid',
  );
  assert(rpcRejectTarget, 'No built-in row with valid login_url for RPC reject test');
  const { error: rpcRejectErr } = await clientA.rpc('persist_discovered_login_url', {
    p_service_id: rpcRejectTarget.id,
    p_login_url: 'https://blocked.example/login',
    p_login_fields: null,
  });
  assert(rpcRejectErr, 'RPC should reject update when login_url already valid');

  console.log('5. User A creates custom registry row...');
  const { error: userRowErr } = await clientA.from('users').upsert({ id: userA }, { onConflict: 'id' });
  assert(!userRowErr, `users upsert failed: ${userRowErr?.message}`);

  const customId = `custom-verify-${crypto.randomUUID()}`;
  const { error: customInsertErr } = await clientA.from('service_registry').insert({
    id: customId,
    display_name: 'אתר בדיקה',
    primary_url: 'https://example-phase102-custom.test',
    category_id: 'shopping',
    icon: '🔗',
    source_type: 'user',
    service_status: 'active',
    metadata: {},
    login_url_status: 'unknown',
    owner_user_id: userA,
  });
  assert(!customInsertErr, `custom insert failed: ${customInsertErr?.message}`);

  console.log('6. RLS isolation — user B cannot read user A custom row...');
  const { data: authB, error: authBErr } = await clientB.auth.signInAnonymously();
  assert(!authBErr, authBErr?.message);
  const userB = authB.user?.id;
  assert(userB && userB !== userA, 'user B must differ from user A');

  const { data: crossRead, error: crossErr } = await clientB
    .from('service_registry')
    .select('id')
    .eq('id', customId);
  assert(!crossErr, crossErr?.message);
  assert(!crossRead || crossRead.length === 0, 'RLS leak: user B read user A custom registry row');

  console.log('7. User A direct UPDATE on own row (login_url + login_fields)...');
  const customLoginUrl = 'https://example-phase102-custom.test/login';
  const { error: customUpdateErr } = await clientA
    .from('service_registry')
    .update({
      login_url: customLoginUrl,
      login_fields: VALID_CUSTOM_LOGIN_FIELDS,
      login_url_status: 'valid',
    })
    .eq('id', customId);
  assert(!customUpdateErr, `user update failed: ${customUpdateErr?.message}`);

  const { data: customAfter, error: customAfterErr } = await clientA
    .from('service_registry')
    .select('login_url, login_fields, login_url_status')
    .eq('id', customId)
    .single();
  assert(!customAfterErr, customAfterErr?.message);
  assert(customAfter.login_url === customLoginUrl, 'custom login_url not persisted');
  assert(customAfter.login_url_status === 'valid', 'custom login_url_status not valid');
  assert(Array.isArray(customAfter.login_fields), 'custom login_fields missing');

  console.log('8. Cleanup custom verify row...');
  const { error: customDeleteErr } = await clientA.from('service_registry').delete().eq('id', customId);
  assert(!customDeleteErr, `custom delete failed: ${customDeleteErr?.message}`);

  console.log('\nPASS: Phase 102 registry verification succeeded.');
  console.log(`  built-in seed count: ${builtins.length}`);
  console.log(`  user A: ${userA}`);
  console.log(`  user B: ${userB}`);
}

main().catch((err) => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
