/**
 * Phase 121 D-121-69 — «הסר מיפוי» removes one mapped field row from the selected SPECIAL
 * step (draft only, until «שמור מיפוי»). Other steps, their rows, the step exits and the
 * opener are kept; readiness is re-derived; the completeness line updates at once.
 *
 * - Pure (REAL specialActionBar + loginContract): removeStepFieldMapping on 3-step and
 *   FLOATING_SCREEN plans; readiness re-derivation; step-named gaps.
 * - Editor (REAL SpecialLoginDraftEditor, minimal hooks runtime, I/O seams only): the button,
 *   the completeness line, save round-trip, discard on reload, re-map in another step,
 *   «אשר מיפוי» blocked, FLOATING_SCREEN opener kept, SPECIAL writes omit login_fields /
 *   the autofill profile keys.
 * Every rule has a mutation that must be caught.
 *
 * Usage: node scripts/verifyPhase121RemoveFieldRow.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const clone = (v) => JSON.parse(JSON.stringify(v));
const json = (v) => JSON.stringify(v);

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
// Bundle (REAL editor + action bar + loginContract; I/O seams only)
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

const load = (overrides = {}) => withTempDir('pv-121rf-', (outdir) => loadIn(outdir, overrides));

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
        export { default as SpecialEditor } from './src/admin/SpecialLoginDraftEditor.tsx';
        export * as lc from './src/loginContract/index.ts';
        export * as bar from './src/admin/specialActionBar.ts';
        export { AUTOFILL_OWNED_KEYS } from './src/admin/contractSafeMetadata.ts';
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
  { id: 'username', label: 'אימייל', type: 'text', required: true },
  { id: 'password', label: 'סיסמה', type: 'password', required: true },
];
const map = (fieldId, locator) => ({ fieldId, locatorType: 'css', locator });
const locs = (step) => (step?.fieldMappings ?? []).map((f) => `${f.fieldId}=${f.locator}`).join(',');
const COMPLETE = 'הבדיקה המבנית תקינה.';
const EMPTY_STEP3 = 'המיפוי לא מלא: שלב 3: כל שלב חייב לכלול מיפוי שדות שאינו ריק.';

function transition(m, id, locator) {
  return m.bar.actionAfterTestSuccess(m.lc.createActionCandidate({ actionId: id, kind: 'intermediate_transition', label: id, locator }));
}

/** eBay E2 shape: step 1 holds email + a wrongly mapped password; step 2 OTP; step 3 password. */
function ebayPlan(m) {
  const { lc } = m;
  let d = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('MULTI_STEP', null), 'step-1', [map('username', '#userid'), map('password', '#pass')]);
  d = lc.placeTransitionAsStepExit(d, 'step-1', transition(m, 'e1', '#next1'));
  d = lc.upsertStepFieldMappings(d, 'step-2', [map('username', '#otp')]);
  d = lc.placeTransitionAsStepExit(d, 'step-2', transition(m, 'e2', '#next2'));
  d = lc.upsertStepFieldMappings(d, 'step-3', [map('password', '#pass3')]);
  return lc.rederiveRevealReadiness(d);
}

function floatingPlan(m) {
  const { lc, bar } = m;
  const opener = lc.createActionCandidate({ actionId: 'op', kind: 'floating_opener', label: 'op', locator: '#logInBtn' });
  let d = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('FLOATING_SCREEN', null), 'step-1', [map('username', '#user'), map('password', '#pass')]);
  d = lc.upsertPreambleAction(d, bar.actionAfterTestSuccess(opener));
  return lc.rederiveRevealReadiness(d);
}

const exitsOf = (d) => d.steps.map((s) => s.exitTransition ?? null);

// ---------------------------------------------------------------------------
// Pure
// ---------------------------------------------------------------------------
function pureChecks(m) {
  const { lc, bar } = m;
  assert(bar.SPECIAL_FIELD_ROW_HE.remove === 'הסר מיפוי', 'copy «הסר מיפוי»');

  const d = ebayPlan(m);
  assert(lc.validateSpecialPlanComplete(d).ok === true, 'fixture: eBay-shape plan structurally complete');
  const before = clone(d);
  const r = bar.removeStepFieldMapping(d, 'step-1', 'password');
  assert(json(d) === json(before), 'the input draft is not mutated');
  assert(locs(r.steps[0]) === 'username=#userid', `step 1 loses only the password row (got ${locs(r.steps[0])})`);
  assert(json(r.steps.slice(1)) === json(before.steps.slice(1)), 'steps 2 / 3 (rows + exits) byte-identical');
  assert(json(exitsOf(r)) === json(exitsOf(before)), 'all step exits byte-identical');
  assert(r.steps.length === 3 && r.pattern === 'MULTI_STEP', 'step count and pattern kept');
  assert(bar.removeStepFieldMapping(d, 'step-1', 'otp-code') === d && bar.removeStepFieldMapping(d, 'step-9', 'password') === d, 'no such row / step → the same draft');

  // Readiness pointing at the removed row → re-derived (step 2 becomes action-only → next exit).
  assert(d.steps[0].exitTransition.readiness.locator === '#otp', 'fixture: step 1 exit readiness = step 2 OTP');
  const r2 = bar.removeStepFieldMapping(d, 'step-2', 'username');
  const e1 = r2.steps[0].exitTransition;
  assert(e1.readiness.locator === '#next2', `step 1 exit readiness re-derived to the action-only step's exit (got ${e1.readiness.locator})`);
  assert(bar.actionSelected(e1) && e1.actionId === 'e1' && e1.locator === '#next1', 'the re-derived exit keeps its identity and choice');
  assert(json(r2.steps[1].exitTransition) === json(d.steps[1].exitTransition) && locs(r2.steps[2]) === 'password=#pass3', 'other exit / step 3 kept');

  // Last row of a non-action-only step → step-named gap.
  const r3 = bar.removeStepFieldMapping(d, 'step-3', 'password');
  assert(r3.steps[2].fieldMappings.length === 0 && r3.steps.length === 3, 'step 3 kept, now empty');
  const c3 = bar.checkSpecialDraft(r3);
  assert(!c3.complete && c3.message === EMPTY_STEP3, `step-named completeness gap (got ${c3.message})`);
  assert(json(r3.steps[0].exitTransition) === json(d.steps[0].exitTransition), 'earlier exit kept byte-identical');

  // FLOATING_SCREEN: opener kept; its readiness re-derives when its row is removed.
  const f = floatingPlan(m);
  const fr = bar.removeStepFieldMapping(f, 'step-1', 'password');
  assert(locs(fr.steps[0]) === 'username=#user' && json(fr.preambleActions) === json(f.preambleActions), 'FLOATING: password row removed, opener byte-identical');
  assert(f.preambleActions[0].readiness.locator === '#user', 'fixture: opener readiness = username');
  const fu = bar.removeStepFieldMapping(f, 'step-1', 'username');
  const op = fu.preambleActions[0];
  assert(op.readiness.locator === '#pass' && op.actionId === 'op' && op.locator === '#logInBtn' && bar.actionSelected(op), `FLOATING: opener kept, readiness re-derived (got ${op.readiness.locator})`);
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

const HUB_ORIGIN = 'https://id.example.test';
function makeRow(m, draft) {
  return {
    id: 'row-1',
    display_name: 'שירות בדיקה',
    primary_url: `${HUB_ORIGIN}/login`,
    login_url: `${HUB_ORIGIN}/login`,
    updated_at: 't',
    owner_user_id: null,
    login_fields: FIELDS,
    metadata: draft ? { [m.lc.LOGIN_FLOW_PLAN_META_KEY]: { draft } } : {},
  };
}

function harness(m, pattern, draft) {
  const writes = [];
  globalThis.__api = async (name, args) => {
    assert(name === 'updateGlobalRegistryRow', `fixture: unexpected API call ${name}`);
    writes.push(args[1]);
    return { updatedRows: 1, writerUserId: 'admin', writtenSpecialVersion: null };
  };
  globalThis.__analyze = async () => { throw new Error('fixture: unexpected Analyze call'); };
  globalThis.__click = async () => { throw new Error('fixture: unexpected click'); };
  globalThis.__pick = async (input) => ({ ok: true, locator: `#visual-${input.fieldId}`, frame: null });
  const row = makeRow(m, draft);
  const view = m.mount(m.SpecialEditor, { row, onSaved: async () => {}, selectedPattern: pattern });
  const buttons = (action, fieldId) =>
    findAll(view.tree, (n) => n.props?.['data-action'] === action && (fieldId === undefined || n.props['data-field-id'] === fieldId));
  return {
    view,
    writes,
    removeButtons: (fieldId) => buttons('special-remove-field', fieldId),
    async remove(fieldId) {
      const b = buttons('special-remove-field', fieldId);
      assert(b.length === 1, `fixture: expected one «הסר מיפוי» for ${fieldId}, found ${b.length}`);
      b[0].props.onClick();
      await view.settle();
    },
    async visual(fieldId) {
      const b = buttons('special-visual-field', fieldId);
      assert(b.length === 1, `fixture: expected one visual button for ${fieldId}`);
      await b[0].props.onClick();
      await view.settle();
    },
    selectStep(stepId) {
      const items = findAll(view.tree, (n) => n.props?.['data-action'] === 'special-select-step' && n.props['data-step-id'] === stepId);
      assert(items.length === 1, `fixture: one «שלבי התהליך» item for ${stepId}`);
      items[0].props.onClick();
      view.setProps({});
    },
    fieldRowText(fieldId) {
      const li = findAll(view.tree, (n) => n.type === 'li' && findAll(n, (c) => c.props?.['data-action'] === 'special-visual-field' && c.props['data-field-id'] === fieldId).length === 1);
      return li.length ? textOf(li[0]) : null;
    },
    completeness() {
      return textOf(findAll(view.tree, (n) => n.props?.['data-status'] === 'mapping-completeness')[0]);
    },
    activateDisabled() {
      return findAll(view.tree, (n) => n.props?.['data-action'] === 'activate-special')[0].props.disabled === true;
    },
    async save() {
      findAll(view.tree, (n) => n.props?.['data-action'] === 'save-special-draft')[0].props.onClick();
      await view.settle();
      return writes.at(-1);
    },
  };
}

async function editorChecks(m) {
  const { lc, bar } = m;
  const saved = ebayPlan(m);
  const h = harness(m, 'MULTI_STEP', saved);
  assert(h.completeness() === COMPLETE, 'fixture: loaded plan complete');

  // Placement: a mapped row in the selected step has «הסר מיפוי»; an unmapped row has none.
  h.selectStep('step-2');
  assert(h.removeButtons('username').length === 1 && h.removeButtons('password').length === 0, 'step 2: «הסר מיפוי» on the mapped row only');
  h.selectStep('step-1');
  assert(h.removeButtons('username').length === 1 && h.removeButtons('password').length === 1, 'step 1: both mapped rows have «הסר מיפוי»');
  assert(h.fieldRowText('password').includes(bar.SPECIAL_FIELD_ROW_HE.remove) && h.fieldRowText('password').includes('#pass'), 'the button sits in the field row next to the locator');

  await h.remove('password');
  assert(h.fieldRowText('password').includes('—') && h.removeButtons('password').length === 0, 'the field shows as unmapped in step 1');
  assert(h.removeButtons('username').length === 1 && h.fieldRowText('username').includes('#userid'), 'the other row of step 1 kept');
  assert(h.completeness() === COMPLETE, 'completeness line re-evaluated (still complete)');
  assert(h.activateDisabled(), '«אשר מיפוי» blocked while the removal is unsaved');
  assert(h.writes.length === 0, 'removal is draft-only (nothing written before «שמור מיפוי»)');

  // Re-map in another step via «מיפוי חזותי».
  h.selectStep('step-3');
  await h.remove('password');
  assert(h.completeness() === EMPTY_STEP3, `step-named gap updates immediately (got ${h.completeness()})`);
  await h.visual('password');
  assert(h.fieldRowText('password').includes('#visual-password') && h.completeness() === COMPLETE, 'the field is re-mapped in step 3 via «מיפוי חזותי»');

  const w = await h.save();
  const d = w.metadata[lc.LOGIN_FLOW_PLAN_META_KEY].draft;
  assert(locs(d.steps[0]) === 'username=#userid' && locs(d.steps[1]) === 'username=#otp' && locs(d.steps[2]) === 'password=#visual-password', `save persists the removal (got ${d.steps.map(locs).join(' | ')})`);
  assert(json(d.steps[0].exitTransition) === json(saved.steps[0].exitTransition), 'saved step 1 exit byte-identical');
  const e2 = d.steps[1].exitTransition;
  assert(json({ ...e2, readiness: null }) === json({ ...saved.steps[1].exitTransition, readiness: null }) && e2.readiness.locator === '#visual-password', `step 2 exit kept; its readiness follows the re-mapped step 3 field (got ${e2.readiness.locator})`);
  assert(!('login_fields' in w), 'the credential schema (login_fields) is not written');
  assert(m.AUTOFILL_OWNED_KEYS.every((k) => !(k in w.metadata)), 'SPECIAL write still omits the autofill profile keys (D-121-64 / 65)');

  // Reload from the stored row: the removal is persisted.
  const re = harness(m, 'MULTI_STEP', d);
  re.selectStep('step-1');
  assert(re.fieldRowText('password').includes('—') && re.removeButtons('password').length === 0, 'reload after save: step 1 password stays removed');

  // Unsaved removal is discarded on reload.
  const u = harness(m, 'MULTI_STEP', saved);
  u.selectStep('step-1');
  await u.remove('password');
  const u2 = harness(m, 'MULTI_STEP', saved);
  u2.selectStep('step-1');
  assert(u2.fieldRowText('password').includes('#pass') && u.writes.length === 0, 'reload without save: the removal is discarded');

  // Last row of a non-action-only step → gap; «אשר מיפוי» stays blocked after save + reload.
  const g = harness(m, 'MULTI_STEP', saved);
  g.selectStep('step-3');
  await g.remove('password');
  const gd = (await g.save()).metadata[lc.LOGIN_FLOW_PLAN_META_KEY].draft;
  const g2 = harness(m, 'MULTI_STEP', gd);
  assert(g2.completeness() === EMPTY_STEP3 && g2.activateDisabled(), '«אשר מיפוי» stays blocked on the step-named gap');

  // FLOATING_SCREEN: remove works, opener kept.
  const fplan = floatingPlan(m);
  const f = harness(m, 'FLOATING_SCREEN', fplan);
  assert(findAll(f.view.tree, (n) => n.props?.['data-panel'] === 'steps-sidebar').length === 0, 'fixture: FLOATING has no step selector');
  await f.remove('password');
  const fd = (await f.save()).metadata[lc.LOGIN_FLOW_PLAN_META_KEY].draft;
  assert(locs(fd.steps[0]) === 'username=#user' && json(fd.preambleActions) === json(fplan.preambleActions), 'FLOATING: row removed, opener byte-identical');
}

// ---------------------------------------------------------------------------
// Static
// ---------------------------------------------------------------------------
function listSrc() {
  const outList = [];
  const rec = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name);
      const r = `${rel}/${name}`;
      if (statSync(p).isDirectory()) rec(p, r);
      else if (/\.(ts|tsx)$/.test(name)) outList.push(r);
    }
  };
  rec(join(root, 'src'), 'src');
  return outList;
}

function staticChecks() {
  const UIF = 'src/admin/SpecialLoginDraftEditor.tsx';
  const BARF = 'src/admin/specialActionBar.ts';
  for (const rel of listSrc()) {
    const src = read(rel);
    if (rel !== UIF && rel !== BARF) {
      assert(!src.includes('special-remove-field') && !src.includes('removeStepFieldMapping'), `S only the SPECIAL editor offers «הסר מיפוי» (${rel})`);
    }
  }
  const ui = read(UIF);
  const barSrc = read(BARF);
  for (const [name, src] of [['editor', ui], ['action bar', barSrc]]) {
    assert(!/ebay|hostname|serviceId ===|fixture/i.test(src), `S no site / hostname / serviceId / fixture branches (${name})`);
  }
  const diff = execSync('git diff HEAD --stat -- extension/manifest.json src/loginContract/validateSpecialPlan.ts src/loginContract/runtimeGate.ts src/loginContract/parse.ts src/loginContract/types.ts', { cwd: root }).toString();
  assert(diff.trim() === '', `S manifest / validator / gate / parse / contract types unchanged (${diff.trim()})`);
}

// ---------------------------------------------------------------------------
// Run + mutations
// ---------------------------------------------------------------------------
async function runAll(m) {
  pureChecks(m);
  await editorChecks(m);
}

const M = await load();
pureChecks(M);
ok('pure: one row from one step; other steps / rows / exits / opener byte-identical; readiness re-derived; step-named gap');
await editorChecks(M);
ok('editor: «הסר מיפוי» per mapped row; completeness updates; re-map in another step; save round-trip; discard on reload; «אשר מיפוי» blocked; FLOATING opener kept; no login_fields / autofill keys written');
staticChecks();
ok('static: only the SPECIAL editor; no site branches; manifest / validator / gate / parse / types unchanged');

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
const mut = (file, pairs) => {
  let src = read(file);
  for (const [from, to] of pairs) src = replaceOnce(src, from, to, `${file}: ${from.slice(0, 40)}`);
  return { [file]: src };
};
const HELPER_RETURN = '  return rederiveRevealReadiness(upsertStepFieldMappings(draft, stepId, kept));';

await expectCaught('MR1 removal across all steps', mut(BAR, [[
  HELPER_RETURN,
  '  let next = draft;\n  for (const s of draft.steps) next = upsertStepFieldMappings(next, s.stepId, (s.fieldMappings as SpecialFieldMapping[]).filter((m) => m.fieldId !== fieldId));\n  return rederiveRevealReadiness(next);',
]]));
await expectCaught('MR2 readiness not re-derived', mut(BAR, [[HELPER_RETURN, '  return upsertStepFieldMappings(draft, stepId, kept);']]));
await expectCaught('MR3 exits touched (step exits dropped)', mut(BAR, [[
  HELPER_RETURN,
  '  const cleared = upsertStepFieldMappings(draft, stepId, kept);\n  return rederiveRevealReadiness({ ...cleared, steps: cleared.steps.map(({ exitTransition: _e, ...s }) => s) });',
]]));
await expectCaught('MR4 exits touched (re-chosen state cleared)', mut(BAR, [[
  HELPER_RETURN,
  '  const cleared = upsertStepFieldMappings(draft, stepId, kept);\n  return rederiveRevealReadiness({ ...cleared, steps: cleared.steps.map((s) => (s.exitTransition ? { ...s, exitTransition: unchosen(s.exitTransition) } : s)) });',
]]));
await expectCaught('MR5 opener dropped (FLOATING)', mut(BAR, [[
  HELPER_RETURN,
  '  return rederiveRevealReadiness({ ...upsertStepFieldMappings(draft, stepId, kept), preambleActions: [] });',
]]));
await expectCaught('MR6 removes the whole step\'s rows', mut(BAR, [['  const kept = rows.filter((m) => m.fieldId !== fieldId);', '  const kept = rows.filter(() => false);']]));
await expectCaught('MR7 editor removes from step 1 regardless of «שלב נוכחי»', mut(UI, [['    setDraft(removeStepFieldMapping(draft, currentStepId, fieldId));', '    setDraft(removeStepFieldMapping(draft, draft.steps[0]?.stepId ?? currentStepId, fieldId));']]));
await expectCaught('MR8 editor button never shown', mut(UI, [['                    {mapping?.locator ? (\n                      <button\n                        type="button"\n                        className="admin-btn admin-btn-secondary"\n                        data-action="special-remove-field"', '                    {false ? (\n                      <button\n                        type="button"\n                        className="admin-btn admin-btn-secondary"\n                        data-action="special-remove-field"']]));

out(`\nPASS — D-121-69 remove one field row verify: 3 groups, ${passed - 3} mutations caught`);
process.exit(0);
