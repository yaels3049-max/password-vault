/**
 * Reset built-in registry rows corrupted by verifyPhase102Registry.mjs (e.g. leumi text-only login_fields).
 *
 * Requires migration 20260703120400_phase102_rpc_validation_and_reset.sql applied.
 *
 * Usage:
 *   set NODE_EXTRA_CA_CERTS=<netspark-ca-bundle.pem>
 *   node scripts/resetPhase102VerifyArtifacts.mjs
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
  if (extra && extra !== 'null' && existsSync(extra)) return extra;
  try {
    const cafile = execSync('npm config get cafile', { encoding: 'utf8' }).trim();
    if (cafile && cafile !== 'null' && existsSync(cafile)) return cafile;
  } catch {
    // ignore
  }
  return null;
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

function hasPasswordField(loginFields) {
  if (!Array.isArray(loginFields) || loginFields.length === 0) {
    return true;
  }

  return loginFields.some((field) => field?.type === 'password');
}

function needsReset(row) {
  if (row.login_url?.includes('example-phase102.test')) {
    return true;
  }

  if (row.login_fields && !hasPasswordField(row.login_fields)) {
    return true;
  }

  return false;
}

async function main() {
  const caPath = resolveCaPath();
  if (caPath) process.env.NODE_EXTRA_CA_CERTS = caPath;

  const env = loadEnvLocal();
  const url = normalizeSupabaseBaseUrl(env.VITE_SUPABASE_URL ?? '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authErr } = await client.auth.signInAnonymously();
  if (authErr) {
    throw new Error(`signInAnonymously failed: ${authErr.message}`);
  }

  const { data: builtins, error: selectErr } = await client
    .from('service_registry')
    .select('id, login_url, login_fields, login_url_status')
    .is('owner_user_id', null)
    .eq('source_type', 'built_in')
    .eq('service_status', 'active');

  if (selectErr) {
    throw new Error(`select failed: ${selectErr.message}`);
  }

  const targets = (builtins ?? []).filter(needsReset);
  if (targets.length === 0) {
    console.log('No built-in rows need reset.');
    return;
  }

  console.log(`Resetting ${targets.length} built-in row(s): ${targets.map((row) => row.id).join(', ')}`);

  for (const row of targets) {
    const { error: resetErr } = await client.rpc('reset_built_in_verify_discovery', {
      p_service_id: row.id,
    });

    if (resetErr) {
      throw new Error(
        `reset_built_in_verify_discovery failed for "${row.id}": ${resetErr.message}\n` +
          'Apply migration supabase/migrations/20260703120400_phase102_rpc_validation_and_reset.sql in Supabase SQL Editor.',
      );
    }

    console.log(`  reset OK: ${row.id}`);
  }

  console.log('\nDone. Refresh the app (Ctrl+Shift+R).');
}

main().catch((err) => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
