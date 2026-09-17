/**
 * Phase 118 — post-deploy smoke for propose-field-mappings (no secrets printed).
 * Usage (Operator machine):
 *   node scripts/probeProposeFieldMappings.mjs
 *
 * If corporate TLS MITM blocks Node, set NODE_TLS_REJECT_UNAUTHORIZED=0 for this probe only.
 */
import { existsSync, readFileSync } from 'node:fs';

function readEnv(name) {
  for (const p of ['.env.local', '.env']) {
    if (!existsSync(p)) continue;
    const t = readFileSync(p, 'utf8');
    const m = t.match(new RegExp('^' + name + '=(.+)$', 'm'));
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return null;
}

const url = readEnv('VITE_SUPABASE_URL');
if (!url) {
  console.log('FAIL: VITE_SUPABASE_URL missing');
  process.exit(1);
}

const endpoint = url.replace(/\/$/, '') + '/functions/v1/propose-field-mappings';
console.log('endpoint_host=' + new URL(url).host);
console.log('function=propose-field-mappings');

const optionsRes = await fetch(endpoint, { method: 'OPTIONS' });
console.log('options_status=' + optionsRes.status);

const noAuthRes = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inspectionCapability: 'single_page_top',
    agentTask: 'propose_field_mappings',
    schema: [{ fieldId: 'username', label: 'User' }],
    page: { schemaVersion: 1, inputs: [], origin: 'https://example.test', finalUrl: 'https://example.test/', capturedAt: new Date().toISOString(), limits: { truncated: false, maxInputsApplied: 40 } },
  }),
});
const noAuthText = await noAuthRes.text();
const leaksSecret = /sk-[a-zA-Z0-9]|OPENAI_API_KEY\s*=/i.test(noAuthText);
console.log('unauthenticated_post_status=' + noAuthRes.status);
console.log('unauthenticated_body_leaks_secret=' + leaksSecret);
console.log(
  'unauthenticated_body_snippet=' + noAuthText.replace(/\s+/g, ' ').slice(0, 160),
);

if (noAuthRes.status === 404) {
  console.log('RESULT=NOT_DEPLOYED');
  process.exit(2);
}
if (leaksSecret) {
  console.log('RESULT=FAIL_SECRET_LEAK');
  process.exit(3);
}
if (noAuthRes.status === 401 || noAuthRes.status === 403) {
  console.log('RESULT=FAIL_CLOSED_AUTH_OK');
  process.exit(0);
}
console.log('RESULT=DEPLOYED_CHECK_AUTH_RESPONSE');
process.exit(0);
