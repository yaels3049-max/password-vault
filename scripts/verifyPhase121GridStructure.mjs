/**
 * Phase 121 D-121-45 — Admin grid structure: one cross-cutting «אופי הכניסה» grid + one
 * mapping grid for the selected pattern («מיפוי אתר רגיל» or the SPECIAL grid, title per
 * pattern). Server-renders the REAL grids (real React) and drives the REAL editors with a
 * minimal hooks runtime for selector switches. I/O modules stubbed. Synthetic fixtures only.
 * Mutations must be caught.
 * Usage: node scripts/verifyPhase121GridStructure.mjs
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
const count = (hay, needle) => hay.split(needle).length - 1;
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
const TITLES = {
  FLOATING_SCREEN: 'מיפוי מסך צף',
  MULTI_STEP: 'מיפוי כניסה רב־שלבית',
  FLOATING_SCREEN_MULTI_STEP: 'מיפוי מסך צף רב־שלבי',
};
const STANDARD_TITLE = 'מיפוי אתר רגיל';
const PATTERN_TITLE = 'אופי הכניסה';
const PATTERNS = ['STANDARD', 'FLOATING_SCREEN', 'MULTI_STEP', 'FLOATING_SCREEN_MULTI_STEP'];
const AUTHORING_ACTIONS = [
  'special-analyze-current-tab', 'special-visual-opener', 'special-visual-transition', 'special-visual-field',
  'authoring-continue-click', 'reject-action', 'approve-frame', 'accept-framed-field', 'save-special-draft',
  'activate-special', 'analyze', 'visual-mapping', 'save', 'approve', 'clear', 'unsupported', 'managed-test',
];

// Minimal hooks runtime (same shape as verifyPhase121ApproveSavedOnly): one component, plain elements.
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
  };
}
export default { useState, useRef, useMemo, useCallback, useEffect, Fragment };
`;

function apiStub() {
  const names = new Set();
  for (const m of read('src/admin/adminRegistryApi.ts').matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  return [...names].map((n) => `export function ${n}() { throw new Error('stubbed in verify: ${n}'); }`).join('\n');
}

const loadBundles = (overrides = {}) => withTempDir('pv-12145-', (outdir) => loadBundlesIn(outdir, overrides));

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
        import PatternGrid from './src/admin/LoginPatternGrid.tsx';
        import SpecialEditor from './src/admin/SpecialLoginDraftEditor.tsx';
        import ManagedEditor from './src/admin/AutofillProfileEditor.tsx';
        import FillTestGrid from './src/admin/AdminFillTestGrid.tsx';
        export const renderPattern = (p) => renderToStaticMarkup(createElement(PatternGrid, { onPatternChange: () => {}, ...p }));
        export const renderSpecial = (p) => renderToStaticMarkup(createElement(SpecialEditor, p));
        export const renderManaged = (p) => renderToStaticMarkup(createElement(ManagedEditor, p));
        export const renderGrid = (p) => renderToStaticMarkup(createElement(FillTestGrid, p));
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
        export { default as SpecialEditor } from './src/admin/SpecialLoginDraftEditor.tsx';
        export { default as ManagedEditor } from './src/admin/AutofillProfileEditor.tsx';
      `,
      resolveDir: root,
      loader: 'ts',
    },
    outfile: miniFile,
    plugins: [plugin(true)],
  });
  const ssr = await import(pathToFileURL(ssrFile).href);
  const mini = await import(pathToFileURL(miniFile).href);
  return { ...ssr, mount: mini.mount, MiniSpecial: mini.SpecialEditor, MiniManaged: mini.ManagedEditor };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ORIGIN = 'https://svc.example.test';
const LOGIN_URL = `${ORIGIN}/login`;
const loginFields = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Pass', type: 'password', required: true },
];
function draftFor(pattern) {
  const steps =
    pattern === 'FLOATING_SCREEN'
      ? [{ stepId: 'step-1', fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }, { fieldId: 'password', locatorType: 'css', locator: '#pass' }] }]
      : [{ stepId: 'step-1', fieldMappings: [] }, { stepId: 'step-2', fieldMappings: [] }];
  return { planVersion: 1, pattern, preambleActions: [], steps };
}
const profile = {
  configVersion: 1,
  supportState: 'not_configured',
  loginEntryUrl: LOGIN_URL,
  allowedOrigin: ORIGIN,
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#user' },
    { fieldId: 'password', locatorType: 'css', locator: '#pass' },
  ],
};
function row(m, pattern) {
  const metadata = { autofillProfile: profile };
  if (pattern !== 'STANDARD') {
    metadata[m.lc.LOGIN_FLOW_PLAN_META_KEY] = m.lc.serializeLoginFlowPlanBag({ draft: draftFor(pattern), active: null });
  }
  return {
    id: 'row-1',
    display_name: 'שירות בדיקה',
    primary_url: `${ORIGIN}/`,
    login_url: LOGIN_URL,
    updated_at: 't1',
    owner_user_id: null,
    login_fields: loginFields,
    metadata,
  };
}
function specialOnlyRow(m) {
  const r = row(m, 'FLOATING_SCREEN');
  delete r.metadata.autofillProfile;
  return r;
}
const onSaved = async () => {};
const isSpecial = (p) => p !== 'STANDARD';
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
const titleOf = (tree) => findAll(tree, (n) => n.type === 'h3').map((n) => n.props.children)[0] ?? null;

// ─── Scenarios ────────────────────────────────────────────────────────────────
function checkOneGridPerPattern(m) {
  for (const p of PATTERNS) {
    const r = row(m, p);
    const special = m.renderSpecial({ row: r, onSaved, selectedPattern: p });
    const managed = m.renderManaged({ row: r, onSaved, specialPatternSelected: isSpecial(p) });
    const rendered = [special, managed].filter((html) => html.length > 0);
    assert(rendered.length === 1, `${p}: exactly one mapping grid rendered (got ${rendered.length})`);
    if (p === 'STANDARD') {
      assert(managed.includes(`>${STANDARD_TITLE}</h3>`), `STANDARD → «${STANDARD_TITLE}»`);
    } else {
      assert(special.includes(`>${TITLES[p]}</h3>`), `${p} → «${TITLES[p]}»`);
      for (const other of Object.values(TITLES).filter((t) => t !== TITLES[p])) {
        assert(!special.includes(`>${other}</h3>`), `${p}: not titled «${other}»`);
      }
      assert(special.includes('data-action="save-special-draft"') && special.includes('data-action="activate-special"'), `${p}: SPECIAL grid holds «שמור מיפוי» / «אשר מיפוי»`);
    }
    for (const html of [special, managed]) {
      assert(!html.includes('מילוי אוטומטי מנוהל') && !html.includes('special-pattern-mapping-elsewhere'), `${p}: old title / SPECIAL-selected notice gone`);
    }
  }
  const fallback = m.renderSpecial({ row: row(m, 'MULTI_STEP'), onSaved });
  assert(fallback.includes(`>${TITLES.MULTI_STEP}</h3>`), 'no parent selection → saved pattern grid');
  return 'exactly one mapping grid per selected pattern; titles «מיפוי אתר רגיל» / «מיפוי מסך צף» / «מיפוי כניסה רב־שלבית» / «מיפוי מסך צף רב־שלבי»; notice removed';
}

const MANUAL_PICKS = {
  FLOATING_SCREEN: { opener: true, transition: false },
  MULTI_STEP: { opener: false, transition: true },
  FLOATING_SCREEN_MULTI_STEP: { opener: true, transition: true },
};
function buttonTag(html, action) {
  const at = html.indexOf(`data-action="${action}"`);
  return at < 0 ? null : html.slice(html.lastIndexOf('<button', at), html.indexOf('>', at) + 1);
}
function checkManualPickVisibility(m) {
  for (const [p, want] of Object.entries(MANUAL_PICKS)) {
    const html = m.renderSpecial({ row: row(m, p), onSaved, selectedPattern: p });
    for (const [key, action, label] of [
      ['opener', 'special-visual-opener', 'סמנו בעצמכם את כפתור פתיחת המסך הצף'],
      ['transition', 'special-visual-transition', 'סמנו בעצמכם את כפתור המעבר בין השלבים'],
    ]) {
      const tag = buttonTag(html, action);
      assert(count(html, `data-action="${action}"`) === (want[key] ? 1 : 0), `${p}: «${label}» ${want[key] ? 'rendered' : 'not rendered'}`);
      assert(html.includes(label) === want[key], `${p}: «${label}» text ${want[key] ? 'shown' : 'absent'}`);
      if (want[key]) assert(!/disabled=""/.test(tag), `${p}: relevant «${label}» keeps today's enablement (idle → enabled)`);
    }
    assert(count(html, 'data-action="special-analyze-current-tab"') === 1, `${p}: Analyze still rendered`);
  }
  return 'C1: per SPECIAL pattern exactly the relevant manual-pick buttons are rendered (FLOATING_SCREEN opener, MULTI_STEP transition, both for FLOATING_SCREEN_MULTI_STEP); relevant ones keep today\'s enablement';
}

function checkCrossCuttingGrid(m) {
  for (const p of PATTERNS) {
    const html = m.renderPattern({ row: p === 'FLOATING_SCREEN' ? specialOnlyRow(m) : row(m, p), pattern: p });
    assert(html.includes(`>${PATTERN_TITLE}</h3>`) && html.includes('data-grid="login-pattern"'), `${p}: «${PATTERN_TITLE}» grid`);
    assert(count(html, 'type="radio"') === 4 && count(html, '<select') === 0 && html.includes('data-action="login-pattern"'), `${p}: one pattern selector with 4 options`);
    const checked = (html.match(/<input[^>]*>/g) ?? []).filter((tag) => tag.includes('checked=""'));
    assert(checked.length === 1 && checked[0].includes(`value="${p}"`), `${p}: selector shows the selected pattern`);
    assert(html.includes('בחירת אופי הכניסה לא משנה דבר'), `${p}: selector explanation`);
    // Phase 122.5 R2: the only buttons are «שינוי אופי הכניסה» and the chooser's «סגירה».
    const buttons = (html.match(/<button[^>]*>/g) ?? []).map((tag) => tag.match(/data-action="([^"]+)"/)?.[1] ?? '?');
    assert(JSON.stringify(buttons) === JSON.stringify(['change-login-pattern', 'close-login-pattern']) && count(html, '<input') === count(html, 'type="radio"'), `${p}: no authoring controls (buttons: ${buttons.join(', ')}; inputs only the pattern radios)`);
    assert(/<fieldset[^>]*hidden=""/.test(html), `${p}: pattern cards closed until «שינוי אופי הכניסה»`);
    for (const a of AUTHORING_ACTIONS) assert(!html.includes(`data-action="${a}"`), `${p}: no authoring action ${a}`);
    assert(html.includes('data-section="mapping-technical"') && !/<details[^>]*\sopen/.test(html), `${p}: collapsed «פרטים טכניים»`);
  }
  const sp = m.renderPattern({ row: specialOnlyRow(m), pattern: 'FLOATING_SCREEN' });
  assert(count(sp, 'data-status="mapping-status"') === 1 && sp.includes('data-mapping-status="saved_not_approved"'), 'SPECIAL: status line of the SPECIAL mapping');
  assert(sp.includes('data-status="special-technical"') && !sp.includes('data-status="standard-technical"'), 'SPECIAL technical details');
  const stdOnSpecialRow = m.renderPattern({ row: specialOnlyRow(m), pattern: 'STANDARD' });
  assert(!stdOnSpecialRow.includes('data-status="mapping-status"') && stdOnSpecialRow.includes('data-status="standard-technical"'), 'STANDARD selected: STANDARD status (none saved) + STANDARD technical details');
  const locked = m.renderPattern({ row: row(m, 'STANDARD'), pattern: 'STANDARD', disabled: true });
  assert(/<fieldset[^>]*disabled=""/.test(locked), 'selector locked while the visible grid is busy');
  assert(/<button[^>]*data-action="change-login-pattern"[^>]*disabled=""/.test(locked), '«שינוי אופי הכניסה» locked while the visible grid is busy');
  const open = m.renderPattern({ row: row(m, 'STANDARD'), pattern: 'STANDARD', chooserOpen: true });
  assert(!/<fieldset[^>]*hidden=""/.test(open), 'chooserOpen shows the pattern cards');
  const special = m.renderSpecial({ row: row(m, 'FLOATING_SCREEN'), onSaved, selectedPattern: 'FLOATING_SCREEN' });
  const managed = m.renderManaged({ row: row(m, 'STANDARD'), onSaved });
  for (const [html, name] of [[special, 'SPECIAL'], [managed, 'STANDARD']]) {
    assert(!html.includes('data-action="login-pattern"') && !html.includes('data-status="mapping-status"'), `${name} grid: no selector, no second status line`);
  }
  return '«אופי הכניסה»: selector + explanation + status line of the selected pattern + collapsed «פרטים טכניים»; no authoring controls; lock honoured';
}

function checkSelectorSwitch(m) {
  const dirty = [];
  const locks = [];
  const view = m.mount(m.MiniSpecial, {
    row: row(m, 'FLOATING_SCREEN'),
    onSaved,
    selectedPattern: 'FLOATING_SCREEN',
    onDraftDirtyChange: (s) => dirty.push(s.dirty),
    onSelectorLockChange: (s) => locks.push(s.locked),
  });
  assert(titleOf(view.tree) === TITLES.FLOATING_SCREEN && dirty.at(-1) === false, 'initial: floating grid, clean');
  assert(locks.at(-1) === false, 'SPECIAL grid reports the selector lock (idle → unlocked)');
  view.setProps({ selectedPattern: 'FLOATING_SCREEN_MULTI_STEP' });
  assert(titleOf(view.tree) === TITLES.FLOATING_SCREEN_MULTI_STEP, 'switch → «מיפוי מסך צף רב־שלבי»');
  assert(findAll(view.tree, (n) => n.props?.['data-panel'] === 'steps-sidebar').length === 1, 'multi-step pattern → «שלבי התהליך» step selection (same editor state machine)');
  assert(dirty.at(-1) === true, 'pattern change is an unsaved change (fill test blocked, as today)');
  view.setProps({ selectedPattern: 'STANDARD' });
  assert(view.tree === null, 'STANDARD selected → SPECIAL grid not rendered');
  assert(dirty.at(-1) === true, 'STANDARD over a saved SPECIAL draft stays an unsaved change (today)');
  view.setProps({ selectedPattern: 'MULTI_STEP' });
  assert(titleOf(view.tree) === TITLES.MULTI_STEP, 'back to SPECIAL → «מיפוי כניסה רב־שלבית»');
  return 'selector switch swaps the grid; the SPECIAL grid follows the parent selection through the same pattern-change path (unsaved state reported as today)';
}

function checkStandardEditsKept(m) {
  const shared = [];
  const view = m.mount(m.MiniManaged, { row: row(m, 'STANDARD'), onSaved, onSharedStateChange: (s) => shared.push(s) });
  const input = () => findAll(view.tree, (n) => n.type === 'input' && n.props['aria-label'] === 'בורר CSS ל-User')[0];
  assert(input() && input().props.value === '#user', 'fixture: STANDARD grid shows the saved locator');
  input().props.onChange({ target: { value: '#user-edited' } });
  view.setProps({});
  assert(input().props.value === '#user-edited' && shared.at(-1).hasUnsavedChanges === true, 'fixture: unsaved STANDARD edit');
  view.setProps({ specialPatternSelected: true });
  assert(view.tree === null, 'SPECIAL selected → STANDARD grid not rendered');
  assert(shared.at(-1).hasUnsavedChanges === true, 'hidden STANDARD grid still reports its unsaved edit');
  view.setProps({ specialPatternSelected: false });
  assert(input() && input().props.value === '#user-edited', 'back to STANDARD → the unsaved edit is still there (no silent loss)');
  const approve = findAll(view.tree, (n) => n.props?.['data-action'] === 'approve');
  assert(approve.length === 1, 'STANDARD «אשר מיפוי» still rendered');
  return 'STANDARD grid hidden (not unmounted) while SPECIAL is selected: unsaved edits and dirty report kept';
}

function checkFillTestFollows(m) {
  const cleanGrid = { rowId: 'row-1', hasUnsavedChanges: false, busy: false, inputsLocked: false, fieldAuthoring: [] };
  for (const [p, route] of [['STANDARD', 'standard'], ['FLOATING_SCREEN', 'special']]) {
    const html = m.renderGrid({ row: row(m, 'FLOATING_SCREEN'), onSaved, managedGrid: cleanGrid, selectedPattern: p, onTestingChange: () => {} });
    assert(html.includes(`data-route="${route}"`), `«בדיקת מילוי» follows the selected pattern (${p} → ${route})`);
  }
  return '«בדיקת מילוי» unchanged; follows the selected pattern';
}

function checkWiring(sources) {
  const reg = sources['src/admin/RegistryAdmin.tsx'];
  const block = reg.slice(reg.indexOf('<LoginPatternGrid'), reg.indexOf('</>', reg.indexOf('<AdminFillTestGrid')));
  const order = ['<LoginPatternGrid', '<SpecialLoginDraftEditor', '<AutofillProfileEditor', '<AdminFillTestGrid'].map((t) => block.indexOf(t));
  assert(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), 'order: «אופי הכניסה» → SPECIAL grid → «מיפוי אתר רגיל» → «בדיקת מילוי»');
  assert(!/specialPatternSelected \?(?!\?)|specialPatternSelected &&|selectedAuthoringPattern \?(?!\?)|selectedAuthoringPattern &&/.test(block), 'grids stay mounted; visibility decided inside each grid');
  assert(block.includes("pattern={selectedAuthoringPattern ?? 'STANDARD'}") && count(block, 'selectedPattern={selectedAuthoringPattern}') === 2, 'one selection feeds «אופי הכניסה», the SPECIAL grid and «בדיקת מילוי»');
  assert(block.includes('specialPatternSelected={specialPatternSelected}') && reg.includes('isSpecialLoginPattern(selectedAuthoringPattern)'), 'STANDARD grid visibility from the same selection');
  assert(block.includes('onPatternChange={onAuthoringPatternSelected}') && block.includes('disabled={patternSelectorLocked}'), 'selector writes the parent selection; locked by the visible grid');
  const managed = sources['src/admin/AutofillProfileEditor.tsx'];
  assert(managed.includes('GRID_SPECIAL_TO_STANDARD_HE') && managed.includes('setSwitchConfirmOpen(true)'), 'SPECIAL→STANDARD switch-confirm on «אשר מיפוי» kept');
  const grid = sources['src/admin/LoginPatternGrid.tsx'];
  assert(!grid.includes('updateGlobalRegistryRow') && !grid.includes('useState'), '«אופי הכניסה» grid writes nothing (selection only)');
  for (const rel of Object.keys(sources)) {
    // RegistryAdmin: only the D-121-45 grid block (the rest of the page predates this slice).
    const src = (rel === 'src/admin/RegistryAdmin.tsx' ? block : sources[rel]).toLowerCase();
    for (const needle of ['hostname', 'serviceid ===', 'super-pharm', 'superpharm', 'pagi', 'mizrahi', 'elal', '.co.il']) {
      assert(!src.includes(needle), `${rel}: no site branch (${needle})`);
    }
  }
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert(JSON.stringify(manifest.permissions) === JSON.stringify(['tabs', 'scripting']), 'manifest permissions unchanged');
  return 'RegistryAdmin wiring: grid order, one selection, grids mounted, switch-confirm kept; no writes from «אופי הכניסה»; no site branches; manifest unchanged';
}

const FILES = ['src/admin/RegistryAdmin.tsx', 'src/admin/LoginPatternGrid.tsx', 'src/admin/SpecialLoginDraftEditor.tsx', 'src/admin/AutofillProfileEditor.tsx', 'src/admin/mappingCopy.ts'];
async function runAll(m, sources, log) {
  for (const g of [checkOneGridPerPattern, checkManualPickVisibility, checkCrossCuttingGrid, checkSelectorSwitch, checkStandardEditsKept, checkFillTestFollows]) {
    const what = g(m);
    if (log) console.log(`  ✓ ${what}`);
  }
  const what = checkWiring(sources);
  if (log) console.log(`  ✓ ${what}`);
}

console.log('Phase 121 D-121-45 — Admin grid structure\n');
const baseSources = Object.fromEntries(FILES.map((rel) => [rel, read(rel)]));
await runAll(await loadBundles(), baseSources, true);

console.log('\nMutations');
const MUT = [
  ['M1 STANDARD grid rendered while SPECIAL is selected', 'src/admin/AutofillProfileEditor.tsx', 'if (fields.length === 0 || specialPatternSelected) {', 'if (fields.length === 0) {'],
  ['M2 SPECIAL grid rendered for STANDARD', 'src/admin/SpecialLoginDraftEditor.tsx', '  if (!isSpecialLoginPattern(pattern)) return null;\n', ''],
  ['M3 SPECIAL title ignores the pattern', 'src/admin/SpecialLoginDraftEditor.tsx', '{SPECIAL_GRID_TITLE_HE[pattern]}', '{SPECIAL_GRID_TITLE_HE.FLOATING_SCREEN}'],
  ['M4 authoring control in «אופי הכניסה»', 'src/admin/LoginPatternGrid.tsx', '      </fieldset>\n      <MappingStatusLine', '      </fieldset>\n      <button type="button" data-action="save-special-draft">x</button>\n      <MappingStatusLine'],
  ['M5 status line dropped from «אופי הכניסה»', 'src/admin/LoginPatternGrid.tsx', '        status={status}', '        status={null}'],
  ['M6 status line ignores the selected pattern', 'src/admin/LoginPatternGrid.tsx', '(special ? specialMappingStatus(row.metadata) : standardMappingStatus(row.metadata))', '(standardMappingStatus(row.metadata))'],
  ['M7 SPECIAL grid ignores the parent selection', 'src/admin/SpecialLoginDraftEditor.tsx', '    if (selectedPattern && selectedPattern !== pattern) onPatternChangeRef.current(selectedPattern);\n', ''],
  ['M8 selector lock ignored', 'src/admin/LoginPatternGrid.tsx', '        disabled={disabled}\n        hidden={!chooserOpen}', '        disabled={false}\n        hidden={!chooserOpen}'],
  ['M9 STANDARD grid unmounted while SPECIAL (edits lost)', 'src/admin/RegistryAdmin.tsx', '                        <AutofillProfileEditor\n', '                        {specialPatternSelected ? null : <AutofillProfileEditor\n'],
  ['M10 old STANDARD title kept', 'src/admin/mappingCopy.ts', "standardTitle: 'מיפוי אתר רגיל',", "standardTitle: 'מילוי אוטומטי מנוהל',"],
  ['M11 C1 irrelevant manual pick rendered (transition in FLOATING_SCREEN)', 'src/admin/SpecialLoginDraftEditor.tsx', "{manualPickRelevant('intermediate_transition', pattern) ? (", '{true ? ('],
  ['M12 C1 relevant manual pick hidden (opener in FLOATING_SCREEN)', 'src/admin/SpecialLoginDraftEditor.tsx', "{manualPickRelevant('floating_opener', pattern) ? (", "{pattern === 'FLOATING_SCREEN_MULTI_STEP' ? ("],
];
for (const [label, rel, from, to] of MUT) {
  const mutated = replaceOnce(baseSources[rel], from, to, label);
  const sources = { ...baseSources, [rel]: mutated };
  let caught = null;
  try {
    const m = rel === 'src/admin/RegistryAdmin.tsx' ? await loadBundles() : await loadBundles({ [rel]: mutated });
    await runAll(m, sources, false);
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }
  assert(caught, `mutation NOT caught: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  console.log(`  ✓ mutation caught: ${label} — ${caught}`);
}

console.log(`\nPASS — D-121-45 grid structure (+ C1): 7 check groups, ${MUT.length} mutations caught`);
process.exit(0);
