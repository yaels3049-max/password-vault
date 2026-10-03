/**
 * Phase 121 D-121-56 — floating screen: fields come only from the opened screen.
 * Drives the REAL SpecialLoginDraftEditor (minimal hooks runtime). Only I/O is stubbed:
 * current-surface Analyze, the authoring click, Visual pick, registry write.
 * - Clean FLOATING_SCREEN draft; the main page offers text / search inputs → manual «נתח» writes
 *   no fields (top-document, framed, held) and the «בדוק» press runs in reveal mode.
 * - After «בדוק» succeeds: fields from the opened surface (top-document and framed fixtures);
 *   a later manual «נתח» writes fields as today.
 * - FLOATING_SCREEN_MULTI_STEP step 1 gated the same way; MULTI_STEP unchanged; field Visual unrestricted.
 * Synthetic fixtures. Mutations must be caught.
 * Usage: node scripts/verifyPhase121FloatingFieldsAfterOpener.mjs
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

const loadBundle = (overrides = {}) => withTempDir('pv-12156-', (outdir) => loadBundleIn(outdir, overrides));
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
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
}
const byAction = (tree, action) => findAll(tree, (n) => n.props?.['data-action'] === action);
function one(tree, action, extra = () => true) {
  const found = byAction(tree, action).filter(extra);
  assert(found.length === 1, `fixture: expected one [data-action="${action}"], found ${found.length}`);
  return found[0];
}
const successText = (tree) => findAll(tree, (n) => n.props?.className === 'admin-success').map(textOf).join(' | ');

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ORIGIN = 'https://bank.example.test';
const SAME_FRAME = { frameLocator: '#iframeLogIn', frameOrigin: ORIGIN };
const CROSS_FRAME = { frameLocator: 'iframe#sso', frameOrigin: 'https://sso.example.test' };
function makeRow() {
  return {
    id: 'row-1',
    display_name: 'בנק בדיקה',
    primary_url: `${ORIGIN}/`,
    login_url: `${ORIGIN}/`,
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
/** Main page before the screen opens: an opener plus text / search inputs the AI rates confidently. */
function mainPageResult(lc) {
  return {
    ok: true,
    actionProposals: [{ action: lc.createActionCandidate({ actionId: 'opener-main', kind: 'floating_opener', label: 'כניסה', locator: '#logInBtn' }) }],
    fieldAnalyze: { ok: true },
    framedFieldProposals: [
      ready('username', '#BranchNumber'),
      ready('password', '#st-search-input', SAME_FRAME),
      { fieldId: 'password', locator: '#sso-pass', frame: CROSS_FRAME, state: 'needs_frame_approval' },
    ],
  };
}
function surfaceResult(proposals) {
  return { ok: true, actionProposals: [], fieldAnalyze: { ok: true }, framedFieldProposals: proposals };
}

// ─── Harness ──────────────────────────────────────────────────────────────────
function harness(m, pattern) {
  const writes = [];
  const clicks = [];
  const analyzeCalls = [];
  const queue = [];
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
    clicks.push({ action: input.action, mode: m.lc.readinessModeFor(input.action) });
    return { ok: true };
  };
  globalThis.__pick = async (input) => ({ ok: true, locator: `#visual-${input.fieldId}`, frame: null });
  const view = m.mount(m.SpecialEditor, { row: makeRow(), onSaved: async () => {}, selectedPattern: pattern });
  const h = {
    view,
    clicks,
    analyzeCalls,
    enqueue: (r) => queue.push(r),
    async analyze() {
      one(view.tree, 'special-analyze-current-tab').props.onClick();
      await view.settle();
    },
    async test(slot = 'primary') {
      one(view.tree, 'authoring-continue-click', (n) => n.props['data-slot'] === slot).props.onClick();
      await view.settle();
    },
    async visual(fieldId) {
      one(view.tree, 'special-visual-field', (n) => n.props['data-field-id'] === fieldId).props.onClick();
      await view.settle();
    },
    /** The draft as «שמור מיפוי» would write it (the editor's current in-memory draft). */
    async draft() {
      one(view.tree, 'save-special-draft').props.onClick();
      await view.settle();
      return writes.at(-1)[m.lc.LOGIN_FLOW_PLAN_META_KEY].draft;
    },
  };
  return h;
}
const mappings = (draft, stepIdx = 0) => draft.steps[stepIdx]?.fieldMappings ?? [];

// ─── Checks ───────────────────────────────────────────────────────────────────
async function gateBeforeOpener(m, fixture) {
  const h = harness(m, 'FLOATING_SCREEN');
  h.enqueue(mainPageResult(m.lc));
  await h.analyze();
  assert(byAction(h.view.tree, 'approve-frame').length === 0 && !successText(h.view.tree).includes(m.SPECIAL_EDITOR_COPY_HE.frameFieldsHeld), `G1 ${fixture}: framed main-page proposal not held`);
  assert(successText(h.view.tree).includes(m.SPECIAL_EDITOR_COPY_HE.actionFound), `G1 ${fixture}: «נתח» proposes the opener with today's copy (got "${successText(h.view.tree)}")`);
  let draft = await h.draft();
  assert(mappings(draft).length === 0, `G1 ${fixture}: «נתח» before the opener test writes no field (got ${JSON.stringify(mappings(draft).map((f) => f.locator))})`);

  // «בדוק»: the click runs in reveal mode (no declared main-page field to wait for).
  const opened =
    fixture === 'framed'
      ? surfaceResult([ready('username', '#user', SAME_FRAME)])
      : surfaceResult([ready('username', '#user')]);
  h.enqueue(opened);
  await h.test();
  assert(h.clicks.length === 1 && h.clicks[0].mode === 'reveal', `G2 ${fixture}: «בדוק» runs in reveal mode (got ${h.clicks[0]?.mode}, readiness ${JSON.stringify(h.clicks[0]?.action.readiness)})`);
  assert(h.analyzeCalls.length === 2, 'fixture: auto-Analyze after the successful test');
  draft = await h.draft();
  const opener = (draft.preambleActions ?? []).find((a) => a.kind === 'floating_opener');
  assert(opener && m.bar.actionSelected(opener), `G2 ${fixture}: the opener is chosen after the test`);
  const user = mappings(draft).find((f) => f.fieldId === 'username');
  assert(user && user.locator === '#user', `G2 ${fixture}: fields come from the opened surface (got ${JSON.stringify(mappings(draft))})`);
  if (fixture === 'framed') assert(user.frame?.frameLocator === SAME_FRAME.frameLocator, 'G2 framed: frame descriptor kept');
  else assert(!user.frame, 'G2 top-document: no frame');
  assert(!mappings(draft).some((f) => ['#BranchNumber', '#st-search-input'].includes(f.locator)), `G2 ${fixture}: no main-page input in the draft`);

  // Opener chosen → manual «נתח» writes fields as today (including the frame hold).
  h.enqueue(surfaceResult([ready('password', '#pass', fixture === 'framed' ? SAME_FRAME : null)]));
  await h.analyze();
  draft = await h.draft();
  assert(mappings(draft).some((f) => f.fieldId === 'password' && f.locator === '#pass'), `G3 ${fixture}: opener chosen → «נתח» writes fields as today`);
}

async function heldAfterOpener(m) {
  const h = harness(m, 'FLOATING_SCREEN');
  h.enqueue(mainPageResult(m.lc));
  await h.analyze();
  h.enqueue(surfaceResult([]));
  await h.test();
  h.enqueue(surfaceResult([{ fieldId: 'password', locator: '#sso-pass', frame: CROSS_FRAME, state: 'needs_frame_approval' }]));
  await h.analyze();
  assert(successText(h.view.tree).includes(m.SPECIAL_EDITOR_COPY_HE.frameFieldsHeld), 'G3 held: opener chosen → a framed proposal is held for «אשר מסגרת» as today');
}

async function floatingMultiStep(m) {
  const h = harness(m, 'FLOATING_SCREEN_MULTI_STEP');
  h.enqueue(mainPageResult(m.lc));
  await h.analyze();
  const draft = await h.draft();
  assert(mappings(draft).length === 0, 'G4 FLOATING_SCREEN_MULTI_STEP step 1: «נתח» before the opener test writes no field');
}

async function multiStepUnchanged(m) {
  const h = harness(m, 'MULTI_STEP');
  h.enqueue(surfaceResult([ready('username', '#u1'), ready('password', '#p1')]));
  await h.analyze();
  const draft = await h.draft();
  assert(mappings(draft).map((f) => f.locator).join(',') === '#u1,#p1', `G5 MULTI_STEP: «נתח» writes fields as today (got ${JSON.stringify(mappings(draft))})`);
}

async function visualUnrestricted(m) {
  const h = harness(m, 'FLOATING_SCREEN');
  await h.visual('username');
  const draft = await h.draft();
  assert(mappings(draft).some((f) => f.fieldId === 'username' && f.locator === '#visual-username'), 'G6 field Visual before the opener test still writes the field');
}

function pureChecks(m) {
  const { bar, lc } = m;
  const fsms = lc.ensureSpecialDraft('FLOATING_SCREEN_MULTI_STEP', null);
  fsms.steps.push({ stepId: 'step-2', fieldMappings: [] });
  // D-121-58: later steps follow step N's transition, not the opener.
  assert(!bar.manualAnalyzeMayWriteFields(fsms, 'FLOATING_SCREEN_MULTI_STEP', 'step-2'), 'P1 later step gated until the previous step\'s transition is chosen (D-121-58)');
  assert(!bar.manualAnalyzeMayWriteFields(fsms, 'FLOATING_SCREEN_MULTI_STEP', 'step-1'), 'P1 FLOATING_SCREEN_MULTI_STEP step 1 gated');
  const fs = lc.ensureSpecialDraft('FLOATING_SCREEN', null);
  const fsExtra = lc.deepClonePlanDocument(fs);
  fsExtra.steps.push({ stepId: 'step-2', fieldMappings: [] });
  assert(bar.manualAnalyzeMayWriteFields(fsExtra, 'FLOATING_SCREEN', 'step-2'), 'P1 FLOATING_SCREEN: only the opener-revealed step is gated');
  assert(!bar.manualAnalyzeMayWriteFields(fs, 'FLOATING_SCREEN', fs.steps[0].stepId), 'P2 no chosen opener → gated');
  const candidate = lc.createActionCandidate({ actionId: 'o', kind: 'floating_opener', label: 'o', locator: '#o' });
  const onlyContinuation = lc.upsertPreambleAction(fs, bar.actionForTestPress(candidate));
  assert(!bar.manualAnalyzeMayWriteFields(onlyContinuation, 'FLOATING_SCREEN', fs.steps[0].stepId), 'P3 test consent alone (no successful test) → still gated');
  const chosen = lc.upsertPreambleAction(fs, bar.actionAfterTestSuccess(candidate));
  assert(bar.manualAnalyzeMayWriteFields(chosen, 'FLOATING_SCREEN', fs.steps[0].stepId), 'P4 chosen opener → allowed');
  assert(bar.manualAnalyzeMayWriteFields(fs, 'MULTI_STEP', fs.steps[0].stepId) && bar.manualAnalyzeMayWriteFields(fs, 'STANDARD', 'step-1'), 'P5 MULTI_STEP / STANDARD never gated');
}

function staticChecks() {
  const ui = read('src/admin/SpecialLoginDraftEditor.tsx');
  const fn = ui.slice(ui.indexOf('async function runSpecialAnalyze'), ui.indexOf('async function analyzeCurrentSurface'));
  assert(fn.includes("mode !== 'manual' || manualAnalyzeMayWriteFields(current, pattern, targetStepId)"), 'S1 gate applies to manual Analyze only (after_continue unchanged)');
  const bar = read('src/admin/specialActionBar.ts');
  const gate = bar.slice(bar.indexOf('export function manualAnalyzeMayWriteFields'), bar.indexOf('/** Result of the last'));
  assert(!/hostname|serviceId|mizrahi|https?:/i.test(gate), 'S2 no site / host / serviceId branches');
  const visual = ui.slice(ui.indexOf('async function visualPickField'), ui.indexOf('function panelAction'));
  assert(!visual.includes('manualAnalyzeMayWriteFields'), 'S3 field Visual not gated');
}

async function runAll(overrides = {}) {
  const m = await loadBundle(overrides);
  pureChecks(m);
  await gateBeforeOpener(m, 'top-document');
  await gateBeforeOpener(m, 'framed');
  await heldAfterOpener(m);
  await floatingMultiStep(m);
  await multiStepUnchanged(m);
  await visualUnrestricted(m);
}

console.log('Phase 121 D-121-56 — floating screen: fields come only from the opened screen\n');
await runAll();
console.log('  ✓ P1–P5 — gate: steps[0] of floating patterns until a chosen opener; test consent alone is not enough; FSMS later steps follow D-121-58; MULTI_STEP / STANDARD open');
console.log('  ✓ G1 — clean draft + main page text/search inputs → «נתח» writes no field, holds nothing, proposes the opener (today\'s copy)');
console.log('  ✓ G2 — «בדוק» runs in reveal mode → fields from the opened surface (top-document and framed fixtures); no main-page input');
console.log('  ✓ G3 — opener chosen → later «נתח» writes fields and holds framed ones as today');
console.log('  ✓ G4 — FLOATING_SCREEN_MULTI_STEP step 1 gated the same way');
console.log('  ✓ G5 — MULTI_STEP «נתח» unchanged');
console.log('  ✓ G6 — field Visual unrestricted before the opener test');
staticChecks();
console.log('  ✓ S1–S3 — manual only; no site branches; Visual not gated');

console.log('\nMutations');
const UI = 'src/admin/SpecialLoginDraftEditor.tsx';
const BAR = 'src/admin/specialActionBar.ts';
const MUT = [
  ['M1 gate removed', UI, [["      mode !== 'manual' || manualAnalyzeMayWriteFields(current, pattern, targetStepId);", '      true;']]],
  ['M2 gate never lifts', BAR, [["    (action) => action.kind === 'floating_opener' && actionSelected(action),", '    () => false,']]],
  ['M3 MULTI_STEP gated too', BAR, [["  if (pattern !== 'FLOATING_SCREEN' && pattern !== 'FLOATING_SCREEN_MULTI_STEP') return true;", "  if (pattern === 'STANDARD') return true;"]]],
  ['M4 held proposals kept while gated', UI, [
    ['    if (fieldsWritable && !afterTest?.actionsOnly && result.ok && result.fieldAnalyze.ok) {', '    if (!afterTest?.actionsOnly && result.ok && result.fieldAnalyze.ok) {'],
    ["        if (p.state === 'ready') {", "        if (p.state === 'ready' && fieldsWritable) {"],
  ]],
  ['M5 gate keyed on the wrong step', BAR, [['  if (draft.steps[0]?.stepId !== stepId) return true;', '  if (draft.steps[1]?.stepId !== stepId) return true;']]],
  ['M8 later steps gated too', BAR, [['  if (draft.steps[0]?.stepId !== stepId) return true;\n', '']]],
  ['M6 gate lifts on test consent alone', BAR, [["    (action) => action.kind === 'floating_opener' && actionSelected(action),", "    (action) => action.kind === 'floating_opener' && action.approvedForAuthoringContinuation === true,"]]],
  ['M7 field Visual gated', UI, [[
    "    const picked = await runArmedVisualPick({ target: 'field', fieldId, label: fieldLabel });",
    "    if (!manualAnalyzeMayWriteFields(draft, pattern, currentStepId)) return;\n    const picked = await runArmedVisualPick({ target: 'field', fieldId, label: fieldLabel });",
  ]]],
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
console.log(`\nPASS — D-121-56 verify: 5 pure + 6 behavior groups + 3 static, ${MUT.length} mutations caught`);
process.exit(0);
