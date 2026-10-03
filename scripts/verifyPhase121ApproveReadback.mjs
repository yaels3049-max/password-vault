/**
 * Phase 121 D-121-55 — SPECIAL «אשר מיפוי» is fail-closed on a read-back of the stored row.
 * Drives the REAL SpecialLoginDraftEditor (minimal hooks runtime) whose registry calls go to the
 * REAL adminRegistryApi over an in-memory Supabase fake. The fake can match 0 rows on update
 * (RLS / non-admin session — no error, like PostgREST), drop the activation key on write, or
 * return a write error. Success copy only when the read-back resolves SPECIAL with the written
 * version and the approved content; otherwise «אישור המיפוי נכשל.» + raw reason under «פרטים טכניים».
 * Synthetic fixtures only. Mutations must be caught.
 * Usage: node scripts/verifyPhase121ApproveReadback.mjs
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
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ─── In-memory Supabase fake ──────────────────────────────────────────────────
const fake = { rows: new Map(), mode: 'ok', updates: [] };
class FakeQuery {
  constructor() {
    this.filters = [];
    this.op = 'select';
    this.payload = null;
    this.returning = false;
  }
  select() {
    if (this.op === 'update') this.returning = true;
    return this;
  }
  order() { return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  eq(k, v) { this.filters.push([k, v]); return this; }
  is(k, v) { this.filters.push([k, v]); return this; }
  exec() {
    let rows = [...fake.rows.values()].filter((r) => this.filters.every(([k, v]) => (r[k] ?? null) === v));
    if (this.op === 'update') {
      if (fake.mode === 'error') return { data: null, error: { message: 'simulated write failure', code: 'XX000' } };
      // RLS using(is_admin() and owner_user_id is null) with a non-admin session: no row, no error.
      if (fake.mode === 'rls') rows = [];
      const payload = clone(this.payload);
      if (fake.mode === 'drop' && payload.metadata) delete payload.metadata.loginContractActivation;
      for (const r of rows) Object.assign(r, payload);
      fake.updates.push({ matched: rows.length, payload });
      return { data: this.returning ? rows.map((r) => ({ id: r.id })) : null, error: null };
    }
    return { data: clone(rows), error: null };
  }
  maybeSingle() {
    const r = this.exec();
    return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
  }
  then(res, rej) { return Promise.resolve(this.exec()).then(res, rej); }
}
globalThis.__pvFakeClient = { from: () => new FakeQuery(), rpc: async () => ({ data: null, error: null }) };

// ─── Bundles ──────────────────────────────────────────────────────────────────
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

const API_STUBS = {
  'supabase/client': 'export const getSupabaseClient = () => globalThis.__pvFakeClient;',
  'supabase/env': 'export const isSupabaseConfigured = () => true;',
  auth: "export const requireAuthenticatedUserId = async () => 'admin-user-0001';",
  'catalog/customServiceDiscovery':
    'export async function discoverLoginForRegistryService() { return { outcome: { status: "failure" }, discovery: null }; }',
  'registry/bulkLoginUrlRefresh':
    'export const BULK_REFRESH_CONCURRENCY = 1; export const BULK_REFRESH_INTER_BATCH_DELAY_MS = 0; export async function bulkRefreshLoginUrls() { return {}; }',
  'registry/registryLoader': 'export function clearRegistryCatalogCache() {}',
};

const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();

function overridePlugin(overrides) {
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  return (b) => {
    b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
      const key = args.path.replace(/\\/g, '/').toLowerCase();
      if (!overridden.has(key)) return undefined;
      return { contents: overridden.get(key), loader: key.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
    });
  };
}

function loadApi(overrides) {
  return withTempDir('pv-12155-api-', (outdir) => loadApiIn(outdir, overrides));
}
async function loadApiIn(outdir, overrides) {
  const outfile = join(outdir, 'api.mjs');
  await build({
    entryPoints: [join(root, 'src/admin/adminRegistryApi.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    packages: 'external',
    define: { 'import.meta.env': '{"DEV":false}' },
    logLevel: 'silent',
    plugins: [
      {
        name: 'api-stubs',
        setup(b) {
          b.onResolve({ filter: /^\.\.?\// }, (args) => {
            if (!args.importer.replace(/\\/g, '/').endsWith('src/admin/adminRegistryApi.ts')) return undefined;
            for (const key of Object.keys(API_STUBS)) {
              if (args.path === `../${key}` || args.path.endsWith(`/${key}`)) return { path: key, namespace: 'pv-stub' };
            }
            return undefined;
          });
          b.onLoad({ filter: /.*/, namespace: 'pv-stub' }, (args) => ({ contents: API_STUBS[args.path], loader: 'js' }));
          overridePlugin(overrides)(b);
        },
      },
    ],
  });
  return import(pathToFileURL(outfile).href);
}

function apiForwarder() {
  const src = read('src/admin/adminRegistryApi.ts');
  const names = new Set();
  for (const m of src.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  return [...names].map((n) => `export function ${n}(...a) { return globalThis.__api(${JSON.stringify(n)}, a); }`).join('\n');
}

function loadEditor(overrides) {
  return withTempDir('pv-12155-ui-', (outdir) => loadEditorIn(outdir, overrides));
}
async function loadEditorIn(outdir, overrides) {
  const reactPath = join(outdir, 'mini-react.mjs');
  writeFileSync(reactPath, MINI_REACT);
  const apiFile = abs('src/admin/adminRegistryApi.ts');
  const outfile = join(outdir, 'bundle.mjs');
  await build({
    stdin: {
      contents: `
        export { mount } from ${JSON.stringify(reactPath.replace(/\\/g, '/'))};
        export { default as SpecialEditor, SPECIAL_EDITOR_COPY_HE } from './src/admin/SpecialLoginDraftEditor.tsx';
        export * as lc from './src/loginContract/index.ts';
        export * as rb from './src/admin/specialApproveReadback.ts';
        export { ADMIN_MAPPING_COPY_HE } from './src/admin/mappingCopy.ts';
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
    plugins: [
      {
        name: 'ui-seams',
        setup(b) {
          b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: reactPath }));
          b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            if (key === apiFile) return { contents: apiForwarder(), loader: 'js' };
            return undefined;
          });
          overridePlugin(overrides)(b);
        },
      },
    ],
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
function one(tree, action) {
  const found = findAll(tree, (n) => n.props?.['data-action'] === action);
  assert(found.length === 1, `expected one [data-action="${action}"], found ${found.length}`);
  return found[0];
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ORIGIN = 'https://svc.example.test';
const FRAME = { frameLocator: 'iframe#login-frame', frameOrigin: 'https://auth.example.test' };
function floatingDraft({ framed, passLocator = '#pass' }) {
  const frame = framed ? { frame: FRAME } : {};
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
        readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 5000, ...frame },
      },
    ],
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#user', ...frame },
          { fieldId: 'password', locatorType: 'css', locator: passLocator, ...frame },
        ],
      },
    ],
  };
}
function seedRow(id) {
  fake.rows.set(id, {
    id,
    display_name: 'שירות בדיקה',
    primary_url: `${ORIGIN}/`,
    login_url: `${ORIGIN}/login`,
    login_url_status: 'valid',
    category_id: null,
    icon: '🔗',
    adapter_id: null,
    login_fields: [
      { id: 'username', label: 'User', type: 'text', required: true },
      { id: 'password', label: 'Pass', type: 'password', required: true },
    ],
    source_type: 'admin',
    service_status: 'active',
    metadata: { credentialMode: 'credential_fields', loginEntryType: 'primary_page', loginUrlSource: 'admin' },
    metadata_version: 1,
    owner_user_id: null,
  });
}

// ─── Scenario pieces ──────────────────────────────────────────────────────────
const infoLog = [];
const realInfo = console.info;
console.info = (...a) => infoLog.push(a);

async function saveDraft(api, lc, id, draft) {
  fake.mode = 'ok';
  const row = await api.fetchRegistryRowForAdmin(id);
  const { LOGIN_FLOW_PLAN_META_KEY: PLAN } = lc;
  const meta = { ...row.metadata };
  delete meta[PLAN];
  delete meta.loginContractActivation;
  await api.updateGlobalRegistryRow(id, { metadata: { ...meta, [PLAN]: { draft } } });
}

/** Mount the editor on the stored row, press «אשר מיפוי» → confirm; return the rendered outcome. */
async function approve(m, api, id, mode) {
  globalThis.__api = (name, args) => api[name](...args);
  let view;
  const onSaved = async () => {
    fake.mode = 'ok';
    view.setProps({ row: await api.fetchRegistryRowForAdmin(id) });
  };
  fake.mode = 'ok';
  view = m.mount(m.SpecialEditor, { row: await api.fetchRegistryRowForAdmin(id), onSaved });
  const btn = one(view.tree, 'activate-special');
  assert(!btn.props.disabled, 'fixture: saved + complete → «אשר מיפוי» enabled');
  btn.props.onClick();
  await view.settle();
  fake.mode = mode;
  const logBefore = infoLog.length;
  one(view.tree, 'confirm-activate-special').props.onClick();
  await view.settle();
  fake.mode = 'ok';
  const tree = view.tree;
  const successes = findAll(tree, (n) => n.props?.className === 'admin-success').map(textOf);
  const block = findAll(tree, (n) => n.props?.['data-status'] === 'special-approve-failed');
  const approveLogs = infoLog.slice(logBefore).filter((a) => a[0] === '[D-121-55 approve]');
  return { successes, block: block[0] ?? null, blocks: block.length, approveLogs, tree };
}

function expectSuccess(m, out, label) {
  assert(out.successes.includes(m.ADMIN_MAPPING_COPY_HE.approved), `${label}: success copy «המיפוי אושר» shown (got ${JSON.stringify(out.successes)})`);
  assert(out.blocks === 0, `${label}: no failure block on a confirmed approval`);
  assert(out.approveLogs.length === 1 && out.approveLogs[0][1].ok === true, `${label}: one [D-121-55 approve] ok log`);
}

function expectFailure(m, out, label, reasonNeedle) {
  assert(!out.successes.includes(m.ADMIN_MAPPING_COPY_HE.approved), `${label}: «המיפוי אושר» must NOT be shown`);
  assert(out.blocks === 1, `${label}: failure block rendered`);
  const msg = findAll(out.block, (n) => n.props?.['data-part'] === 'message');
  assert(msg.length === 1 && textOf(msg[0]) === 'אישור המיפוי נכשל.', `${label}: main line is exactly «אישור המיפוי נכשל.» (got ${JSON.stringify(msg.map(textOf))})`);
  assert(msg[0].props.className === 'admin-error' && msg[0].props.role === 'alert', `${label}: main line uses admin-error / alert`);
  const details = findAll(out.block, (n) => n.type === 'details' && n.props?.['data-part'] === 'technical');
  assert(details.length === 1, `${label}: «פרטים טכניים» details present`);
  assert(!details[0].props.open, `${label}: technical details collapsed by default`);
  const summary = findAll(details[0], (n) => n.type === 'summary');
  assert(summary.length === 1 && textOf(summary[0]) === m.ADMIN_MAPPING_COPY_HE.technicalDetails, `${label}: summary «פרטים טכניים»`);
  const code = findAll(details[0], (n) => n.type === 'code');
  const reason = code.length === 1 ? textOf(code[0]) : '';
  assert(reason.includes(reasonNeedle), `${label}: raw reason under details includes "${reasonNeedle}" (got "${reason}")`);
}

// ─── Checks ───────────────────────────────────────────────────────────────────
async function pureChecks(m) {
  const { rb, lc } = m;
  const draft = floatingDraft({ framed: true });
  const planned = lc.planLoginContractActivate({ currentMetadata: { [lc.LOGIN_FLOW_PLAN_META_KEY]: { draft } }, intent: { transition: 'STANDARD_TO_SPECIAL', draft } });
  assert(planned.ok, 'fixture: planner activates the framed draft');
  const stored = { [lc.LOGIN_FLOW_PLAN_META_KEY]: { draft }, ...planned.metadataPatch };
  const write = { updatedRows: 1, writerUserId: 'admin-user-0001', writtenSpecialVersion: 1 };
  const base = { readBackMetadata: stored, rowFound: true, approvedDraft: draft, previousSpecialVersion: null, write };
  assert(rb.verifySpecialApproveReadback(base).ok, 'P1 stored SPECIAL v1 = written v1 + same content → ok');

  const zero = rb.verifySpecialApproveReadback({ ...base, write: { ...write, updatedRows: 0 } });
  assert(!zero.ok && zero.reason.includes('matched 0 rows'), 'P2 updatedRows 0 → fail "matched 0 rows" (even if the read-back looks right)');

  const dropped = { ...stored };
  delete dropped.loginContractActivation;
  const noAct = rb.verifySpecialApproveReadback({ ...base, readBackMetadata: dropped });
  assert(!noAct.ok && noAct.reason.includes('read-back mode is STANDARD') && noAct.reason.includes('activationStored=no'), 'P3 activation missing on read-back → fail (mode STANDARD, activationStored=no)');

  const vMismatch = rb.verifySpecialApproveReadback({ ...base, write: { ...write, writtenSpecialVersion: 2 } });
  assert(!vMismatch.ok && vMismatch.reason.includes('differs from written 2'), 'P4 read-back v1 ≠ written v2 → fail');

  const otherDraft = floatingDraft({ framed: true, passLocator: '#other' });
  const content = rb.verifySpecialApproveReadback({ ...base, approvedDraft: otherDraft });
  assert(!content.ok && content.reason.includes('differs from the approved mapping'), 'P5 active content ≠ approved draft → fail');

  const noBump = rb.verifySpecialApproveReadback({ ...base, previousSpecialVersion: 1 });
  assert(!noBump.ok && noBump.reason.includes('not above the previous 1'), 'P6 SPECIAL_TO_SPECIAL without a version bump → fail');

  const missing = rb.verifySpecialApproveReadback({ ...base, rowFound: false, readBackMetadata: null });
  assert(!missing.ok && missing.reason.includes('row not found'), 'P7 row not readable → fail');

  const notWritten = rb.verifySpecialApproveReadback({ ...base, write: { ...write, writtenSpecialVersion: null } });
  assert(!notWritten.ok && notWritten.reason.includes('did not carry a SPECIAL activation'), 'P8 write carried no SPECIAL activation → fail');
}

async function apiChecks(api, lc) {
  const draft = floatingDraft({ framed: true });
  seedRow('api-1');
  await saveDraft(api, lc, 'api-1', draft);
  const row = await api.fetchRegistryRowForAdmin('api-1');
  const intentPatch = { metadata: { ...row.metadata, [lc.LOGIN_FLOW_PLAN_META_KEY]: { draft }, [lc.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: { transition: 'STANDARD_TO_SPECIAL', draft } } };

  fake.mode = 'rls';
  const denied = await api.updateGlobalRegistryRow('api-1', intentPatch);
  fake.mode = 'ok';
  assert(denied && denied.updatedRows === 0, `A1 RLS miss → updatedRows 0 reported (got ${JSON.stringify(denied)})`);
  assert(denied.writtenSpecialVersion === 1, 'A1 written SPECIAL version reported from the sent payload');
  assert(lc.resolveActiveLoginContract((await api.fetchRegistryRowForAdmin('api-1')).metadata).mode === 'STANDARD', 'fixture: RLS miss leaves the row STANDARD');

  const okWrite = await api.updateGlobalRegistryRow('api-1', intentPatch);
  assert(okWrite.updatedRows === 1 && okWrite.writerUserId === 'admin-user-0001', 'A2 matched write → updatedRows 1 + writer id');
  assert(lc.resolveActiveLoginContract((await api.fetchRegistryRowForAdmin('api-1')).metadata).mode === 'SPECIAL', 'A2 row SPECIAL after a matched write');

  // STANDARD / non-contract writes: a 0-row update still resolves (callers unchanged, no new throw).
  seedRow('api-2');
  fake.mode = 'rls';
  const plain = await api.updateGlobalRegistryRow('api-2', { display_name: 'שם אחר' });
  fake.mode = 'ok';
  assert(plain.updatedRows === 0 && plain.writtenSpecialVersion === null, 'A3 non-contract 0-row write resolves (updatedRows 0, not SPECIAL) — no throw');
  const contractLogs = infoLog.filter((a) => a[0] === '[D-121-55 registry contract write]');
  assert(contractLogs.some((a) => a[1].updatedRows === 0 && a[1].after === 'SPECIAL v1'), 'A4 contract write trace logs the 0-row SPECIAL write');
  assert(contractLogs.every((a) => !JSON.stringify(a[1]).includes('#user')), 'A4 trace carries modes/counts only (no mapping content)');
}

async function editorChecks(m, api) {
  const { lc } = m;
  // E1 top-document plan: STANDARD → SPECIAL persisted + read back.
  seedRow('top');
  await saveDraft(api, lc, 'top', floatingDraft({ framed: false }));
  const top = await approve(m, api, 'top', 'ok');
  expectSuccess(m, top, 'E1 top-document');
  const topLive = lc.resolveActiveLoginContract((await api.fetchRegistryRowForAdmin('top')).metadata);
  assert(topLive.mode === 'SPECIAL' && topLive.activePlanVersion === 1, 'E1 stored row SPECIAL v1');

  // E2 framed plan (cross-origin frame descriptors on fields + readiness).
  seedRow('framed');
  await saveDraft(api, lc, 'framed', floatingDraft({ framed: true }));
  const framed = await approve(m, api, 'framed', 'ok');
  expectSuccess(m, framed, 'E2 framed');
  const framedLive = lc.resolveActiveLoginContract((await api.fetchRegistryRowForAdmin('framed')).metadata);
  assert(framedLive.mode === 'SPECIAL' && framedLive.plan.steps[0].fieldMappings.every((f) => f.frame?.frameOrigin === FRAME.frameOrigin), 'E2 stored active keeps the frame descriptors');

  // E3 SPECIAL → SPECIAL: changed + saved mapping re-approved → v2 with the new content.
  await saveDraft(api, lc, 'framed', floatingDraft({ framed: true, passLocator: '#pass-v2' }));
  const bump = await approve(m, api, 'framed', 'ok');
  expectSuccess(m, bump, 'E3 SPECIAL_TO_SPECIAL');
  const bumpLive = lc.resolveActiveLoginContract((await api.fetchRegistryRowForAdmin('framed')).metadata);
  assert(bumpLive.mode === 'SPECIAL' && bumpLive.activePlanVersion === 2 && bumpLive.plan.steps[0].fieldMappings[1].locator === '#pass-v2', 'E3 stored row SPECIAL v2 with the re-approved mapping');

  // E4 0-row write (RLS / non-admin session): failure copy, not success.
  seedRow('rls');
  await saveDraft(api, lc, 'rls', floatingDraft({ framed: true }));
  const rls = await approve(m, api, 'rls', 'rls');
  expectFailure(m, rls, 'E4 0-row write', 'matched 0 rows');
  assert(rls.approveLogs.length === 1 && rls.approveLogs[0][1].ok === false, 'E4 [D-121-55 approve] logs ok:false');

  // E5 write that drops loginContractActivation: failure copy, not success.
  seedRow('drop');
  await saveDraft(api, lc, 'drop', floatingDraft({ framed: true }));
  const drop = await approve(m, api, 'drop', 'drop');
  expectFailure(m, drop, 'E5 dropped activation key', 'read-back mode is STANDARD');

  // E6 write error: failure copy with the raw error under details.
  seedRow('err');
  await saveDraft(api, lc, 'err', floatingDraft({ framed: false }));
  const err = await approve(m, api, 'err', 'error');
  expectFailure(m, err, 'E6 write error', '');
  assert(textOf(findAll(err.block, (n) => n.type === 'code')[0]).length > 0, 'E6 raw error text present under details');
}

function staticChecks() {
  const std = read('src/admin/AutofillProfileEditor.tsx');
  assert(!std.includes('specialApproveReadback') && !std.includes('approveFailure'), 'S1 STANDARD approve (AutofillProfileEditor) untouched by the SPECIAL read-back');
  const ui = read('src/admin/SpecialLoginDraftEditor.tsx');
  const act = ui.slice(ui.indexOf('async function activateSpecial'), ui.indexOf('async function runSpecialAnalyze'));
  assert(act.indexOf('fetchRegistryRowForAdmin(row.id)') > act.indexOf('updateGlobalRegistryRow(row.id'), 'S2 read-back happens after the write');
  assert(act.indexOf('setSuccess(SPECIAL_EDITOR_COPY_HE.specialActivated)') > act.indexOf('verifySpecialApproveReadback('), 'S2 success only after the read-back check');
  const helper = read('src/admin/specialApproveReadback.ts');
  assert(!/serviceId|hostname|pagi/i.test(helper), 'S3 no site / host / serviceId branches in the check');
}

async function runAll(overrides = {}) {
  const api = await loadApi(overrides);
  const m = await loadEditor(overrides);
  fake.rows.clear();
  fake.updates.length = 0;
  infoLog.length = 0;
  await pureChecks(m);
  await apiChecks(api, m.lc);
  await editorChecks(m, api);
}

realInfo('Phase 121 D-121-55 — SPECIAL «אשר מיפוי» fail-closed on read-back\n');
await runAll();
realInfo('  ✓ P1–P8 — read-back check: ok only for SPECIAL + written version + approved content; 0 rows / missing activation / version / content / no bump / no row / no SPECIAL write → fail');
realInfo('  ✓ A1–A4 — updateGlobalRegistryRow reports matched rows (RLS miss → 0, no error), writer, written version; non-contract 0-row write still resolves; contract trace logged (no content)');
realInfo('  ✓ E1 — top-document plan: approve persists SPECIAL v1, read back → «המיפוי אושר»');
realInfo('  ✓ E2 — framed plan: approve persists SPECIAL with frame descriptors → «המיפוי אושר»');
realInfo('  ✓ E3 — SPECIAL → SPECIAL: re-approve persists v2 with the new mapping → «המיפוי אושר»');
realInfo('  ✓ E4 — 0-row write → «אישור המיפוי נכשל.» + "matched 0 rows" under collapsed «פרטים טכניים»');
realInfo('  ✓ E5 — dropped activation key → failure copy + "read-back mode is STANDARD"');
realInfo('  ✓ E6 — write error → failure copy + raw error under «פרטים טכניים»');
staticChecks();
realInfo('  ✓ S1–S3 — STANDARD editor untouched; read-back after write, success after check; no site branches');

realInfo('\nMutations');
const EDITOR = 'src/admin/SpecialLoginDraftEditor.tsx';
const HELPER = 'src/admin/specialApproveReadback.ts';
const API = 'src/admin/adminRegistryApi.ts';
const MUT = [
  ['M1 success without the read-back check', EDITOR, '      if (check.ok) {', '      if (true) {'],
  ['M2 0-row result ignored', HELPER, '  if (write.updatedRows === 0) {', '  if (false) {'],
  ['M3 read-back mode check removed', HELPER, "  if (resolved.mode !== 'SPECIAL') {\n    return fail(", "  if (resolved.mode !== 'SPECIAL' && false) {\n    return fail("],
  ['M4 version check removed', HELPER, '  if (resolved.activePlanVersion !== write.writtenSpecialVersion) {', '  if (false) {'],
  ['M5 content check removed', HELPER, '  if (planContentKey(resolved.plan) !== planContentKey(input.approvedDraft)) {', '  if (false) {'],
  ['M6 version-bump check removed', HELPER, '    input.previousSpecialVersion !== null &&\n', '    false &&\n'],
  ['M7 raw reason as the main line', EDITOR, '            {SPECIAL_EDITOR_COPY_HE.approveFailed}\n          </p>\n          <details', '            {approveFailure}\n          </p>\n          <details'],
  ['M8 technical details open', EDITOR, '<details className="admin-special-test-details" data-part="technical">', '<details open className="admin-special-test-details" data-part="technical">'],
  ['M9 thrown error shown as plain error', EDITOR, '      setApproveFailure(err instanceof Error ? err.message : String(err));', '      setError(err instanceof Error ? err.message : String(err));'],
  ['M10 update without returning rows', API, "    .is('owner_user_id', null)\n    .select('id');", "    .is('owner_user_id', null);"],
  ['M11 no read-back (trust the write)', EDITOR, '      const stored = await fetchRegistryRowForAdmin(row.id);', '      const stored = { metadata: { ...(row.metadata ?? {}), loginContractActivation: { mode: "SPECIAL", activePlanVersion: write.writtenSpecialVersion }, loginFlowPlan: { draft: normalized, active: { ...normalized, planVersion: write.writtenSpecialVersion } } } };'],
];
for (const [label, file, from, to] of MUT) {
  const mutated = replaceOnce(read(file), from, to, label);
  let caught = null;
  try {
    await runAll({ [file]: mutated });
  } catch (e) {
    caught = e instanceof Error ? e.message : String(e);
  }
  assert(caught, `mutation NOT caught: ${label}`);
  assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
  realInfo(`  ✓ mutation caught: ${label} — ${caught}`);
}
console.info = realInfo;
realInfo(`\nPASS — D-121-55 verify: 8 pure + 4 API + 6 editor + 3 static checks, ${MUT.length} mutations caught`);
process.exit(0);
