/**
 * Phase 121 D-121-46 — one opener per plan; unchosen candidates never block.
 * Amendment A1 — pattern-irrelevant kinds (transition in FLOATING_SCREEN, opener in
 * MULTI_STEP) are never kept; FLOATING_SCREEN_MULTI_STEP keeps both.
 * Replays the SPECIAL editor's draft writes (same helpers: selectPendingForManualAnalyze,
 * actionForTestPress / actionAfterTestSuccess / actionAfterTestFailure, upsertPreambleAction +
 * rederiveRevealReadiness = `writeDraftAction`) and the legacy normalization used by editor
 * load, «שמור מיפוי», completeness, «בדיקת מילוי» and «אשר מיפוי». Synthetic fixtures only.
 * Mutations must be caught.
 * Usage: node scripts/verifyPhase121SingleOpener.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  assert(n === 1, `anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}

function apiStub() {
  const src = read('src/admin/adminRegistryApi.ts');
  const names = new Set();
  for (const m of src.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  return [...names].map((n) => `export function ${n}() { throw new Error('stubbed: ${n}'); }`).join('\n');
}
const loadBundle = (overrides = {}) => withTempDir('pv-12146-', (outdir) => loadBundleIn(outdir, overrides));
async function loadBundleIn(outdir, overrides) {
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const apiFile = abs('src/admin/adminRegistryApi.ts');
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const outfile = join(outdir, 'bundle.mjs');
  await build({
    stdin: {
      contents: `
        export * as lc from './src/loginContract/index.ts';
        export * as bar from './src/admin/specialActionBar.ts';
      `,
      resolveDir: root,
      loader: 'ts',
    },
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: true,
    logLevel: 'silent',
    nodePaths: [join(root, 'node_modules')],
    define: { 'import.meta.env': '{"DEV":false}' },
    plugins: [
      {
        name: 'verify-overrides',
        setup(b) {
          b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            if (key === apiFile) return { contents: apiStub(), loader: 'js' };
            if (overridden.has(key)) return { contents: overridden.get(key), loader: 'ts', resolveDir: dirname(args.path) };
            return undefined;
          });
        },
      },
    ],
  });
  return import(pathToFileURL(outfile).href);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
function baseDraft(preambleActions = []) {
  return {
    planVersion: 1,
    pattern: 'FLOATING_SCREEN',
    preambleActions,
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#user' },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}
function opener(actionId, locator, chosen) {
  return {
    actionId,
    kind: 'floating_opener',
    label: locator,
    locatorType: 'css',
    locator,
    approvedForAuthoringContinuation: chosen,
    approvedForRuntime: chosen,
    readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 5000 },
  };
}
const openersOf = (d) => (d.preambleActions ?? []).filter((a) => a.kind === 'floating_opener');

function scenarios(m) {
  const { lc, bar } = m;
  const out = [];
  // Editor `writeDraftAction` for preamble actions + `draftCopy`.
  const write = (d, action) => {
    const owner = d.steps.find((s) => s.exitTransition?.actionId === action.actionId);
    return lc.rederiveRevealReadiness(owner ? lc.setStepExitTransition(d, owner.stepId, action) : lc.upsertPreambleAction(d, action));
  };
  const copyOf = (d, a) => lc.listDraftActions(d).find((x) => x.actionId === a.actionId) ?? a;
  const testPress = (d, shown, success) => {
    const consented = bar.actionForTestPress(copyOf(d, shown));
    const consentDraft = write(d, consented);
    const tested = copyOf(consentDraft, consented);
    return {
      consentDraft,
      after: write(consentDraft, success ? bar.actionAfterTestSuccess(tested) : bar.actionAfterTestFailure(tested)),
    };
  };
  const candidate = (actionId, locator, kind = 'floating_opener') => lc.createActionCandidate({ actionId, kind, label: locator, locator });

  // O1 — Analyze proposes the wrong opener (tested, not opened), then a manual pick is tested OK.
  {
    let d = baseDraft();
    const proposal = lc.selectPendingForManualAnalyze(d, [candidate('a-1', '#contact-us')]);
    d = testPress(d, proposal, false).after;
    assert(openersOf(d).length === 1 && openersOf(d)[0].approvedForRuntime === false, 'fixture: failed candidate stays unchosen (D-121-34)');
    assert(!bar.checkSpecialDraft(d).complete, 'unchosen-only draft is incomplete');
    const manual = lc.selectPendingForManualAnalyze(d, [candidate('floating_opener-m1', '#login-btn')]);
    const { consentDraft, after } = testPress(d, manual, true);
    assert(openersOf(consentDraft).length === 1 && openersOf(consentDraft)[0].locator === '#login-btn', 'manual opener press replaces the Analyze candidate (one opener slot)');
    assert(openersOf(after).length === 1 && openersOf(after)[0].locator === '#login-btn' && openersOf(after)[0].approvedForRuntime, 'after test success: exactly one opener, chosen');
    assert(lc.validateSpecialPlanComplete(after).ok && bar.checkSpecialDraft(after).complete, 'saved plan complete');
    out.push(['O1', 'Analyze candidate (not opened) → manual pick tested OK → exactly one opener; plan complete']);
  }

  // O2 — manual pick chosen, then an Analyze proposal: still one.
  {
    let d = testPress(baseDraft(), candidate('floating_opener-m1', '#login-btn'), true).after;
    const proposal = lc.selectPendingForManualAnalyze(d, [candidate('a-1', '#contact-us')]);
    assert(openersOf(d).length === 1 && bar.checkSpecialDraft(d).complete, 'a proposal alone writes nothing: still one chosen opener');
    const pressed = testPress(d, proposal, true);
    assert(openersOf(pressed.consentDraft).length === 1 && openersOf(pressed.after).length === 1, 'pressing the proposal replaces the opener: still one');
    assert(openersOf(pressed.after)[0].locator === '#contact-us' && bar.checkSpecialDraft(pressed.after).complete, 'the tested proposal is the only opener');
    const same = lc.selectPendingForManualAnalyze(d, [candidate('a-9', '#login-btn')]);
    assert(same.actionId === 'floating_opener-m1' && bar.actionSelected(same), 'same locator re-proposed → the existing chosen opener (unchanged)');
    out.push(['O2', 'manual opener chosen → Analyze proposal → still one opener (proposal writes nothing; pressing it replaces)']);
  }

  // O3 — non-opener kinds: a chosen action removes unchosen actions of its kind only.
  {
    const t = (id, loc, chosen) => ({ ...opener(id, loc, chosen), kind: 'intermediate_transition' });
    const d = { ...baseDraft([opener('o', '#login-btn', true), t('t-stale', '#next-a', false)]), pattern: 'FLOATING_SCREEN_MULTI_STEP' };
    const after = lc.upsertPreambleAction(d, t('t-new', '#next-b', true));
    const kinds = (after.preambleActions ?? []).map((a) => `${a.kind}:${a.actionId}`);
    assert(JSON.stringify(kinds) === JSON.stringify(['floating_opener:o', 'intermediate_transition:t-new']), `chosen transition drops the unchosen one only (${kinds})`);
    const unchosenAdd = lc.upsertPreambleAction(d, t('t-new', '#next-b', false));
    assert((unchosenAdd.preambleActions ?? []).length === 3, 'an unchosen non-opener write removes nothing');
    out.push(['O3', 'chosen action removes other unchosen actions of the same kind; opener untouched']);
  }

  // X1 — exitTransition per step is already a single slot.
  {
    const t1 = { ...opener('t-1', '#next-a', false), kind: 'intermediate_transition' };
    const t2 = { ...opener('t-2', '#next-b', true), kind: 'intermediate_transition' };
    const d = { ...baseDraft(), pattern: 'MULTI_STEP', steps: [...baseDraft().steps, { stepId: 'step-2', fieldMappings: [{ fieldId: 'password', locatorType: 'css', locator: '#pass2' }] }] };
    let x = lc.setStepExitTransition(d, 'step-1', t1);
    x = lc.setStepExitTransition(x, 'step-1', t2);
    assert(x.steps[0].exitTransition.actionId === 't-2' && lc.listDraftActions(x).length === 1, 'setStepExitTransition replaces: one transition per step');
    const updated = write(x, { ...t2, label: 'renamed' });
    assert(updated.steps[0].exitTransition.label === 'renamed' && (updated.preambleActions ?? []).length === 0, 'writing an owned transition updates its step slot (not the preamble)');
    out.push(['X1', 'exitTransition per step: single slot (replace), owned writes stay in the step']);
  }

  // L1 — legacy saved draft: stale candidate + chosen opener → normalized, complete.
  {
    const legacy = baseDraft([opener('a-1', '#contact-us', false), opener('floating_opener-m1', '#login-btn', true)]);
    const snapshot = JSON.stringify(legacy);
    const v = lc.validateSpecialPlanComplete(legacy);
    assert(!v.ok && v.code === 'actionNotApprovedForRuntime', 'fixture: raw legacy draft fails exactly as seen live (strictness unchanged)');
    const norm = lc.normalizeLegacyDraftReadiness(legacy);
    assert(JSON.stringify(legacy) === snapshot, 'normalization never mutates its input');
    assert(openersOf(norm).length === 1 && openersOf(norm)[0].actionId === 'floating_opener-m1', 'normalized: only the chosen opener remains');
    assert(bar.checkSpecialDraft(legacy).complete, 'completeness line / «בדיקת מילוי» (checkSpecialDraft) → complete');
    const lcMerge = lc.mergeLoginContractMetadata({
      existingMetadata: { [lc.LOGIN_FLOW_PLAN_META_KEY]: lc.serializeLoginFlowPlanBag({ draft: legacy, active: null }) },
      patchMetadata: {
        [lc.LOGIN_FLOW_PLAN_META_KEY]: { draft: norm },
        [lc.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: { transition: 'STANDARD_TO_SPECIAL', draft: norm },
      },
    });
    assert(lcMerge.ok, `«אשר מיפוי» (normalized saved draft) passes the unchanged contract (${lcMerge.message})`);
    const active = lc.resolveActiveLoginContract(lcMerge.metadata);
    assert(active.mode === 'SPECIAL' && openersOf(active.plan).length === 1, 'approved plan has one opener');
    const rawMerge = lc.mergeLoginContractMetadata({
      existingMetadata: {},
      patchMetadata: { [lc.LOGIN_FLOW_PLAN_META_KEY]: { draft: legacy }, [lc.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: { transition: 'STANDARD_TO_SPECIAL', draft: legacy } },
    });
    assert(!rawMerge.ok, 'contract still rejects an un-normalized plan with an unchosen action');
    const withTransition = baseDraft([opener('a-1', '#contact-us', false), { ...opener('t', '#next', false), kind: 'intermediate_transition' }, opener('m', '#login-btn', true)]);
    const kept = lc.dropStaleOpenerCandidates(withTransition).preambleActions.map((a) => a.actionId);
    assert(JSON.stringify(kept) === JSON.stringify(['t', 'm']), 'only unchosen openers are dropped (other actions kept, order kept)');
    out.push(['L1', 'legacy stale candidate + chosen opener → normalized to one opener; completeness / fill test / approval pass; raw plan still rejected']);
  }

  // L2 — legacy draft with only unchosen opener(s) → unchanged, still incomplete.
  {
    for (const legacy of [baseDraft([opener('a-1', '#contact-us', false)]), baseDraft([opener('a-1', '#contact-us', false), opener('a-2', '#other', false)])]) {
      const norm = lc.dropStaleOpenerCandidates(legacy);
      assert(norm === legacy, 'no chosen opener → draft unchanged');
      assert(!bar.checkSpecialDraft(legacy).complete, 'no chosen opener → still incomplete (no silent approval)');
      assert(openersOf(lc.normalizeLegacyDraftReadiness(legacy)).every((a) => a.approvedForRuntime === false), 'normalization never approves');
    }
    const twoChosen = baseDraft([opener('m1', '#a', true), opener('m2', '#b', true)]);
    assert(lc.dropStaleOpenerCandidates(twoChosen) === twoChosen, 'two chosen openers → unchanged (never picks one silently)');
    out.push(['L2', 'legacy unchosen-only (one or two) → unchanged, incomplete; two chosen → unchanged']);
  }

  // ─── Amendment A1 — pattern relevance ───────────────────────────────────────
  const transition = (id, loc, chosen) => ({ ...opener(id, loc, chosen), kind: 'intermediate_transition' });
  const kindsOf = (d) => [...(d.preambleActions ?? []), ...d.steps.map((s) => s.exitTransition).filter(Boolean)].map((a) => a.kind);

  // R0 — one shared relevance rule (manual pick buttons = draft pruning).
  for (const p of ['FLOATING_SCREEN', 'MULTI_STEP', 'FLOATING_SCREEN_MULTI_STEP', 'STANDARD']) {
    for (const k of ['floating_opener', 'intermediate_transition']) {
      assert(bar.manualPickRelevant(k, p) === lc.actionKindRelevantForPattern(k, p), `manualPickRelevant = actionKindRelevantForPattern (${k}, ${p})`);
    }
  }
  assert(lc.actionKindRelevantForPattern('intermediate_transition', 'FLOATING_SCREEN') === false && lc.actionKindRelevantForPattern('floating_opener', 'MULTI_STEP') === false, 'relevance table');
  out.push(['R0', 'one relevance helper: manualPickRelevant delegates to actionKindRelevantForPattern']);

  // R1 — El Al shape: FLOATING_SCREEN + chosen opener + stale transition (unchosen / chosen / exitTransition).
  {
    const elAl = baseDraft([transition('a-1', 'button[aria-label="Next slide"]', false), opener('floating_opener-m1', '#login-btn', true)]);
    const raw = lc.validateSpecialPlanComplete(elAl);
    assert(!raw.ok && raw.code === 'actionNotApprovedForRuntime', 'fixture: raw El Al-shaped draft fails as seen live');
    const norm = lc.normalizeLegacyDraftReadiness(elAl);
    assert(JSON.stringify(kindsOf(norm)) === JSON.stringify(['floating_opener']), 'unchosen transition dropped; opener kept');
    assert(bar.checkSpecialDraft(elAl).complete, 'El Al-shaped saved draft → completeness / «בדיקת מילוי» complete');
    const chosenVariant = baseDraft([transition('t', '#next', true), opener('m', '#login-btn', true)]);
    assert(JSON.stringify(kindsOf(lc.normalizeLegacyDraftReadiness(chosenVariant))) === JSON.stringify(['floating_opener']) && bar.checkSpecialDraft(chosenVariant).complete, 'chosen transition in FLOATING_SCREEN also dropped → complete');
    const exitVariant = baseDraft([opener('m', '#login-btn', true)]);
    exitVariant.steps[0].exitTransition = transition('x', '#next', false);
    const exitNorm = lc.normalizeLegacyDraftReadiness(exitVariant);
    assert(!exitNorm.steps[0].exitTransition && bar.checkSpecialDraft(exitVariant).complete, 'exitTransition in FLOATING_SCREEN dropped → complete');
    const merged = lc.mergeLoginContractMetadata({
      existingMetadata: {},
      patchMetadata: { [lc.LOGIN_FLOW_PLAN_META_KEY]: { draft: norm }, [lc.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: { transition: 'STANDARD_TO_SPECIAL', draft: norm } },
    });
    assert(merged.ok && JSON.stringify(kindsOf(lc.resolveActiveLoginContract(merged.metadata).plan)) === JSON.stringify(['floating_opener']), '«אשר מיפוי» of the normalized saved draft passes the unchanged contract');
    const onlyTransition = baseDraft([transition('a-1', '#next', false)]);
    const onlyNorm = lc.normalizeLegacyDraftReadiness(onlyTransition);
    assert(kindsOf(onlyNorm).length === 0 && !bar.checkSpecialDraft(onlyTransition).complete, 'no opener at all → still incomplete (nothing approved)');
    const before = lc.upsertPreambleAction(baseDraft([opener('m', '#login-btn', true)]), transition('t2', '#next', false));
    assert(JSON.stringify(kindsOf(before)) === JSON.stringify(['floating_opener']), 'upsert never writes a transition into a FLOATING_SCREEN draft');
    out.push(['R1', 'FLOATING_SCREEN + chosen opener + stale transition (unchosen / chosen / exitTransition) → dropped, complete, approvable; upsert refuses the irrelevant kind']);
  }

  // R2 — pattern switch (editor: normalizeLegacyDraftReadiness(ensureSpecialDraft(next, draft))).
  {
    const floating = baseDraft([opener('m', '#login-btn', true)]);
    const toMulti = lc.normalizeLegacyDraftReadiness(lc.ensureSpecialDraft('MULTI_STEP', floating));
    assert(toMulti.pattern === 'MULTI_STEP' && kindsOf(toMulti).length === 0, 'FLOATING_SCREEN → MULTI_STEP drops the opener');
    const multi = { ...baseDraft([]), pattern: 'MULTI_STEP' };
    multi.steps[0].exitTransition = transition('x', '#next', true);
    const toFloating = lc.normalizeLegacyDraftReadiness(lc.ensureSpecialDraft('FLOATING_SCREEN', multi));
    assert(toFloating.pattern === 'FLOATING_SCREEN' && kindsOf(toFloating).length === 0, 'MULTI_STEP → FLOATING_SCREEN drops the transition');
    const toBoth = lc.normalizeLegacyDraftReadiness(lc.ensureSpecialDraft('FLOATING_SCREEN_MULTI_STEP', multi));
    assert(JSON.stringify(kindsOf(toBoth)) === JSON.stringify(['intermediate_transition']), 'MULTI_STEP → FLOATING_SCREEN_MULTI_STEP keeps the transition');
    out.push(['R2', 'pattern switch drops irrelevant kinds (opener ↔ transition); switching to the combined pattern keeps them']);
  }

  // R3 — FLOATING_SCREEN_MULTI_STEP keeps both kinds.
  {
    const both = {
      ...baseDraft([opener('m', '#login-btn', true)]),
      pattern: 'FLOATING_SCREEN_MULTI_STEP',
      steps: [
        { stepId: 'step-1', fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }], exitTransition: transition('x', '#next', true) },
        { stepId: 'step-2', fieldMappings: [{ fieldId: 'password', locatorType: 'css', locator: '#pass' }] },
      ],
    };
    assert(lc.dropPatternIrrelevantActions(both) === both, 'FLOATING_SCREEN_MULTI_STEP: nothing irrelevant → unchanged');
    assert(JSON.stringify(kindsOf(lc.normalizeLegacyDraftReadiness(both))) === JSON.stringify(['floating_opener', 'intermediate_transition']), 'FLOATING_SCREEN_MULTI_STEP keeps one opener + one transition per step');
    const withNewTransition = lc.upsertPreambleAction(both, transition('p', '#more', false));
    assert(kindsOf(withNewTransition).filter((k) => k === 'intermediate_transition').length === 2, 'FLOATING_SCREEN_MULTI_STEP accepts a transition write');
    out.push(['R3', 'FLOATING_SCREEN_MULTI_STEP keeps both kinds']);
  }
  return out;
}

function staticChecks() {
  const ui = read('src/admin/SpecialLoginDraftEditor.tsx');
  const writeFn = ui.slice(ui.indexOf('function writeDraftAction'), ui.indexOf('function draftCopy'));
  assert(writeFn.includes('upsertPreambleAction(base, action)') && writeFn.includes('setStepExitTransition(base, owner.stepId, action)'), 'editor writes actions through the single-slot helpers');
  const saveFn = ui.slice(ui.indexOf('async function saveDraft'), ui.indexOf('function requestActivateSpecial'));
  assert(saveFn.includes('draft: normalizeLegacyDraftReadiness(draft),'), '«שמור מיפוי» saves the normalized draft');
  assert(ui.includes('return normalizeLegacyDraftReadiness(ensureSpecialDraft(initial, existingPlan?.draft ?? null));'), 'editor load normalizes');
  const act = ui.slice(ui.indexOf('async function activateSpecial'), ui.indexOf('async function runSpecialAnalyze'));
  assert(act.includes('normalizeLegacyDraftReadiness(saved)'), '«אשר מיפוי» approves the normalized saved draft');
  const barSrc = read('src/admin/specialActionBar.ts');
  assert(barSrc.includes('const normalized = normalizeLegacyDraftReadiness(draft);'), 'completeness uses the normalization');
  const pickFn = barSrc.slice(barSrc.indexOf('export function manualPickRelevant'), barSrc.indexOf('/** Pattern-only enablement'));
  assert(pickFn.includes('return actionKindRelevantForPattern(kind, pattern);') && !pickFn.includes("'FLOATING_SCREEN'"), 'manualPickRelevant delegates to the one shared helper');
  const onChange = ui.slice(ui.indexOf('function onPatternChange'), ui.indexOf('async function saveDraft'));
  assert(onChange.includes('setDraft(normalizeLegacyDraftReadiness(ensureSpecialDraft(next, draft)));'), 'pattern change normalizes the SPECIAL draft');
  assert(onChange.includes('manualPickRelevant(a.kind, next)'), 'pattern change clears panels holding an irrelevant kind');
  const flow = read('src/execution/specialLoginFlow.ts');
  assert(flow.includes('const check = checkSpecialDraft(draft);'), '«בדיקת מילוי» uses checkSpecialDraft (normalized saved draft)');
  for (const rel of ['src/execution/specialLoginFlow.ts', 'src/loginContract/resolve.ts', 'src/loginContract/runtimeGate.ts', 'src/loginContract/validateSpecialPlan.ts', 'src/loginContract/planActivate.ts', 'src/loginContract/merge.ts']) {
    const src = read(rel);
    assert(!src.includes('dropStaleOpenerCandidates') && !src.includes('normalizeLegacyDraftReadiness'), `${rel}: ACTIVE / runtime / contract never normalized`);
  }
  const lib = read('src/loginContract/specialDraftAuthoring.ts').toLowerCase();
  for (const needle of ['hostname', 'elal', 'el al', 'serviceid', '.co.il']) assert(!lib.includes(needle), `no site branch (${needle})`);
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert(JSON.stringify(manifest.permissions) === JSON.stringify(['tabs', 'scripting']), 'manifest unchanged');
}

console.log('Phase 121 D-121-46 — one opener per plan; unchosen candidates never block\n');
for (const [id, what] of scenarios(await loadBundle())) console.log(`  ✓ ${id} — ${what}`);
staticChecks();
console.log('  ✓ S1 — editor load / save / approve, completeness and fill test use the normalization; ACTIVE / runtime / contract untouched; no site branches');

console.log('\nMutations');
const LIB = 'src/loginContract/specialDraftAuthoring.ts';
const MUT = [
  ['M1 opener appended instead of replacing (slot rule dropped)', "    (action.kind === 'floating_opener' && a.kind === 'floating_opener');", '    false;'],
  [
    'M2 original upsert (append by actionId only)',
    '  list.forEach((a, i) => {\n    if (i === idx) out.push(action);\n    else if (!occupiesSlot(a) && !supersededByChosen(a)) out.push(a);\n  });',
    '  const byId = list.findIndex((a) => a.actionId === action.actionId);\n  list.forEach((a, i) => out.push(i === byId ? action : a));\n  if (byId >= 0) { next.preambleActions = out; return next; }',
  ],
  ['M3 normalization drops the chosen opener', "(a) => a.kind !== 'floating_opener' || isChosenAction(a),", "(a) => a.kind !== 'floating_opener' || !isChosenAction(a),"],
  ['M4 normalization drops openers with no chosen one', 'if (stale.length === 0 || stale.length === openers.length) return draft;', 'if (stale.length === 0) return draft;'],
  ['M5 stale-opener drop not wired into A1', 'const base = dropStaleOpenerCandidates(dropPatternIrrelevantActions(draft));', 'const base = dropPatternIrrelevantActions(draft);'],
  ['M7 normalization keeps an irrelevant kind', 'const relevant = (a: FlowAction) => actionKindRelevantForPattern(a.kind, draft.pattern);', 'const relevant = (_a: FlowAction) => true;'],
  ['M8 upsert writes an irrelevant kind', '  if (!actionKindRelevantForPattern(action.kind, next.pattern)) return next;\n', ''],
  ['M9 relevance pruning not wired into A1', 'const base = dropStaleOpenerCandidates(dropPatternIrrelevantActions(draft));', 'const base = dropStaleOpenerCandidates(draft);'],
  ['M10 relevance lets openers into MULTI_STEP', "  if (kind === 'floating_opener') {\n    return pattern === 'FLOATING_SCREEN' || pattern === 'FLOATING_SCREEN_MULTI_STEP';\n  }", "  if (kind === 'floating_opener') {\n    return pattern !== 'STANDARD';\n  }"],
  ['M6 chosen action does not supersede unchosen same-kind', '    isChosenAction(action) && a.kind === action.kind && !isChosenAction(a);', '    false;'],
];
for (const [label, from, to] of MUT) {
  const mutated = replaceOnce(read(LIB), from, to, label);
  let caught = null;
  try {
    scenarios(await loadBundle({ [LIB]: mutated }));
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }
  assert(caught, `mutation NOT caught: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  console.log(`  ✓ mutation caught: ${label} — ${caught}`);
}
console.log(`\nPASS — D-121-46 + A1 verify: 11 check groups, ${MUT.length} mutations caught`);
process.exit(0);
