/**
 * Smoke-test anonymous auth via Vite dev proxy (no secrets printed).
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

configureTls();
console.log('CA:', process.env.NODE_EXTRA_CA_CERTS ?? '(none)');

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

const env = loadEnvLocal();
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const remoteBase = env.VITE_SUPABASE_URL.trim().replace(/\/$/, '').replace(/\/rest\/v1\/?$/i, '');
const proxyBase = process.env.DEV_PROXY_URL ?? 'http://localhost:5173/dev-supabase-proxy';

async function probe(label, url, withKey = true) {
  try {
    const init = withKey ? { headers: { apikey: anonKey } } : {};
    const r = await fetch(url, init);
    const body = (await r.text()).slice(0, 60);
    console.log(`${label}: ${r.status} ${body}`);
    return r.status;
  } catch (e) {
    console.error(`${label}: FETCH_ERR ${e instanceof Error ? e.message : e}`);
    return 0;
  }
}

await probe('direct-no-key', `${remoteBase}/auth/v1/health`, false);
await probe('direct-key', `${remoteBase}/auth/v1/health`, true);
await probe('proxy-no-key', `${proxyBase}/auth/v1/health`, false);
await probe('proxy-key', `${proxyBase}/auth/v1/health`, true);

async function logEncoding(label, url, withKey) {
  const init = withKey ? { headers: { apikey: anonKey } } : {};
  const r = await fetch(url, init);
  const enc = r.headers.get('content-encoding');
  const len = r.headers.get('content-length');
  console.log(`${label} encoding=${enc ?? '-'} length=${len ?? '-'} status=${r.status}`);
}

if (process.env.DEBUG_PROXY_HEADERS === '1') {
  await logEncoding('direct-key', `${remoteBase}/auth/v1/health`, true);
  await logEncoding('proxy-key', `${proxyBase}/auth/v1/health`, true);
}

const client = createClient(proxyBase, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  let health;
  try {
    health = await fetch(`${proxyBase}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    console.log('health', health.status, (await health.text()).slice(0, 80));
  } catch (e) {
    console.error('health fetch failed:', e instanceof Error ? e.message : e);
    throw e;
  }

  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    console.error('signInAnonymously FAILED:', error.message, error.name);
    process.exit(1);
  }
  console.log('signInAnonymously OK, user id prefix:', data.user?.id?.slice(0, 8));

  const { data: rows, error: regErr } = await client
    .from('service_registry')
    .select('id')
    .eq('service_status', 'active')
    .limit(3);
  if (regErr) {
    console.error('registry FAILED:', regErr.message);
    process.exit(1);
  }
  console.log('registry OK, sample ids:', rows?.map((r) => r.id).join(', '));
} catch (e) {
  console.error('FETCH ERROR:', e instanceof Error ? e.message : e);
  process.exit(1);
}
