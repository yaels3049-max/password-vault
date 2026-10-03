/**
 * Phase 121 D-121-52 — Analyze inspect readiness waits for Managed-eligible inputs (all patterns).
 * Early-exit only when ≥1 input is managedEligible and no visible input is still ineligible;
 * otherwise poll within the existing bounds; on timeout return the last snapshot (today's result).
 * Real eligibility (V8 hit test) + locator + inspect scripts in linkedom; overlay-driven hit test;
 * the snapshot goes through the real Hub safety validation. Each fixture also runs on the
 * pre-slice inspect script (revert helper) to prove the change. Synthetic fixtures only.
 * Usage: node scripts/verifyPhase121InspectReadinessEligible.mjs
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { revertD12149EligibilityEdits } from './lib/phase121D49EligibilityEdits.mjs';
import { revertD12152ReadinessEdits } from './lib/phase121D52ReadinessEdits.mjs';
import { revertD12168LocatorEdits } from './lib/phase121D68LocatorEdits.mjs';
import { revertD12170ValidatedAutofillEdits } from './lib/phase121D70ValidatedAutofillEdits.mjs';
import { revertD12171EligibilityEdits } from './lib/phase121D71Edits.mjs';
import { withTempDir } from './lib/tempDir.mjs';

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
const PAGE_FILES = [MTE_FILE, LD_FILE, PSI_FILE];
const ORIGIN = 'https://fixture.example.test';
const ROW_H = 40;

// ─── Hub safety validation (real module) ────────────────────────────────────
const { applySafetyAndConfidence } = await withTempDir('pv-12152-', async (dir) => {
  const hubOut = join(dir, 'safety.mjs');
  await build({
    entryPoints: [join(root, 'src/assistedMapping/safetyValidation.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: hubOut,
    logLevel: 'silent',
  });
  return import(pathToFileURL(hubOut).href);
});

const SCHEMA = [
  { fieldId: 'id', label: 'ID' },
  { fieldId: 'password', label: 'Password', type: 'password' },
  { fieldId: 'code', label: 'Code' },
];
const FIELD_TO_ID = { id: 'acct-id', password: 'acct-pass', code: 'acct-code' };

/** Stand-in for the identification surface: it always finds the three fields (as in M1). */
function hubOutcome(page) {
  const rawProposals = [];
  for (const [fieldId, idAttr] of Object.entries(FIELD_TO_ID)) {
    const row = page.inputs.find((i) => i.idAttr === idAttr);
    if (!row) continue;
    rawProposals.push({ fieldId, observedInputId: row.inputId, locator: `#${idAttr}`, modelConfidence: 'high', evidence: ['label'] });
  }
  const r = applySafetyAndConfidence({ requestId: 'r-12152', serviceId: 'svc', schema: SCHEMA, page, rawProposals });
  return {
    status: r.status,
    proposals: r.proposals.filter((p) => p.confidence === 'high' || p.confidence === 'medium').length,
    unmapped: r.unmappedFieldIds.length,
    ineligible: (r.identifiedButManagedIneligible || []).length,
  };
}

// ─── DOM harness ─────────────────────────────────────────────────────────────
/**
 * Inputs carry data-row (vertical slot). `w.__cover(el)` → true while an overlay covers it.
 * elementFromPoint returns the overlay for a covered row, else the row's element.
 */
function loadDom(sources, html) {
  const { window } = parseHTML(`<!DOCTYPE html><html><body>${html}<div id="overlay"></div></body></html>`);
  Object.defineProperty(window, 'location', {
    value: { href: `${ORIGIN}/login/#/LOGIN_PAGE`, origin: ORIGIN, protocol: 'https:' },
    configurable: true,
  });
  window.top = window;
  window.innerWidth = 1024;
  window.innerHeight = 768;
  window.getComputedStyle = (el) => ({
    display: el && el.getAttribute && el.getAttribute('data-display') === 'none' ? 'none' : 'block',
    visibility: 'visible',
    opacity: '1',
    pointerEvents: 'auto',
  });
  const Proto = window.HTMLElement.prototype;
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    const row = Number(this.getAttribute && this.getAttribute('data-row'));
    if (!Number.isFinite(row) || this.getAttribute('data-row') === null) {
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 };
    }
    const top = row * ROW_H;
    return { width: 400, height: ROW_H - 2, top, left: 0, bottom: top + ROW_H - 2, right: 400 };
  };
  Proto.getClientRects = function getClientRects() {
    const r = this.getBoundingClientRect();
    return r.width > 0 ? [r] : [];
  };
  Proto.scrollIntoView = function scrollIntoView() {};
  const doc = window.document;
  window.__cover = () => false;
  window.__snapshots = 0;
  doc.elementFromPoint = (_x, y) => {
    const row = Math.floor(y / ROW_H);
    const el = doc.querySelector(`[data-row="${row}"]`);
    if (!el) return null;
    return window.__cover(el) ? doc.getElementById('overlay') : el;
  };
  const qsa = doc.querySelectorAll.bind(doc);
  doc.querySelectorAll = (sel) => {
    if (sel === 'input, textarea') window.__snapshots += 1;
    return qsa(sel);
  };
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  window.CSS = globalThis.CSS;
  for (const rel of PAGE_FILES) {
    new Function('window', 'document', 'globalThis', 'CSS', `${sources[rel]}\n//# sourceURL=${rel}`)(window, doc, window, globalThis.CSS);
  }
  return window;
}

const LOGIN_FORM = `
  <form>
    <label for="acct-id">ID</label><input id="acct-id" name="acct-id" type="text" data-row="1" />
    <label for="acct-pass">Password</label><input id="acct-pass" name="acct-pass" type="password" data-row="2" />
    <label for="acct-code">Code</label><input id="acct-code" name="acct-code" type="text" data-row="3" />
  </form>`;

const inspect = (w, maxTotalWaitMs, pollIntervalMs) =>
  w.collectSafePageStructureWithReadiness({ expectedOrigin: ORIGIN, maxTotalWaitMs, pollIntervalMs });
const inputsKey = (page) => JSON.stringify(page.inputs);

/** Overlay covers `ids` until `ms` after start (Infinity = permanently). */
function coverFor(w, ids, ms) {
  const until = Date.now() + ms;
  w.__cover = (el) => ids.includes(el.id) && Date.now() < until;
}

// ─── Check groups ────────────────────────────────────────────────────────────
async function checkOverlayThenUncovered(c) {
  const OVERLAY_MS = 600;
  const w = loadDom(c.sources, LOGIN_FORM);
  coverFor(w, ['acct-id', 'acct-pass', 'acct-code'], OVERLAY_MS);
  const r = await inspect(w, 3000, 100);
  assert(r.ok === true, `overlay: ok (${JSON.stringify(r)})`);
  assert(r.readiness.earlyExit === true && r.readiness.timedOut === false, `overlay: early exit once uncovered (${JSON.stringify(r.readiness)})`);
  assert(r.readiness.waitedMs >= OVERLAY_MS - 150, `overlay: waited for the overlay to clear (waitedMs=${r.readiness.waitedMs})`);
  assert(r.readiness.waitedMs < 3000, `overlay: well inside the max wait (waitedMs=${r.readiness.waitedMs})`);
  assert(r.page.inputs.length === 3 && r.page.inputs.every((i) => i.managedEligible === true), 'overlay: snapshot taken when all 3 inputs are Managed-eligible');
  assert(r.readiness.eligibleInputs === 3 && r.readiness.visibleIneligibleInputs === 0, `overlay: readiness counts reported (${JSON.stringify(r.readiness)})`);
  const hub = hubOutcome(r.page);
  assert(hub.status === 'ok' && hub.proposals === 3 && hub.unmapped === 0 && hub.ineligible === 0, `overlay: Analyze proposes all 3 fields (${JSON.stringify(hub)})`);

  if (c.checkPreSlice) {
    const p = loadDom(c.preSliceSources, LOGIN_FORM);
    coverFor(p, ['acct-id', 'acct-pass', 'acct-code'], OVERLAY_MS);
    const pr = await inspect(p, 3000, 100);
    const ph = hubOutcome(pr.page);
    assert(p.__snapshots === 1 && pr.page.inputs.every((i) => i.managedEligible === false), 'pre-slice reproduces M1: first-poll snapshot, all inputs ineligible');
    assert(ph.status === 'no_confident_mapping' && ph.proposals === 0 && ph.unmapped === 3 && ph.ineligible === 3, `pre-slice reproduces M1: no_confident_mapping, 0 proposals, 3 unmapped (${JSON.stringify(ph)})`);
  }

  // Partial overlay (banner over one field): still waits for that visible field.
  const b = loadDom(c.sources, LOGIN_FORM);
  coverFor(b, ['acct-pass'], OVERLAY_MS);
  const br = await inspect(b, 3000, 100);
  assert(br.readiness.earlyExit === true && br.readiness.waitedMs >= OVERLAY_MS - 150, `partial overlay: waits until the covered visible field clears (waitedMs=${br.readiness.waitedMs})`);
  const bh = hubOutcome(br.page);
  assert(bh.status === 'ok' && bh.proposals === 3, `partial overlay: Analyze proposes all 3 fields (${JSON.stringify(bh)})`);
  return 'rule 1: inputs present but overlaid (all / one) for N ms → keeps polling, snapshot once eligible → Analyze proposes; pre-slice code gives the M1 result';
}

async function checkEligibleAtOnce(c) {
  const w = loadDom(c.sources, LOGIN_FORM);
  const r = await inspect(w, 3000, 250);
  assert(r.readiness.earlyExit === true && r.readiness.timedOut === false, 'eligible at once: early exit');
  assert(w.__snapshots === 1, `eligible at once: exits on the first poll (snapshots=${w.__snapshots})`);
  assert(r.readiness.waitedMs < 250, `eligible at once: no poll interval waited (waitedMs=${r.readiness.waitedMs})`);
  if (c.checkPreSlice) {
    const p = loadDom(c.preSliceSources, LOGIN_FORM);
    const pr = await inspect(p, 3000, 250);
    assert(inputsKey(pr.page) === inputsKey(r.page) && pr.readiness.earlyExit === true && p.__snapshots === 1, 'eligible at once: same snapshot and same first-poll exit as pre-slice');
    assert(JSON.stringify(hubOutcome(pr.page)) === JSON.stringify(hubOutcome(r.page)), 'eligible at once: same Analyze result as pre-slice');
  }

  // Ineligible but not visible (display:none / disabled) never blocks the early exit.
  const hidden = loadDom(
    c.sources,
    `${LOGIN_FORM}
    <input id="later-otp" name="later-otp" type="text" data-display="none" data-row="5" />
    <input id="locked" name="locked" type="text" disabled data-row="6" />`,
  );
  const hEl = hidden.document.getElementById('locked');
  assert(hEl.disabled === true, 'fixture: disabled attribute reflected');
  const hr = await inspect(hidden, 3000, 250);
  const rows = Object.fromEntries(hr.page.inputs.map((i) => [i.idAttr, i]));
  assert(rows['later-otp'] && rows['later-otp'].visible === false && rows['later-otp'].managedEligible === false, 'fixture: display:none input observed as not visible');
  assert(hr.readiness.earlyExit === true && hidden.__snapshots === 1, `non-visible ineligible inputs do not block the first-poll exit (snapshots=${hidden.__snapshots})`);
  assert(hr.readiness.eligibleInputs === 3 && hr.readiness.visibleIneligibleInputs === 0, `counts ignore non-visible ineligible inputs (${JSON.stringify(hr.readiness)})`);
  return 'rule 2: eligible at once → exits on the first poll with the pre-slice snapshot / result; hidden or disabled inputs do not delay it';
}

async function checkPermanentlyOccluded(c) {
  const MAX = 1200;
  for (const [what, ids] of [['one visible input', ['acct-code']], ['all inputs', ['acct-id', 'acct-pass', 'acct-code']]]) {
    const w = loadDom(c.sources, LOGIN_FORM);
    coverFor(w, ids, Infinity);
    const r = await inspect(w, MAX, 100);
    assert(r.ok === true && r.readiness.timedOut === true && r.readiness.earlyExit === false, `permanently occluded (${what}): times out (${JSON.stringify(r.readiness)})`);
    assert(r.readiness.waitedMs >= MAX && r.readiness.waitedMs < MAX + 600, `permanently occluded (${what}): bounded by the max wait (waitedMs=${r.readiness.waitedMs})`);
    assert(w.__snapshots > 3, `permanently occluded (${what}): kept polling (snapshots=${w.__snapshots})`);
    assert(r.readiness.visibleIneligibleInputs === ids.length && r.readiness.eligibleInputs === 3 - ids.length, `permanently occluded (${what}): counts (${JSON.stringify(r.readiness)})`);
    assert(r.page.inputs.length === 3, `permanently occluded (${what}): returns the last snapshot`);
    if (c.checkPreSlice) {
      const p = loadDom(c.preSliceSources, LOGIN_FORM);
      coverFor(p, ids, Infinity);
      const pr = await inspect(p, MAX, 100);
      assert(inputsKey(pr.page) === inputsKey(r.page), `permanently occluded (${what}): same snapshot as today`);
      assert(JSON.stringify(hubOutcome(pr.page)) === JSON.stringify(hubOutcome(r.page)), `permanently occluded (${what}): same Analyze result as today (${JSON.stringify(hubOutcome(r.page))})`);
    }
  }
  return 'rule 3: permanently occluded visible input(s) → polls to the max wait, returns the last snapshot = today\'s snapshot and Analyze result';
}

async function checkNoInputs(c) {
  const MAX = 700;
  const html = '<main><p>Loading…</p></main>';
  const w = loadDom(c.sources, html);
  const r = await inspect(w, MAX, 100);
  assert(r.ok === true && r.readiness.timedOut === true && r.readiness.earlyExit === false && r.page.inputs.length === 0, `no inputs: times out with an empty snapshot (${JSON.stringify(r.readiness)})`);
  assert(r.readiness.waitedMs >= MAX && w.__snapshots > 1, 'no inputs: polled to the max wait');
  assert(r.readiness.eligibleInputs === 0 && r.readiness.visibleIneligibleInputs === 0, 'no inputs: zero counts');
  if (c.checkPreSlice) {
    const p = loadDom(c.preSliceSources, html);
    const pr = await inspect(p, MAX, 100);
    assert(pr.readiness.timedOut === true && pr.page.inputs.length === 0, 'no inputs: same as pre-slice');
  }
  // Only non-visible inputs (none eligible): today's timeout, not an early exit.
  const h = loadDom(c.sources, '<input id="x" name="x" type="text" data-display="none" data-row="1" />');
  const hr = await inspect(h, MAX, 100);
  assert(hr.readiness.timedOut === true && hr.page.inputs.length === 1, `no eligible input at all → times out (${JSON.stringify(hr.readiness)})`);
  const o = loadDom(c.sources, LOGIN_FORM);
  const origin = await o.collectSafePageStructureWithReadiness({ expectedOrigin: 'https://other.example.test', maxTotalWaitMs: 300, pollIntervalMs: 100 });
  assert(origin.ok === false && origin.reason === 'origin_mismatch', 'origin mismatch unchanged');
  return 'rule 4: no inputs / no eligible input → today\'s timeout result; origin bind unchanged';
}

/** Reads the files on disk (not the per-run sources), so mutations are caught by behavior only. */
function checkScope(c) {
  // D-121-68 (authorized later) changed the candidate builder; its edits are reverted first.
  const psi = revertD12168LocatorEdits(PSI_FILE, read(PSI_FILE));
  // D-121-57 (authorized later) added four negative words to ACTION_INTENT_VOCABULARY.
  const d57Words = "      'נגישות',\n      'נגיש',\n      'accessibility',\n      'accessible',\n";
  assert(psi.split(d57Words).length === 2, 'D-121-57 accessibility words present exactly once');
  const reverted = revertD12152ReadinessEdits(psi.replace(d57Words, ''));
  assert(sha(reverted) === 'c4dd466db55e558840fbf7c45e1ab751058cf699ff28fe24a3fcc3d654965ec5', 'page-structure-inspect.js untouched outside the D-121-52 edits');
  const head = git(`show HEAD:${PSI_FILE}`);
  const oldRule = '      var eligibleCount = Array.isArray(page.inputs) ? page.inputs.length : 0;\n\n      if (eligibleCount > 0) {\n';
  assert(reverted.includes(oldRule) && head.includes(oldRule), 'pre-slice rule = the committed Phase 119 early-exit rule');
  const fnStart = psi.indexOf('function inspectReadinessCounts');
  const fn = psi.slice(fnStart, psi.indexOf('var ACTION_INTENT_VOCABULARY', fnStart));
  assert(fnStart > 0 && fn.includes('counts.eligibleInputs > 0') && !/\.value\b|document\.cookie|localStorage|sessionStorage|hostname|serviceId|\.co\.il/.test(fn), 'readiness: counts from flags only; no values / storage / site branches');
  assert(
    revertD12149Ok(),
    'managed-target-eligibility.js (hit-test rules, D-121-49) untouched',
  );
  const PINS = {
    'extension/generic/validated-autofill.js': c.pins['extension/generic/validated-autofill.js'],
    'extension/generic/fill-executor.js': c.pins['extension/generic/fill-executor.js'],
    [LD_FILE]: c.pins[LD_FILE],
  };
  for (const [rel, pin] of Object.entries(PINS)) {
    const bytes =
      rel === LD_FILE
        ? revertD12168LocatorEdits(rel, read(rel))
        : rel === 'extension/generic/validated-autofill.js'
          ? revertD12170ValidatedAutofillEdits(read(rel))
          : read(rel);
    assert(sha(bytes) === pin, `${rel} byte-identical (runtime fill / locator rules unchanged)`);
  }
  assert(git('show HEAD:extension/manifest.json') === read('extension/manifest.json'), 'manifest unchanged');
  const bg = read('extension/background.js');
  assert(bg.includes('ADMIN_INSPECT_READINESS_MAX_WAIT_MS = 10000') && bg.includes('ADMIN_INSPECT_READINESS_POLL_MS = 250'), 'existing bounds 10 s / 250 ms unchanged');
  for (const files of [bg.match(/SPECIAL_INSPECT_FILES\s*=\s*\[[^\]]*\]/), bg.match(/files:\s*\[[^\]]*page-structure-inspect\.js[^\]]*\]/)]) {
    assert(files && files[0].indexOf('managed-target-eligibility.js') >= 0 && files[0].indexOf('managed-target-eligibility.js') < files[0].indexOf('page-structure-inspect.js'), 'eligibility injected before inspect (STANDARD + SPECIAL Analyze)');
  }
  return 'scope: only the readiness decision changed (revert = pinned pre-slice bytes); eligibility / runtime fill / locators / manifest / bounds unchanged';
}

function revertD12149Ok() {
  // D-121-71 (authorized later) changed the hit-test point rule; reverted first.
  return revertD12149EligibilityEdits(revertD12171EligibilityEdits(read(MTE_FILE))) === git(`show HEAD:${MTE_FILE}`);
}

const GROUPS = [checkOverlayThenUncovered, checkEligibleAtOnce, checkPermanentlyOccluded, checkNoInputs, checkScope];

/** Pre-slice bytes (LF) of files D-121-52 must not touch. */
const PINS_NOW = {
  'extension/generic/validated-autofill.js': '37b0358a387157d64137f17b757efb743654e3070f4e10994f94ece93e210275',
  'extension/generic/fill-executor.js': '9739554c79e31b438f0905254dafbb3e85a118b523101b8c4b9d568704160e53',
  [LD_FILE]: 'ab741e0e25f07a03b4709f53e2fbac03c042b644dfd4b735a6d4dd5226061220',
};

function baseCtx() {
  const sources = Object.fromEntries(PAGE_FILES.map((rel) => [rel, read(rel)]));
  const preSliceSources = { ...sources, [PSI_FILE]: revertD12152ReadinessEdits(sources[PSI_FILE]) };
  return { sources, preSliceSources, checkPreSlice: true, pins: PINS_NOW };
}
async function runGroups(c, log) {
  for (const g of GROUPS) {
    const what = await g(c);
    if (log) console.log(`  ✓ ${what}`);
  }
}

console.log('Phase 121 D-121-52 — inspect readiness waits for Managed-eligible inputs\n');
await runGroups(baseCtx(), true);

function replaceOnce(src, from, to, id) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation ${id} anchor found ${n}×`);
  return src.replace(from, () => to);
}
const EXIT = '      if (counts.eligibleInputs > 0 && counts.visibleIneligibleInputs === 0) {';
const MUTATIONS = [
  { id: 'M1 early exit on any input (pre-slice rule)', from: EXIT, to: '      if (Array.isArray(page.inputs) && page.inputs.length > 0) {' },
  { id: 'M2 visible-ineligible condition dropped', from: EXIT, to: '      if (counts.eligibleInputs > 0) {' },
  { id: 'M3 ≥1 eligible condition dropped', from: EXIT, to: '      if (counts.visibleIneligibleInputs === 0) {' },
  { id: 'M4 hidden ineligible inputs block the exit', from: '      else if (list[i].visible === true) visibleIneligible += 1;', to: '      else visibleIneligible += 1;' },
  { id: 'M5 eligibility read from observation flag', from: '      if (list[i].managedEligible === true) eligible += 1;', to: '      if (list[i].visible === true) eligible += 1;' },
  { id: 'M6 timeout drops the last snapshot', from: '      if (waitedMs >= maxTotalWaitMs) {\n        return {\n          ok: true,\n          page: page,', to: '      if (waitedMs >= maxTotalWaitMs) {\n        return {\n          ok: true,\n          page: Object.assign({}, page, { inputs: [] }),' },
  { id: 'M7 max wait bound not honored', from: '      if (waitedMs >= maxTotalWaitMs) {', to: '      if (waitedMs >= maxTotalWaitMs * 2) {' },
];

console.log('\nMutations');
let caught = 0;
for (const mu of MUTATIONS) {
  const c = baseCtx();
  c.checkPreSlice = false;
  c.sources[PSI_FILE] = replaceOnce(c.sources[PSI_FILE], mu.from, mu.to, mu.id);
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

console.log(`\nPASS — Phase 121 D-121-52 inspect readiness (${GROUPS.length} check groups, ${caught} mutations caught)`);
process.exit(0);
