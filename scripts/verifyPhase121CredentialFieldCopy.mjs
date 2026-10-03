/**
 * Phase 121 D-121-50 + A1 — «שדות כניסה» editor: plain-language, self-explanatory field controls.
 * One control «זה שדה הסיסמה של האתר» (⇔ type password; on change writes masked with it), no
 * separate «מוסתר» (legacy text+masked shows «מוסתר בתצוגה» until cleared), «ערך מותר»,
 * «חובה למלא», «מזהה טכני» under a collapsed «מתקדם». Stored shape unchanged; untouched fields
 * byte-identical. Server-renders the REAL editor (real React) and drives it with a minimal hooks
 * runtime. Synthetic fixtures only. Mutations must be caught.
 * Usage: node scripts/verifyPhase121CredentialFieldCopy.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR = 'src/admin/CredentialFieldsEditor.tsx';
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
// Expected copy, written independently of the source copy object.
const COPY = {
  label: 'שם השדה',
  labelHint: 'כך השדה יופיע למשתמש. הסוכן משתמש בו גם כדי למצוא את השדה באתר.',
  sitePassword: 'זה שדה הסיסמה של האתר',
  sitePasswordHint:
    'כשמסומן: המערכת תחפש לו שדה סיסמה באתר, תשמור את הערך בדיוק כפי שהוקלד (כולל רווחים), והערך יוסתר תמיד אצל המשתמש.',
  legacyMasked: 'מוסתר בתצוגה',
  allowedValue: 'ערך מותר',
  allowedAny: 'כל תו',
  allowedDigits: 'ספרות בלבד',
  // D-121-50 C1: the hint follows the selected value.
  allowedAnyHint: 'אפשר להקליד אותיות, ספרות וסימנים.',
  allowedDigitsHint: 'המערכת תדחה אותיות ותווים שאינם ספרות (למשל ת"ז).',
  required: 'חובה למלא',
  requiredHint: 'המשתמש לא יוכל לשמור בלי ערך בשדה הזה.',
  advanced: 'מתקדם',
  technicalId: 'מזהה טכני',
  technicalIdHint: 'לשימוש פנימי. שינוי ינתק ערכים שכבר נשמרו אצל משתמשים.',
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const hintP = (s) => `<p class="admin-field-hint">${esc(s)}</p>`;
const allowedHintFor = (inputType) => (inputType === 'number' ? COPY.allowedDigitsHint : COPY.allowedAnyHint);
const otherAllowedHint = (inputType) => (inputType === 'number' ? COPY.allowedAnyHint : COPY.allowedDigitsHint);
const RETIRED_STATIC_HINT = 'ספרות בלבד — המערכת תדחה אותיות (למשל ת"ז).';

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

const loadBundles = (editorSource) => withTempDir('pv-12150-', (outdir) => loadBundlesIn(outdir, editorSource));

async function loadBundlesIn(outdir, editorSource) {
  const reactPath = join(outdir, 'mini-react.mjs');
  writeFileSync(reactPath, MINI_REACT);
  const editorKey = resolvePath(root, EDITOR).replace(/\\/g, '/').toLowerCase();
  const plugin = (mini) => ({
    name: 'verify-seams',
    setup(b) {
      if (mini) b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: reactPath }));
      b.onLoad({ filter: /\.tsx$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        if (editorSource != null && key === editorKey) {
          return { contents: editorSource, loader: 'tsx', resolveDir: dirname(args.path) };
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
        import Editor from './${EDITOR}';
        export { editorFieldsFromStored, editorFieldsToStored } from './${EDITOR}';
        export { ID_CHANGE_WARNING } from './src/service/credentialSchema.ts';
        export const render = (fields) => renderToStaticMarkup(createElement(Editor, { fields, onChange: () => {} }));
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
        export { default as Editor } from './${EDITOR}';
      `,
      resolveDir: root,
      loader: 'ts',
    },
    outfile: miniFile,
    plugins: [plugin(true)],
  });
  const ssr = await import(pathToFileURL(ssrFile).href);
  const mini = await import(pathToFileURL(miniFile).href);
  return { ...ssr, mount: mini.mount, MiniEditor: mini.Editor };
}

// ─── Fixtures (key order = editorFieldsToStored order) ────────────────────────
const STORED = [
  { id: 'user', label: 'User', required: true, masked: false, inputType: 'text', type: 'text' },
  { id: 'pw', label: 'Password', required: true, masked: false, inputType: 'text', type: 'password' },
  { id: 'last4', label: 'Last 4', required: true, masked: true, inputType: 'number', type: 'text' },
  { id: 'pw2', label: 'Pw2', required: false, masked: true, inputType: 'text', type: 'password' },
];
const clone = (x) => JSON.parse(JSON.stringify(x));
const J = (x) => JSON.stringify(x);

// ─── Mini-tree helpers ────────────────────────────────────────────────────────
function kids(n) {
  const c = n?.props?.children;
  return c == null ? [] : Array.isArray(c) ? c.flat(Infinity) : [c];
}
function walk(n, fn) {
  if (n == null || typeof n !== 'object') return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, fn));
  fn(n);
  kids(n).forEach((x) => walk(x, fn));
}
function findAll(n, pred) {
  const out = [];
  walk(n, (x) => {
    if (pred(x)) out.push(x);
  });
  return out;
}
function text(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n !== 'object') return String(n);
  if (Array.isArray(n)) return n.map(text).join('');
  return kids(n).map(text).join('');
}
function control(tree, index, name) {
  const li = findAll(tree, (x) => x.type === 'li')[index];
  assert(li, `field row ${index} rendered`);
  return findAll(li, (x) => x.props['data-control'] === name)[0] ?? null;
}
function inputOf(tree, index, name) {
  const c = control(tree, index, name);
  assert(c, `control ${name} rendered for field ${index}`);
  const el = findAll(c, (x) => x.type === 'input' || x.type === 'select')[0];
  assert(el, `control ${name} has an input`);
  return el;
}

function mountEditor(m, stored, extra = {}) {
  const calls = [];
  const fields = m.editorFieldsFromStored(clone(stored));
  const h = m.mount(m.MiniEditor, { fields, onChange: (f) => calls.push(f), ...extra });
  return { h, calls, fields };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

// ─── Check groups ─────────────────────────────────────────────────────────────
function checkCopyAndOrder(m) {
  const html = m.render(m.editorFieldsFromStored(clone(STORED)));
  const rows = html.split('<li').slice(1);
  assert(rows.length === STORED.length, 'one row per field');
  for (const [i, seg] of rows.entries()) {
    const marks = [
      'data-control="label"',
      `<span>${esc(COPY.label)}</span>`,
      hintP(COPY.labelHint),
      'data-control="site-password"',
      esc(COPY.sitePassword),
      hintP(COPY.sitePasswordHint),
      'data-control="allowed-value"',
      `<span>${esc(COPY.allowedValue)}</span>`,
      `>${esc(COPY.allowedAny)}</option>`,
      `>${esc(COPY.allowedDigits)}</option>`,
      hintP(allowedHintFor(STORED[i].inputType)),
      'data-control="required"',
      esc(COPY.required),
      hintP(COPY.requiredHint),
      'data-control="advanced"',
      `<summary>${esc(COPY.advanced)}</summary>`,
      `<span>${esc(COPY.technicalId)}</span>`,
      hintP(COPY.technicalIdHint),
      'למעלה',
      'למטה',
      'הסר',
    ];
    let at = -1;
    for (const mark of marks) {
      const next = seg.indexOf(mark, at + 1);
      assert(next > at, `row ${i}: "${mark}" present and in order`);
      at = next;
    }
    assert(!seg.includes(esc(otherAllowedHint(STORED[i].inputType))), `row ${i}: only the hint of the selected «ערך מותר» value is shown`);
    assert(!seg.includes(esc(RETIRED_STATIC_HINT)), `row ${i}: retired static «ערך מותר» hint gone`);
    assert(
      seg.includes('<details class="admin-details" data-control="advanced">'),
      `row ${i}: «מתקדם» collapsed by default`,
    );
    const advanced = seg.slice(seg.indexOf('data-control="advanced"'));
    assert(advanced.includes(`value="${STORED[i].id}"`), `row ${i}: technical id lives under «מתקדם»`);
    assert(!seg.slice(0, seg.indexOf('data-control="advanced"')).includes(`value="${STORED[i].id}"`), `row ${i}: technical id not outside «מתקדם»`);
  }
  for (const retired of ['תפקיד מילוי', 'תווית', 'סוג קלט', 'סיסמת אתר']) {
    assert(!html.includes(retired), `retired copy «${retired}» gone`);
  }
  assert(!/ מוסתר<\/label>/.test(html), 'standalone «מוסתר» checkbox removed');
}

function checkSitePasswordControl(m) {
  const html = m.render(m.editorFieldsFromStored(clone(STORED)));
  const rows = html.split('<li').slice(1);
  for (const [i, seg] of rows.entries()) {
    assert(seg.includes(`<p class="admin-field-hint">${esc('כשמסומן: ')}`), `row ${i}: site-password hint starts with «כשמסומן: » (checked or not)`);
    const from = seg.indexOf('data-control="site-password"');
    const block = seg.slice(from, seg.indexOf('</label>', from));
    const checked = /checked=""/.test(block);
    assert(checked === (STORED[i].type === 'password'), `row ${i}: site-password checkbox ⇔ type password (masked ignored)`);
  }
  // Change: checked → password + masked true; unchecked → text + masked false; others untouched.
  const on = mountEditor(m, STORED);
  inputOf(on.h.tree, 0, 'site-password').props.onChange({ target: { checked: true } });
  const afterOn = m.editorFieldsToStored(on.calls.at(-1));
  assert(afterOn[0].type === 'password' && afterOn[0].masked === true, 'checking writes type password + masked true');
  assert(J({ ...afterOn[0], type: 'text', masked: false }) === J(STORED[0]), 'checking changes only type + masked');
  for (const i of [1, 2, 3]) assert(J(afterOn[i]) === J(STORED[i]), `checking field 0 leaves field ${i} byte-identical`);

  const off = mountEditor(m, STORED);
  inputOf(off.h.tree, 3, 'site-password').props.onChange({ target: { checked: false } });
  const afterOff = m.editorFieldsToStored(off.calls.at(-1));
  assert(afterOff[3].type === 'text' && afterOff[3].masked === false, 'unchecking writes type text + masked false');
  assert(J({ ...afterOff[3], type: 'password', masked: true }) === J(STORED[3]), 'unchecking changes only type + masked');

  const legacyPw = mountEditor(m, STORED);
  inputOf(legacyPw.h.tree, 1, 'site-password').props.onChange({ target: { checked: false } });
  inputOf(legacyPw.h.tree, 1, 'site-password').props.onChange({ target: { checked: true } });
  const reOn = m.editorFieldsToStored(legacyPw.calls.at(-1));
  assert(reOn[1].type === 'password', 'legacy password field re-checked is password');
}

function checkUntouchedByteIdentical(m) {
  assert(J(m.editorFieldsToStored(m.editorFieldsFromStored(clone(STORED)))) === J(STORED), 'no edits → stored output byte-identical');
  const edits = [
    ['label', (el) => el.props.onChange({ target: { value: 'User name' } })],
    ['required', (el) => el.props.onChange({ target: { checked: false } })],
    ['allowed-value', (el) => el.props.onChange({ target: { value: 'number' } })],
    ['site-password', (el) => el.props.onChange({ target: { checked: true } })],
  ];
  for (const [name, act] of edits) {
    const e = mountEditor(m, STORED);
    act(inputOf(e.h.tree, 0, name));
    assert(e.calls.length === 1, `editing ${name} emits one change`);
    const out = m.editorFieldsToStored(e.calls[0]);
    for (const i of [1, 2, 3]) {
      assert(J(out[i]) === J(STORED[i]), `editing ${name} of field 0 leaves legacy field ${i} (${STORED[i].type}+masked ${STORED[i].masked}) byte-identical`);
    }
  }
}

function checkLegacyMasked(m) {
  const html = m.render(m.editorFieldsFromStored(clone(STORED)));
  const rows = html.split('<li').slice(1);
  for (const [i, seg] of rows.entries()) {
    const expect = STORED[i].type !== 'password' && STORED[i].masked === true;
    assert(seg.includes('data-control="legacy-masked"') === expect, `row ${i}: legacy «מוסתר בתצוגה» only for text+masked true`);
    assert(seg.includes(esc(COPY.legacyMasked)) === expect, `row ${i}: legacy label only for text+masked true`);
  }
  const e = mountEditor(m, STORED);
  const box = inputOf(e.h.tree, 2, 'legacy-masked');
  assert(box.props.checked === true, 'legacy checkbox shown checked');
  box.props.onChange({ target: { checked: false } });
  const out = m.editorFieldsToStored(e.calls.at(-1));
  assert(out[2].masked === false && out[2].type === 'text', 'clearing legacy writes masked false only');
  assert(J({ ...out[2], masked: true }) === J(STORED[2]), 'clearing legacy changes nothing else');
  e.h.setProps({ fields: e.calls.at(-1) });
  assert(control(e.h.tree, 2, 'legacy-masked') === null, 'cleared legacy checkbox disappears');
  assert(findAll(e.h.tree, (x) => x.props['data-control'] === 'legacy-masked').length === 0, 'no legacy checkbox remains');
}

function checkAllowedValue(m) {
  const html = m.render(m.editorFieldsFromStored(clone(STORED)));
  const rows = html.split('<li').slice(1);
  for (const [i, seg] of rows.entries()) {
    const want = STORED[i].inputType === 'number' ? 'number' : 'text';
    assert(seg.includes(`<option value="${want}" selected="">`), `row ${i}: «ערך מותר» shows inputType ${want}`);
  }
  assert(rows[2].includes(`<option value="number" selected="">${esc(COPY.allowedDigits)}</option>`), '«ספרות בלבד» ⇔ number');
  assert(rows[0].includes(`<option value="text" selected="">${esc(COPY.allowedAny)}</option>`), '«כל תו» ⇔ text');
  const e = mountEditor(m, STORED);
  inputOf(e.h.tree, 0, 'allowed-value').props.onChange({ target: { value: 'number' } });
  assert(e.calls.at(-1)[0].inputType === 'number', 'choosing «ספרות בלבד» writes inputType number');
  const back = mountEditor(m, STORED);
  inputOf(back.h.tree, 2, 'allowed-value').props.onChange({ target: { value: 'text' } });
  assert(back.calls.at(-1)[2].inputType === 'text', 'choosing «כל תו» writes inputType text');
  assert(back.calls.at(-1)[2].masked === true && back.calls.at(-1)[2].type === 'text', 'allowed value does not touch type / masked');

  // C1: the hint follows the selection after a change (both directions).
  const hintText = (tree, index) => {
    const c = control(tree, index, 'allowed-value');
    const p = findAll(c, (x) => x.type === 'p')[0];
    assert(p, `«ערך מותר» hint rendered for field ${index}`);
    return text(p).trim();
  };
  const sw = mountEditor(m, STORED);
  assert(hintText(sw.h.tree, 0) === COPY.allowedAnyHint, '«כל תו» shows its own hint');
  assert(hintText(sw.h.tree, 2) === COPY.allowedDigitsHint, '«ספרות בלבד» shows its own hint');
  inputOf(sw.h.tree, 0, 'allowed-value').props.onChange({ target: { value: 'number' } });
  sw.h.setProps({ fields: sw.calls.at(-1) });
  assert(hintText(sw.h.tree, 0) === COPY.allowedDigitsHint, 'switching to «ספרות בלבד» switches the hint');
  inputOf(sw.h.tree, 0, 'allowed-value').props.onChange({ target: { value: 'text' } });
  sw.h.setProps({ fields: sw.calls.at(-1) });
  assert(hintText(sw.h.tree, 0) === COPY.allowedAnyHint, 'switching back to «כל תו» switches the hint back');
}

// Phase 122.5 R3 / R4: the warning is the in-app `confirmFieldChange`, and only for ids in
// `protectedFieldIds` (last saved login_fields of an active site).
async function checkIdConfirmAndNewField(m) {
  const prompts = [];
  let answer = false;
  const confirmFieldChange = async (change, msg) => (prompts.push([change, msg]), answer);
  const guarded = { protectedFieldIds: STORED.map((f) => f.id), confirmFieldChange };
  const removeBtn = (tree, index) => {
    const li = findAll(tree, (x) => x.type === 'li')[index];
    return findAll(li, (x) => x.type === 'button' && text(x).trim() === 'הסר')[0];
  };
  const no = mountEditor(m, STORED, guarded);
  inputOf(no.h.tree, 0, 'advanced').props.onBlur({ target: { value: 'renamed' } });
  await settle();
  assert(prompts.length === 1 && prompts[0][0] === 'id' && prompts[0][1] === m.ID_CHANGE_WARNING, 'protected technical id change asks ID_CHANGE_WARNING');
  assert(no.calls.length === 0, 'declined id change writes nothing');
  answer = true;
  const yes = mountEditor(m, STORED, guarded);
  inputOf(yes.h.tree, 0, 'advanced').props.onBlur({ target: { value: 'renamed' } });
  await settle();
  assert(prompts.length === 2 && prompts[1][1] === m.ID_CHANGE_WARNING, 'accepted id change also asked');
  assert(yes.calls.at(-1)?.[0]?.id === 'renamed', 'accepted id change writes the new id');
  const same = mountEditor(m, STORED, guarded);
  inputOf(same.h.tree, 0, 'advanced').props.onBlur({ target: { value: 'user' } });
  await settle();
  assert(prompts.length === 2 && same.calls.length === 0, 'unchanged id asks nothing');
  answer = false;
  const rm = mountEditor(m, STORED, guarded);
  removeBtn(rm.h.tree, 1).props.onClick();
  await settle();
  assert(prompts.length === 3 && prompts[2][0] === 'remove' && rm.calls.length === 0, 'protected remove asks; declined writes nothing');

  const free = mountEditor(m, STORED, { protectedFieldIds: ['pw'], confirmFieldChange });
  inputOf(free.h.tree, 0, 'advanced').props.onBlur({ target: { value: 'renamed' } });
  await settle();
  assert(prompts.length === 3 && free.calls.at(-1)?.[0]?.id === 'renamed', 'id not in protectedFieldIds → no warning, change applied');
  removeBtn(free.h.tree, 2).props.onClick();
  await settle();
  assert(prompts.length === 3 && free.calls.at(-1)?.length === 3, 'remove of an unprotected field → no warning');
  const plain = mountEditor(m, STORED);
  removeBtn(plain.h.tree, 0).props.onClick();
  await settle();
  assert(prompts.length === 3 && plain.calls.at(-1)?.length === 3, 'no protected ids (new / inactive / user-owned) → no warning');

  const add = mountEditor(m, STORED);
  const addBtn = findAll(add.h.tree, (x) => x.type === 'button' && text(x).trim() === 'הוסף שדה')[0];
  assert(addBtn, '«הוסף שדה» rendered');
  addBtn.props.onClick();
  const added = add.calls.at(-1).at(-1);
  assert(added.type === 'text' && added.masked === false && added.inputType === 'text', 'new field: type text, masked false');
}

function checkStaticScope() {
  const src = read(EDITOR);
  assert(/export function editorFieldsToStored[\s\S]*?masked: field\.masked,[\s\S]*?type: field\.type,/.test(src), 'editorFieldsToStored writes the editor values as-is');
  assert(!/hostname|serviceId|\.co\.il|\.com['"]/.test(src), 'no site branches in the editor');
  assert(!src.includes('תפקיד מילוי'), 'role select retired');
}

const GROUPS = [
  ['copy + hints + order', checkCopyAndOrder],
  ['site-password control ⇔ type (+ masked on change)', checkSitePasswordControl],
  ['untouched fields byte-identical', checkUntouchedByteIdentical],
  ['legacy «מוסתר בתצוגה»', checkLegacyMasked],
  ['«ערך מותר» ⇔ inputType', checkAllowedValue],
  ['technical id confirm + new field', checkIdConfirmAndNewField],
  ['static scope', () => checkStaticScope()],
];
async function runAll(m) {
  for (const [, fn] of GROUPS) await fn(m);
}

// ─── Mutations ────────────────────────────────────────────────────────────────
function reorderRequiredBeforeAllowed(src) {
  const start = src.indexOf('              <div data-control="required">');
  const end = src.indexOf('              <details className="admin-details"');
  if (start < 0 || end < start) throw new Error('fixture: reorder anchors missing');
  const block = src.slice(start, end);
  const without = src.slice(0, start) + src.slice(end);
  const at = without.indexOf('              <div data-control="allowed-value">');
  if (at < 0) throw new Error('fixture: allowed-value anchor missing');
  return without.slice(0, at) + block + without.slice(at);
}
const MUTATIONS = [
  ['M1 label copy back to «תווית»', (s) => replaceOnce(s, "label: 'שם השדה',", "label: 'תווית',", 'label copy')],
  ['M2 label hint not rendered', (s) => replaceOnce(s, '<p className="admin-field-hint">{CREDENTIAL_FIELD_COPY_HE.labelHint}</p>', '', 'label hint')],
  ['M3 site-password hint not rendered', (s) => replaceOnce(s, '<p className="admin-field-hint">{CREDENTIAL_FIELD_COPY_HE.sitePasswordHint}</p>', '', 'pw hint')],
  ['M4 order: «חובה למלא» before «ערך מותר»', reorderRequiredBeforeAllowed],
  ['M5 checkbox bound to masked', (s) => replaceOnce(s, "checked={field.type === 'password'}", 'checked={field.masked}', 'pw checked')],
  ['M6 checking does not set masked', (s) => replaceOnce(s, "{ type: 'password', masked: true }", "{ type: 'password', masked: false }", 'patch on')],
  ['M7 unchecking keeps masked', (s) => replaceOnce(s, "{ type: 'text', masked: false }", "{ type: 'text', masked: true }", 'patch off')],
  ['M8 stored masked derived from type', (s) => replaceOnce(s, '    masked: field.masked,\n    inputType: field.inputType,', "    masked: field.type === 'password' || field.masked,\n    inputType: field.inputType,", 'toStored masked')],
  ['M9 legacy checkbox for every text field', (s) => replaceOnce(s, "return field.type !== 'password' && field.masked === true;", "return field.type !== 'password';", 'legacy rule')],
  ['M10 legacy checkbox never shown', (s) => replaceOnce(s, "return field.type !== 'password' && field.masked === true;", 'return false;', 'legacy rule')],
  ['M11 «ערך מותר» ignores choice', (s) => replaceOnce(s, 'update(index, { inputType: event.target.value as CredentialInputType })', "update(index, { inputType: 'text' })", 'inputType change')],
  ['M12 «ספרות בלבד» label wrong', (s) => replaceOnce(s, "allowedDigits: 'ספרות בלבד',", "allowedDigits: 'מספר',", 'digits copy')],
  ['M13 id change without confirm', (s) => replaceOnce(s, "fields.some((field, i) => i !== index && field.id === trimmed);\n    if (!(await confirmIfProtected(current.id, 'id'))) {", 'fields.some((field, i) => i !== index && field.id === trimmed);\n    if (false) {', 'id confirm')],
  ['M20 protected remove without confirm', (s) => replaceOnce(s, "    if (!target || !(await confirmIfProtected(target.id, 'remove'))) {", '    if (!target) {', 'remove confirm')],
  ['M21 every field asks (protected ids ignored)', (s) => replaceOnce(s, '    return protectedFieldIds.includes(id);', '    return true;', 'protected rule')],
  ['M14 «מתקדם» open by default', (s) => replaceOnce(s, '<details className="admin-details" data-control="advanced">', '<details className="admin-details" data-control="advanced" open>', 'details')],
  ['M15 new field masked', (s) => replaceOnce(s, "        masked: false,\n        inputType: 'text',\n        type: 'text',", "        masked: true,\n        inputType: 'text',\n        type: 'text',", 'new field')],
  ['M16 required hint missing', (s) => replaceOnce(s, '<p className="admin-field-hint">{CREDENTIAL_FIELD_COPY_HE.requiredHint}</p>', '', 'required hint')],
  ['M17 C1 static «ערך מותר» hint', (s) => replaceOnce(s, "{field.inputType === 'number'\n                    ? CREDENTIAL_FIELD_COPY_HE.allowedDigitsHint\n                    : CREDENTIAL_FIELD_COPY_HE.allowedAnyHint}", '{CREDENTIAL_FIELD_COPY_HE.allowedDigitsHint}', 'allowed hint')],
  ['M18 C1 swapped «ערך מותר» hints', (s) => replaceOnce(s, "{field.inputType === 'number'\n                    ? CREDENTIAL_FIELD_COPY_HE.allowedDigitsHint", "{field.inputType !== 'number'\n                    ? CREDENTIAL_FIELD_COPY_HE.allowedDigitsHint", 'allowed hint cond')],
  ['M19 C1 «כשמסומן: » prefix missing', (s) => replaceOnce(s, "'כשמסומן: המערכת תחפש", "'המערכת תחפש", 'pw hint prefix')],
];

const base = await loadBundles(null);
await runAll(base);
for (const [name] of GROUPS) console.log(`  ok  ${name}`);

const original = read(EDITOR);
let caught = 0;
for (const [name, mutate] of MUTATIONS) {
  const mutated = mutate(original);
  const m = await loadBundles(mutated);
  let failure = null;
  try {
    // The static group reads the file on disk, so only behavioral groups judge a mutation.
    for (const [g, fn] of GROUPS) if (g !== 'static scope') await fn(m);
  } catch (err) {
    failure = err;
  }
  if (!failure) throw new Error(`mutation NOT caught: ${name}`);
  if (String(failure.message).startsWith('fixture:')) throw new Error(`mutation fixture error: ${name}: ${failure.message}`);
  caught += 1;
  console.log(`  caught ${name} — ${failure.message}`);
}
console.log(`PASS — D-121-50 + A1 + C1 credential field controls: ${GROUPS.length} check groups, ${caught} mutations caught`);
