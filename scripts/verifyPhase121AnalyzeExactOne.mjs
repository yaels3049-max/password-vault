/**
 * Phase 121 D-121-54 — Analyze uses the same exact-one choice as Visual (all patterns).
 * A HIGH / MEDIUM row whose locator is not exact-one yields to the first exact-one
 * candidate of the SAME observed input (Visual `preferExactOneLocator` order / rule);
 * deterministic only if found; confidence unchanged; conflict checks on the final locators.
 * Real extension scripts (inspect + Visual) in linkedom; real Hub safety module.
 * Synthetic fixtures only (no site names).
 * Usage: node scripts/verifyPhase121AnalyzeExactOne.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
function replaceOnce(source, from, to, label) {
  const at = source.indexOf(from);
  if (at < 0 || source.indexOf(from, at + from.length) >= 0) {
    throw new Error(`fixture: anchor for "${label}" not found exactly once`);
  }
  return source.slice(0, at) + to + source.slice(at + from.length);
}

const SAFETY = 'src/assistedMapping/safetyValidation.ts';
const DET = 'src/assistedMapping/locatorDeterminism.ts';
const ORIGIN = 'https://fixture.example.test';

// ─── Hub module (overrides = mutations) ─────────────────────────────────────
function loadSafety(overrides = {}) {
  return withTempDir('pv-12154-', (outdir) => loadSafetyIn(outdir, overrides));
}
async function loadSafetyIn(outdir, overrides) {
  const outfile = join(outdir, 'safety.mjs');
  const byAbs = new Map(Object.entries(overrides).map(([rel, text]) => [resolve(root, rel), text]));
  await build({
    entryPoints: [join(root, SAFETY)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
    plugins: [
      {
        name: 'overrides',
        setup(b) {
          b.onLoad({ filter: /\.ts$/ }, (args) => {
            const text = byAbs.get(resolve(args.path));
            return text === undefined ? undefined : { contents: text, loader: 'ts' };
          });
        },
      },
    ],
  });
  return import(pathToFileURL(outfile).href);
}

// ─── Page (real inspect + Visual scripts) ───────────────────────────────────
function loadDom(html) {
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
  Proto.getClientRects = function getClientRects() {
    const top = Number((this.getAttribute('style') || '').match(/top:\s*(\d+)/)?.[1] ?? 0);
    return [{ width: 120, height: 24, top, left: 10, bottom: top + 24, right: 130 }];
  };
  Proto.getBoundingClientRect = function getBoundingClientRect() {
    const r = this.getClientRects()[0];
    return { ...r, x: r.left, y: r.top };
  };
  window.document.elementFromPoint = (x, y) => {
    const nodes = Array.from(window.document.querySelectorAll('input'));
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const r = nodes[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return nodes[i];
    }
    return null;
  };
  globalThis.CSS = { escape: (v) => String(v).replace(/([^a-zA-Z0-9_-])/g, '\\$1') };
  for (const rel of [
    'extension/generic/managed-target-eligibility.js',
    'extension/generic/locator-determinism.js',
    'extension/generic/page-structure-inspect.js',
    'extension/generic/visual-target-pick.js',
  ]) {
    new Function('window', 'document', 'globalThis', 'CSS', `${read(rel)}\n//# sourceURL=${rel}`)(
      window,
      window.document,
      window,
      globalThis.CSS,
    );
  }
  return window;
}

/** Visual's choice for the element: buildCandidates → preferExactOneLocator (+ same-target identity). */
function visualChoice(win, el, stableLocators) {
  const h = win.__visualTargetPickHelpers;
  const candidates = stableLocators ? h.buildCandidates(el, { stableLocators: true }) : h.buildCandidates(el);
  const chosen = h.preferExactOneLocator(candidates, win.document);
  if (!chosen || !h.assertLocatorDeterministic(chosen.locator, el, win.document)) return null;
  return chosen.locator;
}

const SCHEMA = [
  { fieldId: 'user', label: 'User' },
  { fieldId: 'password', label: 'Password', type: 'password' },
];
const raw = (fieldId, observedInputId, locator, modelConfidence = 'high') => ({
  fieldId,
  observedInputId,
  locator,
  modelConfidence,
  evidence: [{ category: 'type_affinity' }],
});
const run = (m, page, rawProposals) =>
  m.applySafetyAndConfidence({ requestId: 'r-12154', serviceId: 'svc', schema: SCHEMA, page, rawProposals });
const rowOf = (r, fieldId) => r.proposals.find((p) => p.fieldId === fieldId);
const prefill = (m, r) => m.applyConfidentPrefill({}, r);

/** Synthetic inspect page (no DOM) for fixture shapes a real page cannot produce. */
const cand = (locator, matchCount, stabilityHint = 'name') => ({ strategy: 'css', locator, stabilityHint, matchCount });
const inputRow = (inputId, locatorCandidates, extra = {}) => ({
  inputId,
  tagName: 'input',
  type: 'text',
  visible: true,
  managedEligible: true,
  editable: true,
  disabled: false,
  readOnly: false,
  locatorCandidates,
  ...extra,
});
const page = (inputs) => ({ schemaVersion: 1, pageOrigin: ORIGIN, inputs });

// ─── G1 duplicate id (S1 shape) → name locator proposed + prefilled ─────────
const DUP_HTML = `
  <input id="j_username" name="j_username" type="text" style="top:10px" />
  <input id="j_password" name="j_password" type="password" style="top:50px" />
  <input id="j_password" name="other_dup" type="text" style="top:90px" />`;
async function checkDuplicateId(m) {
  const win = loadDom(DUP_HTML);
  const pg = win.collectSafePageStructure();
  const pwd = pg.inputs.find((i) => i.nameAttr === 'j_password');
  const user = pg.inputs.find((i) => i.nameAttr === 'j_username');
  assert(pwd && user, 'fixture: inspect found the inputs');
  assert(pwd.locatorCandidates[0]?.locator === '#j_password' && pwd.locatorCandidates[0].matchCount === 2, 'fixture: first candidate is the duplicate id');
  for (const confidence of ['high', 'medium']) {
    const r = run(m, pg, [raw('user', user.inputId, '#j_username', confidence), raw('password', pwd.inputId, '#j_password', confidence)]);
    const row = rowOf(r, 'password');
    assert(row?.locator === 'input[name="j_password"]', `${confidence}: duplicate-id locator replaced by the name locator (got "${row?.locator}")`);
    assert(row.locatorDeterministic === true, `${confidence}: replaced locator is deterministic`);
    assert(row.confidence === confidence, `${confidence}: confidence unchanged (got ${row.confidence})`);
    assert(row.observedInputId === pwd.inputId, `${confidence}: same observed input`);
    const p = prefill(m, r);
    assert(p.appliedFieldIds.includes('password') && p.next.password === 'input[name="j_password"]', `${confidence}: name locator prefilled`);
    assert(p.next.user === '#j_username', `${confidence}: unique id row prefilled as today`);
    assert(r.warnings?.includes('locator_replaced_with_exact_one') && !r.warnings.includes('locator_not_deterministic'), `${confidence}: warnings show the replacement only`);
  }
  const low = run(m, pg, [raw('password', pwd.inputId, '#j_password', 'low')]);
  assert(rowOf(low, 'password')?.locator === '#j_password' && rowOf(low, 'password').confidence === 'low', 'LOW row untouched (only HIGH / MEDIUM rows are replaced)');
}

// ─── G2 exact-one locator → unchanged (even when not the first exact-one) ───
async function checkUniqueUnchanged(m) {
  const win = loadDom(`
    <input id="acct" name="acct" type="text" style="top:10px" />
    <input id="secret" name="secret" type="password" autocomplete="current-password" style="top:50px" />`);
  const pg = win.collectSafePageStructure();
  const user = pg.inputs.find((i) => i.nameAttr === 'acct');
  const pwd = pg.inputs.find((i) => i.nameAttr === 'secret');
  const r = run(m, pg, [raw('user', user.inputId, '#acct'), raw('password', pwd.inputId, 'input[name="secret"]')]);
  assert(rowOf(r, 'user')?.locator === '#acct' && rowOf(r, 'user').locatorDeterministic === true, 'unique id kept');
  assert(rowOf(r, 'password')?.locator === 'input[name="secret"]' && rowOf(r, 'password').locatorDeterministic === true, 'exact-one locator that is not the first exact-one candidate kept as chosen');
  assert(!r.warnings?.includes('locator_replaced_with_exact_one'), 'no replacement warning when every locator is exact-one');
}

// ─── G3 no exact-one candidate → today's «אינו חד-משמעי» ────────────────────
async function checkNoExactOne(m) {
  const win = loadDom(`
    <input id="dup" name="dup" type="password" autocomplete="current-password" style="top:10px" />
    <input id="dup" name="dup" type="password" autocomplete="current-password" style="top:50px" />`);
  const pg = win.collectSafePageStructure();
  const first = pg.inputs[0];
  assert(first && first.locatorCandidates.length >= 2 && first.locatorCandidates.every((c) => c.matchCount !== 1), 'fixture: no exact-one candidate');
  const r = run(m, pg, [raw('password', first.inputId, '#dup')]);
  const row = rowOf(r, 'password');
  assert(row?.locator === '#dup', `locator unchanged when no exact-one candidate exists (got "${row?.locator}")`);
  assert(row.locatorDeterministic === false && row.confidence === 'high', 'identified, not deterministic, confidence kept (today)');
  assert(r.warnings?.includes('locator_not_deterministic') && !r.warnings.includes('locator_replaced_with_exact_one'), 'today\'s warning, no replacement');
  assert(prefill(m, r).appliedFieldIds.length === 0, 'nothing prefilled');
  const label = read('src/assistedMapping/types.ts').match(/LOCATOR_NOT_DETERMINISTIC_LABEL_HE\s*=\s*'([^']*)'/)?.[1] ?? '';
  assert(label.includes('אינו חד-משמעי'), 'the editor label for this state is still «…אינו חד-משמעי…»');
}

// ─── G4 never crosses inputs ────────────────────────────────────────────────
async function checkSameInputOnly(m) {
  const pg = page([
    inputRow('in-1', [cand('#shared', 2, 'id'), cand('input[name="shared"]', 2)]),
    inputRow('in-2', [cand('#other', 1, 'id'), cand('input[name="other"]', 1)], { type: 'password' }),
  ]);
  const r = run(m, pg, [raw('user', 'in-1', '#shared')]);
  const row = rowOf(r, 'user');
  assert(row?.locator === '#shared' && row.observedInputId === 'in-1', `never takes another input's exact-one locator (got "${row?.locator}" on ${row?.observedInputId})`);
  assert(row.locatorDeterministic === false, 'stays non-deterministic');
}

// ─── G5 conflicts run on the final locators ─────────────────────────────────
async function checkConflicts(m) {
  // Collision created by the replacement → both demoted, nothing prefilled.
  const collide = page([
    inputRow('in-1', [cand('#dup', 2, 'id'), cand('input[name="x"]', 1)]),
    inputRow('in-2', [cand('input[name="x"]', 1)], { type: 'password' }),
  ]);
  const r = run(m, collide, [raw('user', 'in-1', '#dup'), raw('password', 'in-2', 'input[name="x"]')]);
  assert(rowOf(r, 'user')?.confidence === 'unknown' && rowOf(r, 'password')?.confidence === 'unknown', 'two fields ending on the same locator are both demoted');
  assert(r.warnings?.includes('conflict_demoted'), 'conflict warning');
  assert(prefill(m, r).appliedFieldIds.length === 0, 'no prefill after a conflict');

  // A shared non-unique locator on two inputs resolves to each input's own exact-one → no conflict.
  const split = page([
    inputRow('in-1', [cand('#dup', 2, 'id'), cand('input[name="a"]', 1)]),
    inputRow('in-2', [cand('#dup', 2, 'id'), cand('input[name="b"]', 1)], { type: 'password' }),
  ]);
  const s = run(m, split, [raw('user', 'in-1', '#dup'), raw('password', 'in-2', '#dup')]);
  assert(rowOf(s, 'user')?.locator === 'input[name="a"]' && rowOf(s, 'password')?.locator === 'input[name="b"]', 'each field ends on its own input\'s exact-one locator');
  assert(rowOf(s, 'user').confidence === 'high' && rowOf(s, 'password').confidence === 'high' && !s.warnings?.includes('conflict_demoted'), 'no conflict on distinct final locators');
}

// ─── G6 Visual and Analyze choose the same locator for the same element ─────
async function checkVisualParity(m) {
  const cases = [
    ['S1 shape (dup id, unique name)', DUP_HTML, 'input[name="j_password"]', false],
    [
      'dup id + dup name → autocomplete (first of several exact-one)',
      `<input id="p" name="p" type="password" autocomplete="current-password" aria-label="Secret" style="top:10px" />
       <input id="p" name="p" type="text" style="top:50px" />`,
      'input[type="password"]',
      false,
    ],
    ['SPECIAL stable candidates (dup id, unique name)', DUP_HTML, 'input[name="j_password"]', true],
  ];
  for (const [label, html, pick, stable] of cases) {
    const win = loadDom(html);
    const el = win.document.querySelector(pick);
    assert(el, `fixture: ${label}: element`);
    const pg = stable ? win.collectSafePageStructure({ stableLocators: true }) : win.collectSafePageStructure();
    const idx = Array.from(win.document.querySelectorAll('input')).indexOf(el);
    const observed = pg.inputs[idx];
    const h = win.__visualTargetPickHelpers;
    const visualList = (stable ? h.buildCandidates(el, { stableLocators: true }) : h.buildCandidates(el)).map((c) => c.locator);
    assert(JSON.stringify(observed.locatorCandidates.map((c) => c.locator)) === JSON.stringify(visualList), `fixture: ${label}: inspect and Visual build the same candidate list`);
    const visual = visualChoice(win, el, stable);
    assert(visual, `fixture: ${label}: Visual finds an exact-one locator`);
    const aiPick = observed.locatorCandidates[0].locator;
    const r = run(m, pg, [raw('password', observed.inputId, aiPick)]);
    const row = rowOf(r, 'password');
    assert(row?.locator === visual && row.locatorDeterministic === true, `${label}: Analyze chose "${row?.locator}", Visual chose "${visual}"`);
  }
}

// ─── G7 static scope ────────────────────────────────────────────────────────
function checkStatic() {
  const safety = read(SAFETY);
  const det = read(DET);
  assert(/preferExactOneCandidate\(observed\)/.test(safety), 'replacement reads only the observed input');
  assert(/locatorCandidateIsDeterministic\(candidate\)/.test(det) && /candidate\.matchCount === 1/.test(det), 'exact-one = inspect matchCount === 1 (Visual querySelectorAll length === 1)');
  const at = safety.indexOf('preferExactOneCandidate(observed)');
  assert(at > 0 && at < safety.indexOf('const byField = new Map'), 'replacement happens before the conflict checks');
  assert(safety.includes('locatorDeterministic !== true'), 'prefill still requires a deterministic locator');
  assert(!/\bshufersal\b|\bj_password\b|serviceId\s*===|hostname\s*===|\.co\.il/i.test(safety + det), 'no site branches');
}

// ─── Runner ─────────────────────────────────────────────────────────────────
const GROUPS = [
  ['G1 duplicate id → name locator proposed + prefilled (HIGH / MEDIUM; LOW untouched)', checkDuplicateId],
  ['G2 exact-one locator unchanged', checkUniqueUnchanged],
  ['G3 no exact-one candidate → today\'s «אינו חד-משמעי»', checkNoExactOne],
  ['G4 never crosses inputs', checkSameInputOnly],
  ['G5 conflicts on the final locators', checkConflicts],
  ['G6 Visual and Analyze choose the same locator', checkVisualParity],
];
async function runAll(overrides) {
  const m = await loadSafety(overrides);
  for (const [, fn] of GROUPS) await fn(m);
}

console.log('Phase 121 D-121-54 — Analyze exact-one choice = Visual\n');
const baseline = await loadSafety();
for (const [label, fn] of GROUPS) {
  await fn(baseline);
  console.log(`  ok  ${label}`);
}
checkStatic();
console.log('  ok  G7 static scope (same input, matchCount rule, before conflicts, no site branches)');

const safetySrc = read(SAFETY);
const detSrc = read(DET);
const MUTATIONS = [
  ['M1 no replacement (today)', () => runAll({ [SAFETY]: replaceOnce(safetySrc, '        locator = exactOne;\n', '', 'assign') })],
  ['M2 exact-one locator replaced anyway', () => runAll({ [SAFETY]: replaceOnce(safetySrc, '      (finalConfidence === \'high\' || finalConfidence === \'medium\') &&\n      !assertLocatorDeterministic(locator, observed)\n', '      (finalConfidence === \'high\' || finalConfidence === \'medium\')\n', 'gate') })],
  ['M3 crosses to another input', () => runAll({ [SAFETY]: replaceOnce(safetySrc, 'const exactOne = preferExactOneCandidate(observed);', 'const exactOne = preferExactOneCandidate(observed) ?? input.page.inputs.map(preferExactOneCandidate).find(Boolean) ?? null;', 'cross') })],
  ['M4 no exact-one → another candidate used', () => runAll({ [SAFETY]: replaceOnce(safetySrc, 'const exactOne = preferExactOneCandidate(observed);', 'const exactOne = preferExactOneCandidate(observed) ?? observed.locatorCandidates[observed.locatorCandidates.length - 1]?.locator ?? null;', 'fallback') })],
  ['M5 confidence changed on replacement', () => runAll({ [SAFETY]: replaceOnce(safetySrc, '      confidence: finalConfidence,\n', "      confidence: locator !== raw.locator.trim() ? 'low' : finalConfidence,\n", 'confidence') })],
  ['M6 LOW rows replaced too', () => runAll({ [SAFETY]: replaceOnce(safetySrc, '      (finalConfidence === \'high\' || finalConfidence === \'medium\') &&\n      !assertLocatorDeterministic', '      !assertLocatorDeterministic', 'low') })],
  ['M7 order differs from Visual (last exact-one)', () => runAll({ [DET]: replaceOnce(detSrc, '  for (const candidate of observedInput.locatorCandidates) {', '  for (const candidate of [...observedInput.locatorCandidates].reverse()) {', 'order') })],
  ['M8 exact-one rule weakened (any candidate)', () => runAll({ [DET]: replaceOnce(detSrc, '    if (locatorCandidateIsDeterministic(candidate)) return locator;', '    return locator;', 'rule') })],
  [
    'M9 replacement after the conflict checks',
    () => {
      let s = replaceOnce(safetySrc, "        locator = exactOne;\n        warnings.push('locator_replaced_with_exact_one');\n", '', 'early');
      s = replaceOnce(
        s,
        '  const gatedProposals: MappingProposalRow[] = proposals.map((row) => {\n    if (row.confidence !== \'high\' && row.confidence !== \'medium\') {\n      return row;\n    }\n    const observed = inputsById.get(row.observedInputId);\n',
        '  const gatedProposals: MappingProposalRow[] = proposals.map((row) => {\n    if (row.confidence !== \'high\' && row.confidence !== \'medium\') {\n      return row;\n    }\n    const observed = inputsById.get(row.observedInputId);\n    const late = observed && !assertLocatorDeterministic(row.locator, observed) ? preferExactOneCandidate(observed) : null;\n    if (late) { row = { ...row, locator: late }; warnings.push(\'locator_replaced_with_exact_one\'); }\n',
        'late',
      );
      return runAll({ [SAFETY]: s });
    },
  ],
  ['M10 locator conflict check dropped', () => runAll({ [SAFETY]: replaceOnce(safetySrc, '  for (const owners of locatorOwners.values()) {', '  for (const owners of [] as string[][]) {', 'conflict') })],
];

let caught = 0;
for (const [name, mutate] of MUTATIONS) {
  let failure = null;
  try {
    await mutate();
  } catch (err) {
    failure = err;
  }
  if (!failure) throw new Error(`mutation NOT caught: ${name}`);
  if (String(failure.message).startsWith('fixture:')) throw new Error(`mutation fixture error: ${name}: ${failure.message}`);
  caught += 1;
  console.log(`  caught ${name} — ${String(failure.message).split('\n')[0]}`);
}
console.log(`\nPASS — D-121-54 Analyze exact-one = Visual: 7 check groups, ${caught} mutations caught`);
