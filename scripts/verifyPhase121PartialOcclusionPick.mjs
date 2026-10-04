/**
 * Phase 121 D-121-71 — Managed hit test passes on center + ≥3 in-view points (an element over an
 * edge of the field no longer blocks it), and a Visual click on an element over exactly one fillable
 * input maps that input (STANDARD + SPECIAL). Synthetic fixtures only (no site names). Mutations at the end.
 * Usage: node scripts/verifyPhase121PartialOcclusionPick.mjs
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { revertD12149EligibilityEdits } from './lib/phase121D49EligibilityEdits.mjs';
import { revertD12171EligibilityEdits, revertD12171VisualPickEdits } from './lib/phase121D71Edits.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const git = (args) => execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const MTE_FILE = 'extension/generic/managed-target-eligibility.js';
const LD_FILE = 'extension/generic/locator-determinism.js';
const VTP_FILE = 'extension/generic/visual-target-pick.js';
const PAGE_FILES = [MTE_FILE, LD_FILE, VTP_FILE];
const ORIGIN = 'https://fixture.example.test';
/** visual-target-pick.js bytes before this slice (D-121-71 edits reverted). */
const VTP_PRE_SLICE_SHA = '0a6a8bb4b401797ef28f7e05fd52700f8facd7d529b17687d83eea8376971626';

/**
 * Real eligibility + pick modules. Every element is 100×20 at 0,0, so the sample points are
 * center (50,10), left (25,10), right (75,10), top (50,5), bottom (50,15).
 * Hit test driven by `w.__hit(x, y)`; the click-point stack by `w.__stack(x, y)`.
 */
function loadDom(sources, html) {
  const { window } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  Object.defineProperty(window, 'location', {
    value: { href: `${ORIGIN}/login`, origin: ORIGIN, protocol: 'https:' },
    configurable: true,
  });
  window.top = window;
  window.innerWidth = 1024;
  window.innerHeight = 768;
  window.getComputedStyle = (el) => ({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    pointerEvents: el && el.getAttribute && el.getAttribute('data-pe') === 'none' ? 'none' : 'auto',
  });
  const Proto = window.HTMLElement.prototype;
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    return this.__rect || { width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100 };
  };
  Proto.getClientRects = function getClientRects() {
    return [this.getBoundingClientRect()];
  };
  window.__scrolled = 0;
  Proto.scrollIntoView = function scrollIntoView() {
    window.__scrolled += 1;
    if (typeof window.__onScroll === 'function') window.__onScroll(this);
  };
  window.__hit = null;
  window.__stack = null;
  window.__stackCalls = [];
  window.document.elementFromPoint = (x, y) => (window.__hit ? window.__hit(x, y) : null);
  window.document.elementsFromPoint = (x, y) => {
    window.__stackCalls.push([x, y]);
    return window.__stack ? window.__stack(x, y) : [];
  };
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  window.CSS = globalThis.CSS;
  for (const rel of PAGE_FILES) {
    new Function('window', 'document', 'globalThis', 'CSS', `${sources[rel]}\n//# sourceURL=${rel}`)(window, window.document, window, globalThis.CSS);
  }
  return window;
}

// ─── Fixture ─────────────────────────────────────────────────────────────────
const FORM = `
  <form id="form">
    <label for="u" id="lu"><span id="lus">User</span></label>
    <input id="u" name="user" type="text" />
    <input id="p" name="pass" type="password" />
    <div id="fp" class="field-link"><span id="fps">Forgot?</span></div>
    <input id="p2" name="pass2" type="password" />
    <input id="cb" name="keep" type="checkbox" />
    <div id="modal"><span id="ms">Notice</span></div>
  </form>`;

const POINT = { center: [50, 10], left: [25, 10], right: [75, 10], top: [50, 5], bottom: [50, 15] };
const at = (x, y, names) => names.some((n) => POINT[n][0] === x && POINT[n][1] === y);
/** Hit test: the named sample points hit `cover`, every other point hits the target. */
const coverOn = (target, cover, names) => (x, y) => (at(x, y, names) ? cover : target);

function classify(w, target, hit) {
  w.__hit = hit;
  w.__onScroll = null;
  return w.ManagedTargetEligibility.classifyHitTest(target);
}

async function pickByClick(w, el, options, point = POINT.bottom, extra = {}) {
  const p = w.armVisualTargetPick({ expectedOrigin: ORIGIN, fieldId: 'f', ...options });
  const ev = new w.Event('click', { bubbles: true, cancelable: true });
  if (point) {
    Object.defineProperty(ev, 'clientX', { value: point[0], configurable: true });
    Object.defineProperty(ev, 'clientY', { value: point[1], configurable: true });
  }
  if (extra.composedPath) {
    Object.defineProperty(ev, 'composedPath', { value: extra.composedPath, configurable: true });
  }
  el.dispatchEvent(ev);
  return p;
}

const MODES = [
  ['STANDARD', {}],
  ['SPECIAL', { mode: 'pick', stableLocators: true }],
];

// ─── Check groups ────────────────────────────────────────────────────────────
function checkHitTestRule(c) {
  const w = loadDom(c.sources, FORM);
  const $ = (id) => w.document.getElementById(id);
  const p = $('p');
  const fp = $('fp');
  let r = classify(w, p, coverOn(p, fp, ['bottom']));
  assert(r.ok === true, `overlay on the bottom 25% point only → PASS (${JSON.stringify(r)})`);
  r = classify(w, p, coverOn(p, fp, ['bottom', 'right']));
  assert(r.ok === true, `overlay on 2 edge points, center + 2 pass (3 in total) → PASS (${JSON.stringify(r)})`);
  r = classify(w, p, coverOn(p, fp, ['center']));
  assert(r.ok === false && r.reason === 'occluded', `overlay on the center point → occluded (${JSON.stringify(r)})`);
  r = classify(w, p, coverOn(p, fp, ['left', 'right', 'bottom']));
  assert(r.ok === false && r.reason === 'occluded', `overlay on 3 of 5 points, center visible → occluded (${JSON.stringify(r)})`);
  r = classify(w, p, () => $('modal'));
  assert(r.ok === false && r.reason === 'occluded', `full-viewport modal → occluded (${JSON.stringify(r)})`);
  r = classify(w, p, coverOn(p, $('ms'), ['center', 'left', 'right', 'top', 'bottom']));
  assert(r.ok === false && r.reason === 'occluded', 'modal content on every point → occluded');
  r = classify(w, p, coverOn(p, null, ['center']));
  assert(r.ok === false && r.reason === 'not_interactable', 'no hit at the center → not_interactable (unchanged)');
  r = classify(w, p, coverOn(p, null, ['left', 'right', 'top']));
  assert(r.ok === false && r.reason === 'not_interactable', 'center passes, 3 points with no hit → not_interactable');
  r = classify(w, p, coverOn(p, fp, ['left', 'right', 'top', 'bottom']));
  assert(r.ok === false && r.reason === 'occluded', 'only the center passes → occluded');
  r = classify(w, $('u'), coverOn($('u'), $('lus'), ['center', 'left']));
  assert(r.ok === true, 'own-label hits still count as passing points (D-121-49)');
  return 'item 1: center + ≥3 passing points — bottom-only overlay PASS; center overlay / 3 of 5 points / full modal → occluded; no hit → not_interactable';
}

function checkHitTestGuards(c) {
  const w = loadDom(c.sources, FORM);
  const $ = (id) => w.document.getElementById(id);
  const MTE = w.ManagedTargetEligibility;
  const p = $('p');
  const fp = $('fp');
  p.setAttribute('data-pe', 'none');
  assert(classify(w, p, () => p).reason === 'not_interactable', 'target pointer-events:none → not_interactable (unchanged)');
  p.removeAttribute('data-pe');
  p.__rect = { width: 100, height: 20, top: -15, left: 0, bottom: 5, right: 100 };
  let r = classify(w, p, () => p);
  assert(r.ok === false && r.reason === 'not_interactable', `<3 sample points in view → not_interactable (unchanged) (${JSON.stringify(r)})`);
  p.__rect = null;

  let cover = ['center'];
  w.__hit = (x, y) => (at(x, y, cover) ? fp : p);
  const before = w.__scrolled;
  w.__onScroll = () => {
    cover = ['bottom'];
  };
  r = MTE.classifyHitTest(p);
  assert(r.ok === true && w.__scrolled === before + 1, `single scrollIntoView retry, re-sampled under the new rule (${JSON.stringify(r)})`);
  const before2 = w.__scrolled;
  w.__onScroll = null;
  w.__hit = coverOn(p, fp, ['center']);
  r = MTE.classifyHitTest(p);
  assert(r.reason === 'occluded' && w.__scrolled === before2 + 1, 'still occluded after the one retry → occluded, exactly one scroll');

  w.__hit = coverOn(p, fp, ['bottom']);
  assert(MTE.isSafeFillTarget(p) === true && MTE.isVisible(p) === true, 'bottom-only overlay → Managed safe fill target (all callers inherit)');
  w.__hit = coverOn(p, fp, ['center']);
  assert(MTE.isSafeFillTarget(p) === false && MTE.classifyManagedIneligibility(p) === 'occluded', 'center overlay → Managed ineligible, detail occluded');
  return 'item 1 guard: pointer-events:none, <3 in view, one bounded scrollIntoView retry kept; isSafeFillTarget / classifyManagedIneligibility follow the rule';
}

async function checkPointPick(c) {
  for (const [label, opts] of MODES) {
    const w = loadDom(c.sources, FORM);
    const $ = (id) => w.document.getElementById(id);
    const p = $('p');
    w.__hit = coverOn(p, $('fp'), ['bottom']);
    w.__stack = () => [$('fps'), $('fp'), p, $('form'), w.document.body, w.document.documentElement];
    let r = await pickByClick(w, $('fps'), opts);
    assert(r.ok === true && r.tagName === 'input' && r.meta.idAttr === 'p' && w.document.querySelector(r.locator) === p, `${label}: click on an overlay over one input → that input (${JSON.stringify(r)})`);
    assert(r.state === 'IDENTIFIED_AND_MANAGED_ELIGIBLE' && r.managedEligible === true, `${label}: point-resolved input passes the shared eligibility`);
    assert(w.__stackCalls.length === 1 && w.__stackCalls[0][0] === 50 && w.__stackCalls[0][1] === 15, `${label}: elementsFromPoint called once with the click clientX/clientY`);

    w.__stack = () => [$('fp'), p, p, $('form')];
    r = await pickByClick(w, $('fp'), opts);
    assert(r.ok === true && r.meta.idAttr === 'p', `${label}: the same input listed twice counts once`);

    w.__stack = () => [$('fp'), $('cb'), p];
    r = await pickByClick(w, $('fp'), opts);
    assert(r.ok === true && r.meta.idAttr === 'p', `${label}: non-fillable inputs in the stack are ignored`);

    const direct = loadDom(c.sources, FORM);
    direct.__hit = () => direct.document.getElementById('u');
    direct.__stack = () => {
      throw new Error('elementsFromPoint must not be consulted for a direct input click');
    };
    r = await pickByClick(direct, direct.document.getElementById('u'), opts);
    assert(r.ok === true && r.meta.idAttr === 'u', `${label}: direct click on an input unchanged (no point lookup)`);
    direct.__hit = () => direct.document.getElementById('lus');
    r = await pickByClick(direct, direct.document.getElementById('lus'), opts);
    assert(r.ok === true && r.meta.idAttr === 'u', `${label}: click on a label still resolves via the label first`);
  }
  return 'item 2: click on an element over exactly one fillable input → that input via candidates + determinism + eligibility (STANDARD and SPECIAL)';
}

async function checkPointPickRejects(c) {
  for (const [label, opts] of MODES) {
    const w = loadDom(c.sources, FORM);
    const $ = (id) => w.document.getElementById(id);
    const p = $('p');
    w.__hit = coverOn(p, $('fp'), ['bottom']);
    const cases = [
      [() => [$('fp'), p, $('p2'), $('form')], 'two stacked inputs'],
      [() => [$('fp'), $('form'), w.document.body], 'an overlay with no input under it'],
      [() => [$('fp'), $('cb')], 'only a non-fillable input under it'],
      [() => [], 'an empty stack'],
    ];
    for (const [stack, what] of cases) {
      w.__stack = stack;
      const r = await pickByClick(w, $('fp'), opts);
      assert(r.ok === false && r.reason === 'unsupported_target' && r.state === 'NOT_IDENTIFIED', `${label}: ${what} → unsupported_target (${JSON.stringify(r)})`);
    }
    w.__stack = () => [$('fp'), p];
    let r = await pickByClick(w, $('fp'), opts, null);
    assert(r.ok === false && r.reason === 'unsupported_target', `${label}: click without coordinates → unsupported_target`);

    w.__hit = coverOn(p, $('fp'), ['center']);
    r = await pickByClick(w, $('fp'), opts);
    assert(r.ok === false && r.reason === 'managed_ineligible' && r.detail === 'occluded' && r.identified === true && r.locatorEvidence, `${label}: point-resolved input with an occluded center → managed_ineligible / occluded (${JSON.stringify(r)})`);
  }
  return 'item 2 guard: several / no / non-fillable inputs under the point → unsupported_target; eligibility still applied (occluded center → managed_ineligible)';
}

async function checkOtherPathsUnchanged(c) {
  const w = loadDom(c.sources, FORM);
  const $ = (id) => w.document.getElementById(id);
  const p = $('p');
  w.__hit = () => p;
  w.__stack = () => [$('fp'), p];
  let r = await pickByClick(w, $('fp'), { mode: 'report_only' });
  assert(r.ok === false && r.reason === 'nested_frame_unsupported', 'report_only (nested frame) → nested_frame_unsupported, no point lookup');
  r = await pickByClick(w, $('fp'), { mode: 'pick', stableLocators: true }, POINT.bottom, { composedPath: () => [$('ms'), $('fp')] });
  assert(r.ok === false && r.reason === 'shadow_dom_unsupported', 'click retargeted from a shadow root → shadow_dom_unsupported');
  r = await pickByClick(w, $('fp'), { mode: 'pick', pickTarget: 'action', stableLocators: true });
  assert(!(r.ok && r.tagName === 'input'), 'action pick never resolves the point to an input');
  assert(w.__stackCalls.length === 0, 'report_only / shadow / action paths never call elementsFromPoint');
  return 'item 2 scope: shadow-DOM / nested-frame report_only / action-pick paths unchanged';
}

function checkScope(c) {
  const mte = c.sources[MTE_FILE];
  const vtp = c.sources[VTP_FILE];
  assert(git('show HEAD:extension/manifest.json') === read('extension/manifest.json'), 'manifest unchanged');
  // R-123-1: pre-slice reference frozen at 909cc8b~1 (= 909cc8b^; `^` is an escape char in cmd.exe; HEAD now
  // contains the Phase 121 edits).
  assert(revertD12149EligibilityEdits(revertD12171EligibilityEdits(read(MTE_FILE))) === git(`show 909cc8b~1:${MTE_FILE}`), 'eligibility: reverting D-121-71 then D-121-49 reproduces the pre-slice bytes (only evaluate() changed)');
  assert(sha(revertD12171VisualPickEdits(read(VTP_FILE))) === VTP_PRE_SLICE_SHA, 'visual-target-pick: reverting D-121-71 reproduces the pre-slice bytes');
  const blocks = [mte.slice(mte.indexOf('D-121-71'), mte.indexOf('return evaluate();')), vtp.slice(vtp.indexOf('D-121-71'), vtp.indexOf('function managedEligibleFor'))];
  for (const block of blocks) {
    assert(block.length > 50, 'fixture: D-121-71 block located');
    assert(!/hostname|serviceId|location\.|elal|yahav|\.co\.il|\.com\b|querySelector|webNavigation|getFrameId|debugger/i.test(block), 'no site / hostname / serviceId / selector / frame-API branches');
  }
  assert(/pointFillableControl\(doc, event\)/.test(vtp), 'point lookup uses the pick document only');
  for (const rel of ['extension/generic/fill-executor.js', 'extension/generic/validated-autofill.js', 'extension/generic/page-structure-inspect.js', 'extension/background.js']) {
    const src = read(rel);
    assert(src.includes('ManagedTargetEligibility') && !src.includes('D-121-71') && !src.includes('elementsFromPoint'), `${rel}: inherits the shared rule, no caller-specific change`);
  }
  return 'scope: manifest unchanged; only evaluate() and the pick field branch changed; no site branches; callers unchanged';
}

const GROUPS = [checkHitTestRule, checkHitTestGuards, checkPointPick, checkPointPickRejects, checkOtherPathsUnchanged, checkScope];

function baseCtx() {
  return { sources: Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(rel)])) };
}
async function runGroups(c, log) {
  for (const g of GROUPS) {
    const what = await g(c);
    if (log) console.log(`  ✓ ${what}`);
  }
}

console.log('Phase 121 D-121-71 — partial-occlusion hit test + point pick\n');
await runGroups(baseCtx(), true);

function replaceOnce(src, from, to, id) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation ${id} anchor found ${n}×`);
  return src.replace(from, () => to);
}
const MUTATIONS = [
  {
    id: 'M1 center requirement dropped',
    edits: [[MTE_FILE, "      if (!hitRelationshipOk(centerHit, element)) {\n        return {\n          ok: false,\n          reason: centerHit == null ? 'not_interactable' : 'occluded',\n        };\n      }\n", '']],
  },
  { id: 'M2 all points required again', edits: [[MTE_FILE, 'if (passed >= 3) {', 'if (passed === inView.length) {']] },
  { id: 'M3 threshold lowered to 2', edits: [[MTE_FILE, 'if (passed >= 3) {', 'if (passed >= 2) {']] },
  { id: 'M4 first input taken when several', edits: [[VTP_FILE, 'if (found) return null;', 'if (found) continue;']] },
  {
    id: 'M5 eligibility skipped after point resolution',
    edits: [
      [VTP_FILE, 'el = pointFillableControl(doc, event) || el;', 'var viaPoint = pointFillableControl(doc, event); el = viaPoint || el;'],
      [VTP_FILE, 'if (!managedEligibleFor(el)) {', 'if (!viaPoint && !managedEligibleFor(el)) {'],
    ],
  },
  { id: 'M6 point fallback removed', edits: [[VTP_FILE, 'el = pointFillableControl(doc, event) || el;', 'el = el;']] },
  { id: 'M7 fillable-type filter dropped', edits: [[VTP_FILE, "      if (FILLABLE_INPUT_TYPES.indexOf(type) < 0) continue;\n", '']] },
  { id: 'M8 duplicate entries counted twice', edits: [[VTP_FILE, 'el === found || ', '']] },
];

console.log('\nMutations');
let caught = 0;
for (const mu of MUTATIONS) {
  const c = baseCtx();
  for (const [file, from, to] of mu.edits) {
    c.sources[file] = replaceOnce(c.sources[file], from, to, mu.id);
  }
  let failure = null;
  try {
    await runGroups(c, false);
  } catch (err) {
    failure = err;
  }
  assert(failure, `mutation NOT caught: ${mu.id}`);
  assert(!String(failure.message).startsWith('fixture:'), `mutation ${mu.id} failed on fixture setup: ${failure.message}`);
  caught += 1;
  console.log(`  ✓ mutation caught: ${mu.id}  [${failure.message}]`);
}

console.log(`\nPASS — Phase 121 D-121-71 partial occlusion + point pick (${GROUPS.length} check groups, ${caught} mutations caught)`);
process.exit(0);
