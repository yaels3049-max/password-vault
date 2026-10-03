/**
 * Phase 121 D-121-53 — «אין שינויים לשמירה — המיפוי במסך זהה למיפוי השמור.» under the STANDARD
 * «מיפוי אתר רגיל» action buttons, shown only when «שמור מיפוי» is disabled solely because nothing
 * changed (not busy, not a structural failure). SPECIAL grid: «שמור מיפוי» there is disabled only
 * while busy (never for "no changes"), so it shows no line (Owner decision 2026-09-29).
 * Server-renders the REAL editors (real React) and drives the STANDARD editor with a minimal hooks
 * runtime. I/O modules stubbed. Synthetic fixtures only. Mutations must be caught.
 * Usage: node scripts/verifyPhase121NoChangesToSave.mjs
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
  if (n !== 1) throw new Error(`fixture: mutation anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
const STD = 'src/admin/AutofillProfileEditor.tsx';
const SPECIAL = 'src/admin/SpecialLoginDraftEditor.tsx';
const COPY_FILE = 'src/admin/mappingCopy.ts';
// Expected copy, written independently of mappingCopy.ts.
const NO_CHANGES = 'אין שינויים לשמירה — המיפוי במסך זהה למיפוי השמור.';
const LINE = 'data-status="no-changes-to-save"';

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
    rerender() { render(); },
    setProps(p) { h.props = { ...h.props, ...p }; render(); },
  };
}
export default { useState, useRef, useMemo, useCallback, useEffect, Fragment };
`;

function apiStub() {
  const names = new Set();
  for (const m of read('src/admin/adminRegistryApi.ts').matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  return [...names].map((n) => `export function ${n}() { throw new Error('stubbed in verify: ${n}'); }`).join('\n');
}

function loadBundles(overrides = {}) {
  return withTempDir('pv-12153-', (outdir) => loadBundlesIn(outdir, overrides));
}
async function loadBundlesIn(outdir, overrides) {
  const reactPath = join(outdir, 'mini-react.mjs');
  writeFileSync(reactPath, MINI_REACT);
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const apiFile = abs('src/admin/adminRegistryApi.ts');
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const plugin = (mini) => ({
    name: 'verify-seams',
    setup(b) {
      if (mini) b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: reactPath }));
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        if (key === apiFile) return { contents: apiStub(), loader: 'js' };
        if (overridden.has(key)) {
          return { contents: overridden.get(key), loader: key.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
        }
        return undefined;
      });
    },
  });
  const common = {
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    write: true,
    logLevel: 'silent',
    nodePaths: [join(root, 'node_modules')],
    define: { 'import.meta.env': '{"DEV":false}', 'process.env.NODE_ENV': '"production"' },
  };
  const ssrFile = join(outdir, 'ssr.mjs');
  await build({
    ...common,
    stdin: {
      contents: `
        import { createElement } from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import SpecialEditor from './${SPECIAL}';
        import ManagedEditor from './${STD}';
        export const renderSpecial = (p) => renderToStaticMarkup(createElement(SpecialEditor, p));
        export const renderManaged = (p) => renderToStaticMarkup(createElement(ManagedEditor, p));
        export * as lc from './src/loginContract/index.ts';
      `,
      resolveDir: root,
      loader: 'tsx',
    },
    outfile: ssrFile,
    plugins: [plugin(false)],
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  });
  const miniFile = join(outdir, 'mini.mjs');
  await build({
    ...common,
    stdin: {
      contents: `
        export { mount } from ${JSON.stringify(reactPath.replace(/\\/g, '/'))};
        export { default as ManagedEditor } from './${STD}';
      `,
      resolveDir: root,
      loader: 'ts',
    },
    outfile: miniFile,
    plugins: [plugin(true)],
  });
  const ssr = await import(pathToFileURL(ssrFile).href);
  const mini = await import(pathToFileURL(miniFile).href);
  return { ...ssr, mount: mini.mount, MiniManaged: mini.ManagedEditor };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ORIGIN = 'https://svc.example.test';
const LOGIN_URL = `${ORIGIN}/login`;
const loginFields = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Pass', type: 'password', required: true },
];
const FULL = [
  { fieldId: 'username', locatorType: 'css', locator: '#user' },
  { fieldId: 'password', locatorType: 'css', locator: '#pass' },
];
function row({ mappings = FULL, loginUrl = LOGIN_URL, special = null } = {}) {
  const metadata = {
    autofillProfile: { configVersion: 1, supportState: 'not_configured', loginEntryUrl: loginUrl, allowedOrigin: ORIGIN, fieldMappings: mappings },
  };
  if (special) Object.assign(metadata, special);
  return { id: 'row-1', display_name: 'שירות בדיקה', primary_url: `${ORIGIN}/`, login_url: loginUrl, updated_at: 't1', owner_user_id: null, login_fields: loginFields, metadata };
}
const onSaved = async () => {};
const saveTag = (html) => {
  const at = html.indexOf('data-action="save"');
  return html.slice(html.lastIndexOf('<button', at), html.indexOf('>', at));
};
const saveDisabled = (html) => /\sdisabled=""/.test(saveTag(html));

// ─── Mini-tree helpers ────────────────────────────────────────────────────────
function walk(node, visit) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  visit(node);
  walk(node.props?.children, visit);
}
function findAll(tree, pred) {
  const out = [];
  walk(tree, (n) => pred(n) && out.push(n));
  return out;
}
const byAttr = (tree, attr, value) => findAll(tree, (n) => n.props?.[attr] === value)[0] ?? null;
const text = (n) => (n == null || typeof n === 'boolean' ? '' : typeof n !== 'object' ? String(n) : Array.isArray(n) ? n.map(text).join('') : text(n.props?.children));

// ─── Check groups ─────────────────────────────────────────────────────────────
function checkStandardStates(m) {
  const clean = m.renderManaged({ row: row(), onSaved });
  assert(saveDisabled(clean), 'fixture: clean saved mapping → «שמור מיפוי» disabled');
  assert(clean.includes(`<p class="admin-muted" ${LINE}>${NO_CHANGES}</p>`), 'no changes, not busy, structurally ok → line shown (hint style admin-muted)');
  const actionsEnd = clean.indexOf('data-action="unsupported"');
  assert(clean.indexOf(LINE) > actionsEnd, 'line placed under the action buttons');

  const busy = m.renderManaged({ row: row(), onSaved, fillTestRunning: true });
  assert(saveDisabled(busy), 'fixture: fill test running → «שמור מיפוי» disabled');
  assert(!busy.includes(LINE), 'busy (fill test running) → line hidden');

  const broken = m.renderManaged({ row: row({ mappings: [FULL[0]] }), onSaved });
  assert(saveDisabled(broken) && broken.includes('class="admin-error" role="status"'), 'fixture: saved mapping missing a required field → structural failure, save disabled');
  assert(!broken.includes(LINE), 'structural failure (no changes) → line hidden');

  const noEntry = m.renderManaged({ row: row({ loginUrl: '' }), onSaved });
  assert(saveDisabled(noEntry) && !noEntry.includes(LINE), 'no login entry URL (structural failure) → line hidden');

  const emptySaved = m.renderManaged({ row: row({ mappings: [] }), onSaved });
  assert(saveDisabled(emptySaved) && emptySaved.includes(LINE), 'saved empty mapping, empty screen (nothing to save; canSave empty-form path) → line shown');
}

function checkStandardTransitions(m) {
  const h = m.mount(m.MiniManaged, { row: row(), onSaved });
  const save = () => byAttr(h.tree, 'data-action', 'save');
  const line = () => byAttr(h.tree, 'data-status', 'no-changes-to-save');
  assert(save().props.disabled === true && line() && text(line()) === NO_CHANGES, 'mounted clean → save disabled + line');
  const userInput = findAll(h.tree, (n) => n.type === 'input' && n.props['aria-label'] === 'בורר CSS ל-User')[0];
  assert(userInput, 'fixture: username locator input rendered');
  userInput.props.onChange({ target: { value: '#user-2' } });
  h.rerender();
  assert(save().props.disabled === false && !line(), 'edited locator → save enabled, line hidden');
  findAll(h.tree, (n) => n.type === 'input' && n.props['aria-label'] === 'בורר CSS ל-User')[0].props.onChange({ target: { value: '#user' } });
  h.rerender();
  assert(save().props.disabled === true && line(), 'edited back to the saved value → save disabled, line back');
  h.setProps({ fillTestRunning: true });
  assert(save().props.disabled === true && !line(), 'fill test starts → line hidden (busy)');
  h.setProps({ fillTestRunning: false });
  assert(line(), 'fill test ends → line back');
}

function checkSpecialGrid(m) {
  const planKey = m.lc.LOGIN_FLOW_PLAN_META_KEY;
  const draft = {
    planVersion: 1,
    pattern: 'FLOATING_SCREEN',
    preambleActions: [],
    steps: [{ stepId: 'step-1', fieldMappings: FULL }],
  };
  const r = row({ special: { [planKey]: m.lc.serializeLoginFlowPlanBag({ draft, active: null }) } });
  const html = m.renderSpecial({ row: r, onSaved, selectedPattern: 'FLOATING_SCREEN' });
  const at = html.indexOf('data-action="save-special-draft"');
  assert(at > 0, 'fixture: SPECIAL grid rendered with «שמור מיפוי»');
  const tag = html.slice(html.lastIndexOf('<button', at), html.indexOf('>', at));
  assert(!/\sdisabled=""/.test(tag), 'SPECIAL «שמור מיפוי» not disabled for a clean draft (disabled only while busy)');
  assert(!html.includes(LINE) && !html.includes(NO_CHANGES), 'SPECIAL grid: no line (its save is never blocked by "no changes")');
}

function checkStaticScope() {
  const copy = read(COPY_FILE);
  assert(copy.includes(`noChangesToSave: '${NO_CHANGES}',`), 'copy lives in mappingCopy.ts (ADMIN_MAPPING_COPY_HE.noChangesToSave)');
  const std = read(STD);
  assert(std.includes('{ADMIN_MAPPING_COPY_HE.noChangesToSave}') && !std.includes(NO_CHANGES), 'STANDARD grid renders the shared copy (no inline literal)');
  assert(
    std.includes('const canSave =\n    !saving &&\n    !analyzing &&\n    !probing &&\n    !testing &&\n    !visualMappingFieldId &&\n    hasUnsavedChanges &&\n    (structural.ok || (formIsEmpty && Boolean(existing)));'),
    'canSave unchanged',
  );
  assert(std.includes('const hasUnsavedChanges = currentMappingsSignature !== savedMappingsSignature;'), 'dirty rule unchanged');
  assert(read(SPECIAL).includes('data-action="save-special-draft"\n              disabled={busy}'), 'SPECIAL save rule unchanged');
  assert(!/hostname|serviceId ===|\.co\.il/.test(std.slice(std.indexOf('saveBlockedOnlyByNoChanges'))), 'no site branches');
}

const GROUPS = [
  ['STANDARD states (clean / busy / structural / empty-saved)', checkStandardStates],
  ['STANDARD transitions (edit → revert → busy)', checkStandardTransitions],
  ['SPECIAL grid (save not blocked by "no changes") → no line', checkSpecialGrid],
  ['static scope (copy source, canSave / dirty unchanged)', () => checkStaticScope()],
];

const base = await loadBundles();
for (const [name, fn] of GROUPS) {
  fn(base);
  console.log(`  ok  ${name}`);
}

const MUTATIONS = [
  ['M1 shown when save is enabled (dirty)', STD, (s) => replaceOnce(s, '    !hasUnsavedChanges &&\n    (structural.ok || (formIsEmpty && Boolean(existing)));', '    (structural.ok || (formIsEmpty && Boolean(existing)));', 'dirty cond')],
  ['M2 shown while busy (fill test)', STD, (s) => replaceOnce(s, 'const saveBlockedOnlyByNoChanges =\n    !saving &&\n    !analyzing &&\n    !probing &&\n    !testing &&', 'const saveBlockedOnlyByNoChanges =\n    !saving &&\n    !analyzing &&\n    !probing &&', 'busy cond')],
  ['M3 shown on structural failure', STD, (s) => replaceOnce(s, '    !hasUnsavedChanges &&\n    (structural.ok || (formIsEmpty && Boolean(existing)));', '    !hasUnsavedChanges;', 'structural cond')],
  ['M4 missing in the STANDARD grid', STD, (s) => replaceOnce(s, '{saveBlockedOnlyByNoChanges ? (', '{false ? (', 'render')],
  ['M5 line added to the SPECIAL grid', SPECIAL, (s) => replaceOnce(s, '          <p className="admin-muted" data-panel="action-bar-explanation">', `          {!busy ? <p className="admin-muted" data-status="no-changes-to-save">{ADMIN_MAPPING_COPY_HE.noChangesToSave}</p> : null}\n          <p className="admin-muted" data-panel="action-bar-explanation">`, 'special')],
  ['M6 copy changed in mappingCopy.ts', COPY_FILE, (s) => replaceOnce(s, `noChangesToSave: '${NO_CHANGES}',`, "noChangesToSave: 'אין שינויים.',", 'copy')],
  ['M7 line above the action buttons', STD, (s) => {
    const block = '      {saveBlockedOnlyByNoChanges ? (\n        <p className="admin-muted" data-status="no-changes-to-save">\n          {ADMIN_MAPPING_COPY_HE.noChangesToSave}\n        </p>\n      ) : null}\n';
    const without = replaceOnce(s, block, '', 'block');
    return replaceOnce(without, '      <div className="admin-actions-row admin-autofill-actions"', `${block}      <div className="admin-actions-row admin-autofill-actions"`, 'actions row');
  }],
];

let caught = 0;
for (const [name, file, mutate] of MUTATIONS) {
  const m = await loadBundles({ [file]: mutate(read(file)) });
  let failure = null;
  try {
    // The static group reads the files on disk, so only behavioral groups judge a mutation.
    for (const [g, fn] of GROUPS) if (!g.startsWith('static')) fn(m);
  } catch (err) {
    failure = err;
  }
  if (!failure) throw new Error(`mutation NOT caught: ${name}`);
  if (String(failure.message).startsWith('fixture:')) throw new Error(`mutation fixture error: ${name}: ${failure.message}`);
  caught += 1;
  console.log(`  caught ${name} — ${failure.message}`);
}
console.log(`PASS — D-121-53 «אין שינויים לשמירה»: ${GROUPS.length} check groups, ${caught} mutations caught`);
