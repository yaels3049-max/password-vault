/**
 * Post-120 Corrective A / A2 + A2.1 + A2.2 — Managed fillDiagnostics (structural only).
 * Proves stamps attach without changing fill ok/reason semantics.
 * Usage: node scripts/verifyPhase120A2ManagedFillDiagnostics.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

// --- Static: A2.1 / A2.2 probes preserve existing event order ---
const fillSrc = read('extension/generic/fill-executor.js');
const fillFnStart = fillSrc.indexOf('function fillField(element, value, isSecret)');
assert(fillFnStart >= 0, 'fillField present');
const fillFn = fillSrc.slice(fillFnStart, fillSrc.indexOf('function verifyMappings', fillFnStart));
const iSet = fillFn.indexOf('setNativeInputValue(element, value)');
const iNative = fillFn.indexOf('matchNativeSet');
const iDispatch = fillFn.indexOf('dispatchInputEvents(element, expected)');
const iEvents = fillFn.indexOf('matchEvents');
const iBlurCall = fillFn.indexOf("new Event('blur'");
const iMatchBlur = fillFn.indexOf('matchBlur');
assert(iSet >= 0 && iNative > iSet, 'A2.1-static native probe after setNativeInputValue');
assert(iDispatch > iNative && iEvents > iDispatch, 'A2.1-static events probe after dispatchInputEvents');
assert(iBlurCall > iEvents && iMatchBlur > iBlurCall, 'A2.1-static blur probe after blur');

const dispatchStart = fillSrc.indexOf('function dispatchInputEvents(element, expectedTrim)');
assert(dispatchStart >= 0, 'A2.2-static dispatchInputEvents signature');
const dispatchFn = fillSrc.slice(
  dispatchStart,
  fillSrc.indexOf('function readValue', dispatchStart),
);
const orderKeys = [
  "new InputEvent('beforeinput'",
  "record('fill_post_beforeinput')",
  "new InputEvent('input'",
  "record('fill_post_input')",
  "new Event('change'",
  "record('fill_post_change')",
  "new KeyboardEvent('keyup'",
  "record('fill_post_keyup')",
];
let cursor = -1;
for (const key of orderKeys) {
  const at = dispatchFn.indexOf(key);
  assert(at > cursor, `A2.2-static order: ${key}`);
  cursor = at;
}

// --- Static: A2.3 after outcome freeze + verify_current_probe ---
const validatedSrc = read('extension/generic/validated-autofill.js');
const iOutcomeOk = validatedSrc.indexOf("outcome = { ok: true, filled: filledCount, reason: 'ok' }");
const iVerifyCurrent = validatedSrc.indexOf("'verify_current_probe'");
const iObserve = validatedSrc.indexOf('observePostVerifyAsync(bag, filledTrail, outcome)');
const iMicro = validatedSrc.indexOf("'post_verify_microtask'");
const iRaf = validatedSrc.indexOf("'post_verify_raf'");
const iT0 = validatedSrc.indexOf("'post_verify_timeout_0'");
assert(iOutcomeOk >= 0 && iVerifyCurrent > iOutcomeOk, 'A2.3-static verify_current after outcome');
assert(iObserve > iVerifyCurrent, 'A2.3-static observe after verify_current_probe');
assert(iMicro > 0 && iRaf > 0 && iT0 > 0, 'A2.3-static stage literals present');
assert(
  !validatedSrc.includes('outcome.ok =') && !validatedSrc.includes('outcome.reason ='),
  'A2.3-static outcome ok/reason never reassigned',
);

function loadManagedDom(html, origin) {
  const { window, document } = parseHTML(html);
  Object.defineProperty(window, 'location', {
    value: { origin, href: `${origin}/login` },
    configurable: true,
  });
  window.top = window;
  installManagedDomGeometry(window);
  const scripts = [
    'extension/generic/managed-target-eligibility.js',
    'extension/generic/form-detector.js',
    'extension/generic/fill-executor.js',
    'extension/generic/validated-autofill.js',
  ];
  for (const rel of scripts) {
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
    const matched = String(element.value || '').trim() === String(value).trim();
    return {
      ok: true,
      verified: true,
      actual: String(value),
      fillStageMatches: {
        fill_post_native_set: matched,
        fill_post_beforeinput: matched,
        fill_post_input: matched,
        fill_post_change: matched,
        fill_post_keyup: matched,
        fill_post_events: matched,
        fill_post_blur: matched,
      },
    };
  };
  return { window, document };
}

const html = read('scripts/fixtures/phase117-rivhit-login.html');
const origin = 'https://online1.rivhit.co.il';
const { window } = loadManagedDom(html, origin);
if (window.__ManagedA24) {
  window.__ManagedA24.setBoundMs(40);
  window.__ManagedA24.setPEnabled(true);
}

const mappings = [
  { fieldId: 'username', locatorType: 'css', locator: '#username' },
  { fieldId: 'password', locatorType: 'css', locator: '#password' },
  { fieldId: 'business_id', locatorType: 'css', locator: '#osek' },
];
const credentials = { username: 'secret-user', password: 'secret-pass', business_id: '999' };

const result = await Promise.resolve(
  window.runManagedAutofill({
    allowedOrigin: origin,
    fieldMappings: mappings,
    credentials,
    diagnosticPath: 'admin_test',
  }),
);

assert(result.ok === true, 'fill still SUCCESS');
assert(result.filled === 3, 'filled count unchanged');
assert(result.reason === 'ok', 'reason unchanged');
assert(result.fillDiagnostics, 'fillDiagnostics present');

const stages = new Set(result.fillDiagnostics.stamps.map((s) => s.stage));
for (const required of [
  'assess_resolve',
  'pre_fill',
  'fill_post_native_set',
  'fill_post_beforeinput',
  'fill_post_input',
  'fill_post_change',
  'fill_post_keyup',
  'fill_post_events',
  'fill_post_blur',
  'post_fill_immediate',
  'post_field_advance',
  'verify_held',
  'verify_current_probe',
  'post_verify_microtask',
  'post_verify_raf',
  'post_verify_timeout_0',
  'post_runtime_a24_start',
]) {
  assert(stages.has(required), `missing stage ${required}`);
}

const a24 = result.fillDiagnostics.stamps.filter((s) =>
  String(s.stage || '').startsWith('post_runtime_a24'),
);
assert(a24.length >= 4, 'A2.4 — start + per-field idle/loss stamps');
assert(
  a24.every((s) => s.a24Mode === 'P' || s.a24Mode === 'B' || s.a24Mode === 'P_partial' || s.stage === 'post_runtime_a24'),
  'A2.4 mode metadata',
);

const a22 = result.fillDiagnostics.stamps.filter((s) =>
  ['fill_post_beforeinput', 'fill_post_input', 'fill_post_change', 'fill_post_keyup'].includes(
    s.stage,
  ),
);
assert(a22.length === 12, 'A2.2 — 4 stages × 3 fields');
assert(
  a22.every((s) => typeof s.expectedValueMatchHeld === 'boolean'),
  'A2.2 — boolean match only',
);

const a23 = result.fillDiagnostics.stamps.filter((s) =>
  ['post_verify_microtask', 'post_verify_raf', 'post_verify_timeout_0'].includes(s.stage),
);
assert(a23.length === 9, 'A2.3 — 3 stages × 3 fields');
assert(
  a23.every((s) => typeof s.expectedValueMatchHeld === 'boolean'),
  'A2.3 — held boolean only',
);
assert(
  a23.every((s) => typeof s.expectedValueMatchCurrent === 'boolean'),
  'A2.3 — current boolean only',
);
assert(
  a23.every((s) => s.runId === result.fillDiagnostics.runId && s.path === 'admin_test'),
  'A2.3 — runId/path correlation',
);

const blob = JSON.stringify(result.fillDiagnostics);
assert(!blob.includes('secret-user'), 'no username value');
assert(!blob.includes('secret-pass'), 'no password value');
assert(!blob.includes('999'), 'no business_id value');
assert(!/"value"\s*:/.test(blob), 'no raw value key');

console.log('verifyPhase120A2ManagedFillDiagnostics: PASS (A2 + A2.1 + A2.2 + A2.3 + A2.4)');
