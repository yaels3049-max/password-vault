/**
 * Phase 121 D-121-68 (+ amendment) — an id or name with a run of ≥ 8 digits is volatile;
 * the volatile-token filter and the anchored fallback apply in every authoring candidate
 * builder (STANDARD, FLOATING_SCREEN, SPECIAL; Analyze and Visual pick; fields and actions).
 * The real page scripts run in linkedom; the pre-slice scripts (revert helper) are the
 * regression reference. Synthetic fixtures only. Mutations at the end.
 * Usage: node scripts/verifyPhase121DigitRunIds.mjs
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { revertD12168LocatorEdits } from './lib/phase121D68LocatorEdits.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const git = (args) => execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(s).digest('hex');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const MTE_FILE = 'extension/generic/managed-target-eligibility.js';
const LD_FILE = 'extension/generic/locator-determinism.js';
const PSI_FILE = 'extension/generic/page-structure-inspect.js';
const VTP_FILE = 'extension/generic/visual-target-pick.js';
const PAGE_FILES = [MTE_FILE, LD_FILE, PSI_FILE, VTP_FILE];
const ORIGIN = 'https://fixture.example.test';
/** Pre-slice bytes (LF) of locator-determinism.js, as pinned by the D-121-52 verify. */
const LD_PRE_SLICE_SHA = 'ab741e0e25f07a03b4709f53e2fbac03c042b644dfd4b735a6d4dd5226061220';

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

async function pickByClick(w, el, options) {
  const p = w.armVisualTargetPick({ expectedOrigin: ORIGIN, fieldId: 'f', ...options });
  el.dispatchEvent(new w.Event('click', { bubbles: true }));
  return p;
}

const inspect = (w, el, opts) => w.__pageStructureInspectHelpers.buildCandidates(el, opts);
const visual = (w, el, opts) => w.__visualTargetPickHelpers.buildCandidates(el, opts);
function chosenFor(w, cands, el) {
  const c = w.LocatorDeterminism.chooseDeterministicLocator(cands, el, el.ownerDocument);
  return c && c.locator;
}
function resolvesTo(w, locator, el) {
  const m = w.document.querySelectorAll(locator);
  return m.length === 1 && m[0] === el;
}

/** Pattern surfaces: STANDARD (no option / no mode), FLOATING_SCREEN + SPECIAL (mode pick + stableLocators). */
const SURFACES = [
  { name: 'STANDARD', opts: undefined, pick: {} },
  { name: 'FLOATING_SCREEN / SPECIAL', opts: { stableLocators: true }, pick: { mode: 'pick', stableLocators: true } },
];

// ─── Fixtures ────────────────────────────────────────────────────────────────
const EMAIL_ID = (n) => `susi_email${n}`;
const N1 = '10180167914112292';
const N2 = '55501234987654321';
const withName = (n) => `<form class="signin-form"><input id="${EMAIL_ID(n)}" name="email" type="email" /><input id="pass" type="password" /></form>`;
const idOnly = (n) => `<div id="slot"><form class="signin-form"><input id="${EMAIL_ID(n)}" type="email" /><input id="pass" type="password" /></form></div>`;

// ─── Check groups ────────────────────────────────────────────────────────────
function checkRule(c) {
  const w = loadDom(c.sources, '<i></i>');
  const LD = w.LocatorDeterminism;
  const doc = w.document;
  for (const id of [EMAIL_ID(N1), 'susi_email12345678', 'x-20260930123456', '12345678']) {
    assert(LD.isUnstableId(id, doc), `id with a ≥ 8-digit run is unstable: ${id}`);
  }
  for (const id of ['step2', 'field_2024', 'otp6', 'user1234567', 'a1234567_7654321', 'username']) {
    assert(!LD.isUnstableId(id, doc), `id with ≤ 7-digit runs stays stable: ${id}`);
  }
  assert(LD.isUnstableName('email_1234567890') && LD.isUnstableName('f12345678'), 'name with a ≥ 8-digit run is unstable');
  for (const name of ['email', 'user1234567', 'field_2024', 'otp6']) {
    assert(!LD.isUnstableName(name), `name with ≤ 7-digit runs stays stable: ${name}`);
  }
  assert(LD.locatorReferencesUnstableId(`#${EMAIL_ID(N1)}`, doc) && LD.locatorReferencesUnstableId(`label[for="${EMAIL_ID(N1)}"]`, doc), 'digit-run id detected in #id and [for]');
  assert(LD.locatorReferencesUnstableId('input[name="email_1234567890"]', doc) && LD.locatorReferencesUnstableId('button[name="go_12345678"]', doc), 'digit-run name detected in [name=…]');
  assert(!LD.locatorReferencesUnstableId('input[name="user1234567"]', doc) && !LD.locatorReferencesUnstableId('#field_2024', doc), '≤ 7-digit name / id locators allowed');
  assert(!LD.locatorReferencesUnstableId('input[aria-label="code 12345678"]', doc), 'only id references and name are volatile tokens (aria-label text untouched)');
  return 'rule: an id or name with a run of ≥ 8 digits is volatile; ≤ 7-digit runs (step2, field_2024, otp6, user1234567) stay stable';
}

async function checkEbayFallback(c) {
  for (const s of SURFACES) {
    const w = loadDom(c.sources, withName(N1));
    const el = w.document.getElementById(EMAIL_ID(N1));
    const ins = inspect(w, el, s.opts);
    const vis = visual(w, el, s.opts);
    for (const cands of [ins, vis]) {
      assert(!cands.some((x) => x.locator.includes('susi_email')), `${s.name}: no candidate on the per-load id (${cands.map((x) => x.locator)})`);
    }
    assert(chosenFor(w, ins, el) === 'input[name="email"]' && chosenFor(w, vis, el) === 'input[name="email"]', `${s.name}: the next stable candidate (name) is chosen`);
    const clicked = await pickByClick(w, el, s.pick);
    assert(clicked.ok === true && clicked.locator === 'input[name="email"]' && clicked.meta.idAttr === EMAIL_ID(N1), `${s.name} Visual pick: stable locator; id kept as evidence (${clicked.locator})`);
  }
  for (const s of SURFACES) {
    const w = loadDom(c.sources, idOnly(N1));
    const el = w.document.getElementById(EMAIL_ID(N1));
    const ins = inspect(w, el, s.opts);
    const loc = chosenFor(w, ins, el);
    assert(loc === 'form.signin-form input[type="email"]', `${s.name} Analyze: nothing else left → anchored fallback (${loc})`);
    assert(ins.find((x) => x.locator === loc).matchCount === 1, `${s.name} Analyze: anchored candidate reports matchCount 1`);
    const page = w.collectSafePageStructure(s.opts);
    const row = page.inputs.find((i) => i.idAttr === EMAIL_ID(N1));
    assert(row && row.locatorCandidates.length && row.locatorCandidates.every((x) => !x.locator.includes('susi_email')), `${s.name} Analyze page: row offered without the per-load id`);
    const clicked = await pickByClick(w, el, s.pick);
    assert(clicked.ok === true && clicked.locator === loc, `${s.name} Visual pick: same anchored locator (${clicked.locator})`);
    w.document.getElementById('slot').innerHTML = idOnly(N2).replace(/^<div id="slot">|<\/div>$/g, '');
    const fresh = w.document.getElementById(EMAIL_ID(N2));
    assert(fresh && resolvesTo(w, loc, fresh), `${s.name}: after a re-render with a new number the locator is exact-one on the new field`);
    assert(w.document.querySelectorAll(`#${EMAIL_ID(N1)}`).length === 0, 'the old per-load id is gone after the re-render (the E1 failure)');
  }
  return 'eBay E1: #susi_email + 17 digits never offered; name chosen when present, otherwise the anchored fallback; exact-one after a re-render with a new number (STANDARD, FLOATING_SCREEN / SPECIAL; Analyze + Visual)';
}

async function checkNameRule(c) {
  const html = '<form class="f"><input id="email-box" name="email_1234567890" autocomplete="email" type="email" /><input name="user1234567" type="text" /><button name="go_1234567890" class="continue-btn">Continue</button></form>';
  for (const s of SURFACES) {
    const w = loadDom(c.sources, html);
    const el = w.document.querySelector('input[type="email"]');
    for (const cands of [inspect(w, el, s.opts), visual(w, el, s.opts)]) {
      assert(!cands.some((x) => x.stabilityHint === 'name'), `${s.name}: digit-run name candidate dropped (${cands.map((x) => x.locator)})`);
      assert(cands[0].locator === '#email-box', `${s.name}: stable id kept first`);
    }
    const noId = loadDom(c.sources, html.replace(' id="email-box"', ''));
    const el2 = noId.document.querySelector('input[type="email"]');
    assert(chosenFor(noId, inspect(noId, el2, s.opts), el2) === 'input[autocomplete="email"]', `${s.name}: next stable candidate (autocomplete) chosen`);
    const picked = await pickByClick(noId, el2, s.pick);
    assert(picked.ok === true && picked.locator === 'input[autocomplete="email"]', `${s.name} Visual pick: ${picked.locator}`);
    const short = noId.document.querySelector('input[name="user1234567"]');
    assert(inspect(noId, short, s.opts)[0].locator === 'input[name="user1234567"]', `${s.name}: ≤ 7-digit name kept`);
    const btn = noId.document.querySelector('button');
    const acts = inspect(noId, btn, s.opts ? { action: true, ...s.opts } : { action: true });
    assert(!acts.some((x) => x.locator.includes('go_1234567890')), `${s.name}: action name with a digit run dropped`);
    const act = await pickByClick(noId, btn, { mode: 'pick', pickTarget: 'action', ...(s.opts || {}) });
    assert(act.ok === true && act.locator === 'button.continue-btn', `${s.name} action pick: ${act.locator}`);
    const identified = noId.__visualTargetPickHelpers.identifyActionTarget(btn, noId.document, Boolean(s.opts));
    assert(identified.ok === true && identified.locator === 'button.continue-btn', `${s.name} identifyActionTarget: ${identified.locator}`);
    const collected = noId.collectSpecialAuthoringActionCandidates(s.opts);
    assert(collected.find((x) => x.visibleText === 'Continue').locator === 'button.continue-btn', `${s.name} action collector: stable locator`);
  }
  return 'name="email_1234567890" dropped → next stable candidate; action name dropped too (builder, identifyActionTarget, collector); ≤ 7-digit name kept';
}

function checkCollectors(c) {
  const w = loadDom(c.sources, `<form class="signin-form"><input id="${EMAIL_ID(N1)}" name="email_1234567890" type="email" /><input id="pw_20260930123456" type="password" /></form>`);
  const locs = w.collectSpecialEligibleCredentialLocators();
  const ins = w.collectSpecialEligibleCredentialInputs();
  for (const l of [...locs, ...ins.map((x) => x.locator)]) {
    assert(!/susi_email|email_1234567890|pw_2026/.test(l), `readiness collectors never report a volatile locator (${l})`);
  }
  assert(locs.includes('form.signin-form input[type="email"]') && locs.includes('form.signin-form input[type="password"]'), `readiness collectors use the anchored fallback (${locs})`);
  assert(ins.find((x) => x.password).locator === 'form.signin-form input[type="password"]', 'password flag kept on the anchored locator');
  return 'reveal readiness collectors (~298 / ~320, no option) filtered + anchored';
}

function checkNotOffered(c) {
  const w = loadDom(c.sources, `<input id="${EMAIL_ID(N1)}" type="email" /><input id="${EMAIL_ID(N2)}" type="email" />`);
  for (const id of [EMAIL_ID(N1), EMAIL_ID(N2)]) {
    const el = w.document.getElementById(id);
    for (const s of SURFACES) {
      assert(inspect(w, el, s.opts).length === 0 && visual(w, el, s.opts).length === 0, `${s.name}: no stable candidate → none emitted (${id})`);
    }
  }
  const page = w.collectSafePageStructure();
  assert(page.inputs.length === 0, 'Analyze: a control with no candidate left is not offered');
  return 'no candidate left → the control is not offered; a volatile locator is never emitted';
}

function checkRegression(c) {
  const fixtures = [
    '<form><input id="username" name="username" autocomplete="username" /><input id="password" name="password" type="password" /><button id="logInBtn" class="btn">Go</button></form>',
    '<form><input id="step2" name="field_2024" /><input id="otp6" name="otp6" /><input id="user1234567" name="user1234567" /><a id="loginAnchor" href="/login" aria-label="Login">Login</a></form>',
  ];
  for (const html of fixtures) {
    const now = loadDom(c.sources, html);
    const pre = loadDom(c.preSources, html);
    const nowEls = [...now.document.querySelectorAll('input, button, a')];
    const preEls = [...pre.document.querySelectorAll('input, button, a')];
    nowEls.forEach((el, i) => {
      for (const opts of [undefined, { action: true }, { stableLocators: true }, { action: true, stableLocators: true }]) {
        assert(JSON.stringify(inspect(now, el, opts)) === JSON.stringify(inspect(pre, preEls[i], opts)), `stable ids / names: Analyze candidates identical to today (${el.id} ${JSON.stringify(opts)})`);
        assert(JSON.stringify(visual(now, el, opts)) === JSON.stringify(visual(pre, preEls[i], opts)), `stable ids / names: Visual candidates identical to today (${el.id} ${JSON.stringify(opts)})`);
      }
    });
    assert(JSON.stringify(now.collectSafePageStructure().inputs.map((r) => r.locatorCandidates)) === JSON.stringify(pre.collectSafePageStructure().inputs.map((r) => r.locatorCandidates)), 'STANDARD Analyze page identical to today');
  }
  return 'regression: stable ids / names and ≤ 7-digit runs → candidates byte-identical to the pre-slice builders (STANDARD, FLOATING_SCREEN / SPECIAL; fields + actions)';
}

/** Reads the files on disk, so mutations are caught by behavior only. */
function checkScope(c) {
  assert(sha(revertD12168LocatorEdits(LD_FILE, read(LD_FILE))) === LD_PRE_SLICE_SHA, 'locator-determinism.js: only the recorded D-121-68 edits (revert = pinned pre-slice bytes)');
  for (const rel of [PSI_FILE, VTP_FILE]) revertD12168LocatorEdits(rel, read(rel));
  const ld = read(LD_FILE);
  const region = ld.slice(ld.indexOf('D-121-48 / D-121-68'), ld.indexOf('global.LocatorDeterminism = {'));
  assert(!/hostname|serviceId|susi|ebay|\.co\.il|\.com\b/i.test(region), 'no site / hostname / serviceId branches');
  for (const rel of ['extension/generic/fill-executor.js', 'extension/generic/validated-autofill.js']) {
    assert(!/isUnstableName|VOLATILE_DIGIT_RUN/.test(read(rel)), `${rel}: runtime resolution untouched`);
  }
  assert(git('diff HEAD -- extension/manifest.json') === '', 'manifest / permissions unchanged');
  for (const rel of ['src/assistedMapping/locatorDeterminism.ts', 'src/assistedMapping/mockProvider.ts']) {
    assert(!/isUnstableId|hasLongHexRun|\\d\{8/.test(read(rel)), `${rel}: the Hub has no mirror of the unstable-id rule (uses extension candidates only)`);
  }
  const bg = read('extension/background.js');
  assert(bg.split('stableLocators: true').length - 1 === 4, 'background.js call sites unchanged (four SPECIAL sites)');
  return 'scope: only the recorded locator edits; runtime, manifest, Hub, background call sites unchanged; no site branches';
}

const GROUPS = [checkRule, checkEbayFallback, checkNameRule, checkCollectors, checkNotOffered, checkRegression, checkScope];

function baseCtx() {
  const sources = Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(rel)]));
  const preSources = { ...sources };
  for (const rel of [LD_FILE, PSI_FILE, VTP_FILE]) preSources[rel] = revertD12168LocatorEdits(rel, sources[rel]);
  return { sources, preSources };
}
async function runGroups(c, log) {
  for (const g of GROUPS) {
    const what = await g(c);
    if (log) console.log(`  ✓ ${what}`);
  }
}

console.log('Phase 121 D-121-68 — digit-run ids / names, all patterns\n');
await runGroups(baseCtx(), true);

function replaceOnce(src, from, to, id) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation ${id} anchor found ${n}×`);
  return src.replace(from, () => to);
}
const REGATE_FROM = 'var volatileFilter = global.LocatorDeterminism || null;';
const REGATE_TO = 'var volatileFilter = opts && opts.stableLocators === true ? global.LocatorDeterminism || null : null;';
const ANCHOR_FROM = 'if (volatileFilter && !volatileFilter.chooseDeterministicLocator(out, el, doc)) {';
const ANCHOR_TO = 'if (stable && !volatileFilter.chooseDeterministicLocator(out, el, doc)) {';
const MUTATIONS = [
  { id: 'N1 threshold 8 → 9', file: LD_FILE, from: 'var VOLATILE_DIGIT_RUN = 8;', to: 'var VOLATILE_DIGIT_RUN = 9;' },
  { id: 'N2 threshold 8 → 7', file: LD_FILE, from: 'var VOLATILE_DIGIT_RUN = 8;', to: 'var VOLATILE_DIGIT_RUN = 7;' },
  { id: 'N3 digit-run id rule removed', file: LD_FILE, from: 'return hasLongHexRun(id) || hasLongDigitRun(id) || hasCounterSiblings(id, doc);', to: 'return hasLongHexRun(id) || hasCounterSiblings(id, doc);' },
  { id: 'N4 name rule removed', file: LD_FILE, from: "      if (/^name$/i.test(m[1]) && isUnstableName(unescapeCss(m[2]))) return true;\n", to: '' },
  { id: 'N5 filter re-gated to SPECIAL only (Analyze)', file: PSI_FILE, from: REGATE_FROM, to: REGATE_TO },
  { id: 'N6 filter re-gated to SPECIAL only (Visual pick)', file: VTP_FILE, from: REGATE_FROM, to: REGATE_TO },
  { id: 'N7 anchored fallback removed for STANDARD (Analyze)', file: PSI_FILE, from: ANCHOR_FROM, to: ANCHOR_TO },
  { id: 'N8 anchored fallback removed for STANDARD (Visual pick)', file: VTP_FILE, from: ANCHOR_FROM, to: ANCHOR_TO },
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

console.log(`\nPASS — Phase 121 D-121-68 digit-run ids / names (${GROUPS.length} check groups, ${caught} mutations caught)`);
process.exit(0);
