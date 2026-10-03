/**
 * Phase 121 D-121-49 — a hit inside the target's own associated label is not occlusion (G11),
 * and a Visual click inside a label resolves to its fillable control (SPECIAL + STANDARD).
 * Synthetic fixtures only (no site names). Mutations at the end.
 * Usage: node scripts/verifyPhase121OwnLabelHit.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const git = (args) => execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const MTE_FILE = 'extension/generic/managed-target-eligibility.js';
const LD_FILE = 'extension/generic/locator-determinism.js';
const VTP_FILE = 'extension/generic/visual-target-pick.js';
const PAGE_FILES = [MTE_FILE, LD_FILE, VTP_FILE];
const ORIGIN = 'https://fixture.example.test';

/** Real eligibility module; hit-test driven by `w.__hit(x, y)` (defaults: the element itself). */
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
  Proto.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100 });
  Proto.getClientRects = function getClientRects() {
    return [this.getBoundingClientRect()];
  };
  window.__scrolled = 0;
  Proto.scrollIntoView = function scrollIntoView() {
    window.__scrolled += 1;
    if (typeof window.__onScroll === 'function') window.__onScroll(this);
  };
  window.__hit = null;
  window.document.elementFromPoint = (x, y) => (window.__hit ? window.__hit(x, y) : null);
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  window.CSS = globalThis.CSS;
  for (const rel of PAGE_FILES) {
    new Function('window', 'document', 'globalThis', 'CSS', `${sources[rel]}\n//# sourceURL=${rel}`)(window, window.document, window, globalThis.CSS);
  }
  return window;
}

// ─── Fixture ─────────────────────────────────────────────────────────────────
const FORM = `
  <form>
    <mat-form-field><div class="infix">
      <label for="u" id="lu"><mat-label id="ml"><span id="mls">User</span></mat-label></label>
      <input id="u" name="user" type="text" />
    </div></mat-form-field>
    <label id="nest"><span id="ns">Pass</span><input id="p" name="pass" type="password" /></label>
    <label id="unrel"><span id="us">Note</span></label>
    <label for="other" id="lo"><span id="os">Other</span></label><input id="other" name="other" type="text" />
    <label for="box" id="lbox"><span id="bs">Remember</span></label><input id="box" type="checkbox" />
    <label for="sel" id="lsel"><span id="ss">Branch</span></label><select id="sel"><option>a</option></select>
    <label for="blk" id="lblk"><span id="bks">Block</span></label><div id="blk"></div>
    <div id="overlay"><span id="ov">x</span></div>
    <input id="plain" name="plain" type="text" />
  </form>`;

const hitAll = (el) => () => el;
function classify(w, target, hit) {
  w.__hit = typeof hit === 'function' ? hit : hitAll(hit);
  w.__onScroll = null;
  return w.ManagedTargetEligibility.classifyHitTest(target);
}

async function pickByClick(w, el, options) {
  const p = w.armVisualTargetPick({ expectedOrigin: ORIGIN, fieldId: 'f', ...options });
  el.dispatchEvent(new w.Event('click', { bubbles: true }));
  return p;
}

// ─── Check groups ────────────────────────────────────────────────────────────
function checkOwnLabelPass(c) {
  const w = loadDom(c.sources, FORM);
  const $ = (id) => w.document.getElementById(id);
  const MTE = w.ManagedTargetEligibility;
  for (const hitId of ['ml', 'mls']) {
    const r = classify(w, $('u'), $(hitId));
    assert(r.ok === true, `label[for=target] descendant (${hitId}) on all 5 points → PASS (${JSON.stringify(r)})`);
  }
  assert(classify(w, $('p'), $('ns')).ok === true, 'nested label descendant covering its own input → PASS');
  assert(classify(w, $('u'), $('lu')).ok === true, 'associated label element itself → PASS (pre-existing)');
  assert(classify(w, $('p'), $('nest')).ok === true, 'nesting label element itself → PASS (pre-existing)');
  assert(classify(w, $('u'), $('u')).ok === true, 'target itself → PASS (pre-existing)');
  const mixed = (x) => (x === 50 ? $('u') : $('ml'));
  assert(classify(w, $('u'), mixed).ok === true, 'mixed target / own-label hits → PASS');
  w.__hit = hitAll($('ml'));
  assert(MTE.isSafeFillTarget($('u')) === true && MTE.isVisible($('u')) === true, 'own-label hit → Managed safe fill target');
  return 'item 1: descendant of the target\'s own label (for= and nested) covering the input → PASS; target / descendant / label itself unchanged';
}

function checkStillOccluded(c) {
  const w = loadDom(c.sources, FORM);
  const $ = (id) => w.document.getElementById(id);
  const MTE = w.ManagedTargetEligibility;
  const cases = [
    ['plain', 'us', 'descendant of an unrelated label (no control)'],
    ['plain', 'unrel', 'unrelated label element itself'],
    ['u', 'os', 'descendant of a label for another control'],
    ['u', 'lo', 'label for another control itself'],
    ['u', 'ns', 'descendant of another input\'s nesting label'],
    ['u', 'ov', 'non-label overlay'],
    ['u', 'overlay', 'non-label overlay container'],
    ['u', 'bs', 'descendant of a label for a checkbox'],
  ];
  for (const [target, hit, what] of cases) {
    const r = classify(w, $(target), $(hit));
    assert(r.ok === false && r.reason === 'occluded', `${what} → occluded (${JSON.stringify(r)})`);
  }
  // D-121-71: center + ≥3 passing points; an overlay on one edge point no longer blocks.
  const oneBad = (x, y) => (x === 50 && y === 15 ? $('ov') : $('ml'));
  assert(classify(w, $('u'), oneBad).ok === true, 'one edge point on an overlay, center + 4 own-label hits → PASS (D-121-71)');
  const centerBad = (x, y) => (x === 50 && y === 10 ? $('ov') : $('ml'));
  assert(classify(w, $('u'), centerBad).reason === 'occluded', 'overlay on the center point → occluded');
  assert(classify(w, $('u'), () => null).reason === 'not_interactable', 'no hit → not_interactable (unchanged)');
  $('u').setAttribute('data-pe', 'none');
  assert(classify(w, $('u'), $('ml')).reason === 'not_interactable', 'target pointer-events:none → not_interactable even with own-label hit');
  $('u').removeAttribute('data-pe');
  w.__hit = hitAll($('ov'));
  assert(MTE.isSafeFillTarget($('u')) === false && MTE.classifyManagedIneligibility($('u')) === 'occluded', 'overlay → Managed ineligible, detail occluded');
  let current = $('ov');
  w.__hit = () => current;
  const before = w.__scrolled;
  w.__onScroll = () => {
    current = $('ml');
  };
  assert(MTE.classifyHitTest($('u')).ok === true && w.__scrolled === before + 1, 'single scrollIntoView retry unchanged (re-sample after scroll)');
  w.__onScroll = null;
  return 'item 1 guard: unrelated label / label for another control / non-label overlay / center overlay stay occluded; pointer-events, null hit, scroll retry unchanged';
}

function checkLabelControlOf(c) {
  const w = loadDom(c.sources, FORM);
  const $ = (id) => w.document.getElementById(id);
  const ctl = w.ManagedTargetEligibility.labelControlOf;
  assert(ctl($('lu')) === $('u') && ctl($('nest')) === $('p'), 'fallback: for= id and nested labelable descendant');
  assert(ctl($('lblk')) === null, 'fallback: for= pointing at a non-labelable element → null');
  assert(ctl($('unrel')) === null && ctl($('ml')) === null, 'label without a control / non-label → null');
  const nativeLabel = $('lo');
  Object.defineProperty(nativeLabel, 'control', { value: $('plain'), configurable: true });
  assert(ctl(nativeLabel) === $('plain'), 'native HTMLLabelElement.control is authoritative when present');
  Object.defineProperty(nativeLabel, 'control', { value: null, configurable: true });
  assert(ctl(nativeLabel) === null, 'native control null → null (no fallback guess)');
  return 'labelControlOf: native .control when the DOM exposes it; HTML rule fallback (for= labelable, else first labelable descendant)';
}

async function checkVisualPick(c) {
  const w = loadDom(c.sources, FORM);
  const $ = (id) => w.document.getElementById(id);
  w.__hit = hitAll($('ml'));
  for (const clickId of ['mls', 'ml', 'lu']) {
    const r = await pickByClick(w, $(clickId), {});
    assert(r.ok === true && r.locator === '#u' && r.tagName === 'input' && r.meta.idAttr === 'u', `STANDARD click on own label (${clickId}) → control #u (${JSON.stringify(r)})`);
  }
  w.__hit = hitAll($('ns'));
  const nested = await pickByClick(w, $('ns'), {});
  assert(nested.ok === true && nested.locator === '#p', `STANDARD click on nested label text → #p (${nested.locator})`);

  for (const [clickId, what] of [['bs', 'label for a checkbox'], ['ss', 'label for a select'], ['bks', 'label for a non-labelable element'], ['us', 'label without a control'], ['ov', 'non-label element']]) {
    for (const opts of [{}, { mode: 'pick', stableLocators: true }]) {
      const r = await pickByClick(w, $(clickId), opts);
      assert(r.ok === false && r.reason === 'unsupported_target', `${opts.mode ? 'SPECIAL' : 'STANDARD'} click on ${what} → no resolution (${JSON.stringify(r)})`);
    }
  }
  const box = await pickByClick(w, $('box'), {});
  assert(box.reason !== 'unsupported_target', 'direct click on a checkbox keeps its pre-slice handling');

  const s = loadDom(c.sources, `
    <app-login-dialog><form>
      <label for="mat-input-4"><mat-label id="sml">User</mat-label></label>
      <input id="mat-input-4" name="username" type="text" />
      <input id="mat-input-5" name="password" type="password" />
    </form></app-login-dialog>`);
  const sEl = s.document.getElementById('mat-input-4');
  s.__hit = hitAll(s.document.getElementById('sml'));
  const special = await pickByClick(s, s.document.getElementById('sml'), { mode: 'pick', stableLocators: true });
  assert(special.ok === true && special.locator === 'input[name="username"]' && special.meta.idAttr === 'mat-input-4', `SPECIAL click on own label → control, D-121-48 stable locator (${JSON.stringify(special)})`);
  assert(special.locatorCandidates.every((x) => !x.locator.includes('mat-input')), 'SPECIAL resolved control candidates avoid the generated id');
  assert(s.document.querySelectorAll(special.locator).length === 1 && s.document.querySelector(special.locator) === sEl, 'resolved locator is exact-one on the control');
  const std = await pickByClick(s, s.document.getElementById('sml'), {});
  // D-121-68: the generated-id filter applies in STANDARD too; name is the next stable candidate.
  assert(std.ok === true && std.locator === 'input[name="username"]' && std.meta.idAttr === 'mat-input-4', `STANDARD on the same page: generated id skipped, stable name chosen (${std.locator})`);

  const act = await pickByClick(s, s.document.getElementById('sml'), { mode: 'pick', pickTarget: 'action', stableLocators: true });
  assert(!(act.ok && act.tagName === 'input'), 'SPECIAL action pick does not resolve labels to inputs (unchanged)');
  return 'item 2: Visual click inside a label → its fillable control (STANDARD and SPECIAL skip the generated id); checkbox / select / non-labelable / no control → unsupported_target';
}

function checkRuntimeAndScope(c) {
  for (const rel of ['extension/generic/fill-executor.js', 'extension/generic/validated-autofill.js']) {
    const src = read(rel);
    assert(!/label/i.test(src) && !src.includes('.click('), `${rel}: writes to the resolved target only, never clicks a label`);
  }
  assert(git('show HEAD:extension/manifest.json') === read('extension/manifest.json'), 'manifest unchanged');
  const d49 = [c.sources[MTE_FILE].slice(c.sources[MTE_FILE].indexOf('D-121-49')), c.sources[VTP_FILE].slice(c.sources[VTP_FILE].indexOf('D-121-49'))];
  for (const block of d49) {
    assert(!/hostname|serviceId|elal|\.co\.il|\.com\b|webNavigation|getFrameId|debugger/i.test(block), 'no site / hostname / serviceId / frame-API branches');
  }
  const bg = read('extension/background.js');
  for (const files of [bg.match(/SPECIAL_PICK_FILES\s*=\s*\[[^\]]*\]/), bg.match(/files:\s*\[[^\]]*visual-target-pick\.js[^\]]*\]/)]) {
    assert(files && files[0].indexOf('managed-target-eligibility.js') >= 0 && files[0].indexOf('managed-target-eligibility.js') < files[0].indexOf('visual-target-pick.js'), 'eligibility module injected before visual-target-pick (SPECIAL + STANDARD)');
  }
  return 'item 3: runtime fill never clicks labels; manifest unchanged; no site branches; both pick paths load the shared label rule';
}

const GROUPS = [checkOwnLabelPass, checkStillOccluded, checkLabelControlOf, checkVisualPick, checkRuntimeAndScope];

function baseCtx() {
  return { sources: Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(rel)])) };
}
async function runGroups(c, log) {
  for (const g of GROUPS) {
    const what = await g(c);
    if (log) console.log(`  ✓ ${what}`);
  }
}

console.log('Phase 121 D-121-49 — own-label hit + Visual label resolution (G11)\n');
await runGroups(baseCtx(), true);

function replaceOnce(src, from, to, id) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation ${id} anchor found ${n}×`);
  return src.replace(from, () => to);
}
const MUTATIONS = [
  { id: 'M1 own-label rule removed', file: MTE_FILE, from: '    if (isInsideOwnLabel(hit, target)) {\n      return true;\n    }\n', to: '' },
  { id: 'M2 control check dropped (any enclosing label passes)', file: MTE_FILE, from: "return Boolean(label) && labelControlOf(label) === target;", to: 'return Boolean(label);' },
  { id: 'M3 label-itself path broadened', file: MTE_FILE, from: "    if (typeof hit.contains === 'function' && hit.contains(target)) {\n      return true;\n    }\n    var id = target.id;", to: "    if (true) {\n      return true;\n    }\n    var id = target.id;" },
  { id: 'M4 native .control ignored', file: MTE_FILE, from: "if (typeof label.control !== 'undefined') {", to: 'if (false) {' },
  { id: 'M5 for= fallback accepts non-labelable elements', file: MTE_FILE, from: 'return byId && typeof byId.matches === \'function\' && byId.matches(LABELABLE_SELECTOR) ? byId : null;', to: 'return byId;' },
  { id: 'M6 fillable-type check dropped', file: VTP_FILE, from: 'return FILLABLE_INPUT_TYPES.indexOf(type) >= 0 ? control : null;', to: 'return control;' },
  { id: 'M7 Visual label resolution removed', file: VTP_FILE, from: 'el = labelFillableControl(el) || el;', to: 'el = el;' },
];

console.log('\nMutations');
let caught = 0;
for (const mu of MUTATIONS) {
  const c = baseCtx();
  c.sources[mu.file] = replaceOnce(c.sources[mu.file], mu.from, mu.to, mu.id);
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

console.log(`\nPASS — Phase 121 D-121-49 own-label hit (${GROUPS.length} check groups, ${caught} mutations caught)`);
process.exit(0);
