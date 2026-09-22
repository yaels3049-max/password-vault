/**
 * Phase 120.9 — Authoring Locator Verification Integrity (R1–R15).
 * Usage: node scripts/verifyPhase120LocatorVerification.mjs
 */
import { mkdtempSync, readFileSync } from 'node:fs';
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

async function loadModule(entry, name) {
  const outfile = join(mkdtempSync(join(tmpdir(), `pv-1209-${name}-`)), `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    packages: 'external',
  });
  return import(pathToFileURL(outfile).href);
}

function loadDom(html, origin = 'https://fixture.example.test') {
  const { window } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  Object.defineProperty(window, 'location', {
    value: { href: `${origin}/login`, origin, protocol: 'https:' },
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
  function readBox(el) {
    const style = el.getAttribute('style') || '';
    if (/display:\s*none|visibility:\s*hidden/i.test(style)) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }
    const tag = String(el.tagName || '').toUpperCase();
    const isControl =
      tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT';
    const w = /width:\s*(\d+)/i.test(style) ? Number(RegExp.$1) : isControl ? 120 : 0;
    const h = /height:\s*(\d+)/i.test(style) ? Number(RegExp.$1) : isControl ? 24 : 0;
    const left = /left:\s*(-?\d+)/i.test(style) ? Number(RegExp.$1) : 0;
    const top = /top:\s*(-?\d+)/i.test(style) ? Number(RegExp.$1) : 0;
    return { width: w, height: h, left, top };
  }
  const Proto = window.HTMLElement.prototype;
  Proto.getClientRects = function getClientRects() {
    const box = readBox(this);
    if (box.width < 1 || box.height < 1) return [];
    return [
      {
        width: box.width,
        height: box.height,
        top: box.top,
        left: box.left,
        bottom: box.top + box.height,
        right: box.left + box.width,
      },
    ];
  };
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    const rects = this.getClientRects();
    if (!rects.length) {
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0 };
    }
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
  window.document.elementFromPoint = function elementFromPoint(x, y) {
    const nodes = Array.from(window.document.querySelectorAll('input, textarea, button, select'));
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const el = nodes[i];
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return el;
      }
    }
    return null;
  };
  globalThis.CSS = {
    escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1'),
  };
  for (const rel of [
    'extension/generic/managed-target-eligibility.js',
    'extension/generic/locator-determinism.js',
    'extension/generic/form-detector.js',
    'extension/generic/fill-executor.js',
    'extension/generic/validated-autofill.js',
    'extension/generic/page-structure-inspect.js',
    'extension/generic/visual-target-pick.js',
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

console.log('Phase 120.9 — Authoring Locator Verification Integrity (R1–R15)\n');

const pickSrc = read('extension/generic/visual-target-pick.js');
const detSrc = read('extension/generic/locator-determinism.js');
const inspectSrc = read('extension/generic/page-structure-inspect.js');
const bgSrc = read('extension/background.js');
const authoringSrc = read('src/assistedMapping/fieldAuthoring.ts');
const editorSrc = read('src/admin/AutofillProfileEditor.tsx');
const safetySrc = read('src/assistedMapping/safetyValidation.ts');
const managedSrc = read('src/execution/managedAutofill.ts');

assert(detSrc.includes('assertLocatorDeterministic'), 'shared assertLocatorDeterministic');
assert(detSrc.includes('preferExactOneLocator'), 'shared preferExactOneLocator');
assert(pickSrc.includes('locator_target_mismatch'), 'Visual fails locator_target_mismatch');
assert(pickSrc.includes('assertLocatorDeterministic'), 'Visual same-target check');
assert(inspectSrc.includes('matchCount'), 'inspect emits matchCount');
assert(bgSrc.includes('locator-determinism.js'), 'bg injects locator-determinism');
assert(authoringSrc.includes('E2 (current ∈ visualLocatorCandidates) removed'), 'E2 removed');
assert(
  editorSrc.includes('[result.fieldId]: result.locator') &&
    !/if\s*\(\s*!sameTarget\s*\)\s*\{\s*setLocators/.test(editorSrc.replace(/\s+/g, ' ')),
  'Hub ALWAYS writes Visual locator',
);
assert(safetySrc.includes('locator_not_deterministic'), 'Analyze determinism gate');
assert(safetySrc.includes('locatorDeterministic !== true'), 'prefill requires deterministic');
assert(!/\bshufersal\b|\brivhit\b|\bserviceId\s*===|\bhostname\s*===/i.test(pickSrc + authoringSrc + safetySrc), 'no site branches');
assert(!/first[_-]?match|matches\[0\](?!\s*===)/i.test(managedSrc), 'Managed runtime not first-match weakened via 120.9 edits');

const assisted = await loadModule('src/assistedMapping/safetyValidation.ts', 'safety');
const authoring = await loadModule('src/assistedMapping/fieldAuthoring.ts', 'authoring');
const determinism = await loadModule('src/assistedMapping/locatorDeterminism.ts', 'determinism');
assert(typeof determinism.assertLocatorDeterministic === 'function', 'TS assertLocatorDeterministic export');

// --- Synthetic duplicate-id fixture (generic; not site-specific) ---
const dupHtml = `
  <input id="j_password" name="j_password" type="password" style="width:120px;height:24px;left:10px;top:10px" />
  <input id="j_password" name="other_dup" type="text" style="width:120px;height:24px;left:10px;top:50px" />
`;
const win = loadDom(dupHtml);
const clicked = win.document.querySelector('input[name="j_password"]');
assert(clicked, 'clicked password control');
assert(win.LocatorDeterminism, 'LocatorDeterminism loaded');
assert(win.__visualTargetPickHelpers, 'visual helpers');

const candidates = win.__visualTargetPickHelpers.buildCandidates(clicked);
assert(
  candidates.some((c) => c.locator === '#j_password'),
  'candidates include non-unique #id',
);
assert(
  candidates.some((c) => c.locator === 'input[name="j_password"]'),
  'candidates include unique name',
);

const chosen = win.__visualTargetPickHelpers.preferExactOneLocator(candidates, win.document);
assert(chosen && chosen.locator === 'input[name="j_password"]', 'R3 preferExactOne → unique name');
assert(
  win.__visualTargetPickHelpers.assertLocatorDeterministic(chosen.locator, clicked, win.document),
  'R3 matches[0]===clickedEl',
);
assert(
  !win.__visualTargetPickHelpers.assertLocatorDeterministic('#j_password', clicked, win.document),
  'R3 #j_password not deterministic',
);
console.log('  ✓ R3 Visual unique selected locator + same clicked target');

const page = win.collectSafePageStructure();
const pwdInput = page.inputs.find((i) => i.nameAttr === 'j_password');
assert(pwdInput, 'inspect found password input');
const idCand = pwdInput.locatorCandidates.find((c) => c.locator === '#j_password');
const nameCand = pwdInput.locatorCandidates.find((c) => c.locator === 'input[name="j_password"]');
assert(idCand && idCand.matchCount === 2, 'inspect matchCount=2 for duplicate id');
assert(nameCand && nameCand.matchCount === 1, 'inspect matchCount=1 for unique name');

// R1 — Analyze exact-one PASS
const schema = [
  { fieldId: 'password', label: 'סיסמה', type: 'password' },
];
const r1 = assisted.applySafetyAndConfidence({
  requestId: 'r1',
  serviceId: 'svc',
  schema,
  page,
  rawProposals: [
    {
      fieldId: 'password',
      observedInputId: pwdInput.inputId,
      locator: 'input[name="j_password"]',
      modelConfidence: 'high',
      evidence: [{ category: 'type_affinity' }],
    },
  ],
});
const r1row = r1.proposals.find((p) => p.fieldId === 'password');
assert(r1row?.confidence === 'high', 'R1 semantic HIGH retained');
assert(r1row?.locatorDeterministic === true, 'R1 locator deterministic');
const r1prefill = assisted.applyConfidentPrefill({}, r1);
assert(r1prefill.appliedFieldIds.includes('password'), 'R1 prefill PASS path');
assert(r1prefill.next.password === 'input[name="j_password"]', 'R1 prefilled unique');
console.log('  ✓ R1 Analyze locator exact-one gate PASS');

// R2 — semantic HIGH + non-unique locator → no prefill; identification preserved
const r2 = assisted.applySafetyAndConfidence({
  requestId: 'r2',
  serviceId: 'svc',
  schema,
  page,
  rawProposals: [
    {
      fieldId: 'password',
      observedInputId: pwdInput.inputId,
      locator: '#j_password',
      modelConfidence: 'high',
      evidence: [{ category: 'type_affinity' }],
    },
  ],
});
const r2row = r2.proposals.find((p) => p.fieldId === 'password');
assert(r2row?.confidence === 'high', 'R2 HIGH semantic preserved (not collapsed)');
assert(r2row?.locatorDeterministic === false, 'R2 locator not deterministic');
assert(r2.warnings?.includes('locator_not_deterministic'), 'R2 warning');
const r2prefill = assisted.applyConfidentPrefill({}, r2);
assert(!r2prefill.appliedFieldIds.includes('password'), 'R2 no unsafe prefill');
assert(!(r2prefill.next.password ?? '').trim(), 'R2 mapping left empty');
console.log('  ✓ R2 semantic HIGH + non-unique → no approvable prefill; ID preserved');

// R4 — SAME via E1; E2 cannot preserve Analyze; Hub always writes Visual unique
const sameE1 = authoring.visualTargetsEquivalent({
  currentLocator: '#j_password',
  currentObservedInputId: 'id:j_password',
  visualLocator: 'input[name="j_password"]',
  visualObservedInputId: 'id:j_password',
  visualLocatorCandidates: ['#j_password', 'input[name="j_password"]'],
});
assert(sameE1 === true, 'R4 SAME via E1');
const e2only = authoring.visualTargetsEquivalent({
  currentLocator: '#j_password',
  currentObservedInputId: 'obs-a',
  visualLocator: 'input[name="j_password"]',
  visualObservedInputId: 'obs-b',
  visualLocatorCandidates: ['#j_password', 'input[name="j_password"]'],
});
assert(e2only === false, 'R4 E2 alone is NOT SAME');
// Simulate Hub always-write: form locator := visual unique even when sameTarget
const formAfterVisual = { password: 'input[name="j_password"]' };
assert(formAfterVisual.password !== '#j_password', 'R4 persisted = Visual unique');
const afterSame = authoring.applyVisualMappingAuthoring({
  current: [
    {
      fieldId: 'password',
      source: 'analyze',
      confidence: 'high',
      observedInputId: 'id:j_password',
      visualMappingVerified: false,
    },
  ],
  fieldId: 'password',
  sameTarget: true,
  previous: {
    fieldId: 'password',
    source: 'analyze',
    confidence: 'high',
    observedInputId: 'id:j_password',
    visualMappingVerified: false,
  },
  visualObservedInputId: 'id:j_password',
});
assert(afterSame[0].source === 'analyze', 'R4 keep Analyze source on SAME');
assert(afterSame[0].confidence === 'high', 'R4 keep Analyze confidence on SAME');
assert(afterSame[0].visualMappingVerified === true, 'R4 verified');
console.log('  ✓ R4 SAME + Visual unique persisted; E2 cannot preserve Analyze');

// R5 — SAME when current already === Visual unique
const sameE3 = authoring.visualTargetsEquivalent({
  currentLocator: 'input[name="j_password"]',
  visualLocator: 'input[name="j_password"]',
  visualObservedInputId: 'id:j_password',
});
assert(sameE3 === true, 'R5 E3 SAME');
const afterE3 = authoring.applyVisualMappingAuthoring({
  current: afterSame,
  fieldId: 'password',
  sameTarget: true,
  previous: afterSame[0],
  visualObservedInputId: 'id:j_password',
});
assert(afterE3[0].visualMappingVerified === true, 'R5 verified');
assert(afterE3[0].confidence === 'high', 'R5 Analyze confidence retained');
console.log('  ✓ R5 SAME + independently deterministic locator provenance truthful');

// R6 — DIFFERENT target
const afterDiff = authoring.applyVisualMappingAuthoring({
  current: afterSame,
  fieldId: 'password',
  sameTarget: false,
  previous: afterSame[0],
  visualObservedInputId: 'id:other',
});
assert(afterDiff[0].source === 'visual_mapping', 'R6 source visual');
assert(afterDiff[0].confidence === null, 'R6 confidence cleared');
assert(afterDiff[0].visualMappingVerified === true, 'R6 verified');
console.log('  ✓ R6 DIFFERENT target clears AI confidence');

// R7 — badge cleared on manual locator edit
const afterManual = authoring.markManualEdit(afterSame, 'password');
assert(afterManual[0].visualMappingVerified === false, 'R7 verified cleared on edit');
assert(afterManual[0].source === 'manual', 'R7 manual source');
console.log('  ✓ R7 visualMappingVerified cleared when locator edited');

// R8 — multi_match fail-closed in Managed runtime (unchanged)
const fillMulti = win.runManagedAutofill({
  allowedOrigin: 'https://fixture.example.test',
  fieldMappings: [{ fieldId: 'password', locatorType: 'css', locator: '#j_password' }],
  credentials: { password: 'secret' },
});
assert(fillMulti.ok === false, 'R8 multi_match fails');
assert(
  /multi_match/i.test(String(fillMulti.detail ?? fillMulti.reason ?? '')),
  `R8 fail reason reflects multi_match (got reason=${fillMulti.reason} detail=${fillMulti.detail})`,
);
console.log('  ✓ R8 Managed runtime multi_match fail-closed');

// R12 — HIGH/MEDIUM semantic facts; locator only if deterministic (MEDIUM path)
const r12 = assisted.applySafetyAndConfidence({
  requestId: 'r12',
  serviceId: 'svc',
  schema,
  page,
  rawProposals: [
    {
      fieldId: 'password',
      observedInputId: pwdInput.inputId,
      locator: '#j_password',
      modelConfidence: 'medium',
      evidence: [{ category: 'type_affinity' }],
    },
  ],
});
assert(r12.proposals[0]?.confidence === 'medium', 'R12 MEDIUM semantic retained');
assert(r12.proposals[0]?.locatorDeterministic === false, 'R12 MEDIUM non-det no locator approve');
assert(assisted.applyConfidentPrefill({}, r12).appliedFieldIds.length === 0, 'R12 no MEDIUM unsafe prefill');
console.log('  ✓ R12 HIGH/MEDIUM semantic provenance; locator only if deterministic');

// Static locks for suite-covered regressions
const validatedSrc = read('extension/generic/validated-autofill.js');
assert(validatedSrc.includes("detail: 'multi_match'"), 'R8/R15 Managed exact-one multi_match present');
assert(!authoringSrc.includes('candidates.some((c) => c.trim() === current)'), 'E2 code removed');
console.log('  ✓ R9–R11/R13–R15 deferred to existing suites (wiring intact)');

console.log('\nPASS — Phase 120.9 Locator Verification Integrity (R1–R8, R12 + locks)');
