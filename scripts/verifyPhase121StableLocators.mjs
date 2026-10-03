/**
 * Phase 121 D-121-48 — SPECIAL authoring never anchors locators on generated ids (G9).
 * Synthetic fixtures only (no site names). STANDARD proof: default builders equal the
 * pre-slice reference on stable ids; since D-121-68 the volatile filter + anchored
 * fallback also apply there (the other extras stay SPECIAL-only). Mutations at the end.
 * Usage: node scripts/verifyPhase121StableLocators.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { revertD12148BackgroundEdits } from './lib/phase121D48BackgroundEdits.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const LD_FILE = 'extension/generic/locator-determinism.js';
const PSI_FILE = 'extension/generic/page-structure-inspect.js';
const VTP_FILE = 'extension/generic/visual-target-pick.js';
const PAGE_FILES = ['extension/generic/managed-target-eligibility.js', LD_FILE, PSI_FILE, VTP_FILE];
const ORIGIN = 'https://fixture.example.test';

function loadDom(sources, html) {
  const { window } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  Object.defineProperty(window, 'location', {
    value: { href: `${ORIGIN}/login`, origin: ORIGIN, protocol: 'https:' },
    configurable: true,
  });
  window.top = window;
  window.innerWidth = 1024;
  window.innerHeight = 768;
  window.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto' });
  const Proto = window.HTMLElement.prototype;
  Proto.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100 });
  Proto.getClientRects = function getClientRects() {
    return [this.getBoundingClientRect()];
  };
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  window.CSS = globalThis.CSS;
  for (const rel of PAGE_FILES) {
    new Function('window', 'document', 'globalThis', 'CSS', `${sources[rel]}\n//# sourceURL=${rel}`)(window, window.document, window, globalThis.CSS);
  }
  // Layout is not modelled by linkedom; Managed eligibility (unchanged module) = "is an input".
  window.ManagedTargetEligibility.isSafeFillTarget = (el) => Boolean(el) && el.tagName === 'INPUT';
  return window;
}

// ─── Pre-slice reference builders (verbatim logic; STANDARD must equal these) ───
function legacyInspectCandidates(w, el, opts) {
  const out = [];
  const doc = el.ownerDocument;
  const forAction = Boolean(opts && opts.action === true);
  const cap = forAction ? 24 : 8;
  const esc = (v) => w.CSS.escape(v);
  const push = (locator, hint) => {
    if (!locator || out.length >= cap) return;
    if (out.some((c) => c.locator === locator)) return;
    out.push({ strategy: 'css', locator, stabilityHint: hint, matchCount: w.LocatorDeterminism.countLocatorMatches(locator, doc) });
  };
  if (el.id) push('#' + esc(el.id), 'id');
  if (el.name) push(el.tagName.toLowerCase() + '[name="' + String(el.name).replace(/"/g, '\\"') + '"]', 'name');
  const ac = el.getAttribute('autocomplete');
  if (ac && ac !== 'on' && ac !== 'off') push(el.tagName.toLowerCase() + '[autocomplete="' + String(ac).replace(/"/g, '\\"') + '"]', 'autocomplete');
  const aria = el.getAttribute('aria-label');
  if (aria) push(el.tagName.toLowerCase() + '[aria-label="' + String(aria).replace(/"/g, '\\"').slice(0, 80) + '"]', 'aria');
  if (forAction) w.LocatorDeterminism.actionLocatorCandidates(el).forEach((c) => push(c.locator, c.hint));
  return out;
}
function legacyPickCandidates(w, el, opts) {
  return legacyInspectCandidates(w, el, opts).map(({ matchCount: _m, ...c }) => c);
}
// D-121-68 (all patterns): the pre-slice builder minus volatile locators, plus the
// anchored fallback when nothing left is exact-one on the element.
function d68InspectCandidates(w, el, opts) {
  const LD = w.LocatorDeterminism;
  const doc = el.ownerDocument;
  const out = legacyInspectCandidates(w, el, opts).filter((c) => !LD.locatorReferencesUnstableId(c.locator, doc));
  if (!LD.chooseDeterministicLocator(out, el, doc)) {
    for (const a of LD.anchoredStructuralCandidates(el, doc)) {
      if (!out.some((c) => c.locator === a.locator)) out.push({ strategy: 'css', locator: a.locator, stabilityHint: a.hint, matchCount: LD.countLocatorMatches(a.locator, doc) });
    }
  }
  return out;
}
function d68PickCandidates(w, el, opts) {
  return d68InspectCandidates(w, el, opts).map(({ matchCount: _m, ...c }) => c);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────
const PLUGIN = 'Opens an accessibility menu';
const pluginNoise = [1, 2, 3].map((i) => `<a href="/p${i}" aria-label="${PLUGIN}">p${i}</a>`).join('');
function counterDialog(n, overlay) {
  return `
  <div class="cdk-overlay-container" id="overlay-host">
    <div id="cdk-overlay-${overlay}" class="cdk-overlay-pane">
      <mat-dialog-container id="mat-mdc-dialog-${overlay}" role="dialog">
        <app-login-dialog>
          <form>
            <label for="mat-input-${n}">user</label>
            <mat-form-field><div class="mat-mdc-form-field-infix"><input id="mat-input-${n}" type="text" aria-label="${PLUGIN}" class="mat-mdc-input-element" /></div></mat-form-field>
            <mat-form-field><div class="mat-mdc-form-field-infix"><input id="mat-input-${n + 1}" type="password" class="mat-mdc-input-element" /></div></mat-form-field>
            <button id="mat-button-${n}" type="submit" class="submit-login">go</button>
          </form>
        </app-login-dialog>
      </mat-dialog-container>
    </div>
  </div>`;
}
const PAGE = (dialog) => `
  <header><button id="mat-button-1" class="secondary-action-button">התחברות</button>
  <button aria-controls="mat-menu-panel-3" class="menu-btn">menu</button></header>
  <app-search><mat-form-field><div class="mat-mdc-form-field-infix"><input id="mat-input-0" type="text" /></div></mat-form-field></app-search>
  ${pluginNoise}
  <div id="dialog-slot">${dialog}</div>`;

function twinDialog(n) {
  return `<app-login-dialog><form>
    <mat-form-field><div><input id="mat-input-${n}" type="text" /></div></mat-form-field>
    <mat-form-field><div><input id="mat-input-${n + 1}" type="text" /></div></mat-form-field>
  </form></app-login-dialog>`;
}

const STABLE_PAGE = `
  <a id="loginAnchor" href="#" data-toggle="modal" data-target="#loginModal" aria-label="התחברות">התחברות</a>
  <button id="logInBtn" class="btn">כניסה</button>
  <iframe id="iframeLogIn" src="/frame"></iframe>
  <form><input id="username" name="username" autocomplete="username" /><input id="password" name="password" type="password" /></form>
  <div id="loginModal"><input id="field-7" type="text" /></div>`;

const special = (w, el, action) => w.__pageStructureInspectHelpers.buildCandidates(el, action ? { action: true, stableLocators: true } : { stableLocators: true });
const specialPick = (w, el, action) => w.__visualTargetPickHelpers.buildCandidates(el, action ? { action: true, stableLocators: true } : { stableLocators: true });
function chosenFor(w, cands, el) {
  const c = w.LocatorDeterminism.chooseDeterministicLocator(cands, el, el.ownerDocument);
  return c && c.locator;
}

async function pickByClick(w, el, options) {
  const p = w.armVisualTargetPick({ expectedOrigin: ORIGIN, fieldId: 'f', ...options });
  el.dispatchEvent(new w.Event('click', { bubbles: true }));
  return p;
}

// ─── Check groups ────────────────────────────────────────────────────────────
function checkIdRule(c) {
  const w = loadDom(c.sources, PAGE(counterDialog(4, 0)) + '<i id="field-7"></i><i id="field-8"></i><i id="lone-3"></i>');
  const LD = w.LocatorDeterminism;
  const doc = w.document;
  for (const id of ['mat-input-4', 'mat-select-2', 'mat-mdc-form-field-label-0', 'cdk-overlay-3', 'react-select-5-input', ':r1a:', '\u00abr3\u00bb', 'ember123', 'ext-gen45', '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f', 'node-a1b2c3d4e5f6a7b8c9', 'field-7']) {
    assert(LD.isUnstableId(id, doc), `generated id detected: ${id}`);
  }
  for (const id of ['loginAnchor', 'logInBtn', 'iframeLogIn', 'username', 'password', 'mat-dialog-title', 'lone-3', 'step2']) {
    assert(!LD.isUnstableId(id, doc), `stable id kept: ${id}`);
  }
  assert(LD.locatorReferencesUnstableId('#mat-input-4', doc) && LD.locatorReferencesUnstableId('label[for="mat-input-4"]', doc), 'unstable #id / label[for] detected');
  assert(LD.locatorReferencesUnstableId('button[aria-controls="mat-menu-panel-3"]', doc), 'unstable id reference in aria-controls detected');
  assert(!LD.locatorReferencesUnstableId('label[for="username"]', doc) && !LD.locatorReferencesUnstableId('#logInBtn', doc), 'stable references allowed');
  assert(LD.isSharedAriaLabel(PLUGIN, doc) && !LD.isSharedAriaLabel('התחברות', doc), 'aria-label shared by many elements detected');
  return 'item 1: generated-id rule (framework prefixes, React / ember / ext-gen, UUID / hex, trailing-counter siblings); unstable label[for] / references';
}

async function checkCounterDialog(c) {
  const w = loadDom(c.sources, PAGE(counterDialog(4, 0)));
  const doc = w.document;
  const userEl = doc.getElementById('mat-input-4');
  const passEl = doc.getElementById('mat-input-5');
  const locators = {};
  for (const [key, el] of [['user', userEl], ['pass', passEl]]) {
    const ins = special(w, el);
    const pick = specialPick(w, el);
    for (const cands of [ins, pick]) {
      assert(!cands.some((x) => /mat-input-\d|mat-mdc-dialog-\d|cdk-overlay-\d/.test(x.locator)), `SPECIAL ${key}: no candidate on a generated id (${cands.map((x) => x.locator)})`);
      assert(!cands.some((x) => x.locator.includes('aria-label')), `SPECIAL ${key}: shared plugin aria-label skipped`);
    }
    const loc = chosenFor(w, ins, el);
    assert(loc && loc === chosenFor(w, pick, el), `SPECIAL ${key}: Analyze and Visual choose the same exact-one + identity locator (${loc})`);
    locators[key] = loc;
  }
  const clicked = await pickByClick(w, passEl, { mode: 'pick', stableLocators: true });
  assert(clicked.ok === true && clicked.locator === locators.pass, `SPECIAL Visual click → stable locator (${clicked.locator})`);
  assert(clicked.meta && clicked.meta.idAttr === 'mat-input-5', 'generated id still reported as identity evidence');
  const page = w.collectSafePageStructure({ stableLocators: true });
  const row = page.inputs.find((i) => i.idAttr === 'mat-input-4');
  assert(row && row.locatorCandidates.every((x) => !x.locator.includes('mat-input')) && row.locatorCandidates.some((x) => x.locator === locators.user && x.matchCount === 1), 'SPECIAL Analyze page: stable exact-one candidate, id kept as evidence');
  const readiness = await w.collectSafePageStructureWithReadiness({ expectedOrigin: ORIGIN, maxTotalWaitMs: 0, stableLocators: true });
  assert(readiness.page.inputs.every((i) => i.locatorCandidates.every((x) => !/#mat-input/.test(x.locator))), 'SPECIAL inspect with readiness forwards the option');

  // Dialog re-created: counters shift (mat-input-6 / 7).
  doc.getElementById('dialog-slot').innerHTML = counterDialog(6, 1);
  for (const [key, id] of [['user', 'mat-input-6'], ['pass', 'mat-input-7']]) {
    const m = doc.querySelectorAll(locators[key]);
    assert(m.length === 1 && m[0] === doc.getElementById(id), `re-created dialog: ${key} locator ${locators[key]} is exact-one on the new field`);
  }
  return 'G9 counter ids shift after re-creation → SPECIAL Analyze / Visual locators stay exact-one on the new dialog; plugin aria-label skipped; id kept as evidence';
}

function checkFallbackOrder(c) {
  const w = loadDom(c.sources, `
    <app-login-dialog><form>
      <input id="mat-input-1" name="user" formcontrolname="username" placeholder="Email" type="text" />
      <input id="mat-input-2" formcontrolname="password" placeholder="Password" type="password" />
      <input id="mat-input-3" data-testid="otp-field" placeholder="Code" type="text" />
      <input id="mat-input-4" aria-label="מספר טלפון" placeholder="Phone" type="tel" />
      <input id="mat-input-5" placeholder="Branch" type="text" />
    </form></app-login-dialog>`);
  const doc = w.document;
  const pick = (id) => chosenFor(w, special(w, doc.getElementById(id)), doc.getElementById(id));
  assert(pick('mat-input-1') === 'input[name="user"]', `name first: ${pick('mat-input-1')}`);
  assert(pick('mat-input-2') === 'input[formcontrolname="password"]', `formcontrolname after name / autocomplete: ${pick('mat-input-2')}`);
  assert(pick('mat-input-3') === 'input[data-testid="otp-field"]', `stable data-test attribute: ${pick('mat-input-3')}`);
  assert(pick('mat-input-4') === 'input[aria-label="מספר טלפון"]', `aria-label before placeholder: ${pick('mat-input-4')}`);
  assert(pick('mat-input-5') === 'input[placeholder="Branch"]', `placeholder before structural: ${pick('mat-input-5')}`);
  const cands = special(w, doc.getElementById('mat-input-2')).map((x) => x.stabilityHint);
  assert(cands.indexOf('formcontrolname') < cands.indexOf('placeholder'), 'chain order formcontrolname → placeholder');
  return 'item 2: fallback chain name → autocomplete → formcontrolname / data-test → aria-label → placeholder → anchored structural';
}

function checkAnchored(c) {
  const w = loadDom(c.sources, `<app-search><input id="mat-input-0" type="text" /></app-search><div id="slot">${twinDialog(4)}</div>`);
  const doc = w.document;
  const first = doc.getElementById('mat-input-4');
  const second = doc.getElementById('mat-input-5');
  const l1 = chosenFor(w, special(w, first), first);
  const l2 = chosenFor(w, special(w, second), second);
  assert(l1 && l2 && l1 !== l2 && /^app-login-dialog\b/.test(l1) && /nth-of-type/.test(l1), `twin inputs (no name / autocomplete / aria / placeholder) → anchored + nth-of-type: ${l1} | ${l2}`);
  const pickL1 = chosenFor(w, specialPick(w, first), first);
  assert(pickL1 === l1, 'Visual builder produces the same anchored locator');
  doc.getElementById('slot').innerHTML = twinDialog(9);
  assert(doc.querySelectorAll(l1).length === 1 && doc.querySelectorAll(l1)[0] === doc.getElementById('mat-input-9'), 'anchored locator survives re-creation (first field)');
  assert(doc.querySelectorAll(l2)[0] === doc.getElementById('mat-input-10'), 'anchored locator survives re-creation (second field)');
  const lone = loadDom(c.sources, `<div role="dialog" class="login-box"><input id="mat-input-7" type="password" /></div><input id="x1" type="password" />`);
  const le = lone.document.getElementById('mat-input-7');
  const loneLoc = chosenFor(lone, special(lone, le), le);
  assert(loneLoc === 'div[role="dialog"] input[type="password"]', `nth-of-type only when needed (plain role="dialog" anchor + type first): ${loneLoc}`);
  return 'anchored structural locator: nearest stable ancestor + input[type]; :nth-of-type only when needed; survives re-creation';
}

async function checkActions(c) {
  const w = loadDom(c.sources, PAGE(counterDialog(4, 0)));
  const doc = w.document;
  const opener = doc.getElementById('mat-button-1');
  const acts = w.collectSpecialAuthoringActionCandidates({ stableLocators: true });
  const a = acts.find((x) => x.visibleText === 'התחברות');
  assert(a && a.locator === 'button.secondary-action-button', `SPECIAL Analyze opener locator not on a generated id: ${a && a.locator}`);
  assert(acts.every((x) => !/mat-button|mat-menu-panel/.test(x.locator)), 'no action locator references a generated id (incl. aria-controls)');
  const picked = await pickByClick(w, opener, { mode: 'pick', pickTarget: 'action', stableLocators: true });
  assert(picked.ok === true && picked.locator === 'button.secondary-action-button', `SPECIAL opener pick: ${picked.locator}`);
  const defaultActs = w.collectSpecialAuthoringActionCandidates();
  assert(defaultActs.find((x) => x.visibleText === 'התחברות').locator === 'button.secondary-action-button', 'D-121-68: without the option the collector also skips the generated id');
  return 'item 3: SPECIAL opener / transition locators (Analyze + pick) follow the same rule';
}

async function checkStableUnchanged(c) {
  const w = loadDom(c.sources, STABLE_PAGE);
  const doc = w.document;
  for (const [id, action] of [['loginAnchor', true], ['logInBtn', true], ['username', false], ['password', false]]) {
    const el = doc.getElementById(id);
    const s = special(w, el, action);
    const d = w.__pageStructureInspectHelpers.buildCandidates(el, action ? { action: true } : undefined);
    assert(JSON.stringify(s) === JSON.stringify(d), `stable-id fixture ${id}: SPECIAL candidates identical to default`);
    assert(chosenFor(w, s, el) === `#${id}`, `stable-id fixture ${id}: #${id} still chosen`);
  }
  assert(!w.LocatorDeterminism.isUnstableId('iframeLogIn', doc), 'same-origin iframe #iframeLogIn id stays stable');
  assert(!w.LocatorDeterminism.isUnstableId('field-7', doc), 'a lone trailing-number id stays stable');
  return 'stable ids (#loginAnchor, #logInBtn, #iframeLogIn, #username) unchanged in SPECIAL';
}

async function checkStandardProof(c) {
  const fixtures = [
    [PAGE(counterDialog(4, 0)), false],
    [STABLE_PAGE, true],
    [`<app-search><input id="mat-input-0" type="text" /></app-search>${twinDialog(4)}`, false],
  ];
  for (const [html, stableIds] of fixtures) {
    const w = loadDom(c.sources, html);
    const els = [...w.document.querySelectorAll('input, button, a')];
    for (const el of els) {
      for (const action of [false, true]) {
        const opts = action ? { action: true } : undefined;
        const refInspect = d68InspectCandidates(w, el, opts);
        const refPick = d68PickCandidates(w, el, opts);
        assert(JSON.stringify(w.__pageStructureInspectHelpers.buildCandidates(el, opts)) === JSON.stringify(refInspect), `STANDARD Analyze candidates = pre-slice minus volatile + anchored (${el.id || el.tagName})`);
        assert(JSON.stringify(w.__visualTargetPickHelpers.buildCandidates(el, opts)) === JSON.stringify(refPick), `STANDARD Visual candidates = pre-slice minus volatile + anchored (${el.id || el.tagName})`);
        if (stableIds) {
          assert(JSON.stringify(refInspect) === JSON.stringify(legacyInspectCandidates(w, el, opts)) && JSON.stringify(refPick) === JSON.stringify(legacyPickCandidates(w, el, opts)), `stable ids: STANDARD candidates identical to the pre-slice builder (${el.id || el.tagName})`);
        }
      }
    }
    const page = w.collectSafePageStructure();
    for (const row of page.inputs) {
      const el = row.idAttr ? w.document.getElementById(row.idAttr) : null;
      if (el) assert(JSON.stringify(row.locatorCandidates) === JSON.stringify(d68InspectCandidates(w, el)), `STANDARD Analyze page = D-121-68 reference (${row.idAttr})`);
      if (row.idAttr && /^mat-input-/.test(row.idAttr)) assert(row.locatorCandidates.every((x) => !x.locator.includes('mat-input')), `STANDARD Analyze page never offers a generated id (${row.idAttr})`);
    }
  }
  const w = loadDom(c.sources, PAGE(counterDialog(4, 0)));
  const passEl = w.document.getElementById('mat-input-5');
  const std = await pickByClick(w, passEl, {});
  assert(std.ok === true && !std.locator.includes('mat-input') && w.document.querySelectorAll(std.locator).length === 1 && w.document.querySelector(std.locator) === passEl, `STANDARD Visual: generated id skipped, anchored exact-one locator (${std.locator})`);
  const stdFlag = await pickByClick(w, passEl, { stableLocators: true });
  assert(stdFlag.locator === std.locator, 'STANDARD Visual ignores stableLocators without a SPECIAL mode');
  const ph = loadDom(c.sources, '<app-login-dialog><form><input id="mat-input-5" placeholder="Branch" type="text" /></form></app-login-dialog>');
  const phEl = ph.document.getElementById('mat-input-5');
  for (const opts of [{}, { stableLocators: true }]) {
    const r = await pickByClick(ph, phEl, opts);
    assert(r.ok === true && r.locator === 'app-login-dialog input[type="text"]', `STANDARD Visual: placeholder stays SPECIAL-only, anchored fallback chosen (${r.locator})`);
  }
  const bg = c.bgSrc;
  // D-121-63: the fourth SPECIAL site is the authoring reveal's action snapshot (collectSpecialRevealActions).
  assert(bg.split('stableLocators: true').length - 1 === 4, 'background.js passes stableLocators from the four SPECIAL sites only');
  const stdInspect = bg.slice(bg.indexOf('var pickOptions = {'), bg.indexOf('var pickOptions = {') + 400);
  assert(!stdInspect.includes('stableLocators'), 'STANDARD Visual call site passes no option');
  const specialInspectAt = bg.indexOf('collectSpecialAuthoringActionCandidates({ stableLocators: true })');
  assert(specialInspectAt > bg.indexOf('121.1-IF — SPECIAL authoring frame surface'), 'option passed from the SPECIAL inspect block');
  revertD12148BackgroundEdits(bg);
  return 'STANDARD proof: stable ids → pre-slice candidates; generated ids → filtered + anchored (D-121-68); STANDARD Visual ignores the option; only SPECIAL sites pass it';
}

function checkNoRewrite(c) {
  for (const rel of listSrc()) {
    const src = read(rel);
    assert(!src.includes('stableLocators') && !src.includes('isUnstableId'), `${rel}: Hub / contract / runtime untouched (saved mappings never rewritten)`);
  }
  for (const rel of ['extension/generic/fill-executor.js', 'extension/generic/validated-autofill.js', 'extension/manifest.json']) {
    assert(!read(rel).includes('stableLocators'), `${rel}: runtime / manifest untouched`);
  }
  assert(!/hostname|serviceId|\.co\.il|\.com\b/.test(read(LD_FILE).slice(read(LD_FILE).indexOf('D-121-48'))), 'no site / hostname / serviceId branches');
  return 'item 4: no saved-mapping rewrite; Hub, contract, runtime, manifest untouched; no site branches';
}

function listSrc() {
  const out = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name);
      const r = `${rel}/${name}`;
      if (statSync(p).isDirectory()) walk(p, r);
      else if (/\.(ts|tsx)$/.test(name)) out.push(r);
    }
  };
  walk(join(root, 'src'), 'src');
  return out;
}

const GROUPS = [checkIdRule, checkCounterDialog, checkFallbackOrder, checkAnchored, checkActions, checkStableUnchanged, checkStandardProof, checkNoRewrite];

function baseCtx() {
  return { sources: Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(rel)])), bgSrc: read('extension/background.js') };
}
async function runGroups(c, log) {
  for (const g of GROUPS) {
    const what = await g(c);
    if (log) console.log(`  ✓ ${what}`);
  }
}

console.log('Phase 121 D-121-48 — SPECIAL stable locators (G9)\n');
await runGroups(baseCtx(), true);

function replaceOnce(src, from, to, id) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation ${id} anchor found ${n}×`);
  return src.replace(from, () => to);
}
const MUTATIONS = [
  { id: 'M1 generated-id rule off', file: LD_FILE, from: "    if (typeof id !== 'string' || !id.trim()) return false;\n    for (var i = 0; i < FRAMEWORK_ID_RES.length", to: "    return false;\n    for (var i = 0; i < FRAMEWORK_ID_RES.length" },
  { id: 'M2 SPECIAL extras gated into STANDARD (Analyze builder)', file: PSI_FILE, from: 'var stable = opts && opts.stableLocators === true ? volatileFilter : null;', to: 'var stable = volatileFilter;' },
  { id: 'M2b SPECIAL extras gated into STANDARD (Visual pick)', file: VTP_FILE, from: "var stableLocators = Boolean(mode) && options.stableLocators === true;", to: 'var stableLocators = true;' },
  { id: 'M2c volatile filter re-gated to SPECIAL only (Analyze builder)', file: PSI_FILE, from: 'var volatileFilter = global.LocatorDeterminism || null;', to: 'var volatileFilter = opts && opts.stableLocators === true ? global.LocatorDeterminism || null : null;' },
  { id: 'M2d volatile filter re-gated to SPECIAL only (Visual pick)', file: VTP_FILE, from: 'var volatileFilter = global.LocatorDeterminism || null;', to: 'var volatileFilter = opts && opts.stableLocators === true ? global.LocatorDeterminism || null : null;' },
  { id: 'M3 fallback skips the anchored ancestor', file: LD_FILE, from: '    if (!el || el.nodeType !== 1 || !doc) return [];\n    var leaf = leafSelector(el);', to: '    return [];\n    var leaf = leafSelector(el);' },
  { id: 'M4 unstable label[for] allowed', file: LD_FILE, from: 'var ID_REFERENCE_ATTRS = /^(id|for|aria-controls', to: 'var ID_REFERENCE_ATTRS = /^(id|aria-controls' },
  { id: 'M5 shared plugin aria-label not skipped', file: LD_FILE, from: 'var SHARED_ARIA_LABEL_MIN = 3;', to: 'var SHARED_ARIA_LABEL_MIN = 1e9;' },
  { id: 'M6 trailing-counter sibling rule off', file: LD_FILE, from: '    return hasLongHexRun(id) || hasLongDigitRun(id) || hasCounterSiblings(id, doc);', to: '    return hasLongHexRun(id) || hasLongDigitRun(id);' },
  { id: 'M7 placeholder before aria-label', file: PSI_FILE, from: "    var aria = el.getAttribute('aria-label');\n    if (aria && !(stable", to: "    if (stable) { var ph0 = stable.placeholderCandidate(el); if (ph0) push(ph0.locator, ph0.hint); }\n    var aria = el.getAttribute('aria-label');\n    if (aria && !(stable" },
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

console.log(`\nPASS — Phase 121 D-121-48 SPECIAL stable locators (${GROUPS.length} check groups, ${caught} mutations caught)`);
process.exit(0);
