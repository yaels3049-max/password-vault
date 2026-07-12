/**
 * Report adapter_id for known services (Phase 103 / 108 expectations).
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

const expected = {
  shufersal: null,
  clalit: null,
  htzone: 'htzone',
};

const { data, error } = await client
  .from('service_registry')
  .select('id, adapter_id, login_url, login_fields')
  .in('id', Object.keys(expected));

if (error) {
  console.error('FAIL:', error.message);
  process.exit(1);
}

let failed = false;
for (const [id, want] of Object.entries(expected)) {
  const row = (data ?? []).find((entry) => entry.id === id);
  if (!row) {
    console.log(`${id}: MISSING_ROW (add/select to restore from seed)`);
    continue;
  }
  const actual = row.adapter_id ?? null;
  const ok = actual === want;
  if (!ok) failed = true;
  console.log(
    `${id}: adapter_id=${actual ?? '(null)'} expected=${want ?? '(null)'} login_url=${row.login_url ? 'yes' : 'no'} ${ok ? 'OK' : 'FAIL'}`,
  );
}

if (failed) {
  process.exit(1);
}

console.log('PASS: adapter_id values match Phase 103/108 architecture');
