/**
 * Phase 120.2 — dump live service_registry row for id=shufersal (S1).
 *
 * PREFERRED: do NOT use this script with a clipboard token.
 * Use Admin Hub console script instead:
 *   scripts/operatorAssistS1ShufersalHubConsole.js
 * (calls fetchRegistryRowForAdmin — no JWT handling).
 *
 * This Node dump remains for lab use only when an Admin Bearer JWT is already
 * in SUPABASE_ACCESS_TOKEN (must be a 3-part JWT). Rejects non-JWT early.
 *
 * Do NOT weaken RLS. Do NOT use service-role. Do NOT ask Owner to paste tokens.
 *
 * Exit 0 = MATCH seed → S1 PASS candidate (record in dev-phase120.md)
 * Exit 2 = MISMATCH → STOP Architecture
 * Exit 3 = missing row / unauthenticated
 * Exit 4 = SUPABASE_ACCESS_TOKEN present but not a JWT (operator-helper class failure)
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function configureTls() {
  try {
    const cafile = execSync('npm config get cafile', {
      encoding: 'utf8',
      cwd: root,
    }).trim();
    if (cafile && cafile !== 'null' && existsSync(cafile)) {
      process.env.NODE_EXTRA_CA_CERTS = cafile;
    }
  } catch {
    // ignore
  }
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

const SEED = {
  // LIVE baseline (Architecture S1 PASS 2026-09-21) — not builtinCatalog email seed
  id: 'shufersal',
  primary_url: 'https://www.shufersal.co.il',
  login_url: 'https://www.shufersal.co.il/online/he/login',
  login_field_ids: ['username', 'password'],
  adapter_id: null,
};

function fieldIds(loginFields) {
  if (!Array.isArray(loginFields)) return [];
  return loginFields
    .map((f) => (f && typeof f.id === 'string' ? f.id : null))
    .filter(Boolean);
}

function redactProfile(meta) {
  const profile = meta && meta.autofillProfile;
  if (!profile || typeof profile !== 'object') return null;
  return {
    schemaVersion: profile.schemaVersion,
    supportState: profile.supportState,
    configVersion: profile.configVersion,
    loginEntryUrl: profile.loginEntryUrl,
    allowedOrigin: profile.allowedOrigin,
    fieldMappings: Array.isArray(profile.fieldMappings)
      ? profile.fieldMappings.map((m) => ({
          fieldId: m.fieldId,
          locatorType: m.locatorType,
          locator: m.locator,
        }))
      : [],
    validation: profile.validation
      ? {
          metadataVersion: profile.validation.metadataVersion,
          hasValidatedAt: Boolean(profile.validation.validatedAt),
        }
      : undefined,
  };
}

configureTls();
const fileEnv = loadEnvLocal();
const url = fileEnv.VITE_SUPABASE_URL.trim()
  .replace(/\/$/, '')
  .replace(/\/rest\/v1\/?$/i, '');
const anonKey = fileEnv.VITE_SUPABASE_ANON_KEY;

const bearer = process.env.SUPABASE_ACCESS_TOKEN
  ? String(process.env.SUPABASE_ACCESS_TOKEN).trim()
  : '';
if (bearer) {
  const parts = bearer.split('.');
  if (parts.length !== 3) {
    console.error(
      JSON.stringify(
        {
          status: 'INVALID_ACCESS_TOKEN_NOT_JWT',
          jwtParts: parts.length,
          hint: 'Clipboard/token path is deprecated for S1. Prefer Admin Hub console: scripts/operatorAssistS1ShufersalHubConsole.js (fetchRegistryRowForAdmin). Likely cause: copied PKCE code-verifier or other non-JWT localStorage value.',
        },
        null,
        2,
      ),
    );
    process.exit(4);
  }
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  },
});

async function authenticateIfNeeded() {
  if (bearer) return;
  console.log(
    JSON.stringify(
      {
        status: 'MISSING_OR_RLS',
        hint: 'No SUPABASE_ACCESS_TOKEN. Prefer Admin Hub console script (fetchRegistryRowForAdmin). Do not use service-role. Do not paste tokens into chat.',
        seed: SEED,
      },
      null,
      2,
    ),
  );
  process.exit(3);
}

await authenticateIfNeeded();

const { data, error } = await client
  .from('service_registry')
  .select(
    'id, display_name, primary_url, login_url, login_fields, adapter_id, metadata, owner_user_id, source_type, service_status',
  )
  .eq('id', 'shufersal');

if (error) {
  console.error('QUERY_FAIL:', error.message);
  process.exit(1);
}

const row = (data ?? [])[0];
if (!row) {
  console.log(
    JSON.stringify(
      {
        status: 'MISSING_OR_RLS',
        hint: 'No shufersal row with current auth. Prefer Admin Hub console: scripts/operatorAssistS1ShufersalHubConsole.js',
        seed: SEED,
      },
      null,
      2,
    ),
  );
  process.exit(3);
}

const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
const ids = fieldIds(row.login_fields);
const dump = {
  status: 'OK',
  live: {
    id: row.id,
    display_name: row.display_name,
    primary_url: row.primary_url,
    login_url: row.login_url,
    login_field_ids: ids,
    login_fields: row.login_fields,
    adapter_id: row.adapter_id ?? null,
    owner_user_id: row.owner_user_id,
    source_type: row.source_type,
    service_status: row.service_status,
    credentialMode: meta.credentialMode ?? null,
    autofillProfile: redactProfile(meta),
  },
  seed: SEED,
};

const normalizeUrl = (u) =>
  typeof u === 'string' ? u.trim().replace(/\/$/, '') : '';
const mismatches = [];
if (dump.live.id !== SEED.id) mismatches.push('id');
if (normalizeUrl(dump.live.primary_url) !== normalizeUrl(SEED.primary_url)) {
  mismatches.push('primary_url');
}
if (normalizeUrl(dump.live.login_url) !== normalizeUrl(SEED.login_url)) {
  mismatches.push('login_url');
}
if (JSON.stringify(ids) !== JSON.stringify(SEED.login_field_ids)) {
  mismatches.push('login_fields');
}
  if ((dump.live.adapter_id ?? null) !== SEED.adapter_id) {
    // Treat "" as none (live baseline) — do not require rewrite
    const liveNone =
      dump.live.adapter_id == null || dump.live.adapter_id === '';
    if (!(SEED.adapter_id === null && liveNone)) {
      mismatches.push('adapter_id');
    }
  }

dump.compare = {
  match: mismatches.length === 0,
  mismatches,
};

console.log(JSON.stringify(dump, null, 2));

if (mismatches.length > 0) {
  console.error(
    'STOP_ARCHITECTURE: live schema/Login Entry mismatch vs seed:',
    mismatches.join(', '),
  );
  process.exit(2);
}

console.error('S1_COMPARE: PASS (live matches seed for id/urls/login_fields/adapter_id)');
