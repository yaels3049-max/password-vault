/**
 * Phase 121 D-121-67 — per-step button panel, proposals per step, a failed re-test keeps a
 * proven choice, step-named completeness / fill-test messages, per-step «מיפוי חזותי» re-map.
 *
 * - Pure (REAL specialActionBar + loginContract): step panel view, statuses, step-named
 *   completeness copy per validator code (located in the validator's own order), re-map /
 *   clear helpers keep later steps and fields and re-derive readiness.
 * - Editor (REAL SpecialLoginDraftEditor, minimal hooks runtime, I/O seams only): Maccabi-shape
 *   3 steps (A: ID + «המשך», B: «כניסה עם סיסמה» only, C: another ID element + password).
 * - Fill test (REAL executeAdminSpecialLoginFlowTest, bridge stubbed): step-named draft message.
 * Every rule has a mutation that must be caught.
 *
 * Usage: node scripts/verifyPhase121StepButtons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const clone = (v) => JSON.parse(JSON.stringify(v));

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const out = (line) => process.stdout.write(`${line}\n`);
for (const level of ['log', 'info', 'warn', 'debug']) console[level] = () => {};

let passed = 0;
function ok(label) {
  passed += 1;
  out(`  ✓ ${label}`);
}

function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  assert(n === 1, `anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}

// ---------------------------------------------------------------------------
// Bundle (REAL editor + action bar + loginContract + Hub flow; I/O seams only)
// ---------------------------------------------------------------------------
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

const BRIDGE_STUB = `
export const isExtensionAvailable = () => true;
export const openUrlInNewTab = () => {};
export const sendExtensionMessageAsync = () => { throw new Error('fixture: no extension message expected'); };
export const sendExtensionMessage = (message, cb) => { if (cb) cb(null); };
export const getChromeRuntime = () => null;
export const getExtensionId = () => 'test-ext';
export const probeExtensionAvailable = async () => true;
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

const load = (overrides = {}) => withTempDir('pv-121sb-', (outdir) => loadIn(outdir, overrides));

async function loadIn(outdir, overrides) {
  const reactPath = join(outdir, 'mini-react.mjs');
  writeFileSync(reactPath, MINI_REACT);
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const seamFile = abs('src/assistedMapping/currentTabAuthoring.ts');
  const apiFile = abs('src/admin/adminRegistryApi.ts');
  const bridgeFile = abs('src/execution/extensionBridge.ts');
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const used = new Set();
  const plugin = {
    name: 'verify-seams',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: reactPath }));
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        if (key === apiFile) return { contents: apiStub(), loader: 'js' };
        if (key === bridgeFile) return { contents: BRIDGE_STUB, loader: 'js' };
        let src = overridden.has(key) ? overridden.get(key) : null;
        if (src !== null) used.add(key);
        if (key === seamFile) {
          src = src ?? readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n');
          for (const [name, anchor, hook] of SEAMS) {
            src = replaceOnce(
              src,
              anchor,
              `export async function ${name}(input: any): Promise<any> { return (globalThis as any).${hook}(input); }\nasync function real_${name}(input: {`,
              `seam ${name}`,
            );
          }
        }
        if (src === null) return undefined;
        return { contents: src, loader: key.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
      });
    },
  };
  const outfile = join(outdir, 'bundle.mjs');
  await build({
    stdin: {
      contents: `
        export { mount } from ${JSON.stringify(reactPath.replace(/\\/g, '/'))};
        export { default as SpecialEditor, SPECIAL_EDITOR_COPY_HE } from './src/admin/SpecialLoginDraftEditor.tsx';
        export { executeAdminSpecialLoginFlowTest } from './src/execution/specialLoginFlow.ts';
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
  assert(used.size === overridden.size, `fixture: every override loaded (${used.size}/${overridden.size})`);
  return import(pathToFileURL(outfile).href);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const FIELDS = [
  { id: 'username', label: 'ת"ז', type: 'text', required: true },
  { id: 'password', label: 'סיסמה', type: 'password', required: true },
];
const map = (fieldId, locator, frame) => ({ fieldId, locatorType: 'css', locator, ...(frame ? { frame } : {}) });
const exitMsg = (n) => `המיפוי לא מלא: כפתור המעבר של שלב ${n} עדיין לא נבחר — בחרו «שלב ${n}» ובדקו אותו.`;

function transition(m, id, locator, chosen = true) {
  const a = m.lc.createActionCandidate({ actionId: id, kind: 'intermediate_transition', label: id, locator });
  return chosen ? m.bar.actionAfterTestSuccess(a) : a;
}

/** Maccabi shape: A (ID) → «המשך» → B (action-only) → «כניסה עם סיסמה» → C (ID2 + password). */
function maccabiPlan(m) {
  const { lc } = m;
  let d = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('MULTI_STEP', null), 'step-1', [map('username', '#id')]);
  d = lc.placeTransitionAsStepExit(d, 'step-1', transition(m, 'cont', '#cont'));
  d = lc.placeTransitionAsStepExit(d, 'step-2', transition(m, 'pw', '#pwLogin'));
  d = lc.upsertStepFieldMappings(d, 'step-3', [map('username', '#id2'), map('password', '#pass')]);
  return lc.rederiveRevealReadiness(d);
}

/** Three steps, each with a field (no action-only step): A (ID) → B (OTP) → C (password). */
function fieldsPlan(m, { exit1 = true, exit2 = true } = {}) {
  const { lc } = m;
  let d = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('MULTI_STEP', null), 'step-1', [map('username', '#id')]);
  d = lc.placeTransitionAsStepExit(d, 'step-1', transition(m, 'e1', '#next1', exit1));
  d = lc.upsertStepFieldMappings(d, 'step-2', [map('username', '#otp')]);
  d = lc.placeTransitionAsStepExit(d, 'step-2', transition(m, 'e2', '#next2', exit2));
  d = lc.upsertStepFieldMappings(d, 'step-3', [map('password', '#pass')]);
  return lc.rederiveRevealReadiness(d);
}

function floatingPlan(m, chosen = true) {
  const { lc, bar } = m;
  const opener = lc.createActionCandidate({ actionId: 'op', kind: 'floating_opener', label: 'op', locator: '#logInBtn' });
  let d = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('FLOATING_SCREEN', null), 'step-1', [map('username', '#user'), map('password', '#pass')]);
  d = lc.upsertPreambleAction(d, chosen ? bar.actionAfterTestSuccess(opener) : opener);
  return lc.rederiveRevealReadiness(d);
}

const detail = (m, plan) => {
  const v = m.lc.validateSpecialPlanComplete(plan);
  assert(!v.ok, 'fixture: plan must fail the validator');
  return { code: v.code, text: m.bar.draftGapDetailHe(plan, v.code, v.message), message: v.message };
};

// ---------------------------------------------------------------------------
// Pure
// ---------------------------------------------------------------------------
function pureChecks(m) {
  const { lc, bar } = m;
  const P = bar.SPECIAL_BUTTON_PANEL_HE;
  const S = bar.SPECIAL_STEP_BUTTON_HE;
  assert(S.lastStep === 'שלב אחרון — אין כפתור מעבר' && S.noExit === 'אין כפתור מעבר', 'A copy exact (last step / no exit)');
  assert(P.statusNeedsTest === 'מצב: ממתין לבדיקה' && P.remap === 'מיפוי חזותי', 'E copy exact («ממתין לבדיקה» / «מיפוי חזותי»)');
  assert(P.keptAfterFailure === 'הבחירה הקודמת נשמרה. אם האתר כבר התקדם, זה צפוי — כדי לבדוק שוב חזרי לדף הכניסה.', 'C copy exact');

  // A: panel view per step.
  const d = maccabiPlan(m);
  assert(lc.validateSpecialPlanComplete(d).ok && lc.validateSpecialRunnable(d).ok, 'fixture: Maccabi plan complete + runnable');
  const v1 = bar.stepButtonView(d, 'step-1');
  const v2 = bar.stepButtonView(d, 'step-2');
  const v3 = bar.stepButtonView(d, 'step-3');
  assert(v1.kind === 'exit' && v1.exit.locator === '#cont' && v1.stepIndex === 0, 'A step 1 panel = «המשך»');
  assert(v2.kind === 'exit' && v2.exit.locator === '#pwLogin', 'A step 2 panel = «כניסה עם סיסמה»');
  assert(v3.kind === 'last' && v3.stepIndex === 2, 'A step 3 = last step');
  const noExit = lc.setStepExitTransition(d, 'step-2', undefined);
  assert(bar.stepButtonView(noExit, 'step-2').kind === 'none', 'A a non-last step without an exit → «אין כפתור מעבר»');
  // Statuses.
  const fresh = transition(m, 'n', '#n', false);
  assert(bar.actionStatusHe(fresh, undefined, true) === P.statusNeedsTest, 'A stored, never tested → «ממתין לבדיקה»');
  assert(bar.actionStatusHe(fresh, undefined, false) === P.statusWaiting, 'A proposal → «ממתין לבחירה»');
  assert(bar.actionStatusHe(bar.actionForTestPress(fresh), undefined, true) === P.statusWaiting, 'A stored, continuation only → «ממתין לבחירה»');
  assert(bar.actionStatusHe(v1.exit, undefined, true) === P.statusSelected, 'A chosen → «נבחר»');
  assert(bar.actionStatusHe(v1.exit, 'opened', true) === P.statusTestedChosen, 'A last outcome: tested + chosen');
  assert(bar.actionStatusHe(v1.exit, 'kept_after_failure', true) === P.statusKeptAfterFailure, 'C chosen + failed re-test → kept status');
  assert(bar.actionStatusHe(bar.actionAfterTestFailure(v1.exit), 'field_missing', true) === P.statusNotChosenFieldMissing, 'A last outcome: failure reason');

  // B: proposals per step.
  const prop = transition(m, 'x9', '#other', false);
  const shown = (stepId, forStep) => bar.proposalShownOnStep({ draft: d, action: prop, proposedForStepId: forStep, currentStepId: stepId });
  assert(shown('step-3', 'step-3') && !shown('step-1', 'step-3') && !shown('step-2', 'step-3'), 'B a proposal shows only on its target step');
  assert(!bar.proposalShownOnStep({ draft: d, action: v1.exit, proposedForStepId: 'step-1', currentStepId: 'step-1' }), 'B a stored exit is never shown twice (own step panel)');
  assert(!bar.proposalShownOnStep({ draft: d, action: { ...v1.exit, actionId: 'dup' }, proposedForStepId: 'step-1', currentStepId: 'step-1' }), 'B same element as the step exit → not shown twice');
  const opener = m.lc.createActionCandidate({ actionId: 'o', kind: 'floating_opener', label: 'o', locator: '#o' });
  assert(bar.proposalShownOnStep({ draft: { ...d, pattern: 'FLOATING_SCREEN_MULTI_STEP' }, action: opener, proposedForStepId: 'step-3', currentStepId: 'step-1' }), 'B an opener is not a step exit → always shown');
  assert(bar.proposalShownOnStep({ draft: floatingPlan(m), action: transition(m, 'q', '#q', false), proposedForStepId: 'zz', currentStepId: 'step-1' }), 'B FLOATING_SCREEN unchanged (single panel)');

  // E: re-map keeps later steps / fields; not chosen; readiness re-derived.
  const picked = lc.createActionCandidate({ actionId: 'r1', kind: 'intermediate_transition', label: '#new', locator: '#new' });
  const r = bar.remapStepExit(d, 'step-1', bar.actionAfterTestSuccess(picked));
  assert(r.steps.length === 3 && r.steps[0].exitTransition.locator === '#new', 'E step 1 exit replaced, 3 steps kept');
  assert(!r.steps[0].exitTransition.approvedForAuthoringContinuation && !r.steps[0].exitTransition.approvedForRuntime, 'E re-mapped exit is never chosen (R3)');
  assert(r.steps[1].exitTransition.locator === '#pwLogin' && bar.actionSelected(r.steps[1].exitTransition), 'E later step exit kept');
  assert(JSON.stringify(r.steps.map((s) => s.fieldMappings)) === JSON.stringify(d.steps.map((s) => s.fieldMappings)), 'E all fields kept');
  assert(r.steps[0].exitTransition.readiness.locator === '#pwLogin' && lc.readinessTargetFor(r, r.steps[0].exitTransition) === 'action', 'E readiness re-derived (into B = B\'s exit)');
  assert(bar.checkSpecialDraft(r).message === exitMsg(1), 'E/D completeness names step 1 until it is tested');
  const r2 = bar.remapStepExit(noExit, 'step-2', picked);
  assert(r2.steps.length === 3 && r2.steps[1].exitTransition.locator === '#new' && r2.steps[2].fieldMappings.length === 2, 'E a step without a button gets one; later steps kept');
  const fo = bar.remapFloatingOpener(floatingPlan(m), lc.createActionCandidate({ actionId: 'o2', kind: 'floating_opener', label: '#o2', locator: '#o2' }));
  const openers = fo.preambleActions.filter((a) => a.kind === 'floating_opener');
  assert(openers.length === 1 && openers[0].locator === '#o2' && !openers[0].approvedForRuntime, 'E FLOATING opener replaced, not chosen');
  assert(bar.checkSpecialDraft(fo).message === 'המיפוי לא מלא: כפתור הפתיחה של המסך הצף עדיין לא נבחר — בדקו אותו.', 'D opener named');

  // «זה לא הכפתור» clears only that step's exit (even when another step has the same element).
  const twin = lc.setStepExitTransition(fieldsPlan(m), 'step-2', { ...fieldsPlan(m).steps[1].exitTransition, locator: '#next1' });
  const cleared = bar.clearStepExit(twin, 'step-2');
  assert(!cleared.steps[1].exitTransition && cleared.steps[0].exitTransition?.locator === '#next1' && cleared.steps.length === 3, 'A reject clears the selected step\'s exit only');

  // D: step-named completeness per validator code (validator order).
  assert(bar.checkSpecialDraft(lc.setStepExitTransition(d, 'step-1', bar.actionAfterTestFailure(d.steps[0].exitTransition))).message === exitMsg(1), 'D Owner case: step 1 exit un-chosen → names step 1');
  assert(bar.checkSpecialDraft(fieldsPlan(m, { exit2: false })).message === exitMsg(2), 'D step 2 exit un-chosen → names step 2');
  assert(bar.checkSpecialDraft(fieldsPlan(m, { exit1: false, exit2: false })).message === exitMsg(1), 'D two gaps → the first in validator order');
  const b2 = lc.setStepExitTransition(d, 'step-2', bar.actionAfterTestFailure(d.steps[1].exitTransition));
  const b2v = detail(m, lc.rederiveRevealReadiness(b2));
  assert(b2v.code === 'readinessNotDeclaredField' && b2v.text === `כפתור המעבר של שלב 1: ${b2v.message.replace(/\.$/, '')}`, `D B's exit un-chosen → validator fails step 1 readiness first; named so (got ${b2v.code}: ${b2v.text})`);
  const emptyPw = clone(d);
  emptyPw.steps[2].fieldMappings[1].locator = '';
  const ep = detail(m, emptyPw);
  assert(ep.code === 'emptyFieldMappings' && ep.text === `שלב 3: ${ep.message.replace(/\.$/, '')}`, `D empty row (raw plan) → step 3 (got ${ep.text})`);
  assert(lc.parseLoginFlowPlanDocument(clone(emptyPw)) === null, 'D an empty row never reaches the validator (parse rejects it), so no single field is ever named');
  const emptyStep = lc.upsertStepFieldMappings(d, 'step-3', []);
  assert(bar.checkSpecialDraft(emptyStep).message === 'המיפוי לא מלא: שלב 3: כל שלב חייב לכלול מיפוי שדות שאינו ריק.', 'D step without fields → step');
  const fsEmpty = clone(floatingPlan(m));
  fsEmpty.steps[0].fieldMappings = [];
  const fe = detail(m, fsEmpty);
  assert(fe.code === 'emptyFieldMappings' && fe.text === fe.message, 'D FLOATING_SCREEN (single step): no step label');
  const F1 = { frameLocator: '#f1', frameOrigin: 'https://a.example' };
  const F2 = { frameLocator: '#f2', frameOrigin: 'https://b.example' };
  const mixed = detail(m, lc.upsertStepFieldMappings(d, 'step-3', [map('username', '#id2', F1), map('password', '#pass', F2)]));
  assert(mixed.code === 'mixedFrameInStep' && mixed.text.startsWith('שלב 3: '), `D mixed frames → step 3 (got ${mixed.text})`);
  const badFrame = { frameLocator: '#f', frameOrigin: 'http://insecure.example' };
  const mapFrame = detail(m, lc.upsertStepFieldMappings(d, 'step-3', [map('username', '#id2'), map('password', '#pass', badFrame)]));
  assert(mapFrame.code === 'invalidFrame' && mapFrame.text.startsWith('שלב 3: '), `D invalid field frame → step 3 (got ${mapFrame.text})`);
  const exitFrame = detail(m, lc.setStepExitTransition(fieldsPlan(m), 'step-2', { ...fieldsPlan(m).steps[1].exitTransition, frame: badFrame }));
  assert(exitFrame.code === 'invalidFrame' && exitFrame.text.startsWith('כפתור המעבר של שלב 2: '), `D invalid button frame → step 2 button (got ${exitFrame.text})`);
  const fp = fieldsPlan(m);
  const selfExit = detail(m, lc.setStepExitTransition(fp, 'step-2', { ...fp.steps[1].exitTransition, readiness: { ...fp.steps[1].exitTransition.readiness, locator: '#next2' } }));
  assert(selfExit.code === 'readinessIsSelf' && selfExit.text.startsWith('כפתור המעבר של שלב 2: '), `D readiness = itself → step 2 button (got ${selfExit.text})`);
  const badReady = detail(m, lc.setStepExitTransition(fp, 'step-2', { ...fp.steps[1].exitTransition, readiness: { ...fp.steps[1].exitTransition.readiness, timeoutMs: 0 } }));
  assert(badReady.code === 'invalidReadiness' && badReady.text.startsWith('כפתור המעבר של שלב 2: '), `D invalid readiness → step 2 button (got ${badReady.text})`);
  const notDeclared = detail(m, lc.setStepExitTransition(fp, 'step-2', { ...fp.steps[1].exitTransition, readiness: { ...fp.steps[1].exitTransition.readiness, locator: '#nope' } }));
  assert(notDeclared.code === 'readinessNotDeclaredField' && notDeclared.text.startsWith('כפתור המעבר של שלב 2: '), `D readiness not declared → step 2 button (got ${notDeclared.text})`);
  const macBad = detail(m, lc.setStepExitTransition(d, 'step-2', { ...d.steps[1].exitTransition, readiness: { ...d.steps[1].exitTransition.readiness, locator: '#nope' } }));
  assert(macBad.code === 'readinessNotDeclaredField' && macBad.text.startsWith('כפתור המעבר של שלב 2: '), `D into the action-only step, readiness = B's exit is valid → the gap is step 2's button (got ${macBad.text})`);
  const emptySteps = { ...lc.ensureSpecialDraft('MULTI_STEP', null), steps: [] };
  const es = lc.validateSpecialPlanComplete(emptySteps);
  assert(bar.draftGapDetailHe(emptySteps, es.code, es.message) === es.message, 'D no place (emptySteps) → validator Hebrew unchanged');
}

// ---------------------------------------------------------------------------
// Editor harness
// ---------------------------------------------------------------------------
function walk(node, visit) {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') return visit(String(node));
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  visit(node);
  walk(node.props?.children, visit);
}
function findAll(tree, pred) {
  const found = [];
  walk(tree, (n) => typeof n === 'object' && pred(n) && found.push(n));
  return found;
}
function textOf(tree) {
  const parts = [];
  walk(tree, (n) => typeof n === 'string' && parts.push(n));
  return parts.join('\n');
}
function one(tree, action, extra = () => true) {
  const found = findAll(tree, (n) => n.props?.['data-action'] === action).filter(extra);
  assert(found.length === 1, `fixture: expected one [data-action="${action}"], found ${found.length}`);
  return found[0];
}

const HUB_ORIGIN = 'https://id.example.test';
function makeRow(metadata = {}) {
  return {
    id: 'row-1',
    display_name: 'שירות בדיקה',
    primary_url: `${HUB_ORIGIN}/login`,
    login_url: `${HUB_ORIGIN}/login`,
    updated_at: 't',
    owner_user_id: null,
    login_fields: FIELDS,
    metadata,
  };
}
const ready = (fieldId, locator) => ({ fieldId, locator, frame: null, state: 'ready' });
const proposal = (lc, actionId, kind, locator, label) => ({ action: lc.createActionCandidate({ actionId, kind, label, locator }) });
const analyzeResult = (fields, actions = []) => ({ ok: true, actionProposals: actions, fieldAnalyze: { ok: true }, framedFieldProposals: fields });
const locs = (step) => (step?.fieldMappings ?? []).map((f) => `${f.fieldId}=${f.locator}`).join(',');

function harness(m, pattern) {
  const writes = [];
  const clicks = [];
  const queue = [];
  const clickQueue = [];
  globalThis.__api = async (name, args) => {
    assert(name === 'updateGlobalRegistryRow', `fixture: unexpected API call ${name}`);
    writes.push(args[1].metadata);
    return { updatedRows: 1, writerUserId: 'admin', writtenSpecialVersion: null };
  };
  globalThis.__analyze = async () => {
    assert(queue.length > 0, 'fixture: unexpected Analyze call');
    return queue.shift();
  };
  globalThis.__click = async (input) => {
    clicks.push({ action: input.action });
    return clickQueue.shift() ?? { ok: true };
  };
  globalThis.__pick = async (input) => ({ ok: true, locator: `#visual-${input.fieldId}`, frame: null });
  const view = m.mount(m.SpecialEditor, { row: makeRow(), onSaved: async () => {}, selectedPattern: pattern });
  const stepPanel = () => {
    const p = findAll(view.tree, (n) => n.props?.['data-panel'] === 'step-exit');
    return p.length ? p[0] : null;
  };
  return {
    view,
    clicks,
    enqueue: (r) => queue.push(r),
    clickNext: (r) => clickQueue.push(r),
    async analyze() {
      one(view.tree, 'special-analyze-current-tab').props.onClick();
      await view.settle();
    },
    async test(slot = 'primary') {
      one(view.tree, 'authoring-continue-click', (n) => n.props['data-slot'] === slot).props.onClick();
      await view.settle();
      await view.settle();
    },
    async reject(slot) {
      one(view.tree, 'reject-action', (n) => n.props['data-slot'] === slot).props.onClick();
      await view.settle();
    },
    async remap(action = 'special-remap-step-exit') {
      one(view.tree, action).props.onClick();
      await view.settle();
    },
    hasSlot(slot) {
      return findAll(view.tree, (n) => n.props?.['data-action'] === 'authoring-continue-click' && n.props['data-slot'] === slot).length === 1;
    },
    selectStep(stepId) {
      const items = findAll(view.tree, (n) => n.props?.['data-action'] === 'special-select-step' && n.props['data-step-id'] === stepId);
      assert(items.length === 1, `fixture: one «שלבי התהליך» item for ${stepId}`);
      items[0].props.onClick();
      view.setProps({});
    },
    stepPanel,
    stepPanelText() {
      const p = stepPanel();
      return p ? textOf(p) : null;
    },
    completeness() {
      return textOf(findAll(view.tree, (n) => n.props?.['data-status'] === 'mapping-completeness')[0]);
    },
    text() {
      return textOf(view.tree);
    },
    async draft() {
      one(view.tree, 'save-special-draft').props.onClick();
      await view.settle();
      return writes.at(-1)[m.lc.LOGIN_FLOW_PLAN_META_KEY].draft;
    },
  };
}

/** «זהה» on A → «בדוק» «המשך» → choice screen → «בדוק» «כניסה עם סיסמה» → C. */
async function maccabiEditor(m) {
  const { lc, bar } = m;
  const h = harness(m, 'MULTI_STEP');
  h.enqueue(analyzeResult([ready('username', '#id')], [proposal(lc, 'cont', 'intermediate_transition', '#cont', 'המשך')]));
  await h.analyze();
  h.clickNext({ ok: true, actionsOnly: true, revealedFrame: null });
  h.enqueue(analyzeResult([], [proposal(lc, 'pw', 'intermediate_transition', '#pwLogin', 'כניסה עם סיסמה')]));
  await h.test();
  assert(!h.hasSlot('primary'), 'B the tested «המשך» is not shown on step 2 (its own step)');
  h.clickNext({ ok: true, revealedFrame: null });
  h.enqueue(analyzeResult([ready('username', '#id2'), ready('password', '#pass')]));
  await h.test('followUp');
  const d = await h.draft();
  assert(d.steps.length === 3 && bar.actionSelected(d.steps[0].exitTransition) && bar.actionSelected(d.steps[1].exitTransition), 'fixture: Maccabi authored');
  assert(locs(d.steps[2]) === 'username=#id2,password=#pass' && lc.validateSpecialRunnable(d).ok, 'fixture: step 3 mapped, runnable');
  return h;
}

async function editorChecks(m) {
  const { lc, bar } = m;
  const P = bar.SPECIAL_BUTTON_PANEL_HE;
  const S = bar.SPECIAL_STEP_BUTTON_HE;
  const h = await maccabiEditor(m);

  // A: the panel follows «שלב נוכחי».
  assert(h.stepPanelText() === `${S.title(2)}\n${S.lastStep}`, `A step 3 panel: «${S.lastStep}» (got ${h.stepPanelText()})`);
  h.selectStep('step-1');
  let t = h.stepPanelText();
  assert(t.includes('#cont') && t.includes(lc.FRAME_TOP_LABEL_HE) && t.includes(P.statusTestedChosen), `A step 1 panel: «המשך», location, status (got ${t})`);
  assert(!t.includes('#pwLogin'), 'A step 1 panel shows only step 1\'s button');
  h.selectStep('step-2');
  t = h.stepPanelText();
  assert(t.includes('#pwLogin') && !t.includes('#cont') && t.includes(P.statusTestedChosen), `A step 2 panel: «כניסה עם סיסמה» (got ${t})`);

  // B: a proposal is shown only while its step is selected.
  h.selectStep('step-3');
  h.enqueue(analyzeResult([], [proposal(lc, 'x9', 'intermediate_transition', '#other', 'עוד')]));
  await h.analyze();
  assert(h.hasSlot('primary'), 'B proposal on its step (3)');
  h.selectStep('step-1');
  assert(!h.hasSlot('primary'), 'B proposal hidden on step 1');
  h.selectStep('step-3');
  assert(h.hasSlot('primary'), 'B proposal back on step 3');

  // C: failed re-test of a chosen exit keeps both flags and the draft.
  h.selectStep('step-1');
  const before = await h.draft();
  h.clickNext({ ok: false, reason: 'readiness_timeout', message: 'השדה לא הופיע.' });
  await h.test('step');
  assert(h.text().includes(`השדה לא הופיע. ${P.keptAfterFailure}`), 'C failure message + kept copy');
  assert(h.stepPanelText().includes(P.statusKeptAfterFailure), 'C status: kept after failure');
  const afterC = await h.draft();
  assert(JSON.stringify(afterC) === JSON.stringify(before), 'C draft unchanged after a failed re-test of a chosen exit');
  assert(bar.actionSelected(afterC.steps[0].exitTransition), 'C both flags kept');
  assert(h.completeness() === 'הבדיקה המבנית תקינה.', 'C mapping still complete');

  // E: «מיפוי חזותי» on step 1's button → «ממתין לבדיקה», later steps / fields kept.
  await h.remap();
  const e = await h.draft();
  const e1 = e.steps[0].exitTransition;
  assert(e1.locator === '#visual-action:intermediate_transition' && !e1.approvedForRuntime && !e1.approvedForAuthoringContinuation, 'E step 1 exit replaced, not chosen');
  assert(e.steps.length === 3 && e.steps[1].exitTransition.locator === '#pwLogin' && bar.actionSelected(e.steps[1].exitTransition), 'E later step exit kept');
  assert(locs(e.steps[0]) === 'username=#id' && locs(e.steps[2]) === 'username=#id2,password=#pass', 'E fields kept');
  assert(e1.readiness.locator === '#pwLogin', `E readiness re-derived (got ${e1.readiness.locator})`);
  assert(h.stepPanelText().includes(P.statusNeedsTest), 'E status «ממתין לבדיקה»');
  assert(h.completeness() === exitMsg(1), `D completeness names step 1 until tested (got ${h.completeness()})`);
  h.clickNext({ ok: true });
  h.enqueue(analyzeResult([]));
  await h.test('step');
  const eT = await h.draft();
  assert(bar.actionSelected(eT.steps[0].exitTransition) && h.completeness() === 'הבדיקה המבנית תקינה.', 'E «בדוק» chooses the re-mapped button');
  assert(h.clicks.at(-1).action.locator === '#visual-action:intermediate_transition', 'E «בדוק» tests the re-mapped button');

  // «זה לא הכפתור» on step 2 → only step 2's exit; then «אין כפתור מעבר» + «מיפוי חזותי».
  h.selectStep('step-2');
  await h.reject('step');
  const rj = await h.draft();
  assert(!rj.steps[1].exitTransition && bar.actionSelected(rj.steps[0].exitTransition) && rj.steps.length === 3 && locs(rj.steps[2]) === 'username=#id2,password=#pass', 'A reject clears step 2\'s exit only');
  assert(h.stepPanelText().includes(S.noExit) && h.stepPanel() && findAll(h.stepPanel(), (n) => n.props?.['data-action'] === 'special-remap-step-exit').length === 1, 'A step without a button: «אין כפתור מעבר» + «מיפוי חזותי»');
  await h.remap();
  const rm = await h.draft();
  assert(rm.steps.length === 3 && rm.steps[1].exitTransition?.locator === '#visual-action:intermediate_transition' && !rm.steps[1].exitTransition.approvedForRuntime, 'E step 2 re-mapped, 3 steps kept');

  // C: failure on an unchosen exit still clears.
  const u = harness(m, 'MULTI_STEP');
  u.enqueue(analyzeResult([ready('username', '#id')], [proposal(lc, 'cont', 'intermediate_transition', '#cont', 'המשך')]));
  await u.analyze();
  u.clickNext({ ok: false, reason: 'surface_not_revealed', message: 'המסך לא נפתח.' });
  await u.test('primary');
  assert(u.text().includes('המסך לא נפתח.') && !u.text().includes(P.keptAfterFailure), 'C unchosen exit: failure message, no kept copy');
  assert(u.stepPanelText().includes(P.statusNotChosen), 'C unchosen: failure outcome in the step panel');
  const ud = await u.draft();
  const ue = ud.steps[0].exitTransition;
  assert(ue && !ue.approvedForRuntime && !ue.approvedForAuthoringContinuation, 'C unchosen exit: failure clears');

  // FLOATING_SCREEN: single opener panel + «מיפוי חזותי» replaces the opener.
  const fs = harness(m, 'FLOATING_SCREEN');
  fs.enqueue(analyzeResult([], [proposal(lc, 'opener-1', 'floating_opener', '#logInBtn', 'כניסה')]));
  await fs.analyze();
  fs.enqueue(analyzeResult([ready('username', '#user'), ready('password', '#pass')]));
  await fs.test();
  assert(fs.stepPanel() === null, 'A FLOATING_SCREEN has no per-step panel');
  await fs.remap('special-remap-opener');
  const fd = await fs.draft();
  const ops = fd.preambleActions.filter((a) => a.kind === 'floating_opener');
  assert(ops.length === 1 && ops[0].locator === '#visual-action:floating_opener' && !ops[0].approvedForRuntime, 'E FLOATING opener replaced, not chosen');
  assert(locs(fd.steps[0]) === 'username=#user,password=#pass', 'E FLOATING fields kept');
  assert(fs.text().includes(P.statusNeedsTest) && fs.hasSlot('primary'), 'E FLOATING panel: «ממתין לבדיקה» with «בדוק»');
  assert(fs.completeness() === 'המיפוי לא מלא: כפתור הפתיחה של המסך הצף עדיין לא נבחר — בדקו אותו.', 'D FLOATING completeness names the opener');
  // C for openers: a chosen opener keeps its choice on a failed re-test.
  fs.enqueue(analyzeResult([]));
  await fs.test();
  const fb = await fs.draft();
  fs.clickNext({ ok: false, reason: 'surface_not_revealed', message: 'המסך לא נפתח.' });
  await fs.test();
  assert(JSON.stringify(await fs.draft()) === JSON.stringify(fb) && bar.actionSelected(fb.preambleActions[0]), 'C opener: failed re-test keeps the choice');
}

// ---------------------------------------------------------------------------
// Fill test (REAL Hub entry; draft path returns before any extension use)
// ---------------------------------------------------------------------------
async function fillTestChecks(m) {
  const { lc, bar } = m;
  const run = async (draft) =>
    m.executeAdminSpecialLoginFlowTest({
      serviceRow: {
        id: 'row-1',
        primary_url: `${HUB_ORIGIN}/login`,
        login_url: `${HUB_ORIGIN}/login`,
        metadata: { [lc.LOGIN_FLOW_PLAN_META_KEY]: { draft } },
      },
      contextChoice: 'special_draft',
      tempCredentials: {},
    });
  const d = maccabiPlan(m);
  const unchosen = lc.setStepExitTransition(d, 'step-1', bar.actionAfterTestFailure(d.steps[0].exitTransition));
  const o1 = await run(unchosen);
  assert(o1.reason === 'draft_incomplete' && o1.detailMessage === exitMsg(1), `D fill test names step 1's button (got ${o1.detailMessage})`);
  const o2 = await run(lc.upsertStepFieldMappings(d, 'step-3', []));
  assert(o2.detailMessage === 'המיפוי לא מלא: שלב 3: כל שלב חייב לכלול מיפוי שדות שאינו ריק.', `D fill test names the step (got ${o2.detailMessage})`);
}

// ---------------------------------------------------------------------------
// Static
// ---------------------------------------------------------------------------
function staticChecks() {
  const ui = read('src/admin/SpecialLoginDraftEditor.tsx');
  const barSrc = read('src/admin/specialActionBar.ts');
  for (const [name, src] of [['editor', ui], ['action bar', barSrc]]) {
    assert(!/maccabi|מכבי|hostname|serviceId ===|fixture/i.test(src), `S no site / hostname / serviceId / fixture branches (${name})`);
  }
  assert(!barSrc.includes("'final_submit'") && !ui.includes("'final_submit'"), 'S final_submit untouched');
  const diff = execSync('git diff HEAD --stat -- extension/manifest.json src/loginContract/validateSpecialPlan.ts src/loginContract/runtimeGate.ts src/loginContract/parse.ts src/loginContract/types.ts', { cwd: root }).toString();
  assert(diff.trim() === '', `S manifest / validator / gate / parse / contract types unchanged (${diff.trim()})`);
  const reject = ui.slice(ui.indexOf('  function rejectAction('), ui.indexOf('  function rejectStepExit('));
  assert(reject.includes("if (!(stepSelector && shown.kind === 'intermediate_transition')) {"), 'S a multi-step proposal reject never removes a stored exit');
}

// ---------------------------------------------------------------------------
// Run + mutations
// ---------------------------------------------------------------------------
async function runAll(m) {
  pureChecks(m);
  await editorChecks(m);
  await fillTestChecks(m);
}

const M = await load();
pureChecks(M);
ok('pure: step panel view + statuses; proposals per step; re-map / clear keep later steps + fields, re-derive readiness; step-named completeness per code');
await editorChecks(M);
ok('editor (Maccabi 3 steps): panel follows «שלב נוכחי»; proposal hidden on other steps; kept choice; «מיפוי חזותי» → «ממתין לבדיקה» → «בדוק»; reject one step; FLOATING opener');
await fillTestChecks(M);
ok('fill test: step / field named «המיפוי לא מלא» message');
staticChecks();
ok('static: no site branches; final_submit, manifest, validator, gate, parse, types unchanged');

async function expectCaught(label, overrides) {
  let caught = null;
  try {
    const m = await load(overrides);
    await runAll(m);
  } catch (err) {
    caught = String((err && err.message) || err).split('\n')[0];
  }
  assert(caught, `MUTATION NOT CAUGHT: ${label}`);
  assert(!caught.startsWith('fixture:') && !caught.includes('anchor "'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  ok(`mutation caught: ${label}  [${caught.slice(0, 100)}]`);
}
const UI = 'src/admin/SpecialLoginDraftEditor.tsx';
const BAR = 'src/admin/specialActionBar.ts';
const FLOW = 'src/execution/specialLoginFlow.ts';
const mut = (file, pairs) => {
  let src = read(file);
  for (const [from, to] of pairs) src = replaceOnce(src, from, to, `${file}: ${from.slice(0, 40)}`);
  return { [file]: src };
};

await expectCaught('MA1 step panel ignores «שלב נוכחי» (always step 1)', mut(UI, [['    const view = stepButtonView(draft, currentStepId);', '    const view = stepButtonView(draft, draft.steps[0]?.stepId ?? currentStepId);']]));
await expectCaught('MA2 last step shown as «אין כפתור מעבר»', mut(BAR, [['  return stepIndex === draft.steps.length - 1 ?', '  return false ?']]));
await expectCaught('MA3 step reject removes the same element on every step', mut(BAR, [[
  '  return rederiveRevealReadiness(setStepExitTransition(draft, stepId, undefined));',
  '  const target = draft.steps.find((s) => s.stepId === stepId)?.exitTransition;\n  let next = draft;\n  for (const s of draft.steps) if (s.exitTransition && target && s.exitTransition.locator === target.locator) next = setStepExitTransition(next, s.stepId, undefined);\n  return rederiveRevealReadiness(next);',
]]));
await expectCaught('MA4 step panel status ignores the stored state (proposal status)', mut(UI, [['              {actionStatusHe(exit, testOutcomes[exit.actionId], true)}', '              {actionStatusHe(exit, testOutcomes[exit.actionId])}']]));
await expectCaught('MB1 proposals shown on every step', mut(BAR, [['  return (input.proposedForStepId ?? currentStepId) === currentStepId;', '  return true;']]));
await expectCaught('MB2 manual Analyze does not record the proposal\'s step', mut(UI, [['        rememberProposalStep(selected, targetStepId);\n        setPendingAction(selected);', '        setPendingAction(selected);']]));
await expectCaught('MC1 failed re-test of a chosen action clears it', mut(UI, [['        if (!wasChosen) {', '        if (true) {']]));
await expectCaught('MC2 failed test of an unchosen action keeps it', mut(UI, [['        if (!wasChosen) {', '        if (false) {']]));
await expectCaught('MC3 kept choice without the kept copy', mut(UI, [['        setError(`${result.message} ${SPECIAL_BUTTON_PANEL_HE.keptAfterFailure}`);', '        setError(result.message);']]));
await expectCaught('MC4 kept choice shows a failure status', mut(UI, [["        setTestOutcome(action.actionId, notProven ? null : 'kept_after_failure');", '        setTestOutcome(action.actionId, notProven ? null : testFailureOutcome(result.reason));']]));
await expectCaught('MD1 completeness not step-named (validator Hebrew only)', mut(BAR, [['  const detail = result.ok ? \'\' : draftGapDetailHe(snap.snapshot.plan, result.code, result.message);', '  const detail = result.ok ? \'\' : result.message;']]));
await expectCaught('MD2 locator walks exits last-to-first', mut(BAR, [['  for (let i = 0; i < steps.length; i += 1) {\n    const exit = steps[i]!.exitTransition;\n    const revealed', '  for (let i = steps.length - 1; i >= 0; i -= 1) {\n    const exit = steps[i]!.exitTransition;\n    const revealed']]));
await expectCaught('MD3 step name dropped for step gaps', mut(BAR, [['  return stepSelectorVisible(plan.pattern) ? `${stepLabelHe(place.stepIndex)}: ${detail}` : message;', '  return message;']]));
await expectCaught('MD4 fill test bypasses the step-named check', mut(FLOW, [['      return failedEarly(\'draft_incomplete\', { detailMessage: check.message, planVersion: draft.planVersion });', '      return failedEarly(\'draft_incomplete\', { detailMessage: draftCompletenessPreviewMessage(draft), planVersion: draft.planVersion });\n    }\n    function draftCompletenessPreviewMessage(d: LoginFlowPlanDocument): string {\n      const v = validateSpecialPlanComplete(d);\n      return v.ok ? \'\' : `המיפוי לא מלא: ${v.message}`;']]));
await expectCaught('MD5 readiness-not-declared located without the action-only rule', mut(BAR, [['      return revealedMappings !== null && revealedMappings.length === 0 && revealedExit\n        ?', '      return false\n        ?']]));
await expectCaught('ME1 re-map writes the button as chosen', mut(BAR, [['  return rederiveRevealReadiness(placeTransitionAsStepExit(draft, stepId, unchosen(candidate)));', '  return rederiveRevealReadiness(placeTransitionAsStepExit(draft, stepId, approveActionForRuntime(approveActionForAuthoringContinuation(candidate))));']]));
await expectCaught('ME2 re-map deletes later steps', mut(BAR, [['  return rederiveRevealReadiness(placeTransitionAsStepExit(draft, stepId, unchosen(candidate)));', '  return rederiveRevealReadiness(placeTransitionAsStepExit({ ...draft, steps: draft.steps.slice(0, draft.steps.findIndex((s) => s.stepId === stepId) + 1) }, stepId, unchosen(candidate)));']]));
await expectCaught('ME3 re-map without re-deriving readiness', mut(BAR, [['  return rederiveRevealReadiness(placeTransitionAsStepExit(draft, stepId, unchosen(candidate)));', '  return placeTransitionAsStepExit(draft, stepId, unchosen(candidate));']]));
await expectCaught('ME4 editor re-map only proposes (never writes the step exit)', mut(UI, [['    if (picked.frame && !frameApproved(picked.frame)) {\n      if (target !== \'opener\')', '    if (true) {\n      if (target !== \'opener\')']]));
await expectCaught('ME5 FLOATING re-map leaves the old opener', mut(UI, [['        ? remapFloatingOpener(current, candidate)', '        ? current']]));

out(`\nPASS — D-121-67 step buttons verify: 4 groups, ${passed - 4} mutations caught`);
process.exit(0);
