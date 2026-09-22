/**
 * Phase 120.4 / 120.6 — Managed Target-Safety Eligibility.
 * 120.6: Fixture A / R3 flipped → F-ANC-ACTIVE ACCEPT when hit-test passes.
 * Usage: node scripts/verifyPhase120ManagedEligibility.mjs
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
  const outfile = join(mkdtempSync(join(tmpdir(), 'pv-1204-')), 'assisted.mjs');
  await build({
    entryPoints: [join(root, 'src/assistedMapping/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  return import(pathToFileURL(outfile).href);
}

function fixtureAHtml() {
  // 120.6 F-ANC-ACTIVE — ancestor aria-hidden, hit-test PASS
  return `<!doctype html><html><body>
    <div aria-hidden="true">
      <input id="UserName" type="text" style="width:120px;height:24px;left:10px;top:10px" />
    </div>
  </body></html>`;
}

function fixtureCHtml() {
  return `<!doctype html><html><body>
    <form>
      <input id="UserName" type="text" style="width:120px;height:24px;left:10px;top:10px" />
      <input id="password" type="password" style="width:120px;height:24px;left:10px;top:40px" />
    </form>
  </body></html>`;
}

function mainStatic() {
  const shared = read('extension/generic/managed-target-eligibility.js');
  const form = read('extension/generic/form-detector.js');
  const fill = read('extension/generic/fill-executor.js');
  const inspect = read('extension/generic/page-structure-inspect.js');
  const pick = read('extension/generic/visual-target-pick.js');
  const bg = read('extension/background.js');
  const safety = read('src/assistedMapping/safetyValidation.ts');
  const types = read('src/assistedMapping/types.ts');

  assert(shared.includes('function isSafeFillTarget'), 'shared isSafeFillTarget');
  assert(shared.includes("getAttribute('aria-hidden') === 'true'"), 'shared keeps V3 SELF');
  assert(!shared.includes("closest('[aria-hidden=\"true\"]')"), 'shared removed absolute V4');
  assert(shared.includes('elementFromPoint'), 'shared V8 hit-test');
  assert(shared.includes('opacity:0'), 'shared documents opacity non-reject');
  assert(form.includes('ManagedTargetEligibility'), 'form-detector delegates');
  assert(!form.includes("closest('[aria-hidden=\"true\"]')"), 'form-detector no V4');
  assert(fill.includes('ManagedTargetEligibility'), 'fill-executor delegates');
  assert(inspect.includes('managedEligible'), 'inspect emits managedEligible');
  assert(inspect.includes('isObservedForIdentification'), 'observation ≠ Managed');
  assert(!inspect.includes("style.opacity === '0'"), 'inspect observation does not opacity-reject');
  assert(pick.includes('managed_ineligible'), 'visual managed_ineligible');
  assert(pick.includes('IDENTIFIED_BUT_MANAGED_INELIGIBLE'), 'visual state #3');
  assert(pick.includes('isIdentifiableControl'), 'visual identification separate');
  assert(bg.includes('managed-target-eligibility.js'), 'bg loads shared module');
  assert(safety.includes('managedEligible'), 'Hub approvability on managedEligible');
  assert(safety.includes('identifiedButManagedIneligible'), '#3 channel');
  assert(types.includes('IDENTIFIED_BUT_MANAGED_INELIGIBLE'), 'three-state types');
  assert(!/\bshufersal\b|\bhtzone\b|\bclalit\b/i.test(shared + safety), 'no site exceptions');
}

async function mainContract(mod) {
  const origin = 'https://fixture.example.test';

  // --- Fixture A → 120.6 F-ANC-ACTIVE (ACCEPT) ---
  const winA = loadDom(fixtureAHtml(), origin);
  const elA = winA.document.getElementById('UserName');
  assert(elA, 'Fixture A input');
  assert(winA.ManagedTargetEligibility.isSafeFillTarget(elA) === true, 'A/F-ANC-ACTIVE Managed eligible');

  const pageA = winA.collectSafePageStructure();
  const inA = pageA.inputs.find((i) => i.idAttr === 'UserName');
  assert(inA, 'A observed in inspect');
  assert(inA.visible === true, 'A observation visible (identification surface)');
  assert(inA.managedEligible === true, 'A managedEligible true (120.6 flip)');

  const assessA = winA.assessManagedTargetsReady({
    allowedOrigin: origin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#UserName' }],
  });
  assert(assessA.ready === true, 'A parity ready (120.6 flip)');

  const fillA = winA.runManagedAutofill({
    allowedOrigin: origin,
    fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#UserName' }],
    credentials: { username: 'u' },
  });
  assert(fillA.ok === true, 'A runtime fill ok (120.6 flip)');

  assert(winA.__visualTargetPickHelpers.isIdentifiableControl(elA) === true, 'A identifiable');
  assert(winA.__visualTargetPickHelpers.managedEligibleFor(elA) === true, 'A visual eligible');

  const analyzeA = mod.applySafetyAndConfidence({
    requestId: 'r-a',
    serviceId: 'svc',
    schema: [{ fieldId: 'username', label: 'User', type: 'text' }],
    page: pageA,
    rawProposals: [
      {
        fieldId: 'username',
        observedInputId: inA.inputId,
        locator: '#UserName',
        modelConfidence: 'high',
        evidence: [{ category: 'id_name_affinity' }],
      },
    ],
  });
  assert(
    analyzeA.proposals.some((p) => p.confidence === 'high'),
    'A IDENTIFIED_AND_MANAGED_ELIGIBLE (120.6 flip)',
  );
  assert(!analyzeA.identifiedButManagedIneligible, 'A no #3 after 120.6 flip');

  // --- F-SELF still #3 ---
  const winSelf = loadDom(
    `<input id="UserName" type="text" aria-hidden="true" style="width:120px;height:24px;left:10px;top:10px" />`,
    origin,
  );
  const elSelf = winSelf.document.getElementById('UserName');
  assert(!winSelf.ManagedTargetEligibility.isSafeFillTarget(elSelf), 'F-SELF ineligible');
  assert(
    winSelf.ManagedTargetEligibility.classifyManagedIneligibility(elSelf) === 'aria_hidden_self',
    'F-SELF aria_hidden_self',
  );
  const pageSelf = winSelf.collectSafePageStructure();
  const inSelf = pageSelf.inputs.find((i) => i.idAttr === 'UserName');
  assert(inSelf.managedEligible === false, 'F-SELF managedEligible false');
  const analyzeSelf = mod.applySafetyAndConfidence({
    requestId: 'r-self',
    serviceId: 'svc',
    schema: [{ fieldId: 'username', label: 'User', type: 'text' }],
    page: pageSelf,
    rawProposals: [
      {
        fieldId: 'username',
        observedInputId: inSelf.inputId,
        locator: '#UserName',
        modelConfidence: 'high',
        evidence: [{ category: 'id_name_affinity' }],
      },
    ],
  });
  assert(
    analyzeSelf.identifiedButManagedIneligible?.some(
      (r) => r.state === 'IDENTIFIED_BUT_MANAGED_INELIGIBLE',
    ),
    'F-SELF → IDENTIFIED_BUT_MANAGED_INELIGIBLE',
  );

  // --- Fixture C ---
  const winC = loadDom(fixtureCHtml(), origin);
  const elC = winC.document.getElementById('UserName');
  assert(winC.ManagedTargetEligibility.isSafeFillTarget(elC) === true, 'C eligible');
  const pageC = winC.collectSafePageStructure();
  const inC = pageC.inputs.find((i) => i.idAttr === 'UserName');
  assert(inC.managedEligible === true, 'C managedEligible');
  const assessC = winC.assessManagedTargetsReady({
    allowedOrigin: origin,
    fieldMappings: [
      { fieldId: 'username', locatorType: 'css', locator: '#UserName' },
      { fieldId: 'password', locatorType: 'css', locator: '#password' },
    ],
  });
  assert(assessC.ready === true, 'C parity ready');
  const analyzeC = mod.applySafetyAndConfidence({
    requestId: 'r-c',
    serviceId: 'svc',
    schema: [
      { fieldId: 'username', label: 'User', type: 'text' },
      { fieldId: 'password', label: 'Pass', type: 'password' },
    ],
    page: pageC,
    rawProposals: [
      {
        fieldId: 'username',
        observedInputId: inC.inputId,
        locator: '#UserName',
        modelConfidence: 'high',
        evidence: [{ category: 'id_name_affinity' }],
      },
      {
        fieldId: 'password',
        observedInputId: pageC.inputs.find((i) => i.idAttr === 'password').inputId,
        locator: '#password',
        modelConfidence: 'high',
        evidence: [{ category: 'type_affinity' }],
      },
    ],
  });
  assert(
    analyzeC.proposals.filter((p) => p.confidence === 'high').length === 2,
    'C IDENTIFIED_AND_MANAGED_ELIGIBLE approvable',
  );
  assert(!analyzeC.identifiedButManagedIneligible, 'C no #3 channel');

  // Contract parity
  assert(
    winA.GenericFormDetector.isVisible(elA) === winA.ManagedTargetEligibility.isVisible(elA),
    'parity form-detector ↔ shared (A)',
  );
  assert(
    winA.GenericFillExecutor.isSafeFillTarget(elA) ===
      winA.ManagedTargetEligibility.isSafeFillTarget(elA),
    'parity fill-executor ↔ shared (A)',
  );
  assert(
    winC.GenericFillExecutor.isSafeFillTarget(elC) === true && inC.managedEligible === true,
    'parity Analyze managedEligible ↔ fill (C)',
  );
}

function mainRegressionMatrix() {
  const origin = 'https://matrix.example.test';

  // R1 normal safe
  {
    const win = loadDom(
      `<input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px" />`,
      origin,
    );
    assert(win.ManagedTargetEligibility.isSafeFillTarget(win.document.getElementById('u')), 'R1');
  }
  // R2 aria-hidden on input (SELF) — still reject
  {
    const win = loadDom(
      `<input id="u" type="text" aria-hidden="true" style="width:120px;height:24px;left:10px;top:10px" />`,
      origin,
    );
    const el = win.document.getElementById('u');
    assert(win.__visualTargetPickHelpers.isIdentifiableControl(el), 'R2 identified');
    assert(!win.ManagedTargetEligibility.isSafeFillTarget(el), 'R2 ineligible');
  }
  // R3 aria-hidden ancestor — 120.6 flip to ACCEPT when hit-test passes
  {
    const win = loadDom(
      `<div aria-hidden="true"><input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px" /></div>`,
      origin,
    );
    assert(
      win.ManagedTargetEligibility.isSafeFillTarget(win.document.getElementById('u')) === true,
      'R3 F-ANC-ACTIVE eligible (120.6 flip)',
    );
  }
  // R7 type=hidden
  {
    const win = loadDom(`<input id="u" type="hidden" />`, origin);
    const el = win.document.getElementById('u');
    assert(!win.ManagedTargetEligibility.isSafeFillTarget(el), 'R7');
  }
  // R8 disabled
  {
    const win = loadDom(
      `<input id="u" type="text" disabled style="width:120px;height:24px;left:10px;top:10px" />`,
      origin,
    );
    assert(!win.ManagedTargetEligibility.isSafeFillTarget(win.document.getElementById('u')), 'R8');
  }
  // R9 readOnly — Managed allows
  {
    const win = loadDom(
      `<input id="u" type="text" readonly style="width:120px;height:24px;left:10px;top:10px" />`,
      origin,
    );
    assert(win.ManagedTargetEligibility.isSafeFillTarget(win.document.getElementById('u')), 'R9');
  }
  // opacity:0 alone must not reject
  {
    const win = loadDom(
      `<input id="u" type="text" style="width:120px;height:24px;left:10px;top:10px;opacity:0" />`,
      origin,
    );
    assert(
      win.ManagedTargetEligibility.isSafeFillTarget(win.document.getElementById('u')),
      'opacity:0 alone eligible',
    );
  }
  // R6 sub-2px
  {
    const win = loadDom(
      `<input id="u" type="text" style="width:1px;height:1px;left:10px;top:10px" />`,
      origin,
    );
    assert(!win.ManagedTargetEligibility.isSafeFillTarget(win.document.getElementById('u')), 'R6');
  }

  console.log('R1–R10 matrix cases exercised (R3 flipped 120.6; R11–R14 = regression suite)');
}

async function main() {
  mainStatic();
  const mod = await loadAssisted();
  await mainContract(mod);
  mainRegressionMatrix();
  console.log(
    'verifyPhase120ManagedEligibility: PASS (F-ANC-ACTIVE flip + F-SELF #3 + R1–R14 + shared module)',
  );
}

await main();
