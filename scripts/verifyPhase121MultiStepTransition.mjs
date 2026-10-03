/**
 * Phase 121 D-121-58 — multi-step: a tested transition creates the step it reveals.
 * Drives the REAL SpecialLoginDraftEditor (minimal hooks runtime). Only I/O is stubbed:
 * current-surface Analyze, the authoring click, Visual pick, registry write.
 * - MULTI_STEP username → «הבא» → password, same page and after navigation: the transition becomes
 *   step 1's exitTransition, step 2 is created, the selector moves to step 2, auto-Analyze writes the
 *   password into step 2; the «בדוק» click runs in reveal mode (never declared on step 1's #email).
 * - A second transition tested on step 2 becomes step 2's exit (step 3 created).
 * - Manual «נתח» on step 2 writes fields only after step 1's transition is chosen.
 * - Legacy preamble transition → steps[0].exitTransition (draft normalization).
 * - FLOATING_SCREEN and FLOATING_SCREEN_MULTI_STEP opener unchanged; FSMS follow-up transition → step 1's exit.
 * Synthetic fixtures. Mutations must be caught.
 * Usage: node scripts/verifyPhase121MultiStepTransition.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
const MINI_REACT = `
let cur = null;
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
function slot() { return cur.i++; }
export function useState(init) {
  const h = cur, i = slot();
  if (!(i in h.s)) h.s[i] = typeof init === 'function' ? init() : init;
  return [h.s[i], (v) => { const next = typeof v === 'function' ? v(h.s[i]) : v; if (!Object.is(next, h.s[i])) { h.s[i] = next; h.dirty = true; } }];
}
export function useRef(init) { const h = cur, i = slot(); if (!(i in h.s)) h.s[i] = { current: init }; return h.s[i]; }
export function useMemo(fn, deps) { const h = cur, i = slot(); const p = h.s[i]; if (p && same(p.deps, deps)) return p.v; const v = fn(); h.s[i] = { deps, v }; return v; }
export function useCallback(fn, deps) { return useMemo(() => fn, deps); }
export function useEffect(fn, deps) {
  const h = cur, i = slot(); const p = h.s[i];
  if (p && deps && same(p.deps, deps)) return;
  h.fx.push(() => { if (p && typeof p.cleanup === 'function') p.cleanup(); h.s[i] = { deps, cleanup: fn() }; });
}
export const Fragment = Symbol('Fragment');
export function jsx(type, props, key) { return { type, props: props ?? {}, key }; }
export const jsxs = jsx;
export function mount(Component, props) {
  const h = { s: {}, fx: [], dirty: false, i: 0, tree: null, props };
  const render = () => {
    for (let n = 0; n < 50; n += 1) {
      h.dirty = false; h.i = 0; cur = h;
      h.tree = Component(h.props);
      cur = null;
      const fx = h.fx.splice(0);
      fx.forEach((f) => f());
      if (!h.dirty) return h.tree;
    }
    throw new Error('render loop');
  };
  render();
  return {
    get tree() { return h.tree; },
    setProps(p) { h.props = { ...h.props, ...p }; render(); },
    async settle() { for (let n = 0; n < 8; n += 1) { await new Promise((r) => setTimeout(r, 0)); render(); } },
  };
}
export default { useState, useRef, useMemo, useCallback, useEffect, Fragment };
`;

function apiStub() {
  const src = read('src/admin/adminRegistryApi.ts');
  const names = new Set();
  for (const m of src.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  return [...names].map((n) => `export function ${n}(...a) { return globalThis.__api(${JSON.stringify(n)}, a); }`).join('\n');
}

const SEAMS = [
  ['analyzeSpecialCurrentSurface', 'export async function analyzeSpecialCurrentSurface(input: {', '__analyze'],
  ['startCurrentTabVisualMapping', 'export async function startCurrentTabVisualMapping(input: {', '__pick'],
  ['performApprovedAuthoringClick', 'export async function performApprovedAuthoringClick(input: {', '__click'],
];

const loadBundle = (overrides = {}) => withTempDir('pv-12158-', (outdir) => loadBundleIn(outdir, overrides));

async function loadBundleIn(outdir, overrides) {
  const reactPath = join(outdir, 'mini-react.mjs');
  writeFileSync(reactPath, MINI_REACT);
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const seamFile = abs('src/assistedMapping/currentTabAuthoring.ts');
  const apiFile = abs('src/admin/adminRegistryApi.ts');
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const plugin = {
    name: 'verify-seams',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: reactPath }));
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        if (key === apiFile) return { contents: apiStub(), loader: 'js' };
        if (key === seamFile) {
          let src = readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n');
          for (const [name, anchor, hook] of SEAMS) {
            src = replaceOnce(
              src,
              anchor,
              `export async function ${name}(input: any): Promise<any> { return (globalThis as any).${hook}(input); }\nasync function real_${name}(input: {`,
              `seam ${name}`,
            );
          }
          return { contents: src, loader: 'ts', resolveDir: dirname(args.path) };
        }
        if (overridden.has(key)) {
          return { contents: overridden.get(key), loader: key.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
        }
        return undefined;
      });
    },
  };
  const outfile = join(outdir, 'bundle.mjs');
  await build({
    stdin: {
      contents: `
        export { mount } from ${JSON.stringify(reactPath.replace(/\\/g, '/'))};
        export { default as SpecialEditor, SPECIAL_EDITOR_COPY_HE } from './src/admin/SpecialLoginDraftEditor.tsx';
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
    jsx: 'automatic',
    write: true,
    logLevel: 'silent',
    nodePaths: [join(root, 'node_modules')],
    define: { 'import.meta.env': '{"DEV":false}', 'process.env.NODE_ENV': '"production"' },
    plugins: [plugin],
  });
  return import(pathToFileURL(outfile).href);
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────
function walk(node, visit) {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  visit(node);
  walk(node.props?.children, visit);
}
function findAll(tree, pred) {
  const out = [];
  walk(tree, (n) => pred(n) && out.push(n));
  return out;
}
const byAction = (tree, action) => findAll(tree, (n) => n.props?.['data-action'] === action);
function one(tree, action, extra = () => true) {
  const found = byAction(tree, action).filter(extra);
  assert(found.length === 1, `fixture: expected one [data-action="${action}"], found ${found.length}`);
  return found[0];
}
function stepItems(tree) {
  const sidebars = findAll(tree, (n) => n.props?.['data-panel'] === 'steps-sidebar');
  if (sidebars.length === 0) return null;
  return findAll(sidebars[0], (n) => n.props?.['data-action'] === 'special-select-step');
}
function clickStep(tree, stepId) {
  const items = (stepItems(tree) ?? []).filter((n) => n.props['data-step-id'] === stepId);
  assert(items.length === 1, `fixture: one «שלבי התהליך» item for ${stepId}`);
  items[0].props.onClick();
}
function currentStep(tree) {
  const items = stepItems(tree);
  if (!items) return null;
  return items.find((n) => n.props['aria-current'] === 'step')?.props['data-step-id'] ?? null;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ORIGIN = 'https://pay.example.test';
function makeRow() {
  return {
    id: 'row-1',
    display_name: 'שירות בדיקה',
    primary_url: `${ORIGIN}/signin`,
    login_url: `${ORIGIN}/signin`,
    updated_at: 't',
    owner_user_id: null,
    login_fields: [
      { id: 'username', label: 'User', type: 'text', required: true },
      { id: 'password', label: 'Pass', type: 'password', required: true },
    ],
    metadata: {},
  };
}
const ready = (fieldId, locator, frame = null) => ({ fieldId, locator, frame, state: 'ready' });
const action = (lc, actionId, kind, locator, label = locator) => ({
  action: lc.createActionCandidate({ actionId, kind, label, locator }),
});
function result(fields, actions = []) {
  return { ok: true, actionProposals: actions, fieldAnalyze: { ok: true }, framedFieldProposals: fields };
}
/** Step 1: username + «הבא». */
const step1Surface = (lc) => result([ready('username', '#email')], [action(lc, 'next-1', 'intermediate_transition', '#btnNext', 'הבא')]);
/** After «הבא», same page: #email still there, password revealed. */
const samePageStep2 = () => result([ready('username', '#email'), ready('password', '#password')]);
/** After «הבא», navigated: a new page with the password only. */
const navigatedStep2 = () => result([ready('password', '#password')]);

// ─── Harness ──────────────────────────────────────────────────────────────────
function harness(m, pattern) {
  const writes = [];
  const clicks = [];
  const analyzeCalls = [];
  const queue = [];
  const state = { clickOk: true };
  globalThis.__api = async (name, args) => {
    assert(name === 'updateGlobalRegistryRow', `fixture: unexpected API call ${name}`);
    writes.push(args[1].metadata);
    return { updatedRows: 1, writerUserId: 'admin', writtenSpecialVersion: null };
  };
  globalThis.__analyze = async (input) => {
    analyzeCalls.push(input);
    assert(queue.length > 0, 'fixture: unexpected Analyze call');
    return queue.shift();
  };
  globalThis.__click = async (input) => {
    clicks.push({ action: input.action, mode: m.lc.readinessModeFor(input.action), requirePasswordSurface: input.requirePasswordSurface });
    return state.clickOk ? { ok: true } : { ok: false, reason: 'readiness_timeout', message: 'המסך לא נפתח' };
  };
  globalThis.__pick = async (input) => ({ ok: true, locator: `#visual-${input.fieldId}`, frame: null });
  const view = m.mount(m.SpecialEditor, { row: makeRow(), onSaved: async () => {}, selectedPattern: pattern });
  return {
    view,
    clicks,
    analyzeCalls,
    state,
    enqueue: (r) => queue.push(r),
    async analyze() {
      one(view.tree, 'special-analyze-current-tab').props.onClick();
      await view.settle();
    },
    async test(slot = 'primary') {
      one(view.tree, 'authoring-continue-click', (n) => n.props['data-slot'] === slot).props.onClick();
      await view.settle();
    },
    selectStep(stepId) {
      clickStep(view.tree, stepId);
      view.setProps({});
    },
    selectedStep() {
      return currentStep(view.tree);
    },
    async draft() {
      one(view.tree, 'save-special-draft').props.onClick();
      await view.settle();
      return writes.at(-1)[m.lc.LOGIN_FLOW_PLAN_META_KEY].draft;
    },
  };
}
const locs = (step) => (step?.fieldMappings ?? []).map((f) => `${f.fieldId}=${f.locator}`).join(',');

// ─── Behavior ─────────────────────────────────────────────────────────────────
async function transitionCreatesStep(m, fixture) {
  const h = harness(m, 'MULTI_STEP');
  h.enqueue(step1Surface(m.lc));
  await h.analyze();
  let draft = await h.draft();
  assert(draft.steps.length === 1 && locs(draft.steps[0]) === 'username=#email', `fixture: step 1 has #email (got ${JSON.stringify(draft.steps)})`);

  h.enqueue(fixture === 'same-page' ? samePageStep2() : navigatedStep2());
  await h.test();
  const click = h.clicks[0];
  assert(click && click.mode === 'reveal', `T1 ${fixture}: «בדוק» on the transition runs in reveal mode (got ${click?.mode}, readiness ${click?.action.readiness.locator})`);
  assert(click.action.readiness.locator !== '#email', `T1 ${fixture}: readiness is never step 1's own #email (old false positive)`);
  assert(click.requirePasswordSurface === false, 'T1: requirePasswordSurface unchanged (FLOATING_SCREEN only)');

  draft = await h.draft();
  assert(draft.steps.length === 2, `T2 ${fixture}: step 2 created (got ${draft.steps.length} steps)`);
  const exit = draft.steps[0].exitTransition;
  assert(exit && exit.locator === '#btnNext' && m.bar.actionSelected(exit), `T2 ${fixture}: «הבא» is step 1's chosen exitTransition (got ${JSON.stringify(exit)})`);
  assert(!(draft.preambleActions ?? []).some((a) => a.kind === 'intermediate_transition'), `T2 ${fixture}: no transition left in the preamble`);
  assert(locs(draft.steps[0]) === 'username=#email', `T3 ${fixture}: step 1 unchanged (got ${locs(draft.steps[0])})`);
  assert(locs(draft.steps[1]) === 'password=#password', `T3 ${fixture}: auto-Analyze wrote the password into step 2 only (got "${locs(draft.steps[1])}")`);
  assert(exit.readiness.locator === '#password', `T3 ${fixture}: readiness = step 2's first mapping (got ${exit.readiness.locator})`);
  assert(h.selectedStep() === draft.steps[1].stepId, `T4 ${fixture}: selector moved to step 2 (got ${h.selectedStep()})`);
  assert(Object.keys(h.analyzeCalls[1].currentLocators).length === 0, `T4 ${fixture}: auto-Analyze targets step 2 (got locators ${JSON.stringify(h.analyzeCalls[1].currentLocators)})`);
  return { h, draft };
}

async function secondTransition(m) {
  const { h } = await transitionCreatesStep(m, 'navigated');
  h.enqueue(result([], [action(m.lc, 'next-2', 'intermediate_transition', '#btnNext2', 'המשך')]));
  await h.analyze();
  h.enqueue(result([ready('username', '#otp')]));
  await h.test();
  const draft = await h.draft();
  assert(draft.steps.length === 3, `T5: a transition tested on step 2 creates step 3 (got ${draft.steps.length})`);
  assert(draft.steps[0].exitTransition?.locator === '#btnNext', 'T5: step 1 keeps its own exit');
  assert(draft.steps[1].exitTransition?.locator === '#btnNext2', `T5: the new transition is step 2's exit (got ${draft.steps[1].exitTransition?.locator})`);
  assert(h.selectedStep() === draft.steps[2].stepId, 'T5: selector on step 3');
}

async function gateOnStep2(m) {
  const h = harness(m, 'MULTI_STEP');
  h.enqueue(step1Surface(m.lc));
  await h.analyze();
  h.state.clickOk = false;
  await h.test();
  let draft = await h.draft();
  assert(draft.steps.length === 2 && draft.steps[0].exitTransition && !m.bar.actionSelected(draft.steps[0].exitTransition), 'fixture: failed test leaves an unchosen exit and step 2');
  h.selectStep(draft.steps[1].stepId);
  assert(h.selectedStep() === draft.steps[1].stepId, 'fixture: step 2 selected');
  h.enqueue(result([ready('password', '#password')]));
  await h.analyze();
  draft = await h.draft();
  assert(locs(draft.steps[1]) === '', `G1: manual «נתח» on step 2 before step 1's transition is chosen writes nothing (got "${locs(draft.steps[1])}")`);

  h.selectStep(draft.steps[0].stepId);
  h.enqueue(result([], [action(m.lc, 'next-1', 'intermediate_transition', '#btnNext', 'הבא')]));
  await h.analyze();
  h.state.clickOk = true;
  h.enqueue(result([]));
  // D-121-67 A/B: the proposal is step 1's stored exit → tested from step 1's own panel.
  await h.test('step');
  draft = await h.draft();
  assert(m.bar.actionSelected(draft.steps[0].exitTransition), 'fixture: transition chosen');
  assert(draft.steps.length === 2, `G2: re-testing the same transition keeps one step 2 (got ${draft.steps.length})`);
  h.enqueue(result([ready('password', '#password')]));
  await h.analyze();
  draft = await h.draft();
  assert(locs(draft.steps[1]) === 'password=#password', `G2: transition chosen → manual «נתח» on step 2 writes (got "${locs(draft.steps[1])}")`);
}

async function floatingUnchanged(m) {
  const opener = (lc) => result([], [action(lc, 'opener-1', 'floating_opener', '#logInBtn', 'כניסה')]);
  const fs = harness(m, 'FLOATING_SCREEN');
  fs.enqueue(opener(m.lc));
  await fs.analyze();
  fs.enqueue(result([ready('username', '#user'), ready('password', '#pass')]));
  await fs.test();
  let draft = await fs.draft();
  assert(draft.steps.length === 1 && locs(draft.steps[0]) === 'username=#user,password=#pass', `F1 FLOATING_SCREEN unchanged (got ${JSON.stringify(draft.steps)})`);
  assert(draft.preambleActions?.[0]?.locator === '#logInBtn' && m.bar.actionSelected(draft.preambleActions[0]), 'F1 opener chosen in the preamble');
  assert(fs.clicks[0].requirePasswordSurface === true, 'F1 FLOATING_SCREEN still requires the password surface');

  const fsms = harness(m, 'FLOATING_SCREEN_MULTI_STEP');
  fsms.enqueue(opener(m.lc));
  await fsms.analyze();
  fsms.enqueue(result([ready('username', '#user')], [action(m.lc, 'next-1', 'intermediate_transition', '#next', 'הבא')]));
  await fsms.test();
  draft = await fsms.draft();
  assert(draft.steps.length === 1 && locs(draft.steps[0]) === 'username=#user', `F2 FSMS opener: fields into step 1, no extra step (got ${JSON.stringify(draft.steps)})`);
  assert(draft.preambleActions?.length === 1 && draft.preambleActions[0].kind === 'floating_opener', 'F2 FSMS opener stays in the preamble');
  assert(fsms.selectedStep() === 'step-1', `F2 FSMS opener test keeps the selector on step 1 (got ${fsms.selectedStep()})`);

  fsms.enqueue(result([ready('password', '#pass')]));
  await fsms.test('followUp');
  draft = await fsms.draft();
  assert(draft.steps.length === 2 && draft.steps[0].exitTransition?.locator === '#next', `F3 FSMS follow-up transition → step 1's exit, step 2 created (got ${JSON.stringify(draft.steps.map((s) => s.exitTransition?.locator ?? null))})`);
  assert(draft.preambleActions.length === 1 && draft.preambleActions[0].kind === 'floating_opener', 'F3 FSMS preamble keeps only the opener');
  assert(locs(draft.steps[1]) === 'password=#pass', `F3 FSMS password into step 2 (got "${locs(draft.steps[1])}")`);
  assert(m.lc.validateSpecialPlanComplete(draft).ok, `F3 FSMS draft complete under the unchanged validator (${m.lc.validateSpecialPlanComplete(draft).message})`);
}

// ─── Pure ─────────────────────────────────────────────────────────────────────
function pureChecks(m) {
  const { lc, bar } = m;
  const base = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('MULTI_STEP', null), 'step-1', [
    { fieldId: 'username', locatorType: 'css', locator: '#email' },
  ]);
  const next = lc.createActionCandidate({ actionId: 't1', kind: 'intermediate_transition', label: 'הבא', locator: '#btnNext' });

  let d = lc.rederiveRevealReadiness(lc.placeTransitionAsStepExit(base, 'step-1', next));
  assert(d.steps.length === 2 && d.steps[0].exitTransition?.actionId === 't1', 'P1 placement: step 1 exit + empty step 2');
  assert(lc.readinessModeFor(d.steps[0].exitTransition) === 'reveal', `P2 step 2 unmapped → reveal readiness (got ${d.steps[0].exitTransition.readiness.locator})`);

  // Old false positive: a transition carrying step 1's #email readiness.
  const stale = { ...next, readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#email', timeoutMs: 8000 } };
  d = lc.rederiveRevealReadiness(lc.placeTransitionAsStepExit(base, 'step-1', stale));
  assert(lc.readinessModeFor(d.steps[0].exitTransition) === 'reveal', `P3 step-1 readiness on a transition is reset to reveal (got ${d.steps[0].exitTransition.readiness.locator})`);

  // Step 2 also lists step 1's #email (same page) → readiness is the password, never #email.
  const withBoth = lc.upsertStepFieldMappings(d, d.steps[1].stepId, [
    { fieldId: 'username', locatorType: 'css', locator: '#email' },
    { fieldId: 'password', locatorType: 'css', locator: '#password' },
  ]);
  const staleExit = lc.setStepExitTransition(withBoth, 'step-1', stale);
  assert(lc.rederiveRevealReadiness(staleExit).steps[0].exitTransition.readiness.locator === '#password', 'P4 declared readiness skips a step-1 field listed in step 2');
  const onlyEmail = lc.upsertStepFieldMappings(d, d.steps[1].stepId, [{ fieldId: 'username', locatorType: 'css', locator: '#email' }]);
  assert(lc.readinessModeFor(lc.rederiveRevealReadiness(onlyEmail).steps[0].exitTransition) === 'reveal', 'P4 step 2 holding only a step-1 field → reveal');

  // Single slot per step: a second transition on step 1 replaces the first; no extra step.
  const other = lc.createActionCandidate({ actionId: 't2', kind: 'intermediate_transition', label: 'המשך', locator: '#go' });
  const replaced = lc.placeTransitionAsStepExit(lc.placeTransitionAsStepExit(base, 'step-1', next), 'step-1', other);
  assert(replaced.steps.length === 2 && replaced.steps[0].exitTransition.actionId === 't2', 'P5 single exit slot per step');

  // Legacy: MULTI_STEP transition in the preamble with step-1 readiness.
  const legacy = lc.deepClonePlanDocument(base);
  legacy.preambleActions = [{ ...stale, approvedForAuthoringContinuation: true, approvedForRuntime: true }];
  const norm = lc.normalizeLegacyDraftReadiness(legacy);
  assert((norm.preambleActions ?? []).length === 0, 'P6 legacy: transition leaves the preamble');
  assert(norm.steps[0].exitTransition?.actionId === 't1' && norm.steps.length === 2, `P6 legacy: moved to steps[0].exitTransition, step 2 created (got ${JSON.stringify(norm.steps)})`);
  assert(lc.readinessModeFor(norm.steps[0].exitTransition) === 'reveal', 'P6 legacy: step-1 readiness reset');
  assert(legacy.preambleActions.length === 1 && legacy.steps.length === 1, 'P6 legacy input not mutated');
  const fsmsLegacy = lc.deepClonePlanDocument(legacy);
  fsmsLegacy.pattern = 'FLOATING_SCREEN_MULTI_STEP';
  const opener = { ...lc.createActionCandidate({ actionId: 'o1', kind: 'floating_opener', label: 'o', locator: '#open' }), approvedForAuthoringContinuation: true, approvedForRuntime: true };
  fsmsLegacy.preambleActions = [opener, ...legacy.preambleActions];
  const fsmsNorm = lc.normalizeLegacyDraftReadiness(fsmsLegacy);
  assert(fsmsNorm.preambleActions.length === 1 && fsmsNorm.preambleActions[0].actionId === 'o1', 'P6 FSMS legacy: opener stays in the preamble');
  assert(fsmsNorm.steps[0].exitTransition?.actionId === 't1', 'P6 FSMS legacy: transition → steps[0].exitTransition');
  const fsLegacy = lc.ensureSpecialDraft('FLOATING_SCREEN', null);
  fsLegacy.preambleActions = [opener];
  const fsNorm = lc.normalizeLegacyDraftReadiness(fsLegacy);
  const o = fsNorm.preambleActions?.[0];
  assert(fsNorm.preambleActions.length === 1 && fsNorm.steps.length === 1 && o.actionId === 'o1' && o.readiness.locator === opener.readiness.locator && bar.actionSelected(o), 'P6 FLOATING_SCREEN opener untouched');

  // Gate.
  const g = lc.placeTransitionAsStepExit(base, 'step-1', next);
  assert(!bar.manualAnalyzeMayWriteFields(g, 'MULTI_STEP', 'step-2'), 'P7 step 2 gated while step 1 transition unchosen');
  assert(!bar.manualAnalyzeMayWriteFields(lc.setStepExitTransition(g, 'step-1', bar.actionForTestPress(next)), 'MULTI_STEP', 'step-2'), 'P7 test consent alone does not lift the gate');
  assert(bar.manualAnalyzeMayWriteFields(lc.setStepExitTransition(g, 'step-1', bar.actionAfterTestSuccess(next)), 'MULTI_STEP', 'step-2'), 'P7 chosen transition → allowed');
  assert(bar.manualAnalyzeMayWriteFields(g, 'MULTI_STEP', 'step-1'), 'P7 MULTI_STEP step 1 never gated');
}

function staticChecks() {
  const auth = read('src/loginContract/specialDraftAuthoring.ts');
  const fns = auth.slice(auth.indexOf('function transitionStepsPattern'), auth.indexOf('/**\n * AC-121.1-6/7'));
  assert(!/hostname|serviceId|paypal|https?:/i.test(fns), 'S1 no site / host / serviceId branches in placement / migration');
  const ui = read('src/admin/SpecialLoginDraftEditor.tsx');
  assert(!/paypal/i.test(ui), 'S1 no site names in the editor');
  const val = read('src/loginContract/validateSpecialPlan.ts');
  assert(!val.includes('D-121-58'), 'S2 validator untouched');
}

async function runAll(overrides = {}) {
  const m = await loadBundle(overrides);
  pureChecks(m);
  await transitionCreatesStep(m, 'same-page');
  await transitionCreatesStep(m, 'navigated');
  await secondTransition(m);
  await gateOnStep2(m);
  await floatingUnchanged(m);
}

console.log('Phase 121 D-121-58 — multi-step: a tested transition creates the step it reveals\n');
await runAll();
console.log('  ✓ P1–P7 — placement, reveal readiness, old false positive reset, step-1 field never readiness, single slot, legacy migration, gate');
console.log('  ✓ T1 — «בדוק» on «הבא» runs in reveal mode; readiness never step 1\'s #email');
console.log('  ✓ T2 — «הבא» becomes step 1\'s chosen exit; step 2 created; nothing in the preamble (same page + navigated)');
console.log('  ✓ T3 — auto-Analyze writes the password into step 2; step 1 unchanged; readiness = step 2 password');
console.log('  ✓ T4 — selector moves to step 2; Analyze runs with step 2 locators');
console.log('  ✓ T5 — a transition tested on step 2 becomes step 2\'s exit (step 3)');
console.log('  ✓ G1–G2 — manual «נתח» on step 2 writes only after step 1\'s transition is chosen');
console.log('  ✓ F1–F3 — FLOATING_SCREEN / FSMS opener unchanged; FSMS follow-up transition → step 1 exit; validator accepts');
staticChecks();
console.log('  ✓ S1–S2 — no site branches; validator untouched');

console.log('\nMutations');
const UI = 'src/admin/SpecialLoginDraftEditor.tsx';
const BAR = 'src/admin/specialActionBar.ts';
const AUTH = 'src/loginContract/specialDraftAuthoring.ts';
const MUT = [
  ['M1 transition written to the preamble', UI, [["    if (action.kind === 'intermediate_transition' && stepSelectorVisible(base.pattern)) {", '    if (false) {']]],
  ['M2 next step not created', AUTH, [['  if (!next.steps[idx + 1]) next.steps.push({ stepId: nextFreeStepId(next), fieldMappings: [] });', '  void idx;']]],
  ['M3 unmapped transition keeps its readiness', AUTH, [['    return isTransition ? { ...action, readiness: createPendingRevealReadiness() } : action;', '    return action;']]],
  ['M4 step-1 fields allowed as readiness', AUTH, [['      if (excludedKeys.has(`${row.locator}@@${frameKey(row.frame)}`)) continue;\n', '']]],
  ['M5 auto-Analyze writes into the selected step', UI, [['      (afterTest && transitionRevealedStepId(afterTest.base, afterTest.tested)) ?? currentStepId;', '      currentStepId;']]],
  ['M6 selector not moved', UI, [['      if (revealedStepId) setSelectedStepId(revealedStepId);\n', '']]],
  ['M7 gate not extended', BAR, [['  if (idx > 0 && stepSelectorVisible(pattern)) {', '  if (false) {']]],
  ['M8 legacy migration dropped', AUTH, [['  const migrated = migrateLegacyPreambleTransitions(base);', '  const migrated = base;']]],
  ['M9 transition always on step 1', AUTH, [['  if (idx < 0) idx = 0;', '  idx = 0;']]],
  ['M10 earlier-step fields re-proposed', UI, [['          earlierMappings.some(\n            (m) => m.fieldId === p.fieldId && m.locator === p.locator && sameFrame(m.frame, p.frame),\n          )', '          false']]],
  ['M11 declared step-1 field kept', AUTH, [['  return !(ownerStepFor(draft, action)?.fieldMappings ?? []).some(matchesReadiness);', '  return true;']]],
  ['M12 legacy migration keeps the preamble copy', AUTH, [["  next.preambleActions = preamble.filter((a) => a.kind !== 'intermediate_transition');", '  next.preambleActions = preamble;']]],
];
for (const [label, file, pairs] of MUT) {
  let mutated = read(file);
  for (const [from, to] of pairs) mutated = replaceOnce(mutated, from, to, label);
  let caught = null;
  try {
    await runAll({ [file]: mutated });
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }
  assert(caught, `mutation NOT caught: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  console.log(`  ✓ mutation caught: ${label} — ${caught}`);
}
console.log(`\nPASS — D-121-58 verify: 7 pure + 5 behavior groups + 2 static, ${MUT.length} mutations caught`);
process.exit(0);
