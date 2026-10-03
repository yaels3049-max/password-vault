/**
 * Phase 121 D-121-59 + A1 — the password-surface requirement follows the site's login fields;
 * one message per click failure reason.
 * End to end: the REAL SpecialLoginDraftEditor (minimal hooks runtime) → the REAL Hub
 * performApprovedAuthoringClick → the REAL extension authoringClickApprovedAction (background.js
 * block, mocked chrome with frame fixtures). Only Analyze, Visual pick and the registry are stubbed.
 * - Schema without a password field + ID / card-digits screen → revealed, fields identified.
 * - Schema with a password field + newsletter-only screen → surface_not_login + its copy / status.
 * - Declared-mode timeout → its copy / status. Nothing revealed → «המסך לא נפתח».
 * - MULTI_STEP / FLOATING_SCREEN_MULTI_STEP never send the flag.
 * Synthetic fixtures. Mutations must be caught.
 * Usage: node scripts/verifyPhase121PasswordlessSurface.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
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
  assert(n === 1, `fixture: anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
const COPY = {
  notOpened: 'המסך לא נפתח',
  notLogin: 'המסך נפתח, אבל לא נמצא בו שדה סיסמה — ייתכן שזה לא מסך הכניסה.',
  fieldMissing: 'השדה הממופה לא הופיע אחרי הלחיצה — ייתכן שהמסך לא נפתח, או שהשדה הממופה שגוי.',
};

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
    async settle(ms = 0) { for (let n = 0; n < 8; n += 1) { await new Promise((r) => setTimeout(r, ms)); render(); } },
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
];
const BRIDGE_IMPORT = "import { sendExtensionMessageAsync, probeExtensionAvailable } from '../browserIntegration';";

function loadBundle(overrides = {}) {
  return withTempDir('pv-12159-', (outdir) => loadBundleIn(outdir, overrides));
}
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
          let src = overridden.get(key) ?? readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n');
          for (const [name, anchor, hook] of SEAMS) {
            src = replaceOnce(
              src,
              anchor,
              `export async function ${name}(input: any): Promise<any> { return (globalThis as any).${hook}(input); }\nasync function real_${name}(input: {`,
              `seam ${name}`,
            );
          }
          // Extension bridge → the real background.js click handler (see extBridge).
          src = replaceOnce(
            src,
            BRIDGE_IMPORT,
            'const sendExtensionMessageAsync = (m: any): Promise<any> => (globalThis as any).__ext(m);\nconst probeExtensionAvailable = (): boolean => true;',
            'bridge import',
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
        export * as bar from './src/admin/specialActionBar.ts';
        export * as hub from './src/assistedMapping/index.ts';
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

// ─── Extension (background.js SPECIAL block, mocked chrome) ──────────────────
const ORIGIN = 'https://card.example.test';

function loadExt(chrome) {
  const bgSrc = read('extension/background.js');
  const start = bgSrc.indexOf('/**\n * 121.1-IF — SPECIAL authoring frame surface');
  const end = bgSrc.indexOf('function openPageAndManagedAutofill');
  assert(start > 0 && end > start, 'fixture: Ext SPECIAL block located');
  const src = bgSrc
    .slice(start, end)
    .replace('var SPECIAL_READINESS_POLL_MS = 400;', 'var SPECIAL_READINESS_POLL_MS = 5;')
    .replace('var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 150;', 'var SPECIAL_FRAME_HANDSHAKE_WAIT_MS = 5;');
  const prelude = `
    var ADMIN_INSPECT_READINESS_MAX_WAIT_MS = 10, ADMIN_INSPECT_READINESS_POLL_MS = 1;
    var SPECIAL_VISUAL_PICK_DEFAULT_TIMEOUT_MS = 1000, SPECIAL_VISUAL_PICK_MAX_TIMEOUT_MS = 2000;
    var specialVisualPickArmed = null;
    function ensureSpecialAuthoringTab(m, cb) { cb({ ok: true, tabId: 7, reused: true }); }
    function activateSpecialAuthoringTab(t, cb) { cb(true); }
    function withAuthoringTab(r, t) { return Object.assign({}, r, { authoringTabId: t }); }
    function rejectIfReopenLoginEntryRequested() { return false; }
  `;
  // eslint-disable-next-line no-new-func
  return new Function('chrome', `${prelude}\n${src}\nreturn { click: authoringClickApprovedAction };`)(chrome);
}

function frameWindow(f) {
  if (f.__win) return f.__win;
  const win = {
    location: { origin: f.origin },
    crypto: webcrypto,
    addEventListener() {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    document: { querySelectorAll: () => [] },
  };
  win.top = win;
  win.parent = win;
  f.__win = win;
  return win;
}
function runInWindow(win, func, args) {
  // eslint-disable-next-line no-new-func
  return new Function('__w', '__f', '__a', 'with (__w) { return eval("(" + __f + ")").apply(null, __a); }')(win, String(func), args || []);
}

/** Top document only: { creds: string[], passwords: string[], clickables: { [locator]: () => void } }. */
function mockChrome(top) {
  const corrSrc = read('extension/generic/frame-correlation.js');
  const credItems = (f) => (f.creds || []).map((locator) => ({ locator, password: (f.passwords || []).includes(locator) }));
  const chrome = {
    runtime: { lastError: null },
    tabs: { get: (id, cb) => setTimeout(() => cb({ id, url: `${ORIGIN}/` }), 0) },
    scripting: {
      executeScript(details, cb) {
        const done = (value, err) =>
          setTimeout(() => {
            chrome.runtime.lastError = err ? { message: err } : null;
            cb(value);
            chrome.runtime.lastError = null;
          }, 0);
        const t = details.target;
        const fsrc = details.func ? String(details.func) : '';
        const probe = { origin: top.origin, protocol: 'https:', isTop: true, isDepth1: false };
        if (t.allFrames && details.files) {
          // eslint-disable-next-line no-new-func
          if (details.files.includes('generic/frame-correlation.js')) new Function('window', corrSrc)(frameWindow(top));
          return done([{ frameId: 0, result: undefined }]);
        }
        if (t.allFrames && fsrc.includes('__readFrameCorrelationNonces')) {
          return done([{ frameId: 0, result: runInWindow(frameWindow(top), details.func, details.args) }]);
        }
        if (t.allFrames) {
          if (details.func && details.func.name === 'specialFrameProbe') return done([{ frameId: 0, result: probe }]);
          return done([{ frameId: 0, result: false }]);
        }
        const fid = t.frameIds[0];
        if (fid !== 0) return done(undefined, 'No frame with id ' + fid);
        const args = details.args || [];
        if (details.files) return done(undefined);
        if (details.func && details.func.name === 'specialFrameProbe') return done([{ frameId: 0, result: probe }]);
        if (fsrc.includes('__collectFrameCorrelation') || fsrc.includes('__resolveFrameByLocator')) {
          return done([{ frameId: 0, result: runInWindow(frameWindow(top), details.func, args) }]);
        }
        if (fsrc.includes('collectSpecialEligibleCredentialInputs')) {
          return done([{ frameId: 0, result: top.origin === args[0] ? credItems(top) : [] }]);
        }
        if (fsrc.includes('collectSpecialEligibleCredentialLocators')) {
          return done([{ frameId: 0, result: top.origin === args[0] ? [...(top.creds || [])] : [] }]);
        }
        if (fsrc.includes('isSpecialDeclaredReadinessMet')) {
          return done([{ frameId: 0, result: { met: (top.creds || []).includes(args[1]) } }]);
        }
        if (fsrc.includes('.click()')) {
          const handler = top.clickables && top.clickables[args[0]];
          if (!handler) return done([{ frameId: 0, result: { ok: false, reason: 'click_target_missing' } }]);
          handler();
          return done([{ frameId: 0, result: { ok: true } }]);
        }
        return done(undefined, 'unexpected script');
      },
    },
  };
  return chrome;
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
const alertText = (tree) => findAll(tree, (n) => n.props?.className === 'admin-error' && n.props?.role === 'alert').map(textOf).join(' | ');
const statusText = (tree) => findAll(tree, (n) => n.props?.['data-status'] === 'action-selection').map(textOf).join(' | ');

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const CAL_FIELDS = [
  { id: 'idNumber', label: 'מספר תעודת זהות', type: 'text', required: true },
  { id: 'cardDigits', label: '4 ספרות אחרונות של הכרטיס', type: 'text', required: true },
];
const PASSWORD_FIELDS = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Pass', type: 'password', required: true },
];
function makeRow(loginFields) {
  return {
    id: 'row-1',
    display_name: 'שירות בדיקה',
    primary_url: `${ORIGIN}/`,
    login_url: `${ORIGIN}/`,
    updated_at: 't',
    owner_user_id: null,
    login_fields: loginFields,
    metadata: {},
  };
}
const ready = (fieldId, locator) => ({ fieldId, locator, frame: null, state: 'ready' });
const result = (fields, actions = []) => ({ ok: true, actionProposals: actions, fieldAnalyze: { ok: true }, framedFieldProposals: fields });
/** Short reveal window so failing fixtures finish quickly (the Ext uses the action's readiness timeout). */
function proposal(lc, kind, locator) {
  const action = lc.createActionCandidate({ actionId: `${kind}-1`, kind, label: 'כניסה', locator });
  return { action: { ...action, readiness: { ...action.readiness, timeoutMs: 150 } } };
}

function harness(m, { pattern, loginFields, page }) {
  const writes = [];
  const messages = [];
  const queue = [];
  const ext = loadExt(mockChrome({ origin: ORIGIN, creds: [], passwords: [], ...page }));
  globalThis.__api = async (name, args) => {
    assert(name === 'updateGlobalRegistryRow', `fixture: unexpected API call ${name}`);
    writes.push(args[1].metadata);
    return { updatedRows: 1, writerUserId: 'admin', writtenSpecialVersion: null };
  };
  // An unqueued Analyze (a mutation let a test pass) gets an empty surface; the checks report it.
  globalThis.__analyze = async () => queue.shift() ?? result([]);
  globalThis.__pick = async (input) => ({ ok: true, locator: input.fieldId === 'username' ? '#user' : `#visual-${input.fieldId}`, frame: null });
  const replies = [];
  globalThis.__ext = (message) =>
    new Promise((resolve) => {
      messages.push(message);
      ext.click(message, (r) => {
        replies.push(r);
        resolve(r);
      });
    });
  const view = m.mount(m.SpecialEditor, { row: makeRow(loginFields), onSaved: async () => {}, selectedPattern: pattern });
  return {
    view,
    messages,
    enqueue: (r) => queue.push(r),
    async analyze() {
      one(view.tree, 'special-analyze-current-tab').props.onClick();
      await view.settle();
    },
    async visual(fieldId) {
      one(view.tree, 'special-visual-field', (n) => n.props['data-field-id'] === fieldId).props.onClick();
      await view.settle();
    },
    async test() {
      const before = replies.length;
      one(view.tree, 'authoring-continue-click', (n) => n.props['data-slot'] === 'primary').props.onClick();
      for (let n = 0; n < 1000 && replies.length === before; n += 1) await new Promise((r) => setTimeout(r, 10));
      assert(replies.length > before, 'fixture: the extension replied to the test click');
      await view.settle();
    },
    async draft() {
      one(view.tree, 'save-special-draft').props.onClick();
      await view.settle();
      return writes.at(-1)[m.lc.LOGIN_FLOW_PLAN_META_KEY].draft;
    },
  };
}

// ─── Checks ───────────────────────────────────────────────────────────────────
async function passwordlessRevealed(m) {
  const page = { clickables: {} };
  page.clickables['#open'] = () => setTimeout(() => page.creds.push('#id', '#card4'), 10);
  page.creds = [];
  const h = harness(m, { pattern: 'FLOATING_SCREEN', loginFields: CAL_FIELDS, page });
  h.enqueue(result([], [proposal(m.lc, 'floating_opener', '#open')]));
  await h.analyze();
  h.enqueue(result([ready('idNumber', '#id'), ready('cardDigits', '#card4')]));
  await h.test();
  assert(h.messages.length === 1 && h.messages[0].requirePasswordSurface === undefined, `C1 no password field in the schema → no password requirement sent (got ${h.messages[0]?.requirePasswordSurface})`);
  assert(alertText(h.view.tree) === '', `C1 ID / card-digits screen → revealed, no error (got "${alertText(h.view.tree)}")`);
  assert(statusText(h.view.tree) === m.bar.SPECIAL_BUTTON_PANEL_HE.statusTestedChosen, `C1 status «נבדק ונבחר» (got "${statusText(h.view.tree)}")`);
  const draft = await h.draft();
  const locs = draft.steps[0].fieldMappings.map((f) => `${f.fieldId}=${f.locator}`).join(',');
  assert(locs === 'idNumber=#id,cardDigits=#card4', `C1 fields identified after the test (got "${locs}")`);
}

async function newsletterNotLogin(m) {
  const page = { creds: [], clickables: {} };
  page.clickables['#open'] = () => setTimeout(() => page.creds.push('#fname', '#email'), 10);
  const h = harness(m, { pattern: 'FLOATING_SCREEN', loginFields: PASSWORD_FIELDS, page });
  h.enqueue(result([], [proposal(m.lc, 'floating_opener', '#open')]));
  await h.analyze();
  await h.test();
  assert(h.messages[0].requirePasswordSurface === true, 'C2 password field in the schema → password requirement sent (G8 kept)');
  assert(alertText(h.view.tree) === COPY.notLogin, `C2 newsletter-only screen → «${COPY.notLogin}» (got "${alertText(h.view.tree)}")`);
  assert(statusText(h.view.tree) === m.bar.SPECIAL_BUTTON_PANEL_HE.statusNotChosenNotLogin, `C2 panel status follows (got "${statusText(h.view.tree)}")`);
  const draft = await h.draft();
  assert(!m.bar.actionSelected(draft.preambleActions[0]), 'C2 opener not chosen');
}

async function declaredTimeout(m) {
  const page = { creds: [], clickables: { '#open': () => {} } };
  const h = harness(m, { pattern: 'FLOATING_SCREEN', loginFields: PASSWORD_FIELDS, page });
  await h.visual('username');
  h.enqueue(result([], [proposal(m.lc, 'floating_opener', '#open')]));
  await h.analyze();
  await h.test();
  assert(h.messages[0].readinessMode === 'declared' && h.messages[0].readiness.locator === '#user', `fixture: declared readiness on the mapped field (got ${h.messages[0].readinessMode})`);
  assert(alertText(h.view.tree) === COPY.fieldMissing, `C3 declared-mode timeout → «${COPY.fieldMissing}» (got "${alertText(h.view.tree)}")`);
  assert(statusText(h.view.tree) === m.bar.SPECIAL_BUTTON_PANEL_HE.statusNotChosenFieldMissing, `C3 panel status follows (got "${statusText(h.view.tree)}")`);
}

async function nothingRevealed(m) {
  const page = { creds: ['#search'], clickables: { '#open': () => {} } };
  const h = harness(m, { pattern: 'FLOATING_SCREEN', loginFields: CAL_FIELDS, page });
  h.enqueue(result([], [proposal(m.lc, 'floating_opener', '#open')]));
  await h.analyze();
  await h.test();
  assert(alertText(h.view.tree) === COPY.notOpened, `C4 nothing revealed → «${COPY.notOpened}» (got "${alertText(h.view.tree)}")`);
  assert(statusText(h.view.tree) === m.bar.SPECIAL_BUTTON_PANEL_HE.statusNotChosen, `C4 panel status «המסך לא נפתח» (got "${statusText(h.view.tree)}")`);
}

async function multiStepPatternsUnchanged(m) {
  for (const pattern of ['MULTI_STEP', 'FLOATING_SCREEN_MULTI_STEP']) {
    const page = { creds: [], clickables: {} };
    page.clickables['#open'] = () => setTimeout(() => page.creds.push('#user'), 10);
    const h = harness(m, { pattern, loginFields: PASSWORD_FIELDS, page });
    const kind = pattern === 'MULTI_STEP' ? 'intermediate_transition' : 'floating_opener';
    h.enqueue(result([], [proposal(m.lc, kind, '#open')]));
    await h.analyze();
    h.enqueue(result([ready('username', '#user')]));
    await h.test();
    assert(h.messages[0].requirePasswordSurface === undefined, `C5 ${pattern}: no password requirement (unchanged)`);
    assert(alertText(h.view.tree) === '', `C5 ${pattern}: identifier-only surface passes (got "${alertText(h.view.tree)}")`);
  }
}

function pureChecks(m) {
  const { bar, hub } = m;
  assert(bar.requirePasswordSurfaceFor('FLOATING_SCREEN', PASSWORD_FIELDS) === true, 'P1 FLOATING_SCREEN + password field → required');
  assert(bar.requirePasswordSurfaceFor('FLOATING_SCREEN', CAL_FIELDS) === false, 'P1 FLOATING_SCREEN without a password field → not required');
  assert(bar.requirePasswordSurfaceFor('FLOATING_SCREEN', []) === false, 'P1 no login fields → not required');
  for (const p of ['MULTI_STEP', 'FLOATING_SCREEN_MULTI_STEP', 'STANDARD']) {
    assert(bar.requirePasswordSurfaceFor(p, PASSWORD_FIELDS) === false, `P1 ${p} → not required`);
  }
  assert(hub.authoringClickFailureMessageHe('surface_not_revealed') === COPY.notOpened, 'P2 surface_not_revealed copy');
  assert(hub.authoringClickFailureMessageHe('surface_not_login') === COPY.notLogin, 'P2 surface_not_login copy');
  assert(hub.authoringClickFailureMessageHe('readiness_timeout') === COPY.fieldMissing, 'P2 readiness_timeout copy');
  assert(hub.authoringClickFailureMessageHe('frame_missing') === hub.FRAME_NOT_ADDRESSABLE_HE, 'P2 other reasons unchanged');
  assert(hub.authoringClickFailureMessageHe('something_else') === 'לחיצת המשך נכשלה. בדקו שהלשונית הנוכחית פתוחה במקור הנכון.', 'P2 default unchanged');
  assert(bar.testFailureOutcome('surface_not_login') === 'not_login' && bar.testFailureOutcome('readiness_timeout') === 'field_missing' && bar.testFailureOutcome('surface_not_revealed') === 'not_opened' && bar.testFailureOutcome('click_target_missing') === 'not_opened', 'P3 status outcome per reason');
}

function staticChecks() {
  const barSrc = read('src/admin/specialActionBar.ts');
  const fn = barSrc.slice(barSrc.indexOf('export function requirePasswordSurfaceFor'), barSrc.indexOf('/** Both contract approvals.'));
  assert(fn.length > 0 && !/hostname|serviceId|cal\b|https?:/i.test(fn), 'S1 no site / host / serviceId branches');
  const ui = read('src/admin/SpecialLoginDraftEditor.tsx');
  assert(ui.split('requirePasswordSurface:').length === 2 && ui.includes('requirePasswordSurface: requirePasswordSurfaceFor(consentDraft.pattern, loginFields),'), 'S2 the editor sends the flag only via requirePasswordSurfaceFor');
}

async function runAll(overrides = {}, { pure = true } = {}) {
  const m = await loadBundle(overrides);
  if (pure) pureChecks(m);
  await passwordlessRevealed(m);
  await newsletterNotLogin(m);
  await declaredTimeout(m);
  await nothingRevealed(m);
  await multiStepPatternsUnchanged(m);
}

console.log('Phase 121 D-121-59 + A1 — password requirement follows the login fields; one message per reason\n');
await runAll();
console.log('  ✓ P1–P3 — requirement rule; copy per reason; panel outcome per reason; other reasons unchanged');
console.log('  ✓ C1 — schema without a password field + ID / card-digits screen → revealed, fields identified');
console.log('  ✓ C2 — schema with a password field + newsletter-only screen → surface_not_login + its copy / status');
console.log('  ✓ C3 — declared-mode timeout → its copy / status');
console.log('  ✓ C4 — nothing revealed → «המסך לא נפתח»');
console.log('  ✓ C5 — MULTI_STEP / FLOATING_SCREEN_MULTI_STEP unchanged');
staticChecks();
console.log('  ✓ S1–S2 — no site branches; single send site');

// Mutations run the end-to-end groups only: each must be caught through editor → Hub → Ext.
console.log('\nMutations (end-to-end groups only)');
const BAR = 'src/admin/specialActionBar.ts';
const HUB = 'src/assistedMapping/currentTabAuthoring.ts';
const RULE = "  return pattern === 'FLOATING_SCREEN' && loginFields.some((f) => f.type === 'password');";
const MUT = [
  ['M1 always require (FLOATING_SCREEN)', BAR, [[RULE, "  return pattern === 'FLOATING_SCREEN';"]]],
  ['M2 never require', BAR, [[RULE, '  return false;']]],
  ['M3 wrong field-type test', BAR, [[RULE, "  return pattern === 'FLOATING_SCREEN' && loginFields.some((f) => f.type === 'text');"]]],
  ['M4 pattern check dropped', BAR, [[RULE, "  return loginFields.some((f) => f.type === 'password');"]]],
  ['M5 copy mapping collapsed back', HUB, [[
    "    case 'surface_not_revealed':\n      return SURFACE_NOT_OPENED_HE;\n    case 'surface_not_login':\n      return SURFACE_NOT_LOGIN_HE;\n    case 'readiness_timeout':\n      return MAPPED_FIELD_NOT_APPEARED_HE;",
    "    case 'readiness_timeout':\n    case 'surface_not_revealed':\n    case 'surface_not_login':\n      return SURFACE_NOT_OPENED_HE;",
  ]]],
  ['M6 panel status collapsed back', BAR, [["  if (reason === 'surface_not_login') return 'not_login';\n  if (reason === 'readiness_timeout') return 'field_missing';\n", '']]],
];
for (const [label, file, pairs] of MUT) {
  let mutated = read(file);
  for (const [from, to] of pairs) mutated = replaceOnce(mutated, from, to, label);
  let caught = null;
  try {
    await runAll({ [file]: mutated }, { pure: false });
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }
  assert(caught, `mutation NOT caught: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  console.log(`  ✓ mutation caught: ${label} — ${caught}`);
}
console.log(`\nPASS — D-121-59 + A1 verify: 3 pure + 5 end-to-end groups + 2 static, ${MUT.length} mutations caught`);
process.exit(0);
