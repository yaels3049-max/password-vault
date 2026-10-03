/**
 * Phase 121 D-121-43 CORRECTION C1 — SPECIAL «אשר מיפוי» approves only the saved mapping.
 * Drives the REAL SpecialLoginDraftEditor with a minimal hooks runtime (no DOM library):
 * change a field (Visual pick stubbed) → approve disabled and the confirm dialog cannot open;
 * «שמור מיפוי» → enabled → confirm → the approve write carries the saved draft; the row is
 * rebuilt through the REAL contract merge and the status line reads «מאושר למשתמשים».
 * Only I/O is stubbed (registry write, extension pick). Synthetic fixtures. Mutations must be caught.
 * Usage: node scripts/verifyPhase121ApproveSavedOnly.mjs
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

// Minimal hooks runtime: the component is a plain function; elements are plain objects.
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
    async settle() { for (let n = 0; n < 5; n += 1) { await new Promise((r) => setTimeout(r, 0)); render(); } },
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

const loadBundle = (overrides = {}) => withTempDir('pv-12143c1-', (outdir) => loadBundleIn(outdir, overrides));
async function loadBundleIn(outdir, overrides) {
  const reactPath = join(outdir, 'mini-react.mjs');
  writeFileSync(reactPath, MINI_REACT);
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const pickSeamFile = abs('src/assistedMapping/currentTabAuthoring.ts');
  const apiFile = abs('src/admin/adminRegistryApi.ts');
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const plugin = {
    name: 'verify-seams',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: reactPath }));
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        if (key === apiFile) return { contents: apiStub(), loader: 'js' };
        if (key === pickSeamFile) {
          const src = replaceOnce(
            readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n'),
            'export async function startCurrentTabVisualMapping(input: {',
            'export async function startCurrentTabVisualMapping(input: any): Promise<any> { return (globalThis as any).__pick(input); }\nasync function realStartCurrentTabVisualMapping(input: {',
            'pick seam',
          );
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
        export { default as SpecialEditor } from './src/admin/SpecialLoginDraftEditor.tsx';
        export * as lc from './src/loginContract/index.ts';
        export * as status from './src/admin/mappingStatus.ts';
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
function one(tree, action) {
  const found = byAction(tree, action);
  assert(found.length === 1, `expected one [data-action="${action}"], found ${found.length}`);
  return found[0];
}
/**
 * D-121-45: the status line moved to the «אופי הכניסה» grid, which derives it from the row
 * the parent passes to both grids; read it from the row the editor currently holds.
 */
function statusOf(m, row) {
  return m.status.specialMappingStatus(row.metadata);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ORIGIN = 'https://svc.example.test';
function floatingDraft(userLocator) {
  return {
    planVersion: 1,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [
      {
        actionId: 'opener-1',
        kind: 'floating_opener',
        label: 'Open',
        locatorType: 'css',
        locator: '#open-login',
        approvedForAuthoringContinuation: true,
        approvedForRuntime: true,
        readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: userLocator, timeoutMs: 5000 },
      },
    ],
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: userLocator },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}
function makeRow(metadata) {
  return {
    id: 'row-1',
    display_name: 'שירות בדיקה',
    primary_url: `${ORIGIN}/`,
    login_url: `${ORIGIN}/login`,
    updated_at: 't',
    owner_user_id: null,
    login_fields: [
      { id: 'username', label: 'User', type: 'text', required: true },
      { id: 'password', label: 'Pass', type: 'password', required: true },
    ],
    metadata,
  };
}

// ─── Scenario ─────────────────────────────────────────────────────────────────
async function scenario(m) {
  const { lc } = m;
  const PLAN = lc.LOGIN_FLOW_PLAN_META_KEY;
  const INTENT = lc.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY;
  let db = lc.mergeLoginContractMetadata({ existingMetadata: {}, patchMetadata: { [PLAN]: { draft: floatingDraft('#user') } } });
  assert(db.ok, 'fixture: initial save merges');
  db = db.metadata;
  const writes = [];
  // Same order as updateGlobalRegistryRow's contract path: planner sees the stored plan, not this request's intent.
  globalThis.__api = async (name, args) => {
    if (name === 'fetchRegistryRowForAdmin') return makeRow(db);
    assert(name === 'updateGlobalRegistryRow', `fixture: unexpected API call ${name}`);
    const patch = args[1].metadata;
    writes.push(patch);
    const existing = { ...db, ...patch };
    delete existing[INTENT];
    if (PLAN in db) existing[PLAN] = db[PLAN];
    else delete existing[PLAN];
    const merged = lc.mergeLoginContractMetadata({ existingMetadata: existing, patchMetadata: patch });
    assert(merged.ok, `fixture: write merges (${merged.message})`);
    const next = { ...existing, ...merged.metadata };
    delete next[INTENT];
    db = next;
    const written = lc.resolveActiveLoginContract(next);
    return { updatedRows: 1, writerUserId: 'admin-user', writtenSpecialVersion: written.mode === 'SPECIAL' ? written.activePlanVersion : null };
  };
  globalThis.__pick = async () => ({ ok: true, locator: '#user-new', frame: null });

  let view;
  let currentRow = makeRow(db);
  const onSaved = async () => {
    currentRow = makeRow(db);
    view.setProps({ row: currentRow });
  };
  view = m.mount(m.SpecialEditor, { row: currentRow, onSaved });
  const approveDisabled = () => Boolean(one(view.tree, 'activate-special').props.disabled);
  const dialogOpen = () => byAction(view.tree, 'confirm-activate-special').length === 1;

  assert(!approveDisabled(), 'saved + complete + no edits → «אשר מיפוי» enabled');
  assert(statusOf(m, currentRow) === 'saved_not_approved', 'before approval → «נשמר — עדיין לא אושר למשתמשים»');

  // A1 — change a field without saving.
  const userVisual = findAll(view.tree, (n) => n.props?.['data-action'] === 'special-visual-field' && n.props['data-field-id'] === 'username');
  assert(userVisual.length === 1, 'fixture: username Visual button');
  userVisual[0].props.onClick();
  await view.settle();
  assert(writes.length === 0, 'fixture: a Visual pick writes nothing');
  assert(approveDisabled(), 'unsaved field change → «אשר מיפוי» disabled');
  one(view.tree, 'activate-special').props.onClick();
  await view.settle();
  assert(!dialogOpen(), 'unsaved changes → the confirm dialog cannot open');
  assert(writes.length === 0, 'unsaved changes → nothing approved');

  // A2 — «שמור מיפוי» → enabled.
  one(view.tree, 'save-special-draft').props.onClick();
  await view.settle();
  assert(writes.length === 1 && !(INTENT in writes[0]), 'save writes the mapping only');
  const savedDraft = lc.readLoginFlowPlanFromMetadata(db).draft;
  assert(savedDraft.steps[0].fieldMappings.some((f) => f.locator === '#user-new'), 'fixture: the change is saved');
  assert(!approveDisabled(), 'after «שמור מיפוי» → «אשר מיפוי» enabled');

  // A3 — edit again while the dialog is open, then confirm: nothing is approved.
  one(view.tree, 'activate-special').props.onClick();
  await view.settle();
  assert(dialogOpen(), 'clean → confirm dialog opens');
  globalThis.__pick = async () => ({ ok: true, locator: '#user-later', frame: null });
  findAll(view.tree, (n) => n.props?.['data-action'] === 'special-visual-field' && n.props['data-field-id'] === 'username')[0].props.onClick();
  await view.settle();
  if (dialogOpen()) one(view.tree, 'confirm-activate-special').props.onClick();
  await view.settle();
  assert(writes.length === 1, 'edit after opening the dialog → confirm approves nothing (unsaved editor state never approved)');

  // A4 — save, approve: the approved plan is the saved draft; status «מאושר למשתמשים».
  globalThis.__pick = async () => ({ ok: true, locator: '#user-new', frame: null });
  findAll(view.tree, (n) => n.props?.['data-action'] === 'special-visual-field' && n.props['data-field-id'] === 'username')[0].props.onClick();
  await view.settle();
  assert(!approveDisabled(), 'fixture: back to the saved mapping → clean');
  one(view.tree, 'activate-special').props.onClick();
  await view.settle();
  assert(dialogOpen(), 'confirm dialog opens');
  one(view.tree, 'confirm-activate-special').props.onClick();
  await view.settle();
  assert(writes.length === 2 && INTENT in writes[1], 'confirm writes one approve intent');
  const key = (p) => JSON.stringify({ ...lc.serializeLoginFlowPlanDocument(lc.normalizeLegacyDraftReadiness(p)), planVersion: 0 });
  assert(key(writes[1][INTENT].draft) === key(savedDraft), 'approve intent carries the saved draft');
  const live = lc.resolveActiveLoginContract(db);
  assert(live.mode === 'SPECIAL' && key(live.plan) === key(lc.readLoginFlowPlanFromMetadata(db).draft), 'approved plan == saved draft');
  assert(statusOf(m, currentRow) === 'approved', 'right after approval → «מאושר למשתמשים»');
  assert(m.status.specialMappingStatus(db) === 'approved', 'row status approved');
}

// ─── Static: scope ────────────────────────────────────────────────────────────
function staticChecks() {
  const ui = read('src/admin/SpecialLoginDraftEditor.tsx');
  const act = ui.slice(ui.indexOf('async function activateSpecial'), ui.indexOf('async function runSpecialAnalyze'));
  assert(act.includes('readLoginFlowPlanFromMetadata(row.metadata ?? {})?.draft'), 'approve reads the saved draft from the row');
  // 121.3 G11: specialApproveGate = checkSpecialDraft + the runtime gate, on the saved draft.
  assert(
    act.includes('normalizeLegacyDraftReadiness(saved)') && act.includes('if (!specialApproveGate(saved).allowed) return;'),
    'A1 normalization + checkSpecialDraft (via specialApproveGate) on the saved draft',
  );
  assert(!/normalizeLegacyDraftReadiness\(draft\)/.test(act), 'approve never normalizes the editor draft');
  assert(act.includes("activeResolved.mode === 'SPECIAL' ? 'SPECIAL_TO_SPECIAL' : 'STANDARD_TO_SPECIAL'"), 'transition unchanged');
  const std = read('src/admin/AutofillProfileEditor.tsx');
  assert(std.includes('!hasUnsavedChanges &&'), 'STANDARD guard untouched');
}

console.log('Phase 121 D-121-43 C1 — SPECIAL «אשר מיפוי» approves only the saved mapping\n');
await scenario(await loadBundle());
console.log('  ✓ A1 — field changed, not saved → «אשר מיפוי» disabled; the dialog cannot open; nothing written');
console.log('  ✓ A2 — «שמור מיפוי» → «אשר מיפוי» enabled');
console.log('  ✓ A3 — edit after the dialog opened → confirm approves nothing');
console.log('  ✓ A4 — approve intent = saved draft; approved plan == saved draft; status «מאושר למשתמשים» right after approval');
staticChecks();
console.log('  ✓ S1 — approve reads the row; A1 + checkSpecialDraft on the saved draft; transition + STANDARD unchanged');

console.log('\nMutations');
const MUT = [
  [
    'M1 dirty guard removed from «אשר מיפוי»',
    'disabled={busy || draftDirty || !draftCheck.complete || !approveGate.allowed}',
    'disabled={busy || !draftCheck.complete || !approveGate.allowed}',
  ],
  [
    'M2 dialog opens while dirty',
    'if (!draft || busy || draftDirty || !draftCheck.complete || !approveGate.allowed) return;',
    'if (!draft || busy || !draftCheck.complete || !approveGate.allowed) return;',
  ],
  [
    'M3 approve from editor state',
    "    const saved = readLoginFlowPlanFromMetadata(row.metadata ?? {})?.draft ?? null;\n    if (!saved || !isSpecialLoginPattern(saved.pattern) || draftDirty) return;\n    if (!specialApproveGate(saved).allowed) return;",
    '    const saved = draft;\n    if (!saved) return;',
  ],
];
for (const [label, from, to] of MUT) {
  const mutated = replaceOnce(read('src/admin/SpecialLoginDraftEditor.tsx'), from, to, label);
  let caught = null;
  try {
    await scenario(await loadBundle({ 'src/admin/SpecialLoginDraftEditor.tsx': mutated }));
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }
  assert(caught, `mutation NOT caught: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  console.log(`  ✓ mutation caught: ${label} — ${caught}`);
}
console.log(`\nPASS — D-121-43 C1 verify: 4 behavior checks + 1 static, ${MUT.length} mutations caught`);
process.exit(0);
