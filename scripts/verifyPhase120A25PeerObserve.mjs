/**
 * Post-120 Corrective A / A2.5 — peer observe + onStageProbe safety (N1–N14).
 * Usage: node scripts/verifyPhase120A25PeerObserve.mjs
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

const fillSrc = read('extension/generic/fill-executor.js');
assert(fillSrc.includes('function fillField(element, value, isSecret)'), 'N12-static fillField 3-arg fixture preserved');
assert(fillSrc.includes('var activeStageProbe = null'), 'N12-static active probe slot');
assert(fillSrc.includes("typeof onStageProbe !== 'function'"), 'N1-static absent no-op');
assert(fillSrc.includes('dispatchInputEvents(element, expected)'), 'N1-static A2 call site preserved');
assert(
  !/await onStageProbe|Promise\.|requestAnimationFrame\(onStage|queueMicrotask\(onStage|setTimeout\(onStage/.test(
    fillSrc,
  ),
  'N12 no async in probe path',
);
assert(!/leumi|Leumi|hostname|serviceId|bank/.test(fillSrc), 'N13 no site logic in fill-executor');

// N3-static: notify only after existing stage actions (order preserved)
const dispatchStart = fillSrc.indexOf('function dispatchInputEvents(element, expectedTrim');
const dispatchFn = fillSrc.slice(dispatchStart, fillSrc.indexOf('function readValue', dispatchStart));
const orderKeys = [
  "new InputEvent('beforeinput'",
  "record('fill_post_beforeinput')",
  "notify('fill_post_beforeinput')",
  "new InputEvent('input'",
  "record('fill_post_input')",
  "notify('fill_post_input')",
  "new Event('change'",
  "record('fill_post_change')",
  "notify('fill_post_change')",
  "new KeyboardEvent('keyup'",
  "record('fill_post_keyup')",
  "notify('fill_post_keyup')",
];
let cursor = -1;
for (const key of orderKeys) {
  const at = dispatchFn.indexOf(key);
  assert(at > cursor, `N3-static order: ${key}`);
  cursor = at;
}
const fillFnStart = fillSrc.indexOf('function fillField(element, value, isSecret)');
const fillFn = fillSrc.slice(fillFnStart, fillSrc.indexOf('function verifyMappings', fillFnStart));
assert(fillFnStart >= 0, 'fillField present');
assert(fillFn.indexOf('element.focus()') < fillFn.indexOf("notify('fill_post_native_set')"), 'N3 focus before probe');
assert(
  fillFn.indexOf('setNativeInputValue(element, value)') < fillFn.indexOf("notify('fill_post_native_set')"),
  'N2 write before probe',
);
assert(
  fillFn.indexOf("new Event('blur'") < fillFn.indexOf("notify('fill_post_blur')"),
  'N4 blur before probe',
);
assert(fillFn.includes('catch (_probeErr)'), 'N8 fail-open catch');
assert(fillFn.includes('arguments.length > 3'), 'optional 4th arg via arguments');
assert(fillFn.includes('activeStageProbe'), 'probe slot wired in fillField');
assert(fillFn.includes('dispatchInputEvents(element, expected)'), 'A2 call site unchanged');

const validatedSrc = read('extension/generic/validated-autofill.js');
assert(validatedSrc.includes("bag.path === 'admin_test'"), 'path isolation admin_test');
assert(validatedSrc.includes("bag.path === 'digital_home'"), 'path isolation digital_home');
assert(validatedSrc.includes('peer_observe'), 'peer_observe stage');
assert(validatedSrc.includes('peer_first_observed_loss_boundary'), 'loss boundary stage');
assert(validatedSrc.includes('observed_adjacency_only'), 'epistemics');
assert(validatedSrc.includes('makePeerStageProbe'), 'caller-side probe factory');
assert(!/leumi|Leumi/.test(validatedSrc), 'N13 no Leumi in validated-autofill peer path');

function loadDom(html, origin) {
  const { window, document } = parseHTML(html);
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
  return { window, document };
}

const origin = 'https://fixture.example.test';
const html =
  '<!doctype html><html><body><form>' +
  '<input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px" />' +
  '<input id="p" type="password" style="width:120px;height:24px;left:10px;top:40px" />' +
  '</form></body></html>';

const { window, document } = loadDom(html, origin);

// Unit-level: isolate onStageProbe fail-open without relying on linkedom InputEvent
const el = document.getElementById('u');
const peerEl = document.getElementById('p');
peerEl.value = 'peer-held';
const realDispatch = el.dispatchEvent.bind(el);
const dispatched = [];
el.dispatchEvent = function (evt) {
  dispatched.push(evt && evt.type ? evt.type : 'unknown');
  return true;
};
let focusNoProbe = 0;
let blurNoProbe = 0;
el.addEventListener('focus', () => {
  focusNoProbe += 1;
});
el.addEventListener('blur', () => {
  blurNoProbe += 1;
});

const r0 = window.GenericFillExecutor.fillField(el, 'alpha', false);
assert(r0.ok === true, 'baseline fill ok');
assert(el.value === 'alpha', 'N2 baseline write');
const baselineFocus = focusNoProbe;
const baselineBlur = blurNoProbe;
const baselineDispatch = dispatched.slice();
const peerAfterBaseline = peerEl.value;

el.value = '';
dispatched.length = 0;
focusNoProbe = 0;
blurNoProbe = 0;
let probeCalls = 0;
const r1 = window.GenericFillExecutor.fillField(el, 'beta', false, function (stage) {
  probeCalls += 1;
  if (stage === 'fill_post_input') {
    throw new Error('forced probe failure');
  }
  return { shouldNotAffect: true, ok: false };
});
assert(r1.ok === true, 'N8/N11 fill still ok despite throw + return');
assert(el.value === 'beta', 'N2 same target write with probe');
assert(peerEl.value === peerAfterBaseline, 'N7 probe path did not write peer');
assert(probeCalls >= 5, 'probe invoked after stages');
assert(JSON.stringify(dispatched) === JSON.stringify(baselineDispatch), 'N3 event types/order');
assert(focusNoProbe === baselineFocus && blurNoProbe === baselineBlur, 'N4 focus/blur counts');
el.dispatchEvent = realDispatch;

// N7 unit: peer read-only observe path never writes peer (managed stub)
const rivhitHtml = read('scripts/fixtures/phase117-rivhit-login.html');
const { window: win2, document: doc2 } = loadDom(rivhitHtml, 'https://online1.rivhit.co.il');

function installFillStub(win, { throwOnProbe = false } = {}) {
  win.GenericFillExecutor.fillField = function (element, value, _isSecret, onStageProbe) {
    if (!element || value == null || value === '') {
      return { ok: false, reason: 'missing_value' };
    }
    if (!win.GenericFillExecutor.isSafeFillTarget(element)) {
      return { ok: false, reason: 'hidden_or_unsafe_target' };
    }
    element.value = String(value);
    const stages = [
      'fill_post_native_set',
      'fill_post_beforeinput',
      'fill_post_input',
      'fill_post_change',
      'fill_post_keyup',
      'fill_post_events',
      'fill_post_blur',
    ];
    for (const s of stages) {
      if (typeof onStageProbe === 'function') {
        try {
          onStageProbe(s);
        } catch (_e) {
          if (throwOnProbe) {
            // swallowed like real executor
          }
        }
      }
    }
    const matched = String(element.value || '').trim() === String(value).trim();
    return {
      ok: true,
      verified: true,
      actual: String(value),
      fillStageMatches: Object.fromEntries(stages.map((s) => [s, matched])),
    };
  };
}

installFillStub(win2);

const mappings = [
  { fieldId: 'username', locatorType: 'css', locator: '#username' },
  { fieldId: 'password', locatorType: 'css', locator: '#password' },
  { fieldId: 'business_id', locatorType: 'css', locator: '#osek' },
];
const creds = { username: 'secret-user', password: 'secret-pass', business_id: '999' };

const noDiag = await Promise.resolve(
  win2.runManagedAutofill({
    allowedOrigin: 'https://online1.rivhit.co.il',
    fieldMappings: mappings,
    credentials: creds,
  }),
);
assert(noDiag.ok === true && noDiag.reason === 'ok' && noDiag.filled === 3, 'N6 no-diag outcome');
const peersOff = (noDiag.fillDiagnostics?.stamps || []).filter((s) => s.stage === 'peer_observe');
assert(peersOff.length === 0, 'N1 path isolation — no peer_observe without approved path');

const orderNoDiag = (noDiag.fillDiagnostics?.stamps || [])
  .filter((s) => s.stage === 'pre_fill')
  .map((s) => s.fieldId);

const withDiag = await Promise.resolve(
  win2.runManagedAutofill({
    allowedOrigin: 'https://online1.rivhit.co.il',
    fieldMappings: mappings,
    credentials: { username: 'u2', password: 'p2', business_id: '2' },
    diagnosticPath: 'admin_test',
  }),
);
assert(withDiag.ok === true && withDiag.reason === 'ok' && withDiag.filled === 3, 'N6 diag outcome');
assert(withDiag.reason === noDiag.reason && withDiag.filled === noDiag.filled, 'N6 identical Managed outcome shape');

const orderDiag = withDiag.fillDiagnostics.stamps
  .filter((s) => s.stage === 'pre_fill')
  .map((s) => s.fieldId);
assert(JSON.stringify(orderDiag) === JSON.stringify(orderNoDiag), 'N5 identical field fill order');

const peers = withDiag.fillDiagnostics.stamps.filter((s) => s.stage === 'peer_observe');
assert(peers.length > 0, 'peer_observe present on admin_test');
assert(
  peers.every((s) => s.activeFieldId && s.peerFieldId && s.observingActiveStage),
  'A2.5 schema fields',
);
assert(
  peers.every((s) => s.epistemics === 'observed_adjacency_only'),
  'epistemics adjacency only',
);
assert(
  peers.every((s) => s.peerFieldId !== s.activeFieldId),
  'peer is prior filled field only',
);

// N7 — peer observation: username held value unchanged while password stages observed
const userEl = doc2.querySelector('#username');
const passEl = doc2.querySelector('#password');
assert(userEl && passEl, 'rivhit fields present');
const userAfter = String(userEl.value || '');
assert(userAfter === 'u2', 'N7 username still holds filled value after peer observes during password');

const blob = JSON.stringify(withDiag.fillDiagnostics);
assert(!blob.includes('secret-user') && !blob.includes('secret-pass'), 'N9 no secrets from first run');
assert(!blob.includes('u2') && !blob.includes('p2'), 'N9 no diag credential strings');

// digital_home enables; unknown does not
const { window: win3 } = loadDom(rivhitHtml, 'https://online1.rivhit.co.il');
installFillStub(win3);
const dh = await Promise.resolve(
  win3.runManagedAutofill({
    allowedOrigin: 'https://online1.rivhit.co.il',
    fieldMappings: mappings,
    credentials: { username: 'a', password: 'b', business_id: '1' },
    diagnosticPath: 'digital_home',
  }),
);
assert((dh.fillDiagnostics.stamps || []).some((s) => s.stage === 'peer_observe'), 'digital_home peers on');

const { window: win4 } = loadDom(rivhitHtml, 'https://online1.rivhit.co.il');
installFillStub(win4);
const unk = await Promise.resolve(
  win4.runManagedAutofill({
    allowedOrigin: 'https://online1.rivhit.co.il',
    fieldMappings: mappings,
    credentials: { username: 'a', password: 'b', business_id: '1' },
    diagnosticPath: 'unknown',
  }),
);
assert(
  !(unk.fillDiagnostics.stamps || []).some((s) => s.stage === 'peer_observe'),
  'unknown path peers off',
);

// firstObservedLossBoundary — synthetic true→false on peer during active fill
const { window: win5, document: doc5 } = loadDom(rivhitHtml, 'https://online1.rivhit.co.il');
installFillStub(win5);
let stageHit = 0;
const origStub = win5.GenericFillExecutor.fillField;
win5.GenericFillExecutor.fillField = function (element, value, isSecret, onStageProbe) {
  if (element && element.id === 'password' && typeof onStageProbe === 'function') {
    const wrapped = function (stage) {
      stageHit += 1;
      const u = doc5.querySelector('#username');
      if (stage === 'fill_post_input' && u) {
        u.value = '';
      }
      onStageProbe(stage);
      // Restore after boundary observation so Managed verify still succeeds (N6).
      if (stage === 'fill_post_blur' && u) {
        u.value = 'hold';
      }
    };
    return origStub(element, value, isSecret, wrapped);
  }
  return origStub(element, value, isSecret, onStageProbe);
};
const lossRun = await Promise.resolve(
  win5.runManagedAutofill({
    allowedOrigin: 'https://online1.rivhit.co.il',
    fieldMappings: mappings,
    credentials: { username: 'hold', password: 'pw', business_id: '1' },
    diagnosticPath: 'admin_test',
  }),
);
assert(lossRun.ok === true, 'loss-run fill ok');
const boundaries = (lossRun.fillDiagnostics.stamps || []).filter(
  (s) => s.stage === 'peer_first_observed_loss_boundary',
);
assert(boundaries.length >= 1, 'firstObservedLossBoundary emitted');
assert(
  boundaries.every(
    (s) =>
      s.epistemics === 'observed_adjacency_only' &&
      typeof s.firstObservedLossBoundary === 'string' &&
      s.firstObservedLossBoundary.includes('at-or-before'),
  ),
  'adjacency wording only',
);
assert(stageHit > 0, 'password stages probed');

// Example synthetic schema (non-secret)
const example = peers.find((s) => s.observingActiveStage === 'fill_post_native_set');
assert(example, 'example stage present');
console.log(
  'A2.5 example stamp:',
  JSON.stringify(
    {
      stage: example.stage,
      peerFieldId: example.peerFieldId,
      activeFieldId: example.activeFieldId,
      observingActiveStage: example.observingActiveStage,
      expectedValueMatchHeld: example.expectedValueMatchHeld,
      expectedValueMatchCurrent: example.expectedValueMatchCurrent,
      epistemics: example.epistemics,
      probeFailed: example.probeFailed,
    },
    null,
    2,
  ),
);
const exampleBoundary = boundaries[0];
console.log(
  'A2.5 example boundary:',
  JSON.stringify(
    {
      stage: exampleBoundary.stage,
      peerFieldId: exampleBoundary.peerFieldId,
      activeFieldId: exampleBoundary.activeFieldId,
      firstObservedLossBoundary: exampleBoundary.firstObservedLossBoundary,
      epistemics: exampleBoundary.epistemics,
    },
    null,
    2,
  ),
);

console.log('verifyPhase120A25PeerObserve: PASS (N1–N13 structural + runtime; N10/N14 via suite)');
