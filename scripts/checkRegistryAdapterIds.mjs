/**
 * Report adapter_id for Shufersal/Clalit in Supabase registry.
 * Usage: node scripts/checkRegistryAdapterIds.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function configureTls() {
  const extra = process.env.NODE_EXTRA_CA_CERTS;
  if (extra && extra !== 'null' && existsSync(extra)) return extra;
  try {
    const cafile = execSync('npm config get cafile', { encoding: 'utf8', cwd: root }).trim();
    if (cafile && cafile !== 'null' && existsSync(cafile)) {
      process.env.NODE_EXTRA_CA_CERTS = cafile;
      return cafile;
    }
  } catch {
    // ignore
  }
  return null;
}

function loadEnvLocal() {
  const text = readFileSync(join(root, '.env.local'), 'utf8');
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

configureTls();
const env = loadEnvLocal();
const url = env.VITE_SUPABASE_URL.trim().replace(/\/$/, '').replace(/\/rest\/v1\/?$/i, '');
const anonKey = env.VITE_SUPABASE_ANON_KEY;

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await client
  .from('service_registry')
  .select('id, adapter_id, login_url')
  .in('id', ['shufersal', 'clalit']);

if (error) {
  console.error('FAIL:', error.message);
  process.exit(1);
}

for (const row of data ?? []) {
  const ok = row.adapter_id === 'generic';
  console.log(`${row.id}: adapter_id=${row.adapter_id ?? '(null)'} login_url=${row.login_url ? 'yes' : 'no'} ${ok ? 'OK' : 'NEEDS_MIGRATION'}`);
}

const missing = ['shufersal', 'clalit'].filter((id) => !(data ?? []).some((row) => row.id === id));
if (missing.length > 0) {
  console.error('Missing rows:', missing.join(', '));
  process.exit(1);
}
