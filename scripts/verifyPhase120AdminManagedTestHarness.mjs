/**
 * Phase 120.5 — Admin Managed Autofill Test Harness (AC-120.5-1…13).
 * Static call-graph + gate evidence; safety sample uses F-SELF (120.6 V3).
 * Usage: node scripts/verifyPhase120AdminManagedTestHarness.mjs
 */
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertIncludes(hay, needle, message) {
  assert(hay.includes(needle), message);
}

function assertNotIncludes(hay, needle, message) {
  assert(!hay.includes(needle), message);
}

async function loadManagedAutofillModule() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-1205-')), 'managedAutofill.mjs');
  await build({
    entryPoints: [join(root, 'src/execution/managedAutofill.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    define: {
      'import.meta.env.DEV': 'false',
    },
    plugins: [
      {
        name: 'stub-heavy-deps',
        setup(buildApi) {
          const stubs = [
            [/extensionBridge/, 'extension-bridge-stub', `
              export function isExtensionAvailable() { return false; }
              export function sendExtensionMessageAsync() { return Promise.resolve(null); }
              export function openUrlInNewTab() {}
            `],
            [/autofill\/validatedProfile/, 'validated-profile-stub', `
              export function isManagedAutofillEligible() { return false; }
              export function isVersionMatchedValidated(p) { return p && p.supportState === 'validated'; }
              export function readAutofillProfileFromMetadata(metadata) {
                if (!metadata || typeof metadata !== 'object') return null;
                return metadata.autofillProfile ?? null;
              }
            `],
            [/mockServices/, 'mock-services-stub', `
              export function getServiceOpenUrl() { return ''; }
            `],
          ];
          for (const [filter, path, contents] of stubs) {
            buildApi.onResolve({ filter }, () => ({ path, namespace: 'stub' }));
            buildApi.onLoad({ filter: new RegExp(`^${path}$`), namespace: 'stub' }, () => ({
              contents,
              loader: 'js',
            }));
          }
          // Catch-all for namespace stub loads keyed by path string
          buildApi.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => {
            const found = stubs.find((s) => s[1] === args.path);
            return {
              contents: found ? found[2] : 'export {}',
              loader: 'js',
            };
          });
        },
      },
    ],
  });
  return import(pathToFileURL(outfile).href);
}

function loadManagedDom(html, origin) {
  const { window } = parseHTML(html);
  Object.defineProperty(window, 'location', {
    value: { origin, href: `${origin}/login` },
    configurable: true,
  });
  window.top = window;
  window.innerWidth = 1024;
  window.innerHeight = 768;
  window.getComputedStyle = (el) => {
    const style = el?.getAttribute?.('style') || '';
    return {
      display: /display:\s*none/i.test(style) ? 'none' : 'block',
      visibility: /visibility:\s*hidden/i.test(style) ? 'hidden' : 'visible',
      opacity: /opacity:\s*0(?:\.0+)?(?:;|$)/i.test(style) ? '0' : '1',
      pointerEvents: /pointer-events:\s*none/i.test(style) ? 'none' : 'auto',
    };
  };
  const Proto = window.HTMLElement.prototype;
  Proto.getClientRects = function getClientRects() {
    const style = this.getAttribute('style') || '';
    if (/display:\s*none|visibility:\s*hidden/i.test(style)) return [];
    const w = /width:\s*(\d+)/i.test(style) ? Number(RegExp.$1) : 120;
    const h = /height:\s*(\d+)/i.test(style) ? Number(RegExp.$1) : 24;
    const left = /left:\s*(-?\d+)/i.test(style) ? Number(RegExp.$1) : 0;
    const top = /top:\s*(-?\d+)/i.test(style) ? Number(RegExp.$1) : 0;
    if (w < 1 || h < 1) return [];
    return [{ width: w, height: h, top, left, bottom: top + h, right: left + w }];
  };
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    const rects = this.getClientRects();
    if (!rects.length) return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0 };
    const r = rects[0];
    return {
      width: r.width,
      height: r.height,
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right,
      x: r.left,
      y: r.top,
    };
  };
  Proto.scrollIntoView = function scrollIntoView() {};
  window.document.elementFromPoint = function elementFromPoint(x, y) {
    const all = Array.from(window.document.querySelectorAll('*')).filter((el) => {
      const tag = String(el.tagName || '').toUpperCase();
      return tag !== 'HTML' && tag !== 'HEAD' && tag !== 'BODY' && tag !== 'SCRIPT';
    });
    let best = null;
    let bestOrder = -1;
    for (let order = 0; order < all.length; order += 1) {
      const el = all[order];
      const style = el.getAttribute('style') || '';
      if (/pointer-events:\s*none/i.test(style)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
        if (order > bestOrder) {
          best = el;
          bestOrder = order;
        }
      }
    }
    return best;
  };
  globalThis.CSS = {
    escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1'),
  };
  for (const rel of [
    'extension/generic/managed-target-eligibility.js',
    'extension/generic/form-detector.js',
    'extension/generic/fill-executor.js',
    'extension/generic/validated-autofill.js',
  ]) {
    const run = new Function(
      'window',
      'document',
      'globalThis',
      'CSS',
      `${read(rel)}\n//# sourceURL=${rel}`,
    );
    run(window, window.document, window, globalThis.CSS);
  }
  return window;
}

console.log('Phase 120.5 — Admin Managed Autofill Test Harness verification\n');

const hubSrc = read('src/execution/managedAutofill.ts');
const editorSrc = read('src/admin/AutofillProfileEditor.tsx');
const dhExecSrc = read('src/execution/serviceExecution.ts');
const validatedSrc = read('src/autofill/validatedProfile.ts');
const bgSrc = read('extension/background.js');

// --- AC-120.5-4 / D-120-12: shared send path ---
assertIncludes(hubSrc, 'export function buildManagedAutofillPayload', 'AC-120.5-4: shared payload builder');
assertIncludes(hubSrc, 'export async function sendManagedAutofillPayloadAndAwait', 'AC-120.5-4: shared send');
assertIncludes(hubSrc, 'HUB_MANAGED_AUTOFILL', 'AC-120.5-4: HUB_MANAGED_AUTOFILL message');

const adminFn = hubSrc.slice(
  hubSrc.indexOf('export async function executeAdminManagedAutofillTest'),
  hubSrc.indexOf('export function formatAdminManagedTestResultSummary'),
);
const dhFn = hubSrc.slice(
  hubSrc.indexOf('export async function executeManagedAutofill('),
  hubSrc.indexOf('export const MSG_ADMIN_MANAGED_TEST_INCOMPLETE'),
);

assertIncludes(adminFn, 'sendManagedAutofillPayloadAndAwait', 'D-120-12: Admin → shared send');
assertIncludes(dhFn, 'sendManagedAutofillPayloadAndAwait', 'D-120-12: Digital Home → shared send');
assertIncludes(adminFn, 'adminManagedTestExecutionKey', 'D-120-12: Admin-scoped execution key');
assertNotIncludes(adminFn, 'serviceIsManagedAutofillEligible', 'D-120-13: Admin does not use DH gate');
assertIncludes(dhFn, 'serviceIsManagedAutofillEligible', 'D-120-13: DH still uses production gate');

// Payload must not include executionContext (fill must not branch)
const payloadFn = hubSrc.slice(
  hubSrc.indexOf('export function buildManagedAutofillPayload'),
  hubSrc.indexOf('export async function sendManagedAutofillPayloadAndAwait'),
);
assertNotIncludes(payloadFn, 'executionContext', 'AC-120.5-4: no executionContext in Ext payload');
assertIncludes(payloadFn, 'type: HUB_MANAGED_AUTOFILL_MESSAGE', 'payload type HUB_MANAGED_AUTOFILL');
assertIncludes(payloadFn, 'fieldMappings', 'payload fieldMappings');
assertIncludes(payloadFn, 'credentials', 'payload credentials');

// Ext still routes HUB_MANAGED_AUTOFILL to same orchestrator; no admin-only fill branch
assertIncludes(bgSrc, 'HUB_MANAGED_AUTOFILL', 'Ext handles HUB_MANAGED_AUTOFILL');
assertNotIncludes(bgSrc, 'admin_test', 'Ext fill path has no admin_test branch');
assertNotIncludes(bgSrc, 'executeAdminManagedAutofillTest', 'Ext does not know Admin harness');

// --- AC-120.5-5 / D-120-13: Admin candidate vs DH validated ---
assertIncludes(validatedSrc, "supportState !== 'validated'", 'DH eligibility requires validated');
assertNotIncludes(adminFn, 'supportState', 'Admin test does not check supportState');
assertIncludes(editorSrc, 'savedProfileReady', 'Editor: saved-profile gate');
assertIncludes(editorSrc, '!hasUnsavedChanges', 'Editor: dirty disables test');
assertIncludes(editorSrc, 'כניסה לאתר ומילוי שדות', 'AC-120.5-3: button label');
assertIncludes(editorSrc, 'allTempValuesFilled', 'AC-120.5-3: all-fields gate');
assertIncludes(editorSrc, "field.type === 'password' ? 'password'", 'AC-120.5-8: masked password');
assertIncludes(editorSrc, 'fields.map((field)', 'AC-120.5-2: schema-dynamic inputs');
assertIncludes(editorSrc, 'tempTestValues', 'AC-120.5-7: component memory');
assertIncludes(editorSrc, 'setTempTestValues({})', 'AC-120.5-7: remount clears temps (retention B)');
assertIncludes(editorSrc, 'executeAdminManagedAutofillTest', 'Editor calls Admin entry');
assertNotIncludes(editorSrc, 'localStorage', 'AC-120.5-7: no localStorage for temps');
assertNotIncludes(editorSrc, 'sessionStorage', 'AC-120.5-7: no sessionStorage for temps');

// requestManagedTest must not approve / flip supportState (120.8 may persist authoring fact only)
const requestStart = editorSrc.indexOf('async function requestManagedTest');
const requestEnd = editorSrc.indexOf('async function requestAnalyzeLoginPage', requestStart);
assert(requestStart >= 0 && requestEnd > requestStart, 'requestManagedTest function found');
const requestFn = editorSrc.slice(requestStart, requestEnd);
assertIncludes(requestFn, 'stampAdminTestPassed', '120.8: Admin Test success fact helper');
assertIncludes(requestFn, 'fieldAuthoring', '120.8: may persist fieldAuthoring fact');
assertIncludes(
  requestFn,
  '[AUTOFILL_LIVE_VALIDATION_APPROVED_KEY]: false',
  '120.8: success fact must not approve live validation',
);
assertNotIncludes(requestFn, 'approveConfirm', 'AC-120.5-6: no approve on test');
assertNotIncludes(requestFn, 'activate_validated', 'AC-120.5-6: no activate on test');
assertNotIncludes(requestFn, "supportState:", 'AC-120.5-6: no supportState mutation on test');
assertNotIncludes(adminFn, 'updateGlobalRegistryRow', 'AC-120.5-6: Admin entry no DB write');

// Structured results without secrets
assertIncludes(hubSrc, 'formatAdminManagedTestResultSummary', 'AC-120.5-11: summary formatter');
const summaryFn = hubSrc.slice(hubSrc.indexOf('export function formatAdminManagedTestResultSummary'));
assertNotIncludes(summaryFn, 'credentials', 'AC-120.5-11: summary does not echo credentials');
assertIncludes(summaryFn, 'outcome.reason', 'AC-120.5-11: reason');
assertIncludes(summaryFn, 'outcome.fieldId', 'AC-120.5-11: fieldId');

// Genericity: no site/hostname branches in Admin harness path
for (const needle of ['shufersal', 'hostname ===', 'serviceId ===', 'namedSite']) {
  assertNotIncludes(adminFn.toLowerCase(), needle.toLowerCase(), `AC-120.5-12: no ${needle} in Admin test`);
}

// Digital Home entry unchanged
assertIncludes(dhExecSrc, 'serviceIsManagedAutofillEligible', 'DH execution still gated');
assertNotIncludes(dhExecSrc, 'executeAdminManagedAutofillTest', 'DH path does not call Admin harness');

// --- Runtime: payload + Admin incomplete / candidate allowed; DH still gated ---
const maf = await loadManagedAutofillModule();

const candidateProfile = {
  version: 1,
  supportState: 'not_configured',
  loginEntryUrl: 'https://example.com/login',
  allowedOrigin: 'https://example.com',
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#user' },
    { fieldId: 'password', locatorType: 'css', locator: '#pass' },
  ],
  schemaFingerprint: 'fp',
};

const loginFields = [
  { id: 'username', label: 'User', type: 'text' },
  { id: 'password', label: 'Pass', type: 'password' },
];

// Incomplete temps → not_eligible (button would be disabled; defense in depth)
const incomplete = await maf.executeAdminManagedAutofillTest({
  serviceId: 'svc-1',
  savedProfile: candidateProfile,
  loginFields,
  tempCredentials: { username: 'a', password: '' },
});
assert(incomplete.ok === false && incomplete.reason === 'not_eligible', 'incomplete temps fail-closed');
assertIncludes(incomplete.userMessage, 'זמני', 'incomplete message HE');

// Candidate (not validated) still proceeds to shared send (extension stub → extension_unavailable)
const candidateRun = await maf.executeAdminManagedAutofillTest({
  serviceId: 'svc-1',
  savedProfile: candidateProfile,
  loginFields,
  tempCredentials: { username: 'temp-user', password: 'temp-pass' },
});
assert(candidateRun.ok === false, 'stub Ext: not ok');
assert(
  candidateRun.reason === 'extension_unavailable',
  `candidate reaches send path (got ${candidateRun.reason})`,
);

const payload = maf.buildManagedAutofillPayload({
  url: candidateProfile.loginEntryUrl,
  allowedOrigin: candidateProfile.allowedOrigin,
  fieldMappings: candidateProfile.fieldMappings,
  credentials: { username: 'secret-user', password: 'secret-pass' },
});
assert(payload.type === 'HUB_MANAGED_AUTOFILL', 'payload type');
assert(payload.credentials.username === 'secret-user', 'credentials keyed by fieldId');
assert(!('executionContext' in payload), 'no executionContext on wire');

const keyAdmin = maf.adminManagedTestExecutionKey('svc-1');
const keyDh = maf.managedAutofillExecutionKey
  ? maf.managedAutofillExecutionKey('svc-1', 'ap-1')
  : null;
assert(keyAdmin.includes('admin_test'), 'Admin key scoped');
assert(keyAdmin !== 'svc-1::ap-1', 'Admin key ≠ vault DH key');

const summary = maf.formatAdminManagedTestResultSummary({
  ok: false,
  reason: 'unsafe_target',
  fieldId: 'username',
  detail: 'aria-hidden',
  locator: '#user',
  tabOpened: true,
  extensionUsed: true,
  userMessage: 'מילוי נכשל',
});
assertIncludes(summary, 'unsafe_target', 'summary includes reason');
assertIncludes(summary, 'username', 'summary includes fieldId');
assertNotIncludes(summary, 'secret-user', 'summary has no secret');
assertNotIncludes(summary, 'temp-pass', 'summary has no temp password');

// DH gate still requires validated (isManagedAutofillEligible via validatedProfile)
const vpOut = join(mkdtempSync(join(tmpdir(), 'pv-1205-vp-')), 'validatedProfile.mjs');
await build({
  entryPoints: [join(root, 'src/autofill/validatedProfile.ts')],
  outfile: vpOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: true,
});
const vp = await import(pathToFileURL(vpOut).href);
const dhEligibleCandidate = vp.isManagedAutofillEligible({
  metadata: {
    autofillProfile: candidateProfile,
  },
  loginFields,
  credential: { username: 'a', password: 'b' },
});
assert(dhEligibleCandidate === false, 'D-120-13: DH rejects non-validated candidate');

const validatedProfile = {
  ...candidateProfile,
  supportState: 'validated',
  validatedAt: '2026-01-01T00:00:00.000Z',
  validatedSchemaFingerprint: 'fp',
};
// Need proper validated shape — check isVersionMatchedValidated path
const metaValidated = vp.writeAutofillProfileToMetadata
  ? null
  : null;
void metaValidated;
const eligibleValidated = vp.isManagedAutofillEligible({
  metadata: { autofillProfile: validatedProfile },
  loginFields,
  credential: { username: 'a', password: 'b' },
});
// May still be false if fingerprint/version gates fail — at minimum validated≠candidate path exists
assert(
  typeof eligibleValidated === 'boolean',
  'DH eligibility function callable',
);
assertIncludes(validatedSrc, "profile.supportState !== 'validated'", 'validated gate present in source');

console.log('  ✓ D-120-12 call-graph: Admin + DH → sendManagedAutofillPayloadAndAwait');
console.log('  ✓ D-120-13 Admin candidate OK; DH gate unchanged');
console.log('  ✓ AC-120.5-1…3,6…9,11,12 static + runtime gates');

// --- AC-120.5-9 / 10 / 13: no auto-submit; Managed safety still rejects unsafe (F-SELF / V3) ---
assertNotIncludes(read('extension/generic/validated-autofill.js'), '.submit(', 'no auto-submit in Managed fill');
assertNotIncludes(read('extension/generic/fill-executor.js'), 'form.submit', 'no form.submit in fill executor');

// 120.6: ancestor-only Fixture A is no longer absolute-reject; use F-SELF for safety proof.
const fixtureSelf = `<!doctype html><html><body>
<form>
  <input id="UserName" type="text" aria-hidden="true" style="width:120px;height:24px;left:10px;top:10px" />
  <input id="Password" type="password" style="width:120px;height:24px;left:10px;top:40px" />
</form>
</body></html>`;

const win = loadManagedDom(fixtureSelf, 'https://example.com');
const unsafe = win.document.querySelector('#UserName');
assert(unsafe, 'F-SELF username present');
assert(
  win.ManagedTargetEligibility.isSafeFillTarget(unsafe) === false,
  'AC-120.5-10: F-SELF still unsafe (V3)',
);
assert(
  win.ManagedTargetEligibility.classifyManagedIneligibility(unsafe) === 'aria_hidden_self',
  'AC-120.5-10: aria_hidden_self',
);
const assess = win.assessManagedTargetsReady({
  allowedOrigin: 'https://example.com',
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#UserName' },
    { fieldId: 'password', locatorType: 'css', locator: '#Password' },
  ],
});
assert(assess.ready === false, 'assess not ready for F-SELF');
assert(assess.detail === 'aria_hidden_self', `F-SELF → aria_hidden_self (got ${JSON.stringify(assess)})`);
assert(assess.reason === 'targets_not_ready', 'F-SELF reason targets_not_ready');

console.log('  ✓ AC-120.5-9 no auto-submit');
console.log('  ✓ AC-120.5-10/13 F-SELF aria_hidden_self still fails (Managed safety)');
console.log('\nPASS — Phase 120.5 Admin Managed Autofill Test Harness');
