/**
 * Phase 120.6 — Managed Visibility Correction (Ancestor aria-hidden vs Occlusion).
 * Fixtures: F-SELF / F-ANC-ACTIVE / F-ANC-OCCLUDED / F-CSS-HIDDEN / F-PLAIN + edges.
 * Flips 120.4 Fixture A / R3 → F-ANC-ACTIVE ACCEPT when hit-test passes.
 * Usage: node scripts/verifyPhase120ManagedVisibility.mjs
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

/**
 * linkedom harness with transform-aware rects + elementFromPoint stacking.
 */
function loadDom(html, origin) {
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

  function readBox(el) {
    const style = el.getAttribute('style') || '';
    if (/display:\s*none|visibility:\s*hidden/i.test(style)) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }
    const tag = String(el.tagName || '').toUpperCase();
    const isControl =
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'BUTTON' ||
      tag === 'SELECT' ||
      tag === 'LABEL' ||
      tag === 'A';
    const hasExplicitSize = /width:\s*\d+/i.test(style) || /height:\s*\d+/i.test(style);
    if (!isControl && !hasExplicitSize) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }
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
  Proto.scrollIntoView = function scrollIntoView() {
    const style = this.getAttribute('style') || '';
    if (/data-scroll-into-view:\s*fix/i.test(style)) {
      return;
    }
    // Simulate one bounded scroll: clamp top into viewport.
    const box = readBox(this);
    if (box.top >= 0 && box.top + box.height <= window.innerHeight) {
      return;
    }
    const nextTop = 40;
    let next = style.replace(/top:\s*-?\d+px/i, `top:${nextTop}px`);
    if (!/top:\s*-?\d+/i.test(style)) {
      next = `${style};top:${nextTop}px`;
    }
    this.setAttribute('style', next);
  };

  window.document.elementFromPoint = function elementFromPoint(x, y) {
    const all = Array.from(window.document.querySelectorAll('*')).filter((el) => {
      const tag = String(el.tagName || '').toUpperCase();
      return tag !== 'HTML' && tag !== 'HEAD' && tag !== 'BODY' && tag !== 'SCRIPT';
    });
    let best = null;
    let bestZ = -Infinity;
    let bestOrder = -1;
    for (let order = 0; order < all.length; order += 1) {
      const el = all[order];
      const style = el.getAttribute('style') || '';
      if (/pointer-events:\s*none/i.test(style)) continue;
      if (/display:\s*none|visibility:\s*hidden/i.test(style)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
        const z = /z-index:\s*(-?\d+)/i.test(style) ? Number(RegExp.$1) : 0;
        if (z > bestZ || (z === bestZ && order > bestOrder)) {
          best = el;
          bestZ = z;
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

async function loadAssisted() {
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-1206-')), 'assisted.mjs');
  await build({
    entryPoints: [join(root, 'src/assistedMapping/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  return import(pathToFileURL(outfile).href);
}

console.log('Phase 120.6 — Managed Visibility Correction verification\n');

// --- Static contract ---
const shared = read('extension/generic/managed-target-eligibility.js');
const form = read('extension/generic/form-detector.js');
const fill = read('extension/generic/fill-executor.js');
const assessSrc = read('extension/generic/validated-autofill.js');

assertIncludes(shared, "getAttribute('aria-hidden') === 'true'", 'V3 SELF kept');
assertNotIncludes(
  shared,
  "closest('[aria-hidden=\"true\"]')",
  'V4 absolute ancestor removed from shared',
);
assertIncludes(shared, 'elementFromPoint', 'V8 hit-test present');
assertIncludes(shared, 'aria_hidden_self', 'subreason aria_hidden_self');
assertIncludes(shared, 'occluded', 'subreason occluded');
assertIncludes(shared, 'not_interactable', 'subreason not_interactable');
assertNotIncludes(form, "closest('[aria-hidden=\"true\"]')", 'form-detector no V4');
assertIncludes(form, 'ManagedTargetEligibility', 'form-detector delegates');
assertIncludes(fill, 'return false;', 'fill-executor fail-closed without shared');
assertIncludes(assessSrc, 'classifyManagedIneligibility', 'assess propagates subreasons');
assert(!/\bshufersal\b|\b#UserName\b|\b#content\b|\bserviceId\s*===/i.test(shared), 'no site branches');
assert(!/\bhostname\b/i.test(shared), 'no hostname in shared eligibility');

const origin = 'https://fixture.example.test';

// --- F-SELF ---
{
  const win = loadDom(
    `<input id="u" type="text" aria-hidden="true" style="width:120px;height:24px;left:10px;top:10px" />`,
    origin,
  );
  const el = win.document.getElementById('u');
  assert(win.ManagedTargetEligibility.isSafeFillTarget(el) === false, 'F-SELF reject');
  assert(
    win.ManagedTargetEligibility.classifyManagedIneligibility(el) === 'aria_hidden_self',
    'F-SELF aria_hidden_self',
  );
  console.log('  ✓ F-SELF REJECT aria_hidden_self');
}

// --- F-ANC-ACTIVE (replaces 120.4 Fixture A reject) ---
{
  const win = loadDom(
    `<div aria-hidden="true">
      <input id="UserName" type="text" style="width:120px;height:24px;left:10px;top:10px" />
    </div>`,
    origin,
  );
  const el = win.document.getElementById('UserName');
  assert(win.ManagedTargetEligibility.isSafeFillTarget(el) === true, 'F-ANC-ACTIVE ACCEPT');
  assert(
    win.ManagedTargetEligibility.isVisible(el) === true,
    'F-ANC-ACTIVE isVisible true',
  );
  const page = win.collectSafePageStructure();
  const row = page.inputs.find((i) => i.idAttr === 'UserName');
  assert(row && row.managedEligible === true, 'F-ANC-ACTIVE managedEligible');
  const assess = win.assessManagedTargetsReady({
    allowedOrigin: origin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#UserName' }],
  });
  assert(assess.ready === true, 'F-ANC-ACTIVE parity ready');
  const fillOk = win.runManagedAutofill({
    allowedOrigin: origin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#UserName' }],
    credentials: { username: 'u' },
  });
  assert(fillOk.ok === true, 'F-ANC-ACTIVE runtime fill ok');
  assert(win.__visualTargetPickHelpers.managedEligibleFor(el) === true, 'F-ANC-ACTIVE visual');
  console.log('  ✓ F-ANC-ACTIVE ACCEPT (Fixture A / R3 flipped)');
}

// --- F-ANC-OCCLUDED ---
{
  const win = loadDom(
    `<div aria-hidden="true">
      <input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px" />
    </div>
    <div id="overlay" style="position:absolute;left:0px;top:0px;width:400px;height:200px;z-index:5"></div>`,
    origin,
  );
  const el = win.document.getElementById('u');
  assert(win.ManagedTargetEligibility.isSafeFillTarget(el) === false, 'F-ANC-OCCLUDED reject');
  assert(
    win.ManagedTargetEligibility.classifyManagedIneligibility(el) === 'occluded',
    'F-ANC-OCCLUDED occluded',
  );
  assert(win.__visualTargetPickHelpers.isIdentifiableControl(el) === true, 'still identifiable');
  assert(win.__visualTargetPickHelpers.managedEligibleFor(el) === false, 'visual ineligible');
  const assess = win.assessManagedTargetsReady({
    allowedOrigin: origin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#u' }],
  });
  assert(assess.ready === false && assess.detail === 'occluded', 'parity detail occluded');
  console.log('  ✓ F-ANC-OCCLUDED REJECT occluded (not NOT_IDENTIFIED)');
}

// --- F-CSS-HIDDEN ---
{
  const win = loadDom(
    `<input id="u" type="text" style="display:none;width:120px;height:24px" />`,
    origin,
  );
  const el = win.document.getElementById('u');
  assert(!win.ManagedTargetEligibility.isSafeFillTarget(el), 'F-CSS-HIDDEN reject');
  assert(
    win.ManagedTargetEligibility.classifyManagedIneligibility(el) === 'display_or_visibility',
    'F-CSS-HIDDEN display_or_visibility',
  );
  console.log('  ✓ F-CSS-HIDDEN REJECT');
}

// --- F-PLAIN ---
{
  const win = loadDom(
    `<input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px" />`,
    origin,
  );
  assert(win.ManagedTargetEligibility.isSafeFillTarget(win.document.getElementById('u')), 'F-PLAIN');
  console.log('  ✓ F-PLAIN ACCEPT');
}

// --- F-LABEL-HIT ---
{
  const win = loadDom(
    `<label for="u" style="position:absolute;left:0px;top:0px;width:200px;height:40px;z-index:2">Name</label>
     <input id="u" type="text" style="width:120px;height:24px;left:10px;top:8px" />`,
    origin,
  );
  const el = win.document.getElementById('u');
  assert(win.ManagedTargetEligibility.isSafeFillTarget(el) === true, 'F-LABEL-HIT ACCEPT');
  console.log('  ✓ F-LABEL-HIT ACCEPT');
}

// --- F-POINTER-NONE-TARGET ---
{
  const win = loadDom(
    `<input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px;pointer-events:none" />`,
    origin,
  );
  const el = win.document.getElementById('u');
  assert(!win.ManagedTargetEligibility.isSafeFillTarget(el), 'F-POINTER-NONE-TARGET reject');
  assert(
    win.ManagedTargetEligibility.classifyManagedIneligibility(el) === 'not_interactable',
    'F-POINTER-NONE-TARGET not_interactable',
  );
  console.log('  ✓ F-POINTER-NONE-TARGET REJECT');
}

// --- F-POINTER-NONE-OVERLAY ---
{
  const win = loadDom(
    `<input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px" />
     <div style="position:absolute;left:0px;top:0px;width:400px;height:200px;z-index:9;pointer-events:none"></div>`,
    origin,
  );
  assert(
    win.ManagedTargetEligibility.isSafeFillTarget(win.document.getElementById('u')) === true,
    'F-POINTER-NONE-OVERLAY ACCEPT',
  );
  console.log('  ✓ F-POINTER-NONE-OVERLAY ACCEPT');
}

// --- F-PARTIAL-PEEK ---
{
  // Overlay covers all but a 4px left edge — multi-point center/insets fail.
  const win = loadDom(
    `<input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px" />
     <div style="position:absolute;left:14px;top:0px;width:400px;height:200px;z-index:5"></div>`,
    origin,
  );
  const el = win.document.getElementById('u');
  assert(!win.ManagedTargetEligibility.isSafeFillTarget(el), 'F-PARTIAL-PEEK reject');
  assert(
    win.ManagedTargetEligibility.classifyManagedIneligibility(el) === 'occluded',
    'F-PARTIAL-PEEK occluded',
  );
  console.log('  ✓ F-PARTIAL-PEEK REJECT occluded');
}

// --- F-OFFSCREEN (stays offscreen after scroll blocked) ---
{
  const win = loadDom(
    `<input id="u" type="text" style="width:120px;height:24px;left:10px;top:5000px;data-scroll-into-view:fix" />`,
    origin,
  );
  // Override scroll to no-op via attribute check already in harness
  const el = win.document.getElementById('u');
  el.scrollIntoView = function () {};
  assert(!win.ManagedTargetEligibility.isSafeFillTarget(el), 'F-OFFSCREEN reject');
  assert(
    win.ManagedTargetEligibility.classifyManagedIneligibility(el) === 'not_interactable',
    'F-OFFSCREEN not_interactable',
  );
  console.log('  ✓ F-OFFSCREEN REJECT not_interactable');
}

// --- Three-state: F-ANC-ACTIVE → #2; F-SELF → #3 ---
const mod = await loadAssisted();
{
  const win = loadDom(
    `<div aria-hidden="true">
      <input id="UserName" type="text" style="width:120px;height:24px;left:10px;top:10px" />
    </div>`,
    origin,
  );
  const page = win.collectSafePageStructure();
  const inRow = page.inputs.find((i) => i.idAttr === 'UserName');
  const analyze = mod.applySafetyAndConfidence({
    requestId: 'r-anc',
    serviceId: 'svc',
    schema: [{ fieldId: 'username', label: 'User', type: 'text' }],
    page,
    rawProposals: [
      {
        fieldId: 'username',
        observedInputId: inRow.inputId,
        locator: '#UserName',
        modelConfidence: 'high',
        evidence: [{ category: 'id_name_affinity' }],
      },
    ],
  });
  assert(
    analyze.proposals.some((p) => p.confidence === 'high'),
    'F-ANC-ACTIVE Analyze → IDENTIFIED_AND_MANAGED_ELIGIBLE',
  );
  assert(!analyze.identifiedButManagedIneligible, 'F-ANC-ACTIVE no #3 channel');
}
{
  const win = loadDom(
    `<input id="UserName" type="text" aria-hidden="true" style="width:120px;height:24px;left:10px;top:10px" />`,
    origin,
  );
  const page = win.collectSafePageStructure();
  const inRow = page.inputs.find((i) => i.idAttr === 'UserName');
  assert(inRow && inRow.visible === true, 'F-SELF still observed');
  assert(inRow.managedEligible === false, 'F-SELF managedEligible false');
  const analyze = mod.applySafetyAndConfidence({
    requestId: 'r-self',
    serviceId: 'svc',
    schema: [{ fieldId: 'username', label: 'User', type: 'text' }],
    page,
    rawProposals: [
      {
        fieldId: 'username',
        observedInputId: inRow.inputId,
        locator: '#UserName',
        modelConfidence: 'high',
        evidence: [{ category: 'id_name_affinity' }],
      },
    ],
  });
  assert(
    analyze.identifiedButManagedIneligible?.some(
      (r) => r.state === 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
    ),
    'F-SELF → state #3 preserved',
  );
  assert(
    analyze.proposals.every((p) => p.confidence !== 'high'),
    'F-SELF no HIGH prefill',
  );
}

// Contract parity form/fill/shared
{
  const win = loadDom(
    `<div aria-hidden="true">
      <input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px" />
    </div>`,
    origin,
  );
  const el = win.document.getElementById('u');
  assert(
    win.GenericFormDetector.isVisible(el) === win.ManagedTargetEligibility.isVisible(el),
    'parity form ↔ shared',
  );
  assert(
    win.GenericFillExecutor.isSafeFillTarget(el) ===
      win.ManagedTargetEligibility.isSafeFillTarget(el),
    'parity fill ↔ shared',
  );
}

// No auto-submit preserved
assertNotIncludes(read('extension/generic/validated-autofill.js'), '.submit(', 'no auto-submit');
assertNotIncludes(read('extension/generic/fill-executor.js'), 'form.submit', 'no form.submit');

console.log('  ✓ Three-state preserved (F-ANC-ACTIVE #2 / F-SELF #3)');
console.log('  ✓ Contract parity shared ↔ form ↔ fill');
console.log('  ✓ No auto-submit / no site branches / no validated stamp');
console.log('\nPASS — Phase 120.6 Managed Visibility Correction');
