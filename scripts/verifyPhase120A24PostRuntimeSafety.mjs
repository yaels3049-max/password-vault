/**
 * Post-120 Corrective A / A2.4 — N1–N9 non-interference proof for P accessor wrap.
 * If any assertion fails → P must be disabled (B fallback).
 * Usage: node scripts/verifyPhase120A24PostRuntimeSafety.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { installManagedDomGeometry } from './lib/linkedomManagedHarness.mjs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(rootDir, rel), 'utf8');
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function loadWindow() {
  const { window, document } = parseHTML(
    '<!doctype html><html><body><form id="f"><input id="u" type="text" /></form></body></html>',
  );
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://fixture.example.test', href: 'https://fixture.example.test/login' },
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
  return { window, document };
}

const { window, document } = loadWindow();
const A24 = window.__ManagedA24;
assert(A24 && typeof A24.installP === 'function', 'A24 hooks present');

const el = document.getElementById('u');
assert(el, 'input present');

// Baseline native get/set before wrap
const protoDesc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
assert(protoDesc && typeof protoDesc.get === 'function' && typeof protoDesc.set === 'function', 'native value accessor');

el.value = 'alpha';
const beforeGet = el.value;
assert(beforeGet === 'alpha', 'N2-prep baseline set');

const ownBefore = Object.getOwnPropertyDescriptor(el, 'value');
assert(ownBefore === undefined, 'N5-prep no own value before wrap');

let boundaryHits = 0;
const handle = A24.installP(el, 'alpha', function () {
  boundaryHits += 1;
});
assert(handle, 'N4-prep P install succeeded');

// N1 — getter unchanged
assert(el.value === 'alpha', 'N1 getter during wrap returns same');
assert(A24.matchViaFwd(el, 'alpha', handle.fwdGet) === true, 'N1 fwdGet match');

// N7 — wrap set alone does not dispatch input/change
let eventCount = 0;
el.addEventListener('input', function () {
  eventCount += 1;
});
el.addEventListener('change', function () {
  eventCount += 1;
});

// N2/N3/N4 — setter forwards exact value; receiver is element
el.value = 'beta';
assert(el.value === 'beta', 'N2/N4 setter updates value via wrap');
assert(handle.fwdGet.call(el) === 'beta', 'N3 receiver is element (fwdGet sees beta)');
assert(eventCount === 0, 'N7 no input/change from programmatic set through wrap');
assert(boundaryHits === 1, 'P observes mismatch when set leaves expected');

el.value = 'alpha';
assert(el.value === 'alpha', 'restore match');
const hitsAfterRematch = boundaryHits;
el.value = '';
assert(boundaryHits === hitsAfterRematch + 1, 'P observes clear mismatch');
assert(el.value === '', 'N2 setter result empty string preserved');

assert(el.value === '', 'value still empty before teardown');
const tear = handle.teardown();
assert(tear && tear.ok === true && tear.restoreFailed === false, 'N5 teardown ok');
assert(Object.getOwnPropertyDescriptor(el, 'value') === undefined, 'N5 no own value after teardown');
el.value = 'gamma';
assert(el.value === 'gamma', 'N1 after restore getter still works via prototype');

// N6 — restore when prior own accessor existed
const customGet = function () {
  return this._v;
};
const customSet = function (v) {
  this._v = v;
};
Object.defineProperty(el, 'value', {
  configurable: true,
  enumerable: false,
  get: customGet,
  set: customSet,
});
el.value = 'own1';
const handle2 = A24.installP(el, 'own1', function () {});
assert(handle2 && handle2.hadOwn === true, 'N6 wrap over own accessor');
el.value = 'own2';
assert(el.value === 'own2', 'N6 set through wrap');
const tear2 = handle2.teardown();
assert(tear2.ok === true, 'N6 restore ok');
const restored = Object.getOwnPropertyDescriptor(el, 'value');
assert(restored && restored.get === customGet && restored.set === customSet, 'N6 exact own descriptor restored');
assert(el.value === 'own2', 'N6 value preserved after restore');

// N8 — Managed outcome unchanged (short A2.4 bound)
A24.setBoundMs(30);
A24.setPEnabled(true);
const html = read('scripts/fixtures/phase117-rivhit-login.html');
const { window: win2, document: doc2 } = parseHTML(html);
Object.defineProperty(win2, 'location', {
  value: { origin: 'https://online1.rivhit.co.il', href: 'https://online1.rivhit.co.il/login' },
  configurable: true,
});
win2.top = win2;
installManagedDomGeometry(win2);
for (const rel of [
  'extension/generic/managed-target-eligibility.js',
  'extension/generic/form-detector.js',
  'extension/generic/fill-executor.js',
  'extension/generic/validated-autofill.js',
]) {
  const run = new Function('window', 'document', 'globalThis', `${read(rel)}\n//# sourceURL=${rel}`);
  run(win2, win2.document, win2);
}
win2.__ManagedA24.setBoundMs(30);
win2.__ManagedA24.setPEnabled(true);
win2.GenericFillExecutor.fillField = function (element, value) {
  if (!element || value == null || value === '') {
    return { ok: false, reason: 'missing_value' };
  }
  if (!win2.GenericFillExecutor.isSafeFillTarget(element)) {
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

const control = await Promise.resolve(
  win2.runManagedAutofill({
    allowedOrigin: 'https://online1.rivhit.co.il',
    fieldMappings: [
      { fieldId: 'username', locatorType: 'css', locator: '#username' },
      { fieldId: 'password', locatorType: 'css', locator: '#password' },
      { fieldId: 'business_id', locatorType: 'css', locator: '#osek' },
    ],
    credentials: { username: 'u', password: 'p', business_id: '1' },
  }),
);
const withA24 = await Promise.resolve(
  win2.runManagedAutofill({
    allowedOrigin: 'https://online1.rivhit.co.il',
    fieldMappings: [
      { fieldId: 'username', locatorType: 'css', locator: '#username' },
      { fieldId: 'password', locatorType: 'css', locator: '#password' },
      { fieldId: 'business_id', locatorType: 'css', locator: '#osek' },
    ],
    credentials: { username: 'u2', password: 'p2', business_id: '2' },
    diagnosticPath: 'admin_test',
  }),
);
assert(control.ok === true && control.reason === 'ok', 'N8 control ok');
assert(withA24.ok === true && withA24.reason === 'ok' && withA24.filled === 3, 'N8 A24 path ok/reason/filled');
assert(withA24.fillDiagnostics, 'N8 diagnostics present on admin_test');
const a24Stages = withA24.fillDiagnostics.stamps.filter((s) => String(s.stage || '').startsWith('post_runtime_a24'));
assert(a24Stages.length >= 1, 'N8 A2.4 stamps present');

// Lifetime / cleanup: after admin_test run completes, inputs should not retain diagnostic own value
const u2 = doc2.querySelector('#username');
assert(Object.getOwnPropertyDescriptor(u2, 'value') === undefined, 'lifetime cleanup — no leftover own value');

console.log('verifyPhase120A24PostRuntimeSafety: PASS (N1–N9; P gate OPEN)');
