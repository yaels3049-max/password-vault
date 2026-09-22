/**
 * Phase 120.2-AP — Managed-parity activate gate (AC-120.2-AP-1…11).
 * Usage: node scripts/verifyPhase120ManagedActivateGate.mjs
 */
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function loadContract() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-120ap-')), 'validatedProfile.mjs');
  await build({
    entryPoints: [join(root, 'src/autofill/validatedProfile.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
  });
  return import(pathToFileURL(outfile).href);
}

async function loadProbeModule() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-120ap-probe-')), 'managedReadinessProbe.mjs');
  await build({
    entryPoints: [join(root, 'src/autofill/managedReadinessProbe.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    // browserIntegration is stubbed via external + virtual? Keep pure helpers: format only.
    // Full module imports browserIntegration — bundle it with empty stubs via banner no;
    // Instead build only for formatManagedReadinessFailureHe by importing after marking
    // browserIntegration as external and injecting a stub file.
    plugins: [
      {
        name: 'stub-browser-integration',
        setup(buildApi) {
          buildApi.onResolve({ filter: /browserIntegration/ }, () => ({
            path: 'browser-integration-stub',
            namespace: 'stub',
          }));
          buildApi.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            contents: `
              export function probeExtensionAvailable() { return false; }
              export function sendExtensionMessageAsync() { return Promise.resolve(null); }
            `,
            loader: 'js',
          }));
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
  installManagedDomGeometry(window);
  for (const rel of [
    'extension/generic/managed-target-eligibility.js',
    'extension/generic/form-detector.js',
    'extension/generic/fill-executor.js',
    'extension/generic/validated-autofill.js',
  ]) {
    const run = new Function('window', 'document', 'globalThis', `${read(rel)}\n//# sourceURL=${rel}`);
    run(window, window.document, window);
  }
  window.GenericFillExecutor.fillField = function (element, value) {
    if (!element || value == null || value === '') {
      return { ok: false, reason: 'missing_value' };
    }
    if (!window.GenericFillExecutor.isSafeFillTarget(element)) {
      return { ok: false, reason: 'hidden_or_unsafe_target' };
    }
    element.value = String(value);
    return { ok: true, verified: true, actual: String(value) };
  };
  return window;
}

function sampleFields() {
  return [
    { id: 'username', label: 'User', type: 'text', required: true },
    { id: 'password', label: 'Pass', type: 'password', required: true },
  ];
}

function sampleMappings() {
  return [
    { fieldId: 'username', locatorType: 'css', locator: '#username' },
    { fieldId: 'password', locatorType: 'css', locator: '#password' },
  ];
}

function mainStatic() {
  const contract = read('src/autofill/validatedProfile.ts');
  const editor = read('src/admin/AutofillProfileEditor.tsx');
  const probe = read('src/autofill/managedReadinessProbe.ts');
  const background = read('extension/background.js');
  const runner = read('extension/generic/validated-autofill.js');

  // AC-120.2-AP-1 / AP-9 — planner + evidence
  assert(contract.includes('cannotActivateWithoutManagedReadinessProbe'), 'AP-1 error code');
  assert(contract.includes('managedReadinessProbePassed'), 'AP-1 probe proof input');
  assert(contract.includes("managed_readiness_ok"), 'AP-9 resultSummary constant');
  assert(!contract.includes("resultSummary: 'live_validation_ok'"), 'AP-9 hollow stamp removed');

  // AC-120.2-AP-2 — shared assess contract
  assert(runner.includes('function assessManagedTargetsReady'), 'AP-2 assess fn');
  assert(background.includes('assessManagedTargetsReady'), 'AP-2 background uses assess');
  assert(background.includes('ADMIN_MANAGED_READINESS_PROBE'), 'AP-2 Admin message');
  assert(background.includes('openPageAndManagedReadinessProbe'), 'AP-2 open path');
  assert(background.includes('runManagedReadinessProbeOnTab'), 'AP-2 tab runner');
  assert(probe.includes('ADMIN_MANAGED_READINESS_PROBE'), 'AP-2 Hub message constant');
  assert(probe.includes('assessManagedTargetsReady') || background.includes('assessManagedTargetsReady'), 'AP-2 same assess');

  // AC-120.2-AP-3 — surface fieldId / detail / locator
  assert(probe.includes('formatManagedReadinessFailureHe'), 'AP-3 formatter');
  assert(probe.includes('fieldId') && probe.includes('locator') && probe.includes('detail'), 'AP-3 fields');
  assert(editor.includes('runManagedReadinessProbe'), 'AP-3 Admin calls probe');
  assert(editor.includes('probe.message'), 'AP-3 Admin surfaces probe message');

  // AC-120.2-AP-4 — no first-match
  assert(!runner.includes('nodes[0]') || runner.includes('nodes.length !== 1'), 'AP-4 exactly-one before use');
  assert(/nodes\.length !== 1/.test(runner), 'AP-4 multi_match reject');
  assert(!/first.?match/i.test(probe + editor + contract), 'AP-4 no first-match language');

  // AC-120.2-AP-5 — no hostname/serviceId branches in gate code
  for (const [label, src] of [
    ['probe', probe],
    ['contract-activate', contract],
    ['editor-activate', editor],
  ]) {
    assert(!/\bshufersal\b/i.test(src), `AP-5 no shufersal in ${label}`);
    assert(!/hostname\s*===|serviceId\s*===/.test(src), `AP-5 no hostname/serviceId branch in ${label}`);
  }
  assert(!/\bshufersal\b/i.test(background.split('ADMIN_MANAGED_READINESS_PROBE')[1]?.slice(0, 800) || ''), 'AP-5 probe handler generic');

  // AC-120.2-AP-6 — no new uniqueness timing substitute on probe path
  assert(background.includes('MANAGED_AUTOFILL_RETRY_DELAY_MS'), 'AP-6 reuses Managed retry const');
  const probeFn = background.slice(
    background.indexOf('function runManagedReadinessProbeOnTab'),
    background.indexOf('function openPageAndManagedReadinessProbe'),
  );
  assert(probeFn.includes('MANAGED_AUTOFILL_RETRY_DELAY_MS'), 'AP-6 probe uses existing retry spacing');
  assert(!/setTimeout\(\s*function[^,]*,\s*(2000|5000|10000)\s*\)/.test(probeFn), 'AP-6 no late-probe timing as uniqueness');

  // AC-120.2-AP-7 — no credentials on probe
  assert(probe.includes('Never sends vault credentials') || probe.includes('never sends credential'), 'AP-7 Hub docs');
  assert(background.includes('credentials_forbidden_on_probe'), 'AP-7 reject credentials payload');
  assert(
    !/credentials\s*:/.test(probeFn) && !probe.includes('credentials:'),
    'AP-7 probe does not pass credentials',
  );

  // AC-120.2-AP-8 — no legacy generic fallback on activate
  assert(!editor.includes('POC_GENERIC_FILL'), 'AP-8 no generic fill on activate');
  assert(!probe.includes('generic-autofill'), 'AP-8 no legacy generic');
  assert(background.includes("'admin-managed-readiness-probe'"), 'AP-8 assess session label');

  // AC-120.2-AP-10 — fixture locators not edited by this gate (source gate files)
  assert(!probe.includes('#j_password'), 'AP-10 probe module does not hardcode fixture locator');
  assert(!editor.includes('#j_password'), 'AP-10 editor does not hardcode fixture locator');

  // UI wiring
  assert(editor.includes('managedReadinessProbePassed'), 'activate persists probe proof');
  assert(editor.includes('AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY'), 'control key wired');
  assert(editor.includes('בודק מוכנות מנוהלת'), 'probing status copy');
}

async function mainContract(mod) {
  const httpsLogin = 'https://online1.example.test/login';
  const origin = 'https://online1.example.test';
  const mappings = sampleMappings();

  const saved = mod.planAutofillProfileWrite({
    previous: null,
    proposed: {
      fieldMappings: mappings,
      loginEntryUrl: httpsLogin,
      allowedOrigin: origin,
    },
    loginFields: sampleFields(),
    action: 'save',
  });
  assert(saved.ok === true, 'save ok');
  assert(saved.profile.supportState === 'not_configured', 'AC-120.2-AP-11: structural save never validated');

  // AC-120.2-AP-1 — bare liveValidationApproved rejected
  const bare = mod.planAutofillProfileWrite({
    previous: saved.profile,
    proposed: saved.profile,
    loginFields: sampleFields(),
    action: 'activate_validated',
    liveValidationApproved: true,
  });
  assert(bare.ok === false, 'AP-1 bare approve rejected');
  assert(bare.code === 'cannotActivateWithoutManagedReadinessProbe', 'AP-1 code');

  const mergedBare = mod.mergeAutofillProfileMetadata({
    existingMetadata: {
      autofillProfile: mod.serializeAutofillProfile(saved.profile),
    },
    patchMetadata: {
      autofillProfile: mod.serializeAutofillProfile(saved.profile),
      [mod.AUTOFILL_PROFILE_ACTION_KEY]: 'activate_validated',
      [mod.AUTOFILL_LIVE_VALIDATION_APPROVED_KEY]: true,
    },
    loginFields: sampleFields(),
  });
  assert(mergedBare.ok === false, 'AP-1 merge rejects UI-only approve');

  // AC-120.2-AP-9 — success stamp
  const activated = mod.planAutofillProfileWrite({
    previous: saved.profile,
    proposed: saved.profile,
    loginFields: sampleFields(),
    action: 'activate_validated',
    liveValidationApproved: true,
    managedReadinessProbePassed: true,
    nowIso: '2026-09-22T00:00:00.000Z',
  });
  assert(activated.ok === true && activated.profile.supportState === 'validated', 'activate with probe');
  assert(
    activated.profile.validation.resultSummary === mod.MANAGED_READINESS_OK_SUMMARY,
    'AP-9 managed_readiness_ok',
  );
  assert(activated.profile.validation.resultSummary !== 'live_validation_ok', 'AP-9 not hollow');

  const mergedOk = mod.mergeAutofillProfileMetadata({
    existingMetadata: {
      autofillProfile: mod.serializeAutofillProfile(saved.profile),
    },
    patchMetadata: {
      autofillProfile: {
        fieldMappings: mappings,
        loginEntryUrl: httpsLogin,
        allowedOrigin: origin,
      },
      [mod.AUTOFILL_PROFILE_ACTION_KEY]: 'activate_validated',
      [mod.AUTOFILL_LIVE_VALIDATION_APPROVED_KEY]: true,
      [mod.AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY]: true,
    },
    loginFields: sampleFields(),
  });
  assert(mergedOk.ok === true && mergedOk.profile.supportState === 'validated', 'merge activate with probe');
  assert(
    !Object.prototype.hasOwnProperty.call(mergedOk.metadata, mod.AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY),
    'control key stripped after merge',
  );
}

async function mainProbeFormat(probeMod) {
  const msg = probeMod.formatManagedReadinessFailureHe({
    fieldId: 'password',
    detail: 'multi_match',
    locator: '#j_password',
  });
  assert(msg.includes('password'), 'AP-3 fieldId in message');
  assert(msg.includes('multi_match'), 'AP-3 detail in message');
  assert(msg.includes('#j_password'), 'AP-3 locator in message');
  assert(!/secret|password-value|credential/i.test(msg), 'AP-7 no secrets in message');
}

function mainDomParity() {
  const origin = 'https://fixture.example.test';
  const uniqueHtml = `
    <!doctype html><html><body>
      <form id="login-form">
        <input id="username" type="text" />
        <input id="password" type="password" />
      </form>
    </body></html>`;
  const window = loadManagedDom(uniqueHtml, origin);
  assert(typeof window.assessManagedTargetsReady === 'function', 'AP-2 assess loaded');

  const zero = window.assessManagedTargetsReady({
    allowedOrigin: origin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#missing' }],
  });
  assert(zero.ready === false && zero.detail === 'zero_match', 'AP-3 zero_match');
  assert(zero.fieldId === 'username' && zero.locator === '#missing', 'AP-3 zero surfaces ids');

  const clone = window.document.getElementById('password').cloneNode(true);
  clone.removeAttribute('id');
  clone.id = 'password';
  window.document.getElementById('login-form').appendChild(clone);
  const multi = window.assessManagedTargetsReady({
    allowedOrigin: origin,
    fieldMappings: [{ fieldId: 'password', locatorType: 'css', locator: '#password' }],
  });
  assert(multi.ready === false && multi.detail === 'multi_match', 'AP-3/4 multi fail closed');
  assert(multi.fieldId === 'password' && multi.locator === '#password', 'AP-3 multi surfaces ids');

  const win2 = loadManagedDom(uniqueHtml, origin);
  const ready = win2.assessManagedTargetsReady({
    allowedOrigin: origin,
    fieldMappings: sampleMappings(),
  });
  assert(ready.ready === true, 'AP-2 ready when exactly-one');

  const fill = win2.runManagedAutofill({
    allowedOrigin: origin,
    fieldMappings: sampleMappings(),
    credentials: { username: 'u', password: 'p' },
  });
  assert(fill.ok === true, 'AC-120.2-AP-11: Managed fill still works on unique locators');
}

async function main() {
  mainStatic();
  const mod = await loadContract();
  await mainContract(mod);
  const probeMod = await loadProbeModule();
  await mainProbeFormat(probeMod);
  mainDomParity();
  console.log('verifyPhase120ManagedActivateGate: PASS (AC-120.2-AP-1…11)');
}

await main();
