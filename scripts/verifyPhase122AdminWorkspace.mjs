/**
 * Phase 122 — Admin Workspace (presentation only). Runs the REAL Admin (AdminApp, RegistryAdmin,
 * every grid / editor, admin.css) in a real browser (Edge via Playwright). Stubbed seams only:
 * AdminGate (pass-through), adminAuth (session email), adminRegistryApi (in-memory rows; every
 * write recorded), useServiceLogos (no logos), chrome.runtime (the extension never answers, so a
 * Visual pick / fill test stays in progress). Synthetic fixtures only. Mutations must be caught.
 *
 * Usage: node scripts/verifyPhase122AdminWorkspace.mjs [--slice=122.1|122.2|122.3|122.4|122.5|122.7|122.8]
 *          [--only=<checkName>] [--no-mutations | --mutations=M72,M73]
 *        PHASE122_SCREENSHOTS=<dir> also writes screenshots. --only runs one check group, no mutations.
 *        No mutation switch = full sweep (END OF ROUND only, test policy T-1).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { makeTempDir, removeTempDir, withTempDir } from './lib/tempDir.mjs';
import { formatElapsed, mutationId, parseMutationArgs, selectMutations } from './lib/mutationArgs.mjs';

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

const SLICE = Number((process.argv.find((a) => a.startsWith('--slice=')) ?? '--slice=122.8').split('.').pop());
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice('--only='.length) || null;
const MUTATION_ARGS = parseMutationArgs();
if (ONLY && MUTATION_ARGS.mode === 'ids') throw new Error('--only runs no mutations; drop --mutations=…');
const STARTED = Date.now();
const SHOTS = process.env.PHASE122_SCREENSHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

/** Harness dir → the source overrides it was built with (for source-level checks under a mutation). */
const harnessOverrides = new Map();

const HE = {
  unsavedLeave: 'יש באתר הזה שינויים שלא נשמרו. לעזוב בלי לשמור?',
  registryNav: 'הגדרת אתרים',
  back: 'מעבר לרשימת האתרים',
  newSite: 'אתר חדש',
};
const MULTI = 'שירות רב־שלבי';
const STANDARD = 'שירות רגיל';
const USER_OWNED = 'הגשת משתמש';
const FLOAT = 'שירות מסך צף';
const ADMIN_EMAIL = 'admin@example.test';
const ADMIN_FIRST = 'דנה';
const ADMIN_LAST = 'כהן';

// ─── Harness bundle ───────────────────────────────────────────────────────────
function apiStub() {
  const names = new Set();
  for (const m of read('src/admin/adminRegistryApi.ts').matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  const impl = {
    fetchAllRegistryRowsForAdmin: 'async () => clone(db().rows)',
    fetchAdminCategories: 'async () => clone(db().categories)',
    fetchRegistryRowForAdmin: 'async (id) => clone(db().rows.find((r) => r.id === id) ?? null)',
    updateGlobalRegistryRow: 'async (id, patch) => { record("updateGlobalRegistryRow", [id, patch]); applyPatch(id, patch); }',
    updateUserOwnedRegistryRow: 'async (id, patch) => { record("updateUserOwnedRegistryRow", [id, patch]); applyPatch(id, patch); }',
    createGlobalRegistryRow:
      'async (input) => { record("createGlobalRegistryRow", [input]); const id = "svc-created-" + db().rows.length; db().rows.push({ ...clone(input), id, owner_user_id: null, created_at: "2026-10-01T00:00:00.000Z", updated_at: "c1" }); return id; }',
    fetchPendingSubmissions: 'async () => clone(db().pending)',
    fetchSubmitterProfiles:
      'async (ids) => { globalThis.__rpc.push(clone(ids)); if (globalThis.__pvRpcFail) throw new Error("rpc failed"); return clone(db().profiles.filter((p) => ids.includes(p.id))); }',
    ADMIN_NOTE_MAX_LENGTH: '20000',
    fetchAdminServiceNote: 'async (id) => clone(db().notes[id] ?? null)',
    fetchAdminNoteServiceIds:
      'async () => { globalThis.__noteIdCalls += 1; if (globalThis.__pvNoteIdsFail) throw new Error("notes failed"); return Object.keys(db().notes); }',
    saveAdminServiceNote:
      'async (id, body) => { record("saveAdminServiceNote", [id, body]); if (!body.trim()) { delete db().notes[id]; return null; } const n = { service_id: id, body, updated_at: "2026-10-02T09:15:00.000Z" }; db().notes[id] = n; return clone(n); }',
  };
  const lines = [
    'const db = () => globalThis.__pvdb;',
    'const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));',
    'let rev = 0;',
    'function record(fn, args) { globalThis.__writes.push({ fn, args: clone(args) }); }',
    'function applyPatch(id, patch) { const r = db().rows.find((x) => x.id === id); if (r) { Object.assign(r, clone(patch)); r.updated_at = "rev-" + (++rev); } }',
  ];
  for (const n of names) {
    const body = impl[n] ?? (n.startsWith('fetch') ? 'async () => []' : `async (...args) => { record(${JSON.stringify(n)}, args); return null; }`);
    lines.push(`export const ${n} = ${body};`);
  }
  return lines.join('\n');
}

const STUBS = {
  'src/admin/adminRegistryApi.ts': apiStub,
  'src/admin/AdminGate.tsx': () => 'export default function AdminGate({ children }) { return children; }',
  'src/admin/adminAuth.ts': () =>
    `export async function readSignedInAdmin() { return globalThis.__pvAdmin ?? { firstName: ${JSON.stringify(ADMIN_FIRST)}, lastName: ${JSON.stringify(ADMIN_LAST)}, email: ${JSON.stringify(ADMIN_EMAIL)} }; }\nexport async function resolveAdminAccess() { return { status: 'allowed', userId: 'u1', isAdmin: true, error: null }; }`,
  'src/useServiceLogos.ts': () => 'export function useServiceLogos() { return {}; }',
  // G-122-9: the real module; only SPECIAL «Analyze» answers from `globalThis.__pvAnalyze` when set.
  'src/assistedMapping/currentTabAuthoring.ts': () => {
    const real = read('src/assistedMapping/currentTabAuthoring.ts');
    const head = 'export async function analyzeSpecialCurrentSurface(';
    assert(real.includes(head), 'fixture: analyzeSpecialCurrentSurface found');
    return `${real.replace(head, 'async function realAnalyzeSpecialCurrentSurface(')}
export async function analyzeSpecialCurrentSurface(input: Parameters<typeof realAnalyzeSpecialCurrentSurface>[0]) {
  const hook = (globalThis as { __pvAnalyze?: (i: unknown) => unknown }).__pvAnalyze;
  return hook ? (hook(input) as ReturnType<typeof realAnalyzeSpecialCurrentSurface>) : realAnalyzeSpecialCurrentSurface(input);
}
`;
  },
};

const HARNESS_ENTRY = `
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './src/admin/AdminApp.tsx';
import * as lc from './src/loginContract/index.ts';
import * as bar from './src/admin/specialActionBar.ts';

const FIELDS = [
  { id: 'username', label: 'אימייל', type: 'text', required: true },
  { id: 'password', label: 'סיסמה', type: 'password', required: true },
];
const map = (fieldId, locator) => ({ fieldId, locatorType: 'css', locator });
const transition = (id, locator) =>
  bar.actionAfterTestSuccess(lc.createActionCandidate({ actionId: id, kind: 'intermediate_transition', label: id, locator }));
let d = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('MULTI_STEP', null), 'step-1', [map('username', '#user')]);
d = lc.placeTransitionAsStepExit(d, 'step-1', transition('next-1', '#next'));
d = lc.upsertStepFieldMappings(d, 'step-2', [map('password', '#pass')]);
d = lc.rederiveRevealReadiness(d);
const multiMeta = {
  loginEntryType: 'direct_url',
  credentialMode: 'credential_fields',
  [lc.LOGIN_FLOW_PLAN_META_KEY]: lc.serializeLoginFlowPlanBag({ draft: d, active: null }),
};
const standardMeta = {
  loginEntryType: 'direct_url',
  credentialMode: 'credential_fields',
  autofillProfile: {
    configVersion: 1,
    supportState: 'not_configured',
    loginEntryUrl: 'https://plain.example.test/login',
    allowedOrigin: 'https://plain.example.test',
    fieldMappings: [map('username', '#u'), map('password', '#p')],
  },
};
const base = (id, name, host, extra = {}) => ({
  id,
  display_name: name,
  primary_url: 'https://' + host + '/',
  login_url: 'https://' + host + '/login',
  login_url_status: 'valid',
  category_id: 'cat-a',
  icon: '🔗',
  adapter_id: null,
  source_type: 'admin',
  service_status: 'active',
  owner_user_id: null,
  login_fields: FIELDS,
  metadata: { loginEntryType: 'direct_url', credentialMode: 'credential_fields' },
  metadata_version: 1,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: 't1',
  ...extra,
});
const rows = [
  base('svc-multi', ${JSON.stringify(MULTI)}, 'multi.example.test', { metadata: multiMeta }),
  base('svc-plain', ${JSON.stringify(STANDARD)}, 'plain.example.test', { metadata: standardMeta }),
  base('svc-user', ${JSON.stringify(USER_OWNED)}, 'user.example.test', { owner_user_id: 'user-0001', source_type: 'approved_global', service_status: 'pending_review', login_fields: null, metadata: { loginEntryType: 'direct_url' } }),
];
// G-122-9: a FLOATING_SCREEN site (only when an init script sets __pvFloat) + an Analyze answer
// that proposes a floating opener (shows «נמצא כפתור באתר» next to «מיפוי שדות»).
if (globalThis.__pvFloat) {
  const fd = lc.rederiveRevealReadiness(lc.upsertStepFieldMappings(lc.ensureSpecialDraft('FLOATING_SCREEN', null), 'step-1', [map('username', '#fu')]));
  rows.push(base('svc-float', ${JSON.stringify(FLOAT)}, 'float.example.test', {
    metadata: { loginEntryType: 'direct_url', credentialMode: 'credential_fields', [lc.LOGIN_FLOW_PLAN_META_KEY]: lc.serializeLoginFlowPlanBag({ draft: fd, active: null }) },
  }));
}
globalThis.__pvAnalyze = async () => ({
  ok: true,
  actionProposals: [{ action: lc.createActionCandidate({ actionId: 'opener-1', kind: 'floating_opener', label: 'כניסה', locator: '#open-login' }) }],
  fieldAnalyze: {
    ok: true,
    proposal: { schemaVersion: 1, requestId: 'r1', serviceId: 'svc-float', status: 'ok', proposals: [], unmappedFieldIds: [] },
    prefill: { next: {}, appliedFieldIds: [] },
  },
  framedFieldProposals: [],
  authoringTabId: 1,
});
for (let i = 1; i <= 9; i += 1) rows.push(base('svc-f' + i, 'אתר מילוי ' + i, 'filler' + i + '.example.test', { service_status: i % 3 === 0 ? 'disabled' : 'active' }));
const categories = [{ id: 'cat-a', display_name: 'כללי', sort_order: 1 }, { id: 'cat-b', display_name: 'בריאות', sort_order: 2 }];
['בנקים', 'ביטוח', 'תקשורת', 'ממשלה', 'חינוך', 'קניות'].forEach((name, i) => categories.push({ id: 'cat-' + 'cdefgh'[i], display_name: name, sort_order: i + 3 }));
// 122.7 queue: pending user submissions (the queue only) + submitter profiles (RPC stub).
const sub = (id, name, owner, extra) => ({
  id, display_name: name, primary_url: 'https://' + id + '.example.test/', login_url: null, login_url_status: null,
  category_id: 'cat-a', icon: '🔗', adapter_id: null, source_type: 'user', service_status: 'pending_review',
  owner_user_id: owner, login_fields: null, metadata: { loginEntryType: 'primary_page' }, metadata_version: 1,
  created_at: '2026-09-30T21:05:00.000Z', updated_at: 'p1', ...extra,
});
const pending = [
  sub('sub-one', 'הגשה עם שם', 'user-1001', { login_url: 'https://sub-one.example.test/login', metadata: { loginEntryType: 'direct_url' } }),
  sub('sub-two', 'הגשה בלי שם', 'user-1002', { created_at: '2026-09-15T08:30:00.000Z' }),
  sub('sub-three', 'הגשה לא מזוהה', 'user-1003', { primary_url: 'ftp://files.example.test/' }),
  // G-122-8: home-page entry stores login_url = primary_url (explicitLoginEntry).
  sub('sub-four', 'הגשה נוספת', 'user-1001', { login_url: 'https://sub-four.example.test/' }),
  sub('sub-five', 'הגשה בלי מטא-דאטה', 'user-1002', { login_url: 'https://sub-five.example.test/signin', metadata: null }),
  sub('sub-six', 'הגשה עם כתובת פגומה', 'user-1003', { login_url: 'javascript:alert(1)', metadata: { loginEntryType: 'direct_url' } }),
];
const profiles = [
  { id: 'user-1001', first_name: 'נועה', last_name: 'לוי', email: 'noa@example.test' },
  { id: 'user-1002', first_name: '', last_name: null, email: 'anon@example.test' },
];
// G-122-7: optional user-submitted catalog rows + their profiles (set by an init script).
rows.push(...(globalThis.__pvCatalogUsers ?? []));
// G-122-12: extra catalog rows (e.g. a row without a category), set by an init script.
rows.push(...(globalThis.__pvExtraRows ?? []).map((extra) => base(extra.id, extra.display_name, extra.host, extra.fields)));
profiles.push(...(globalThis.__pvCatalogProfiles ?? []));
// 122.8 (only when an init script sets __pv1228): R2 / R3 rows — partial / approved / changed STANDARD,
// partial / approved / changed / invalid SPECIAL — and a long-name row with a long category (R1).
globalThis.__pvSpecialGap = {};
if (globalThis.__pv1228) {
  const meta = (extra) => ({ loginEntryType: 'direct_url', credentialMode: 'credential_fields', ...extra });
  const prof = (extra) => meta({ autofillProfile: { ...standardMeta.autofillProfile, ...extra } });
  rows.push(base('svc-std-partial', 'רגיל חלקי', 'std-partial.example.test', { metadata: prof({ fieldMappings: [map('username', '#u')] }) }));
  rows.push(base('svc-std-approved', 'רגיל מאושר', 'std-approved.example.test', { metadata: prof({ supportState: 'validated', configVersion: 1, validation: { metadataVersion: 1 } }) }));
  rows.push(base('svc-std-changed', 'רגיל שונה אחרי אישור', 'std-changed.example.test', { metadata: prof({ supportState: 'unsupported', configVersion: 2, validation: { metadataVersion: 1 } }) }));
  // Step exit not yet approved for the runtime → checkSpecialDraft incomplete.
  let partial = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('MULTI_STEP', null), 'step-1', [map('username', '#user')]);
  partial = lc.placeTransitionAsStepExit(partial, 'step-1', lc.createActionCandidate({ actionId: 'next-p', kind: 'intermediate_transition', label: 'next-p', locator: '#next' }));
  partial = lc.rederiveRevealReadiness(lc.upsertStepFieldMappings(partial, 'step-2', [map('password', '#pass')]));
  globalThis.__pvSpecialGap['svc-sp-partial'] = bar.checkSpecialDraft(partial).message;
  rows.push(base('svc-sp-partial', 'מיוחד חלקי', 'sp-partial.example.test', { metadata: meta({ [lc.LOGIN_FLOW_PLAN_META_KEY]: lc.serializeLoginFlowPlanBag({ draft: partial, active: null }) }) }));
  const act = lc.planLoginContractActivate({ currentMetadata: multiMeta, intent: { transition: 'STANDARD_TO_SPECIAL' } });
  if (!act.ok) throw new Error('fixture: SPECIAL activation plan ' + act.code);
  const approvedMeta = { ...multiMeta, ...act.metadataPatch };
  rows.push(base('svc-sp-approved', 'מיוחד מאושר', 'sp-approved.example.test', { metadata: approvedMeta }));
  const changed = lc.upsertStepFieldMappings(d, 'step-2', [map('password', '#pass-2')]);
  rows.push(base('svc-sp-changed', 'מיוחד שונה אחרי אישור', 'sp-changed.example.test', {
    metadata: { ...approvedMeta, [lc.LOGIN_FLOW_PLAN_META_KEY]: lc.serializeLoginFlowPlanBag({ draft: changed, active: act.nextPlanBag.active }) },
  }));
  rows.push(base('svc-sp-invalid', 'מיוחד חסום', 'sp-invalid.example.test', {
    metadata: { ...multiMeta, [lc.LOGIN_CONTRACT_ACTIVATION_META_KEY]: lc.serializeLoginContractActivation({ mode: 'SPECIAL', activePlanVersion: 9 }) },
  }));
  categories.push({ id: 'cat-long', display_name: 'קטגוריה עם שם ארוך מאוד שלא נכנס בשורה אחת של הכרטיס', sort_order: 99 });
  rows.push(base('svc-long', 'אתר עם שם ארוך מאוד מאוד שממשיך וממשיך ולא נגמר גם אחרי שתי שורות שלמות של טקסט בכרטיס', 'long.example.test', { category_id: 'cat-long', source_type: 'approved_global' }));
}
// 122.8 R4: admin notes (in memory; svc-f1 starts with a note).
const notes = { 'svc-f1': { service_id: 'svc-f1', body: 'להתקשר לתמיכה לפני שינוי מיפוי.', updated_at: '2026-10-01T07:30:00.000Z' } };
globalThis.__pvdb = { rows, categories, pending, profiles, notes };
globalThis.__noteIdCalls = 0;
globalThis.__writes = [];
globalThis.__rpc = [];
createRoot(document.getElementById('root')).render(createElement(AdminApp));
`;

const INDEX_HTML = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><title>Admin harness</title>
<link rel="stylesheet" href="harness.css"><style>html,body{margin:0}</style></head>
<body><div id="root"></div>
<script>
  window.__ext = [];
  window.chrome = { runtime: { sendMessage(id, message, cb) { window.__ext.push(message && message.type); } } };
</script>
<script src="harness.js"></script></body></html>`;

/**
 * Builds a harness and runs `fn(dir)`; the harness dir is removed in a `finally` (pass or fail).
 * `virtual`: import specifier → module source, for modules the pre-phase baseline imports that no longer exist.
 */
async function withHarness(overrides, virtual, fn) {
  const dir = makeTempDir('pv-122-');
  try {
    await bundleHarness(dir, overrides, virtual);
    harnessOverrides.set(dir, overrides);
    return await fn(dir);
  } finally {
    harnessOverrides.delete(dir);
    removeTempDir(dir);
  }
}

async function bundleHarness(outdir, overrides, virtual) {
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const stubs = new Map(Object.entries(STUBS).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const used = new Set();
  await build({
    stdin: { contents: HARNESS_ENTRY, resolveDir: root, loader: 'tsx', sourcefile: 'harness.tsx' },
    outfile: join(outdir, 'harness.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    write: true,
    logLevel: 'silent',
    nodePaths: [join(root, 'node_modules')],
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
    define: {
      'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production', VITE_POC_EXTENSION_ID: 'pv-test-extension' }),
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [
      {
        name: 'phase122-seams',
        setup(b) {
          b.onResolve({ filter: /^\.\// }, (args) => (Object.hasOwn(virtual, args.path) ? { path: args.path, namespace: 'pv-virtual' } : undefined));
          b.onLoad({ filter: /.*/, namespace: 'pv-virtual' }, (args) => ({ contents: virtual[args.path], loader: 'jsx' }));
          b.onLoad({ filter: /\.(ts|tsx|css)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            const loader = key.endsWith('.css') ? 'css' : key.endsWith('.tsx') ? 'tsx' : 'ts';
            // A stubbed seam stays stubbed when overridden; `checkNoMetadataNotes` reads the override source.
            if (overridden.has(key) && stubs.has(key)) {
              used.add(key);
              return { contents: stubs.get(key)(), loader, resolveDir: dirname(args.path) };
            }
            if (overridden.has(key)) {
              used.add(key);
              return { contents: overridden.get(key), loader, resolveDir: dirname(args.path) };
            }
            if (stubs.has(key)) return { contents: stubs.get(key)(), loader, resolveDir: dirname(args.path) };
            return undefined;
          });
        },
      },
    ],
  });
  assert(used.size === overridden.size, `fixture: every override loaded (${used.size}/${overridden.size})`);
  writeFileSync(join(outdir, 'index.html'), INDEX_HTML);
}

// ─── Browser helpers ──────────────────────────────────────────────────────────
let browser = null;
// 122.5 R3 — Admin confirmations are in-app (AdminConfirmDialog). Each one that opens is logged
// in the page and answered per `window.__pvAnswer` (true = confirm, false = cancel, null = leave
// it open for the test). A native browser dialog fails the check (`allowNative` only for the
// pre-phase baseline, which still uses window.confirm).
const IN_APP_DIALOG_OBSERVER = `
  window.__pvDialogs = [];
  window.__pvAnswer = true;
  new MutationObserver(() => {
    for (const d of document.querySelectorAll('[data-admin-confirm]:not([data-pv-seen])')) {
      d.setAttribute('data-pv-seen', '1');
      window.__pvDialogs.push({
        name: d.getAttribute('data-admin-confirm'),
        title: d.querySelector('[data-part="confirm-title"]')?.textContent ?? '',
        body: d.querySelector('[data-part="confirm-body"]')?.textContent ?? '',
      });
      const answer = window.__pvAnswer;
      if (answer === null) continue;
      setTimeout(() => d.querySelector(answer ? '[data-action="confirm-accept"]' : '[data-action="confirm-cancel"]')?.click(), 0);
    }
  }).observe(document, { childList: true, subtree: true });
`;
async function openApp(bundleDir, { width = 1440, height = 900, allowNative = false, timezoneId, init } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'he-IL', ...(timezoneId ? { timezoneId } : {}) });
  await context.addInitScript(IN_APP_DIALOG_OBSERVER);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const s = { page, context, native: [], errors: [], answer: true, allowNative };
  page.on('dialog', async (dlg) => {
    s.native.push(`${dlg.type()}: ${dlg.message()}`);
    if (s.answer) await dlg.accept();
    else await dlg.dismiss();
  });
  page.on('pageerror', (e) => s.errors.push(String(e)));
  await page.goto(pathToFileURL(join(bundleDir, 'index.html')).href);
  await page.waitForSelector('.admin-site-card', { timeout: 10000 });
  return s;
}
const close = async (s) => {
  assert(s.errors.length === 0, `page errors: ${s.errors.join(' | ')}`);
  assert(s.allowNative || s.native.length === 0, `native browser dialog shown (in-app dialogs only): ${s.native.join(' | ')}`);
  await s.context.close();
};
/** In-app dialogs opened so far: { name, title, body }. */
const dialogLog = (s) => s.page.evaluate(() => window.__pvDialogs.slice());
/** Same, as the message text (body, else title). */
const dialogs = async (s) => (await dialogLog(s)).map((d) => d.body || d.title);
async function answer(s, value) {
  s.answer = value;
  await s.page.evaluate((v) => {
    window.__pvAnswer = v;
  }, value);
}
const openDialog = (page) => page.locator('[data-admin-confirm]');
const mode = (page) => page.getAttribute('section.admin-section--registry', 'data-mode');
const nameInput = (page) => page.locator('label.admin-field', { hasText: 'שם האתר' }).locator('input');
async function openSite(page, name) {
  await page.locator('.admin-site-card', { hasText: name }).click();
  await page.waitForSelector('[data-mode="workspace"]');
  await page.waitForFunction((n) => document.querySelector('[data-part="site-name"]')?.textContent === n, name);
  await page.waitForTimeout(80);
}
async function back(page) {
  await page.click('[data-action="back-to-catalog"]');
  await page.waitForTimeout(80);
}
async function tab(page, id) {
  await page.click(`[data-tab="${id}"]`);
  await page.waitForTimeout(60);
}
const visible = (page, sel) => page.locator(sel).first().isVisible();
const activeTab = (page) => page.getAttribute('[data-tab][aria-selected="true"]', 'data-tab');
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
}
const rect = (page, sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, width: r.width }; });
async function columns(page, sel) {
  return page.$$eval(sel, (els) => {
    const rs = els.map((e) => e.getBoundingClientRect());
    const top = rs[0]?.top ?? 0;
    return new Set(rs.filter((r) => Math.abs(r.top - top) < 2).map((r) => Math.round(r.left))).size;
  });
}

// ─── 122.1 checks ─────────────────────────────────────────────────────────────
async function checkWidths(dir) {
  for (const width of [1920, 1440, 1280]) {
    const s = await openApp(dir, { width });
    const main = await rect(s.page, '.admin-app-main');
    const header = await rect(s.page, '.admin-app-header');
    assert(main.width >= width - 50 && main.width > 1100, `${width}px: main uses the full width (got ${Math.round(main.width)})`);
    assert(header.width >= width - 2, `${width}px: app bar spans the viewport (got ${Math.round(header.width)})`);
    const cols = await columns(s.page, '.admin-card-grid > li');
    assert(cols >= 4, `${width}px: catalog is multi-column (${cols} columns)`);
    if (width === 1920) await shot(s.page, '122-catalog-1920');
    await openSite(s.page, MULTI);
    // 122.4: the workspace content is capped at 1440px and centered (the shell stays full width).
    const ws = await rect(s.page, '.admin-workspace');
    assert(ws.width >= Math.min(main.width - 70, 1439) && ws.width <= 1440.5, `${width}px: workspace uses the main width up to 1440px (${Math.round(ws.width)} of ${Math.round(main.width)})`);
    assert((await s.page.$$('[data-part="catalog"]')).length === 0, `${width}px: catalog not shown next to the workspace`);
    await close(s);
  }
  const narrow = await openApp(dir, { width: 860 });
  assert((await columns(narrow.page, '.admin-card-grid > li')) === 1, '≤ 900px: catalog falls back to one column');
  await close(narrow);
  return 'widths: 1920 / 1440 / 1280 use the full width (no 1100px cap), multi-column catalog, workspace full width; ≤ 900px one column';
}

async function checkModes(dir) {
  const s = await openApp(dir);
  const { page } = s;
  assert((await mode(page)) === 'catalog' && (await page.$$('[data-part="workspace"]')).length === 0, 'start: catalog mode');
  const nav = await page.$$eval('.admin-nav-btn', (els) => els.map((e) => e.textContent));
  assert(nav.includes(HE.registryNav) && !nav.includes('כל האתרים'), `nav label «${HE.registryNav}» (${nav.join(' / ')})`);
  const bar = await page.textContent('[data-part="app-bar"]');
  assert(bar.includes('מרכז הבקרה של הכספת') && bar.includes(ADMIN_EMAIL), 'app bar: title, signed-in admin');
  await openSite(page, MULTI);
  assert((await page.textContent('[data-status="site-status"]')) === 'פעיל', 'site strip: existing status chip');
  await shot(page, '122-workspace-strip');
  await page.click('[data-action="site-switcher"]');
  await page.fill('[data-panel="site-switcher"] input[type="search"]', 'רגיל');
  const listed = await page.$$eval('[data-action="switch-site"]', (els) => els.map((e) => e.textContent));
  assert(listed.length === 1 && listed[0].includes(STANDARD), `switcher search filters the list (${listed.join(' / ')})`);
  await page.click('[data-action="switch-site"]');
  await page.waitForFunction((n) => document.querySelector('[data-part="site-name"]')?.textContent === n, STANDARD);
  assert((await nameInput(page).inputValue()) === STANDARD, 'switcher opens the chosen site');
  await back(page);
  assert((await mode(page)) === 'catalog', '«מעבר לרשימת האתרים» restores the catalog');
  await page.click('[data-action="new-site"]');
  assert((await mode(page)) === 'workspace' && (await page.textContent('[data-part="site-name"]')) === HE.newSite, '«אתר חדש» enters the workspace');
  await back(page);
  assert((await dialogs(s)).length === 0, `no confirmation when nothing changed (${(await dialogs(s)).length})`);
  await close(s);
  return 'modes: catalog → site (catalog hidden) → switcher with search → back; «אתר חדש»; app bar title / nav «הגדרת אתרים» / signed-in admin; no prompt when clean';
}

async function checkGuard(dir) {
  const s = await openApp(dir);
  const { page } = s;
  await openSite(page, MULTI);
  await nameInput(page).fill(`${MULTI} ערוך`);
  await answer(s, false);
  await back(page);
  assert((await dialogs(s)).at(-1) === HE.unsavedLeave, `dirty form → confirm on back (${(await dialogs(s)).at(-1)})`);
  assert((await mode(page)) === 'workspace' && (await nameInput(page).inputValue()) === `${MULTI} ערוך`, 'Cancel keeps the site and the edit');
  await page.click('[data-action="site-switcher"]');
  await page.locator('[data-action="switch-site"]', { hasText: STANDARD }).click();
  assert((await dialogs(s)).length === 2 && (await page.textContent('[data-part="site-name"]')) === MULTI, 'dirty form → confirm on switch; Cancel stays');
  await page.click(`.admin-nav-btn:has-text("קטגוריות")`);
  assert((await dialogs(s)).length === 3 && (await mode(page)) === 'workspace' && (await nameInput(page).inputValue()) === `${MULTI} ערוך`, 'dirty form → confirm on Admin nav; Cancel keeps the edit');
  await nameInput(page).fill(MULTI);
  await back(page);
  assert((await dialogs(s)).length === 3 && (await mode(page)) === 'catalog', 'edit reverted → no confirm');
  await openSite(page, MULTI);
  await nameInput(page).fill(`${MULTI} ערוך`);
  await answer(s, true);
  await back(page);
  assert((await dialogs(s)).length === 4 && (await mode(page)) === 'catalog', 'OK leaves the site');

  await openSite(page, MULTI);
  if (await page.$('[data-tab="login"]')) await tab(page, 'login');
  await page.click('[data-action="special-remove-field"]');
  await answer(s, false);
  await back(page);
  assert((await dialogs(s)).length === 5 && (await mode(page)) === 'workspace', 'dirty SPECIAL draft → confirm on back');
  await answer(s, true);
  await back(page);
  assert((await dialogs(s)).length === 6 && (await mode(page)) === 'catalog', 'OK leaves (SPECIAL draft)');

  await openSite(page, STANDARD);
  await nameInput(page).fill(`${STANDARD} חדש`);
  await page.click('form.admin-edit-shell button[type="submit"]');
  await page.waitForSelector('.admin-success');
  await page.waitForTimeout(150);
  await back(page);
  assert((await dialogs(s)).length === 6 && (await mode(page)) === 'catalog', `saved → no confirm (${(await dialogs(s)).length})`);

  await page.click('[data-action="new-site"]');
  await nameInput(page).fill('אתר בדיקה');
  await answer(s, false);
  await page.click(`.admin-nav-btn:has-text("קטגוריות")`);
  assert((await dialogs(s)).length === 7 && (await mode(page)) === 'workspace', 'create form with input → confirm on Admin nav');
  await answer(s, true);
  await page.click(`.admin-nav-btn:has-text("קטגוריות")`);
  await page.waitForTimeout(100);
  assert((await page.$$('section.admin-section--registry')).length === 0, 'OK → Admin nav leaves');
  await close(s);
  return 'unsaved guard: dirty form (back / switcher / Admin nav) and dirty SPECIAL draft ask; Cancel keeps site + edits; clean, reverted and saved states do not ask';
}

// ─── 122.2 checks ─────────────────────────────────────────────────────────────
const TAB_LABELS = ['פרטי אתר', 'הגדרת כניסה ומילוי', 'בדיקה והפעלה', 'הערות'];
const panelShown = (page, id) => visible(page, `[data-tab-panel="${id}"]`);

async function checkTabs(dir) {
  const s = await openApp(dir);
  const { page } = s;
  await openSite(page, MULTI);
  const labels = await page.$$eval('[data-tab]', (els) => els.map((e) => e.textContent));
  assert(JSON.stringify(labels) === JSON.stringify(TAB_LABELS), `four tabs, «הערות» after «בדיקה והפעלה» (${labels.join(' / ')})`);
  assert((await activeTab(page)) === 'details' && (await panelShown(page, 'details')) && !(await panelShown(page, 'login')) && !(await panelShown(page, 'test')), 'site opens on «פרטי אתר»; other panels hidden');
  assert((await visible(page, '[data-part="details-aside"]')) && (await visible(page, '[data-part="more-details"]')) && (await visible(page, '[data-part="details-actions"]')), '«פרטי אתר»: icon / login URL side stack, «פרטים נוספים» and השבת / delete');
  await shot(page, '122-tab-details');

  await nameInput(page).fill(`${MULTI} ערוך`);
  await tab(page, 'login');
  assert(!(await panelShown(page, 'details')) && (await panelShown(page, 'login')) && !(await visible(page, '[data-part="details-aside"]')), '«הגדרת כניסה ומילוי» shown; details hidden');
  for (const sel of ['[data-grid="login-pattern"]', '[data-panel="steps-sidebar"]']) {
    assert(await visible(page, sel), `login tab shows ${sel}`);
  }
  const mappedBefore = await page.$$eval('[data-action="special-remove-field"]', (els) => els.length);
  await page.click('[data-action="special-remove-field"]');
  await page.waitForTimeout(80);
  const mappedAfter = await page.$$eval('[data-action="special-remove-field"]', (els) => els.length);
  assert(mappedAfter === mappedBefore - 1, `SPECIAL draft edit applied (${mappedBefore} → ${mappedAfter})`);
  await page.click('[data-action="special-visual-field"]');
  await page.waitForFunction(() => document.querySelector('[data-tab-panel="login"]')?.textContent.includes('ממתין ללחיצה על השדה'), null, { timeout: 3000 });
  await shot(page, '122-tab-login');

  await tab(page, 'test');
  assert((await panelShown(page, 'test')) && (await visible(page, '[data-section="fill-test-grid"]')), '«בדיקה והפעלה» shows «בדיקת מילוי»');
  assert(await visible(page, '[data-tab-panel="test"] [data-status="mapping-status"]'), '«בדיקה והפעלה» shows the mapping status line');
  await shot(page, '122-tab-test');
  await tab(page, 'details');
  assert((await nameInput(page).inputValue()) === `${MULTI} ערוך`, 'form value kept across tab switches');
  await tab(page, 'login');
  assert((await page.$$eval('[data-action="special-remove-field"]', (els) => els.length)) === mappedAfter, 'SPECIAL draft kept across tab switches');
  assert((await page.textContent('[data-tab-panel="login"]')).includes('ממתין ללחיצה על השדה'), 'armed Visual pick kept across tab switches');
  for (const t of ['details', 'login', 'test']) {
    await tab(page, t);
    const shown = await visible(page, '[data-part="save-bar"] button[type="submit"]');
    assert(shown === (t === 'details'), `122.5 R1: save bar ${t === 'details' ? 'shown' : 'not shown'} on «${t}» (${shown})`);
  }
  await close(s);

  const f = await openApp(dir);
  await openSite(f.page, STANDARD);
  await tab(f.page, 'test');
  const inputs = f.page.locator('[data-tab-panel="test"] [data-temp-test-field]');
  const n = await inputs.count();
  assert(n > 0, 'STANDARD fill test inputs shown');
  for (let i = 0; i < n; i += 1) await inputs.nth(i).fill(`v${i}`);
  await f.page.click('[data-action="managed-test"]');
  await f.page.waitForFunction(() => document.querySelector('[data-action="managed-test"]')?.textContent === 'ממלא…', null, { timeout: 3000 });
  await tab(f.page, 'details');
  await tab(f.page, 'login');
  await tab(f.page, 'test');
  assert((await f.page.textContent('[data-action="managed-test"]')) === 'ממלא…', 'running fill test kept across tab switches');
  for (let i = 0; i < n; i += 1) assert((await inputs.nth(i).inputValue()) === `v${i}`, 'fill test values kept across tab switches');
  await close(f);
  return 'tabs: «פרטי אתר» / «הגדרת כניסה ומילוי» / «בדיקה והפעלה» per §4.3; form value, SPECIAL draft, armed Visual pick and running fill test survive tab switches; save bar only on «פרטי אתר» (122.5)';
}

async function checkTabRules(dir) {
  const s = await openApp(dir);
  const { page } = s;
  await page.click('[data-action="new-site"]');
  const disabled = await page.$$eval('[data-tab]', (els) => els.map((e) => `${e.getAttribute('data-tab')}:${e.disabled}`));
  assert(JSON.stringify(disabled) === JSON.stringify(['details:false', 'login:true', 'test:true', 'notes:true']), `create mode: only «פרטי אתר» enabled (${disabled.join(' ')})`);
  assert(await visible(page, '[data-hint="create-only-tabs"]'), 'create mode: hint for the disabled tabs');
  assert(await visible(page, 'label.admin-field:has-text("פרטי כניסה") select'), 'create mode: today\'s credential section still shown');
  assert(!(await page.$('[data-grid="login-pattern"]')) && !(await page.$('[data-section="fill-test-grid"]')), 'create mode: no authoring / fill test (as today)');
  await shot(page, '122-create');
  await back(page);

  await openSite(page, USER_OWNED);
  await tab(page, 'login');
  assert((await visible(page, '[data-hint="user-owned-login"]')) && !(await page.$('label.admin-field:has-text("פרטי כניסה") select')), 'user-owned: no authoring on «הגדרת כניסה ומילוי»');
  await tab(page, 'test');
  assert((await visible(page, '[data-hint="user-owned-test"]')) && !(await page.$('[data-section="fill-test-grid"]')), 'user-owned: no fill test on «בדיקה והפעלה»');
  await back(page);

  await openSite(page, MULTI);
  await nameInput(page).fill('');
  await tab(page, 'login');
  // 122.5: no save button on this tab; a submit from here (e.g. Enter) still validates the form.
  await page.evaluate(() => document.querySelector('form.admin-edit-shell').requestSubmit());
  await page.waitForTimeout(120);
  assert((await activeTab(page)) === 'details', 'save with an invalid hidden field → «פרטי אתר» shown');
  assert((await page.evaluate(() => globalThis.__writes.length)) === 0, 'invalid form → nothing written');
  await answer(s, true);
  await close(s);
  return 'tab rules: create mode only «פרטי אתר» (+ today\'s credential section) with a hint; user-owned keeps no authoring / no fill test; invalid hidden field brings «פרטי אתר» forward';
}

// Same user actions on the pre-phase RegistryAdmin and the current one; the recorded writes must match.
async function saveScenarios(dir, visitTab, { baseline = false } = {}) {
  const s = await openApp(dir, { allowNative: baseline });
  const { page } = s;
  const tabbed = async (id) => {
    if (await page.$(`[data-tab="${id}"]:not([disabled])`)) await tab(page, id);
  };
  const open = async (name) => {
    if (await page.$('[data-action="back-to-catalog"]')) await back(page);
    await page.locator('.admin-site-card', { hasText: name }).click();
    await page.waitForFunction((n) => {
      const input = [...document.querySelectorAll('label.admin-field')].find((l) => l.textContent.includes('שם האתר'))?.querySelector('input');
      return input?.value === n;
    }, name);
    await page.waitForTimeout(80);
  };
  const save = async () => {
    const before = await page.evaluate(() => globalThis.__writes.length);
    // 122.5 R1: visit the tab after the edits, then save from «פרטי אתר» (the only save bar).
    await tabbed(visitTab);
    await tabbed('details');
    await page.click('form.admin-edit-shell button[type="submit"]');
    await page.waitForFunction((n) => globalThis.__writes.length > n, before);
    await page.waitForTimeout(120);
    return page.evaluate(() => JSON.stringify(globalThis.__writes.splice(0)));
  };
  const category = () => page.locator('label.admin-field', { hasText: /^קטגוריה/ }).locator('select');
  const out = {};
  await open(MULTI);
  await nameInput(page).fill(`${MULTI} 2`);
  await category().selectOption('cat-b');
  out.multi = await save();
  await open(STANDARD);
  await tabbed('details');
  await page.locator('label.admin-field', { hasText: 'פרטי כניסה' }).locator('select').selectOption('no_stored_credentials');
  await page.waitForTimeout(80);
  await nameInput(page).fill(`${STANDARD} 2`);
  out.standardCredentialMode = await save();
  await open(USER_OWNED);
  await nameInput(page).fill(`${USER_OWNED} 2`);
  out.userOwned = await save();
  if (await page.$('[data-action="back-to-catalog"]')) await back(page);
  await page.locator('.admin-toolbar button', { hasText: 'אתר חדש' }).click();
  await nameInput(page).fill('אתר חדש לבדיקה');
  await page.locator('.admin-field', { hasText: 'כתובת הבית' }).locator('input').first().fill('https://fresh.example.test/');
  // G-122-12: a new site has no category until chosen (the pre-phase form pre-selected the first, cat-a).
  await category().selectOption('cat-a');
  out.create = await save();
  await close(s);
  return out;
}

let baselineWrites = null;
async function checkSavePayload(dir) {
  if (!baselineWrites) {
    // 122.7 removed LoginUrlRefresh (its own save path, not part of the service form payload).
    baselineWrites = await withHarness(
      { 'src/admin/RegistryAdmin.tsx': read('scripts/lib/phase122-baseline/RegistryAdmin.tsx.txt') },
      { './LoginUrlRefresh': 'export default function LoginUrlRefresh() { return null; }' },
      (baseDir) => saveScenarios(baseDir, 'details', { baseline: true }),
    );
    for (const [k, v] of Object.entries(baselineWrites)) assert(v.length > 2, `fixture: baseline scenario ${k} wrote nothing`);
  }
  for (const t of ['details', 'login', 'test']) {
    const now = await saveScenarios(dir, t);
    for (const k of Object.keys(baselineWrites)) {
      assert(now[k] === baselineWrites[k], `save after visiting «${t}» (${k}) = pre-phase payload\n  before: ${baselineWrites[k]}\n  now:    ${now[k]}`);
    }
  }
  return `save payload snapshot equality vs pre-phase RegistryAdmin after visiting every tab, saved from «פרטי אתר» (${Object.keys(baselineWrites).join(', ')})`;
}

// ─── 122.3 checks ─────────────────────────────────────────────────────────────
const sel = {
  radios: '[data-action="login-pattern"] input[type="radio"]',
  sidebar: '[data-panel="steps-sidebar"]',
  oldStepSelect: '[data-field="special-current-step"]',
  items: '[data-action="special-select-step"]',
  current: '[data-action="special-select-step"][aria-current="step"]',
  rows: '[data-panel="step-fields"] > li',
  main: '[data-panel="step-main"]',
};

async function checkMultiStepLayout(dir) {
  const s = await openApp(dir);
  const { page } = s;
  await openSite(page, MULTI);
  await tab(page, 'login');

  const radioState = () => page.$$eval(sel.radios, (els) => els.map((e) => `${e.value}:${e.checked ? 'on' : 'off'}:${e.disabled ? 'disabled' : 'enabled'}`));
  const before = await radioState();
  // 122.5 R2: the cards open via «שינוי אופי הכניסה» (saved draft → the warning is confirmed first).
  await page.click('[data-action="change-login-pattern"]');
  await page.waitForSelector('[data-action="login-pattern"]', { state: 'visible', timeout: 3000 });
  await page.locator(`${sel.radios}[value="FLOATING_SCREEN_MULTI_STEP"]`).click({ force: true });
  await page.locator('[data-pattern="FLOATING_SCREEN_MULTI_STEP"]').click({ force: true });
  await page.waitForTimeout(80);
  assert((await page.$eval(`${sel.radios}[value="MULTI_STEP"]`, (e) => e.checked)) && !(await page.$eval(`${sel.radios}[value="FLOATING_SCREEN_MULTI_STEP"]`, (e) => e.checked)), '«שילוב» not selectable (click keeps «רב־שלבים»)');
  assert((await page.textContent('[data-grid="special-mapping"] .admin-panel-title')) === 'מיפוי כניסה רב־שלבית', 'multi-step grid unchanged after clicking «שילוב»');
  assert(JSON.stringify(before) === JSON.stringify(['STANDARD:off:enabled', 'FLOATING_SCREEN:off:enabled', 'MULTI_STEP:on:enabled', 'FLOATING_SCREEN_MULTI_STEP:off:disabled']), `pattern radio row; «שילוב» shown disabled (${before.join(' ')})`);
  await page.click('[data-action="close-login-pattern"]');

  assert((await page.textContent(`${sel.sidebar} h4`)) === 'שלבי התהליך', 'sidebar «שלבי התהליך»');
  const items = await page.$$eval(sel.items, (els) => els.map((e) => e.textContent));
  assert(JSON.stringify(items) === JSON.stringify(['שלב 11/2 שדות · כפתור נבחר', 'שלב 21/2 שדות · שלב אחרון']), `sidebar items + short status (${items.join(' | ')})`);
  // G-122-1: the sidebar replaces «שלב נוכחי»; the selected step is read from what the step panel shows.
  assert((await page.$$(sel.oldStepSelect)).length === 0 && (await page.$$(`${sel.sidebar} select`)).length === 0 && !(await page.textContent('[data-grid="special-mapping"]')).includes('שלב נוכחי'), 'no «שלב נוכחי» select (the sidebar replaces it)');
  const stepState = async () => ({
    current: await page.getAttribute(sel.current, 'data-step-id'),
    panel: `step-${Number(await page.getAttribute(`${sel.main} [data-panel="step-exit"]`, 'data-step-index')) + 1}`,
  });
  let st = await stepState();
  assert(st.current === 'step-1' && st.panel === 'step-1', `sidebar follows the selected step (${JSON.stringify(st)})`);
  await page.click(`${sel.items}[data-step-id="step-2"]`);
  st = await stepState();
  assert(st.panel === 'step-2', `sidebar click drives the selected step (${JSON.stringify(st)})`);
  assert(st.current === 'step-2', `sidebar follows the selected step after a change (${JSON.stringify(st)})`);
  assert(await page.$(`${sel.main} [data-panel="step-exit"]`), 'step button card shown in the step panel');
  assert((await page.textContent('[data-panel="step-exit"] [data-status="step-exit-selection"]')) === 'שלב אחרון — אין כפתור מעבר', 'step 2: last-step text');
  assert((await page.textContent(`${sel.rows}:nth-child(2)`)).includes('#pass'), 'step 2: fields table shows the step-2 mapping');
  await page.click(`${sel.items}[data-step-id="step-1"]`);
  st = await stepState();
  assert(st.current === 'step-1' && st.panel === 'step-1', `back to step 1 via the sidebar (${JSON.stringify(st)})`);

  const head = await page.$$eval('.admin-special-field-table-head span', (els) => els.map((e) => e.textContent));
  assert(JSON.stringify(head) === JSON.stringify(['שדה', 'מיפוי', 'פעולות']), `fields table header (${head.join(' | ')})`);
  const rows = await page.$$eval(sel.rows, (els) => els.map((e) => e.textContent));
  assert(rows.length === 2 && rows[0].includes('#user') && rows[0].includes('מיפוי חזותי') && rows[0].includes('הסר מיפוי'), `row 1: name | locator + location | «מיפוי חזותי», «הסר מיפוי» (${rows[0]})`);
  assert(rows[1].includes('—') && !rows[1].includes('הסר מיפוי'), `row 2 unmapped: «—», no «הסר מיפוי» (${rows[1]})`);
  const card = await page.$$eval(`${sel.main} [data-panel="step-exit"] [data-action]`, (els) => els.map((e) => e.getAttribute('data-action')));
  assert(['authoring-continue-click', 'reject-action', 'special-remap-step-exit'].every((a) => card.includes(a)), `step button card: D-121-67 A/E controls (${card.join(', ')})`);
  assert((await page.textContent(`${sel.main} [data-panel="step-exit"]`)).includes('#next'), 'step button card shows the saved exit');
  const order = await page.$eval(sel.main, (main) => {
    const pos = (q) => [...main.querySelectorAll('*')].indexOf(main.querySelector(q));
    return [pos('[data-action="special-analyze-current-tab"]'), pos('[data-panel="step-fields"]'), pos('[data-panel="step-exit"]'), pos('[data-status="mapping-completeness"]')];
  });
  // G-122-9: fields table and button card are side by side (button card first in the DOM, start side).
  const [analyzeAt, fieldsAt, exitAt, completeAt] = order;
  assert(order.every((p) => p >= 0) && analyzeAt < fieldsAt && analyzeAt < exitAt && Math.max(fieldsAt, exitAt) < completeAt, `step panel: Analyze / manual pick → fields table + button card → completeness (${order.join(', ')})`);
  const loginText = await page.textContent('[data-tab-panel="login"]');
  for (const excluded of ['הוסף שלב', 'הוסף פעולה', 'שכפל', 'סדר מחדש']) assert(!loginText.includes(excluded), `excluded mockup item absent: «${excluded}»`);
  const side = await rect(page, sel.sidebar);
  const main = await rect(page, sel.main);
  assert(side.x > main.x, `RTL: sidebar right of the step panel (sidebar ${Math.round(side.x)}, panel ${Math.round(main.x)})`);
  await page.locator(sel.sidebar).scrollIntoViewIfNeeded();
  await shot(page, '122-multi-step');
  await close(s);

  const adminApp = read('src/admin/AdminApp.tsx');
  assert(adminApp.includes('ADMIN_WORKSPACE_HE.registryNav') && read('src/admin/adminWorkspace.ts').includes("registryNav: 'הגדרת אתרים'"), 'static: Admin nav label from ADMIN_WORKSPACE_HE.registryNav (verifyPhase107Admin re-pointed check)');
  return 'multi-step layout: pattern radio row with «שילוב» disabled; «שלבי התהליך» sidebar replaces «שלב נוכחי» (no select) and drives / follows the selected step, with short per-step status; fields table (name | locator + location / «—» | «מיפוי חזותי», «הסר מיפוי»); step button card with the D-121-67 A/E controls / last-step text; Analyze, completeness attached; no excluded mockup items';
}

// G-122-2 — the sticky save bar never covers a control: at scroll end, and when any control is
// scrolled into view (focus / scrollIntoView), on every tab.
async function saveBarOverlaps(page, panelId, mode) {
  return page.evaluate(
    ({ panelId, mode }) => {
      const body = document.querySelector('.admin-workspace-body');
      const bar = document.querySelector('[data-part="save-bar"]');
      const panel = document.querySelector(`[data-tab-panel="${panelId}"]`);
      // Collapsed <details> content keeps layout boxes; checkVisibility() excludes it.
      const shown = (el) => el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
      const controls = [...panel.querySelectorAll('button, input, select, textarea, summary')].filter(shown);
      const describe = (el) => `${el.tagName.toLowerCase()}${el.dataset.action ? `[${el.dataset.action}]` : ''} «${(el.textContent || el.value || '').trim().slice(0, 30)}»`;
      const hit = (el) => {
        const r = el.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        const intersects = r.bottom > b.top + 0.5 && r.top < b.bottom - 0.5 && r.right > b.left && r.left < b.right;
        const atPoint = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        // Hit-testing skips disabled form controls and returns their container instead.
        const clickable =
          atPoint === el ||
          el.contains(atPoint) ||
          (el.disabled === true && atPoint !== null && !bar.contains(atPoint) && atPoint.contains(el));
        const onTopRect = atPoint?.getBoundingClientRect();
        const onTop = atPoint
          ? `${atPoint.tagName.toLowerCase()}.${String(atPoint.className).replace(/ /g, '.')} ${Math.round(onTopRect.top)}–${Math.round(onTopRect.bottom)}${atPoint === bar ? ' (save bar)' : ''}`
          : 'nothing';
        return intersects || !clickable ? `${describe(el)} (control ${Math.round(r.top)}–${Math.round(r.bottom)}, bar ${Math.round(b.top)}–${Math.round(b.bottom)}, clickable ${clickable}${clickable ? '' : ` — on top: ${onTop}`})` : null;
      };
      const bad = [];
      if (mode === 'end') {
        body.scrollTop = body.scrollHeight;
        const last = controls.reduce((a, el) => (!a || el.getBoundingClientRect().bottom >= a.getBoundingClientRect().bottom ? el : a), null);
        const h = last && hit(last);
        if (h) bad.push(h);
      } else {
        for (const el of controls) {
          body.scrollTop = 0;
          el.scrollIntoView({ block: 'nearest' });
          const h = hit(el);
          if (h) bad.push(h);
        }
      }
      const reserved = parseFloat(getComputedStyle(body).scrollPaddingBottom) || 0;
      const barHeight = bar.getBoundingClientRect().height;
      if (reserved + 0.5 < barHeight) bad.push(`reserved bottom space ${reserved}px < bar height ${Math.round(barHeight)}px`);
      return bad;
    },
    { panelId, mode },
  );
}

async function checkSaveBarSpace(dir) {
  for (const width of [1280, 1920]) {
    const s = await openApp(dir, { width, height: 900 });
    const { page } = s;
    await openSite(page, MULTI);
    for (const t of ['details', 'login', 'test']) {
      await tab(page, t);
      for (const m of ['end', 'into-view']) {
        const bad = await saveBarOverlaps(page, t, m);
        assert(bad.length === 0, `${width}px «${t}» ${m === 'end' ? 'at scroll end' : 'scrolled into view'}: control under the save bar — ${bad.slice(0, 2).join('; ')}`);
      }
    }
    await tab(page, 'login');
    await page.evaluate(() => {
      const body = document.querySelector('.admin-workspace-body');
      body.scrollTop = body.scrollHeight;
    });
    await page.waitForTimeout(80);
    await shot(page, `122-multi-step-end-${width}`);
    await page.evaluate(() => {
      document.querySelector('.admin-workspace-body').scrollTop = 0;
      document.querySelector('[data-panel="step-exit"] [data-action="reject-action"]').scrollIntoView({ block: 'nearest' });
    });
    await page.waitForTimeout(80);
    await shot(page, `122-step-card-into-view-${width}`);
    await close(s);
  }
  return 'save bar: at 1280 / 1920, on every tab, the last control at scroll end and every control scrolled into view stay clear of «שמור / ביטול» and clickable; reserved bottom space ≥ bar height';
}

// ─── 122.4 checks ─────────────────────────────────────────────────────────────
const CAP = { input: 560, short: 420, content: 1440, categories: 960 };

// Horizontal overflow (document, main, the page scroller, any element outside main), nested
// vertical scroll areas other than the page scroller, and the control width caps inside `scopeSel`.
async function audit(page, scopeSel, scrollerSel) {
  return page.evaluate(
    ({ scopeSel, scrollerSel, CAP }) => {
      const bad = [];
      const doc = document.documentElement;
      if (doc.scrollWidth > doc.clientWidth + 1) bad.push(`overflow: document scrollWidth ${doc.scrollWidth} > ${doc.clientWidth}`);
      const main = document.querySelector('.admin-app-main');
      if (main.scrollWidth > main.clientWidth + 1) bad.push(`overflow: main scrollWidth ${main.scrollWidth} > ${main.clientWidth}`);
      const scope = document.querySelector(scopeSel);
      if (!scope) return [`missing ${scopeSel}`];
      const scroller = scrollerSel ? document.querySelector(scrollerSel) : null;
      if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) bad.push(`overflow: ${scrollerSel} scrollWidth ${scroller.scrollWidth} > ${scroller.clientWidth}`);
      const shown = (el) => el.checkVisibility({ visibilityProperty: true });
      const name = (el) =>
        `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${el.dataset?.action ? `[${el.dataset.action}]` : ''}`;
      const m = main.getBoundingClientRect();
      const all = [...scope.querySelectorAll('*')].filter(shown);
      let outside = 0;
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || el.closest('.admin-sr-only')) continue;
        if ((r.left < m.left - 1 || r.right > m.right + 1) && outside++ < 3) bad.push(`overflow: ${name(el)} spans ${Math.round(r.left)}–${Math.round(r.right)}, main ${Math.round(m.left)}–${Math.round(m.right)}`);
        if (el !== scroller && /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1) bad.push(`nested scroll: ${name(el)} (${el.scrollHeight} > ${el.clientHeight})`);
        const label = () => (el.closest('label')?.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 24);
        if (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea')) {
          const cap = el.matches('[data-temp-test-field], .admin-field--short input') ? CAP.short : CAP.input;
          if (r.width > cap + 0.5) bad.push(`input cap: ${name(el)} «${label()}» ${Math.round(r.width)}px > ${cap}px`);
        } else if (el.matches('select') && r.width > CAP.short + 0.5) {
          bad.push(`select cap: «${label()}» ${Math.round(r.width)}px > ${CAP.short}px`);
        }
      }
      return bad;
    },
    { scopeSel, scrollerSel, CAP },
  );
}

async function saveBarAudit(page) {
  return page.evaluate(() => {
    const body = document.querySelector('.admin-workspace-body');
    const bar = document.querySelector('[data-part="save-bar"]');
    const bad = [];
    const cs = getComputedStyle(bar);
    const parts = (cs.backgroundColor.match(/rgba?\(([^)]+)\)/)?.[1] ?? '0 0 0 0').split(/[\s,/]+/).filter(Boolean);
    if (parts.length > 3 && Number(parts[3]) < 1) bad.push(`not opaque (${cs.backgroundColor})`);
    if (cs.boxShadow === 'none') bad.push('no top shadow');
    for (const where of ['top', 'end']) {
      body.scrollTop = where === 'top' ? 0 : body.scrollHeight;
      const b = bar.getBoundingClientRect();
      const r = body.getBoundingClientRect();
      const innerBottom = r.bottom - parseFloat(getComputedStyle(body).borderBottomWidth);
      if (Math.abs(b.bottom - innerBottom) > 1) bad.push(`${where}: bar bottom ${Math.round(b.bottom)} ≠ workspace bottom ${Math.round(innerBottom)} (not flush)`);
      if (Math.abs(b.width - body.clientWidth) > 1) bad.push(`${where}: bar width ${Math.round(b.width)} ≠ workspace width ${body.clientWidth}`);
    }
    body.scrollTop = 0;
    return bad;
  });
}

const boxes = (page, selectors) =>
  page.evaluate((selectors) => {
    const out = {};
    for (const [k, q] of Object.entries(selectors)) {
      const el = document.querySelector(q);
      const r = el && el.checkVisibility() ? el.getBoundingClientRect() : null;
      out[k] = r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width } : null;
    }
    return out;
  }, selectors);

const gridColumns = (page, gridSel) =>
  page.$eval(gridSel, (grid) => {
    const cells = [...grid.children].filter((c) => c.checkVisibility());
    const top = cells[0]?.getBoundingClientRect().top ?? 0;
    return new Set(cells.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 2).map((c) => Math.round(c.getBoundingClientRect().left))).size;
  });

async function auditWorkspace(page, width, label) {
  const bad = await audit(page, '.admin-workspace', '.admin-workspace-body');
  assert(bad.length === 0, `${width}px ${label}: ${bad.slice(0, 3).join('; ')}`);
}

async function checkReadableWidths(dir) {
  for (const width of [1280, 1440, 1920]) {
    const s = await openApp(dir, { width, height: 900 });
    const { page } = s;
    const catalogBad = await audit(page, 'section.admin-section--registry', '.admin-catalog');
    assert(catalogBad.length === 0, `${width}px catalog: ${catalogBad.slice(0, 3).join('; ')}`);
    await shot(page, `122-4-catalog-${width}`);

    await openSite(page, MULTI);
    const geo = await boxes(page, { main: '.admin-app-main', ws: '.admin-workspace' });
    const gapStart = geo.ws.left - geo.main.left;
    const gapEnd = geo.main.right - geo.ws.right;
    assert(geo.ws.width <= CAP.content + 0.5 && Math.abs(gapStart - gapEnd) <= 2 && gapStart >= 24, `${width}px: workspace ≤ ${CAP.content}px, centered, ≥ 24px side padding (width ${Math.round(geo.ws.width)}, gaps ${Math.round(gapStart)} / ${Math.round(gapEnd)})`);

    for (const t of ['details', 'login', 'test']) {
      await tab(page, t);
      await auditWorkspace(page, width, `MULTI «${t}»`);
      if (t === 'details') {
        const bar = await saveBarAudit(page);
        assert(bar.length === 0, `${width}px «${t}» save bar: ${bar.join('; ')}`);
        const over = await saveBarOverlaps(page, t, 'end');
        assert(over.length === 0, `${width}px «${t}» at scroll end: control under the save bar — ${over[0]}`);
      } else {
        assert(!(await visible(page, '[data-part="save-bar"]')), `${width}px «${t}»: no save bar (122.5 R1)`);
      }
      if (t === 'login') await shot(page, `122-4-login-multi-${width}`);
    }

    await tab(page, 'details');
    assert((await gridColumns(page, '[data-tab-panel="details"] .admin-field-grid')) === 2, `${width}px «פרטי אתר»: 2-column field grid`);
    const d = await boxes(page, { cols: '.admin-workspace-columns', main: '[data-part="details-main"]', aside: '[data-part="details-aside"]', danger: '[data-part="danger-zone"]' });
    const share = (b) => b.width / d.cols.width;
    assert(d.main && d.aside && share(d.main) > 0.62 && share(d.main) < 0.7 && share(d.aside) > 0.28 && share(d.aside) < 0.36 && Math.abs(d.main.top - d.aside.top) < 2 && d.aside.left < d.main.left, `${width}px «פרטי אתר»: main card 8 cols | side stack 4 cols (main ${d.main && share(d.main).toFixed(2)}, side ${d.aside && share(d.aside).toFixed(2)})`);
    assert(d.danger && d.danger.top > d.main.bottom, `${width}px «פרטי אתר»: «אזור מסוכן» card below the main card`);
    const danger = await page.textContent('[data-part="danger-zone"]');
    assert(danger.includes('אזור מסוכן') && danger.includes('השבת') && danger.includes('מחיקת אתר'), `«אזור מסוכן» holds השבת / «מחיקת אתר» (${danger})`);
    assert(!(await page.textContent('[data-part="details-main"]')).includes('השבת'), 'השבת not in the main card');
    await shot(page, `122-4-details-${width}`);

    await tab(page, 'test');
    const tl = await boxes(page, { run: '[data-part="fill-test-run"]', result: '[data-part="fill-test-result"]' });
    assert(tl.run && tl.result && Math.abs(tl.run.top - tl.result.top) < 2 && tl.result.left < tl.run.left, `${width}px «בדיקה והפעלה»: fill-test card | result + status card`);
    assert(await visible(page, '[data-part="fill-test-result"] [data-status="mapping-status"]'), '«בדיקה והפעלה»: status line in the result card');
    await shot(page, `122-4-test-multi-${width}`);
    await back(page);

    await openSite(page, STANDARD);
    for (const t of ['login', 'test']) {
      await tab(page, t);
      await auditWorkspace(page, width, `STANDARD «${t}»`);
    }
    await shot(page, `122-4-test-standard-${width}`);
    await tab(page, 'login');
    await shot(page, `122-4-login-standard-${width}`);
    await tab(page, 'details');
    const cards = await gridColumns(page, '[data-tab-panel="details"] .admin-credential-field-list');
    const card = await boxes(page, { card: '[data-tab-panel="details"] .admin-credential-field' });
    assert(cards >= 2 && card.card.width <= 380, `${width}px credential fields on «פרטי אתר»: card grid (${cards} per row, ${Math.round(card.card.width)}px per field)`);
    await shot(page, `122-5-details-standard-${width}`);
    await back(page);
    await close(s);
  }

  for (const width of [900, 360]) {
    const s = await openApp(dir, { width, height: 800 });
    const { page } = s;
    const catalogBad = await audit(page, 'section.admin-section--registry', '.admin-catalog');
    assert(catalogBad.length === 0, `${width}px catalog: ${catalogBad.slice(0, 3).join('; ')}`);
    await shot(page, `122-4-catalog-${width}`);
    for (const name of [MULTI, STANDARD]) {
      await openSite(page, name);
      for (const t of ['details', 'login', 'test']) {
        await tab(page, t);
        await auditWorkspace(page, width, `${name === MULTI ? 'MULTI' : 'STANDARD'} «${t}»`);
      }
      await tab(page, 'details');
      assert((await gridColumns(page, '[data-tab-panel="details"] .admin-field-grid')) === 1, `${width}px «פרטי אתר»: 1-column field grid`);
      const d = await boxes(page, { panel: '[data-tab-panel="details"]', aside: '[data-part="details-aside"]' });
      assert(d.aside.top >= d.panel.bottom - 1, `${width}px «פרטי אתר»: side stack below the main column`);
      if (name === MULTI && width === 360) await shot(page, '122-4-details-360');
      await tab(page, 'test');
      const tl = await boxes(page, { run: '[data-part="fill-test-run"]', result: '[data-part="fill-test-result"]' });
      assert(tl.result.top >= tl.run.bottom - 1, `${width}px «בדיקה והפעלה»: result card below the fill-test card`);
      await back(page);
    }
    await close(s);
  }
  return 'readable widths: 1280 / 1440 / 1920 — workspace ≤ 1440px centered with side padding; every input ≤ 560px, selects / short fields / fill-test inputs ≤ 420px; no horizontal overflow; one scroll per tab; save bar (only «פרטי אתר») opaque, flush, full width, last control clear; «פרטי אתר» 8 | 4 with 2-column field grid and «אזור מסוכן»; test tab 2 columns; credential fields card grid on «פרטי אתר»; 900 / 360 — no overflow, 1-column fallback';
}

async function checkCategoriesTable(dir) {
  for (const width of [1280, 1440, 1920, 360]) {
    const s = await openApp(dir, { width, height: 900 });
    const { page } = s;
    await page.click('.admin-nav-btn:has-text("קטגוריות")');
    await page.waitForSelector('[data-part="category-table"] [data-part="category-row"]');
    const bad = await audit(page, '.admin-section--categories', '.admin-section--categories');
    assert(bad.length === 0, `${width}px «קטגוריות»: ${bad.slice(0, 3).join('; ')}`);
    const t = await boxes(page, { table: '[data-part="category-table"]', create: '[data-part="category-create"]', row: '[data-part="category-row"]' });
    assert(t.table.width <= CAP.categories + 0.5, `${width}px «קטגוריות»: table ≤ ${CAP.categories}px (${Math.round(t.table.width)})`);
    assert(t.create.top < t.row.top && t.create.top >= t.table.top, `${width}px «קטגוריות»: «קטגוריה חדשה» inline at the top of the table`);
    if (width >= 1280) {
      // G-122-4: the table is centered in the section's content box (scrollbar gutter excluded).
      const c = await page.evaluate(() => {
        const sec = document.querySelector('.admin-section--categories');
        const cs = getComputedStyle(sec);
        const r = sec.getBoundingClientRect();
        const right = r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
        const left = r.right - parseFloat(cs.borderRightWidth) - sec.clientWidth + parseFloat(cs.paddingLeft);
        const t = document.querySelector('[data-part="category-table"]').getBoundingClientRect();
        return { start: right - t.right, end: t.left - left, width: t.width, content: right - left };
      });
      assert(Math.abs(c.start - c.end) <= 2 && c.content > c.width + 40, `${width}px «קטגוריות»: table centered in the content area (gaps ${Math.round(c.start)} / ${Math.round(c.end)}, table ${Math.round(c.width)} of ${Math.round(c.content)})`);
      const head = await page.$$eval('[data-part="category-table"] [role="columnheader"]', (els) => els.map((e) => e.textContent.trim()));
      assert(JSON.stringify(head) === JSON.stringify(['שם', 'עריכה', 'מחיקה', 'סידור']), `«קטגוריות» columns: name | edit | delete | ↑ ↓ (${head.join(' | ')})`);
      await shot(page, `122-4-categories-${width}`);
    }
    const names = await page.$$eval('[data-part="category-row"] input', (els) => els.map((e) => e.value));
    assert(names.length === 8 && new Set(names).size === 8, `one row per category, one table (${names.length})`);
    assert((await page.$$('.admin-reorder-list, .admin-categories-layout, .admin-category-scroll')).length === 0, '«קטגוריות»: no second list column / inner list scroll');
    if (width === 1440) {
      const writes = async () => page.evaluate(() => globalThis.__writes.splice(0).map((w) => `${w.fn}:${JSON.stringify(w.args)}`));
      const first = page.locator('[data-part="category-row"]').first();
      await first.locator('button[aria-label^="העבר את"][aria-label$="למטה"]').click();
      await page.waitForTimeout(120);
      const moved = await writes();
      assert(moved.length === 1 && moved[0].startsWith('reorderAdminCategories:[["cat-b","cat-a"'), `↓ persists the order (${moved.join(' | ')})`);
      await first.locator('input').fill('כללי 2');
      await first.locator('button', { hasText: 'שמור' }).click();
      await page.waitForTimeout(120);
      const saved = await writes();
      assert(saved.length === 1 && saved[0] === 'updateAdminCategory:["cat-a",{"display_name":"כללי 2"}]', `«שמור» updates the name (${saved.join(' | ')})`);
      await first.locator('button', { hasText: 'מחק' }).click();
      await page.waitForTimeout(120);
      const deleted = await writes();
      assert((await dialogLog(s)).at(-1)?.title === 'למחוק את הקטגוריה?' && deleted.length === 1 && deleted[0] === 'deleteAdminCategory:["cat-a"]', `«מחק» confirms, then deletes (${deleted.join(' | ')})`);
      await page.fill('[data-part="category-create"] input', 'חדשה');
      await page.click('[data-part="category-create"] button[type="submit"]');
      await page.waitForTimeout(120);
      const created = await writes();
      assert(created.length === 1 && created[0].startsWith('createAdminCategory:[{') && created[0].includes('"display_name":"חדשה"'), `«קטגוריה חדשה» creates (${created.join(' | ')})`);
    }
    await close(s);
  }
  return '«קטגוריות»: one table ≤ 960px, centered at 1280 / 1440 / 1920 (G-122-4) (שם | עריכה | מחיקה | סידור) with «קטגוריה חדשה» inline at the top; no second list column, no inner scroll, no overflow (1280 / 1440 / 1920 / 360); ↓ / «שמור» / «מחק» / create write exactly as before';
}

// ─── 122.5 checks ─────────────────────────────────────────────────────────────
const FILLER = 'אתר מילוי 1';
const FILLER_INACTIVE = 'אתר מילוי 3';
const credentialCount = (page) => page.$$eval('[data-tab-panel="details"] .admin-credential-field', (els) => els.length);
const removeButtons = (page) => page.locator('[data-tab-panel="details"] .admin-credential-field-actions .admin-btn-danger');
const writeCount = (page) => page.evaluate(() => globalThis.__writes.length);

async function checkSaveBarOnDetails(dir) {
  const s = await openApp(dir);
  const { page } = s;
  await openSite(page, STANDARD);
  assert(await visible(page, '[data-tab-panel="details"] [data-part="credentials-card"]'), 'R1: «שדות כניסה» card on «פרטי אתר»');
  assert((await page.textContent('[data-tab-panel="details"] [data-part="credentials-card"] .admin-card-title')) === 'שדות כניסה', 'R1: card titled «שדות כניסה»');
  assert(await visible(page, '[data-tab-panel="details"] label.admin-field:has-text("פרטי כניסה") select'), 'R1: «פרטי כניסה» mode select on «פרטי אתר»');
  assert((await credentialCount(page)) === 2, 'R1: CredentialFieldsEditor on «פרטי אתר»');
  const order = await page.$eval('[data-tab-panel="details"]', (panel) => {
    const pos = (q) => [...panel.querySelectorAll('*')].indexOf(panel.querySelector(q));
    return [pos('[data-part="details-main"]'), pos('[data-part="credentials-card"]'), pos('[data-part="danger-zone"]')];
  });
  assert(order[0] >= 0 && order[1] > order[0] && order[2] > order[1], `R1: details card → «שדות כניסה» → «אזור מסוכן» (${order.join(', ')})`);
  await tab(page, 'login');
  assert(!(await page.$('[data-tab-panel="login"] [data-part="credentials-card"]')) && !(await page.$('[data-tab-panel="login"] label.admin-field:has-text("פרטי כניסה")')), 'R1: no credential section on «הגדרת כניסה ומילוי»');
  for (const q of ['[data-grid="login-pattern"]', '[data-tab-panel="login"] .admin-autofill-profile']) assert(await visible(page, q), `R1: «הגדרת כניסה ומילוי» = pattern + mapping (${q})`);
  assert(!(await page.$('[data-notice="details-unsaved"]')), 'R1: no unsaved notice when the details are clean');
  await tab(page, 'test');
  assert(await visible(page, '[data-section="fill-test-grid"]'), 'R1: «בדיקה והפעלה» = fill test + status');

  await tab(page, 'details');
  await nameInput(page).fill(`${STANDARD} ערוך`);
  assert(!(await page.$('[data-notice="details-unsaved"]')), 'R1: no notice on «פרטי אתר» itself');
  for (const t of ['login', 'test']) {
    await tab(page, t);
    assert(await visible(page, '[data-notice="details-unsaved"]'), `R1: unsaved-details notice on «${t}»`);
    assert((await page.textContent('[data-notice="details-unsaved"]')).includes('יש שינויים שלא נשמרו בפרטי האתר'), 'R1: notice text');
    assert(!(await visible(page, '[data-part="save-bar"]')), `R1: no save bar on «${t}»`);
  }
  await shot(page, '122-5-unsaved-notice');
  await page.click('[data-notice="details-unsaved"] [data-action="go-to-details"]');
  await page.waitForTimeout(60);
  assert((await activeTab(page)) === 'details' && (await visible(page, '[data-part="save-bar"] button[type="submit"]')), 'R1: the notice link opens «פרטי אתר» with the save bar');
  await nameInput(page).fill(STANDARD);
  await tab(page, 'login');
  assert(!(await page.$('[data-notice="details-unsaved"]')), 'R1: reverted edit → no notice');

  await tab(page, 'details');
  await credentialFieldEdit(page);
  await tab(page, 'login');
  assert(await visible(page, '[data-notice="details-unsaved"]'), 'R1: credential-field edit counts as unsaved details');
  await tab(page, 'details');
  await page.locator('label.admin-field', { hasText: 'פרטי כניסה' }).locator('select').selectOption('no_stored_credentials');
  await page.waitForTimeout(100);
  await tab(page, 'login');
  assert((await visible(page, '[data-hint="login-needs-fields"]')) && !(await page.$('[data-grid="login-pattern"]')), 'R1: no credential fields → hint, no authoring grids (today\'s condition)');
  await tab(page, 'details');
  await shot(page, '122-5-details-credentials');
  await answer(s, true);
  await close(s);
  return 'R1: «שדות כניסה» card (mode + fields) on «פרטי אתר» between the details card and «אזור מסוכן»; save bar only there; login tab = pattern + mapping, test tab = fill test + status; unsaved-details notice with a link back on the other tabs (form + credential edits), none when clean / reverted; authoring grids keep today\'s condition';
}

async function credentialFieldEdit(page) {
  await page.locator('[data-tab-panel="details"] .admin-credential-field').first().locator('[data-control="label"] input').fill('אימייל ערוך');
  await page.waitForTimeout(40);
}

const patternWarningCases = () => withTempDir('pv-1225-', patternWarningCasesIn);
async function patternWarningCasesIn(outdir) {
  const out = join(outdir, 'cases.mjs');
  await build({
    stdin: {
      contents: `
import * as lc from './src/loginContract/index.ts';
import { patternChangeNeedsWarning } from './src/admin/patternChange.ts';
const map = (fieldId, locator) => ({ fieldId, locatorType: 'css', locator });
const profile = (supportState, locator = '#u') => ({ configVersion: 1, supportState, loginEntryUrl: 'https://x.example.test/login', allowedOrigin: 'https://x.example.test', fieldMappings: [map('username', locator)] });
const draft = lc.upsertStepFieldMappings(lc.ensureSpecialDraft('FLOATING_SCREEN', null), 'step-1', [map('username', '#u')]);
export const cases = {
  noMapping: patternChangeNeedsWarning({ credentialMode: 'credential_fields' }),
  nullMetadata: patternChangeNeedsWarning(null),
  emptyStandardProfile: patternChangeNeedsWarning({ autofillProfile: profile('not_configured', '') }),
  standardSaved: patternChangeNeedsWarning({ autofillProfile: profile('not_configured') }),
  standardApproved: patternChangeNeedsWarning({ autofillProfile: profile('validated') }),
  specialDraft: patternChangeNeedsWarning({ [lc.LOGIN_FLOW_PLAN_META_KEY]: lc.serializeLoginFlowPlanBag({ draft, active: null }) }),
  liveSpecial: patternChangeNeedsWarning({ [lc.LOGIN_CONTRACT_ACTIVATION_META_KEY]: { mode: 'SPECIAL', activePlanVersion: 1 } }),
};`,
      resolveDir: root,
      loader: 'ts',
      sourcefile: 'cases.ts',
    },
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    nodePaths: [join(root, 'node_modules')],
  });
  return (await import(pathToFileURL(out).href)).cases;
}

async function checkPatternChange(dir) {
  const cases = await patternWarningCases();
  const expected = { noMapping: false, nullMetadata: false, emptyStandardProfile: false, standardSaved: true, standardApproved: true, specialDraft: true, liveSpecial: true };
  assert(JSON.stringify(cases) === JSON.stringify(expected), `R2: warning rule — saved STANDARD profile / SPECIAL draft / live contract → warn, otherwise not (${JSON.stringify(cases)})`);

  const s = await openApp(dir);
  const { page } = s;
  const summary = () => page.textContent('[data-grid="login-pattern"] [data-status="login-pattern"]');
  const chooserShown = () => visible(page, '[data-action="login-pattern"]');
  const label = (p) => page.textContent(`[data-pattern="${p}"] span`);

  // No saved mapping → the chooser opens directly.
  await openSite(page, FILLER);
  await tab(page, 'login');
  assert((await page.textContent('[data-part="login-pattern-summary"]')).startsWith('אופי הכניסה:') && (await summary()) === (await label('STANDARD')), `R2: read-only summary «אופי הכניסה: ${await summary()}»`);
  assert(!(await chooserShown()), 'R2: pattern cards hidden until «שינוי אופי הכניסה»');
  await page.click('[data-action="change-login-pattern"]');
  await page.waitForTimeout(80);
  assert((await dialogs(s)).length === 0 && (await chooserShown()), 'R2: no saved mapping → chooser opens directly (no dialog)');
  await shot(page, '122-5-pattern-chooser');
  await page.click('[data-pattern="FLOATING_SCREEN"]');
  await page.waitForTimeout(80);
  assert(!(await chooserShown()) && (await summary()) === (await label('FLOATING_SCREEN')) && (await visible(page, '[data-grid="special-mapping"]')), 'R2: choosing a card closes the chooser; the grid follows (today\'s switch)');
  assert((await page.$$eval('[data-pattern="FLOATING_SCREEN_MULTI_STEP"] input', (els) => els.map((e) => e.disabled))).every(Boolean), 'R2: «שילוב» stays disabled');
  assert((await writeCount(page)) === 0, 'R2: a switch writes nothing');
  await back(page);

  // Saved STANDARD mapping → dialog first; Cancel / Esc keep everything.
  await openSite(page, STANDARD);
  await tab(page, 'login');
  const metaBefore = await page.evaluate(() => JSON.stringify(globalThis.__pvdb.rows.find((r) => r.id === 'svc-plain').metadata));
  await answer(s, null);
  const logged = (await dialogLog(s)).length;
  await page.click('[data-action="change-login-pattern"]');
  await openDialog(page).waitFor({ state: 'visible', timeout: 3000 });
  const d = (await dialogLog(s)).slice(logged);
  assert(d.length === 1 && d[0].name === 'change-login-pattern' && d[0].title === 'לשנות את אופי הכניסה?', `R2: saved mapping → in-app warning first (${JSON.stringify(d)})`);
  assert(d[0].body === PATTERN_DIALOG_BODY, `G-122-5: short dialog copy (${JSON.stringify(d[0].body)})`);
  const buttons = await openDialog(page).locator('button').allTextContents();
  assert(JSON.stringify(buttons) === JSON.stringify(['ביטול', 'שינוי בכל זאת']), `R2: [«שינוי בכל זאת»] / [«ביטול»] (${buttons.join(' / ')})`);
  assert((await page.evaluate(() => document.activeElement?.getAttribute('data-action'))) === 'confirm-cancel', 'R2: «ביטול» focused by default');
  assert(!(await chooserShown()), 'R2: chooser not open behind the warning');
  await shot(page, '122-5-pattern-dialog');
  await openDialog(page).locator('[data-action="confirm-cancel"]').click();
  await page.waitForTimeout(80);
  const metaAfter = await page.evaluate(() => JSON.stringify(globalThis.__pvdb.rows.find((r) => r.id === 'svc-plain').metadata));
  assert(!(await openDialog(page).count()) && !(await chooserShown()) && (await summary()) === (await label('STANDARD')), 'R2: Cancel → no chooser, pattern unchanged');
  assert(metaAfter === metaBefore && (await writeCount(page)) === 0 && (await visible(page, '[data-tab-panel="login"] .admin-autofill-profile')), 'R2: Cancel → stored mapping and grid unchanged, nothing written');
  await page.click('[data-action="change-login-pattern"]');
  await openDialog(page).waitFor({ state: 'visible', timeout: 3000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  assert(!(await openDialog(page).count()) && !(await chooserShown()), 'R2: Esc → cancelled');
  await page.click('[data-action="change-login-pattern"]');
  await openDialog(page).waitFor({ state: 'visible', timeout: 3000 });
  await openDialog(page).locator('[data-action="confirm-accept"]').click();
  await page.waitForTimeout(80);
  assert(await chooserShown(), 'R2: «שינוי בכל זאת» → chooser opens');
  await page.click('[data-pattern="MULTI_STEP"]');
  await page.waitForTimeout(100);
  assert((await summary()) === (await label('MULTI_STEP')) && (await visible(page, '[data-grid="special-mapping"]')) && !(await visible(page, '[data-tab-panel="login"] .admin-autofill-profile')), 'R2: confirm → today\'s switch (SPECIAL grid shown, STANDARD grid hidden)');
  assert((await writeCount(page)) === 0 && (await page.evaluate(() => JSON.stringify(globalThis.__pvdb.rows.find((r) => r.id === 'svc-plain').metadata))) === metaBefore, 'R2: confirmed switch still writes nothing');
  await answer(s, true);
  await close(s);

  const ssrLocked = read('src/admin/LoginPatternGrid.tsx');
  assert(/data-action="change-login-pattern"[\s\S]{0,120}disabled=\{disabled\}/.test(ssrLocked), 'R2: «שינוי אופי הכניסה» uses the same lock (patternSelectorLocked)');
  return 'R2: warning rule (STANDARD profile / SPECIAL draft / live contract → warn); summary «אופי הכניסה: …» + «שינוי אופי הכניסה»; no mapping → chooser directly; saved mapping → in-app warning first (short G-122-5 copy, «ביטול» focused); Cancel / Esc → pattern, mapping and grid unchanged, nothing written; confirm → switch; «שילוב» disabled';
}

const PATTERN_DIALOG_BODY = [
  'לאתר הזה כבר יש מיפוי שמור. השינוי לא מוחק אותו — הוא יוחלף רק אחרי «שמור מיפוי» באופי הכניסה החדש.',
  'המשתמשים ממשיכים לקבל את המיפוי המאושר עד «אשר מיפוי».',
  'חריג: שמירת שינוי במיפוי רגיל שכבר אושר עוצרת את המילוי אצל המשתמשים עד שיאושר שוב.',
].join('\n');

async function checkPatternReturn(dir) {
  const s = await openApp(dir);
  const { page } = s;
  const grid = '[data-grid="special-mapping"]';
  const gridText = () => page.innerText(grid);
  const steps = () => page.$$eval('[data-action="special-select-step"]', (els) => els.map((e) => e.getAttribute('data-step-id')));
  const locators = () => page.$$eval(`${grid} .admin-special-field-mapping code`, (els) => els.map((e) => e.textContent));
  const storedMeta = (id) => page.evaluate((rowId) => JSON.stringify(globalThis.__pvdb.rows.find((r) => r.id === rowId).metadata), id);
  async function switchTo(pattern) {
    await page.click('[data-action="change-login-pattern"]');
    await page.waitForTimeout(100);
    await page.click(`[data-pattern="${pattern}"]`);
    await page.waitForTimeout(120);
  }
  /** True when leaving the site asks (the editor is dirty); the site stays open. */
  async function leaveAsks() {
    await answer(s, false);
    const n = (await dialogLog(s)).length;
    await back(page);
    const asked = (await dialogLog(s)).slice(n).some((x) => x.name === 'leave-site');
    await answer(s, true);
    return asked;
  }

  // MULTI_STEP saved → STANDARD → MULTI_STEP: the saved draft, not dirty.
  await openSite(page, MULTI);
  await tab(page, 'login');
  const savedText = await gridText();
  const savedSteps = await steps();
  const savedLocators = await locators();
  const metaBefore = await storedMeta('svc-multi');
  assert(JSON.stringify(savedSteps) === '["step-1","step-2"]' && savedLocators.includes('#user'), `fixture: saved MULTI_STEP draft shown on open (${savedSteps} / ${savedLocators})`);
  await switchTo('STANDARD');
  assert(await visible(page, '[data-tab-panel="login"] .admin-autofill-profile'), 'G-122-5: SPECIAL → STANDARD shows the STANDARD grid (unchanged)');
  await switchTo('MULTI_STEP');
  assert(JSON.stringify(await steps()) === JSON.stringify(savedSteps) && JSON.stringify(await locators()) === JSON.stringify(savedLocators), `G-122-5: back on the saved pattern → saved steps / fields (${await steps()} / ${await locators()})`);
  assert((await gridText()) === savedText, 'G-122-5: back on the saved pattern → the editor shows exactly what first open showed (steps, fields, step exit)');
  assert(!(await leaveAsks()) && (await mode(page)) === 'catalog', 'G-122-5: the reloaded draft is not dirty (leaving does not ask)');
  assert((await writeCount(page)) === 0, 'G-122-5: no write during the switches');

  // «שמור מיפוי» right after returning (no edits) → stored draft byte-equal.
  await openSite(page, MULTI);
  await tab(page, 'login');
  await switchTo('STANDARD');
  await switchTo('MULTI_STEP');
  await page.click(`${grid} [data-action="save-special-draft"]`);
  await page.waitForFunction(() => globalThis.__writes.length > 0, null, { timeout: 5000 });
  await page.waitForTimeout(150);
  const w = await page.evaluate(() => globalThis.__writes.map((x) => x.fn));
  assert(JSON.stringify(w) === '["updateGlobalRegistryRow"]', `fixture: «שמור מיפוי» writes once (${w.join(', ')})`);
  // The save path writes the plan bag without an empty `active: null` (as from first open), so the draft is compared.
  const storedDraft = (meta) => JSON.stringify(JSON.parse(meta).loginFlowPlan?.draft ?? null);
  const metaAfter = await storedMeta('svc-multi');
  assert(storedDraft(metaBefore) !== 'null' && storedDraft(metaAfter) === storedDraft(metaBefore), `G-122-5: «שמור מיפוי» after returning without edits keeps the stored draft byte-equal (${storedDraft(metaBefore)} → ${storedDraft(metaAfter)})`);

  // MULTI_STEP saved → FLOATING_SCREEN: today's behavior (keeps the current mappings, dirty).
  await switchTo('FLOATING_SCREEN');
  assert((await locators()).includes('#user'), `G-122-5: different SPECIAL pattern → today's switch keeps the current mappings (${await locators()})`);
  assert(await leaveAsks(), 'G-122-5: different SPECIAL pattern → the draft is unsaved (leaving asks)');
  // FLOATING_SCREEN → MULTI_STEP (the saved pattern) → saved draft again.
  await switchTo('MULTI_STEP');
  assert((await gridText()) === savedText && !(await leaveAsks()), 'G-122-5: from another SPECIAL pattern back to the saved one → saved draft, not dirty');
  // STANDARD → FLOATING_SCREEN (not the saved pattern) → empty, as today.
  await openSite(page, MULTI);
  await tab(page, 'login');
  await switchTo('STANDARD');
  await switchTo('FLOATING_SCREEN');
  assert((await locators()).every((l) => l === '—'), `G-122-5: STANDARD → another SPECIAL pattern starts empty, as today (${await locators()})`);
  await answer(s, true);
  await back(page);

  // STANDARD saved, no SPECIAL draft → MULTI_STEP: empty step 1.
  await openSite(page, STANDARD);
  await tab(page, 'login');
  await switchTo('MULTI_STEP');
  assert(JSON.stringify(await steps()) === '["step-1"]' && (await locators()).every((l) => l === '—'), `G-122-5: no saved SPECIAL draft → empty step 1 (${await steps()} / ${await locators()})`);
  await shot(page, '122-5-g5-multi-empty');
  await close(s);
  return 'G-122-5: MULTI_STEP saved → STANDARD → MULTI_STEP shows the saved steps / fields / exit and is not dirty; «שמור מיפוי» right after keeps the stored draft byte-equal; MULTI_STEP → FLOATING_SCREEN keeps today\'s switch (dirty); back to the saved pattern from another SPECIAL reloads it; STANDARD → FLOATING_SCREEN empty; no SPECIAL draft → empty step 1';
}

const FORBIDDEN_DIALOGS = [
  /\b(?:window|globalThis|self)\s*\.\s*(?:confirm|alert|prompt)\b/,
  /(?<![\w.$])(?:alert|prompt)\s*\(/,
  /(?<![\w.$]|function |void )confirm\s*\(/,
];

function adminSources() {
  const out = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(child);
    }
  };
  walk('src/admin');
  return out;
}

async function checkInAppDialogs(dir) {
  const files = adminSources();
  const hits = [];
  for (const rel of files) {
    read(rel).split('\n').forEach((line, i) => {
      if (/beforeunload/.test(line)) return;
      if (FORBIDDEN_DIALOGS.some((re) => re.test(line))) hits.push(`${rel}:${i + 1} ${line.trim()}`);
    });
  }
  assert(hits.length === 0, `R3: browser dialog under src/admin — ${hits.join(' | ')}`);
  assert(files.length > 20, `fixture: src/admin scanned (${files.length} files)`);

  const s = await openApp(dir);
  const { page } = s;
  await openSite(page, MULTI);
  await nameInput(page).fill(`${MULTI} ערוך`);
  await answer(s, null);
  await back(page);
  const dlg = openDialog(page);
  await dlg.waitFor({ state: 'visible', timeout: 3000 });
  const attrs = await dlg.evaluate((el) => ({ role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'), dir: el.getAttribute('dir'), labelled: Boolean(el.getAttribute('aria-labelledby')), cls: el.className }));
  assert(attrs.role === 'alertdialog' && attrs.modal === 'true' && attrs.dir === 'rtl' && attrs.labelled && attrs.cls.includes('admin-autofill-confirm'), `R3: in-app dialog (alertdialog, aria-modal, RTL, «אשר מיפוי» style) ${JSON.stringify(attrs)}`);
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('data-action') ?? document.activeElement?.tagName);
  assert((await focused()) === 'confirm-cancel', 'R3: cancel focused on open');
  const seen = [];
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    seen.push(await focused());
  }
  assert(JSON.stringify(seen) === JSON.stringify(['confirm-accept', 'confirm-cancel', 'confirm-accept', 'confirm-cancel']), `R3: Tab stays inside the dialog (${seen.join(' → ')})`);
  await page.keyboard.press('Shift+Tab');
  assert((await focused()) === 'confirm-accept', `R3: Shift+Tab wraps inside the dialog (${await focused()})`);
  await shot(page, '122-5-leave-dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  assert(!(await dlg.count()) && (await mode(page)) === 'workspace' && (await nameInput(page).inputValue()) === `${MULTI} ערוך`, 'R3: Esc = cancel (site and edit kept)');
  await back(page);
  await dlg.waitFor({ state: 'visible', timeout: 3000 });
  await page.mouse.click(5, 5);
  await page.waitForTimeout(80);
  assert(!(await dlg.count()) && (await mode(page)) === 'workspace', 'R3: click outside = cancel');
  await back(page);
  await dlg.locator('[data-action="confirm-accept"]').click();
  await page.waitForTimeout(80);
  assert((await mode(page)) === 'catalog', 'R3: confirm leaves');

  await answer(s, false);
  await openSite(page, FILLER);
  await page.click('[data-part="details-actions"] button:has-text("השבת")');
  await page.waitForTimeout(100);
  assert((await dialogLog(s)).at(-1)?.name === 'disable-site' && (await writeCount(page)) === 0, 'R3: «השבת» asks in-app; cancel writes nothing');
  await back(page);
  await openSite(page, STANDARD);
  await tab(page, 'login');
  const clear = page.locator('[data-tab-panel="login"] [data-action="clear"]');
  assert(await clear.isEnabled(), 'fixture: STANDARD «נקה מיפוי» enabled');
  await clear.click();
  await page.waitForTimeout(100);
  const last = (await dialogLog(s)).at(-1);
  assert(last?.name === 'clear-mapping' && last.title === 'לנקות את שדות המיפוי במסך?' && last.body.includes('סיסמאות ופרטי כניסה לא יימחקו'), `R3: «נקה מיפוי» asks in-app with the same text (${JSON.stringify(last)})`);
  await close(s);
  return `R3: no window.confirm / alert / prompt under src/admin (${files.length} files; beforeunload allowed); one in-app dialog (alertdialog, RTL, «אשר מיפוי» style): cancel focused, Tab / Shift+Tab trapped, Esc and outside click cancel; leave guard, «השבת», «נקה מיפוי» ask in-app; no native dialog in any check`;
}

async function checkFieldWarnings(dir) {
  const s = await openApp(dir);
  const { page } = s;
  await answer(s, false);
  const count = async () => (await dialogLog(s)).length;
  const lastName = async () => (await dialogLog(s)).at(-1)?.name;

  // Saved field of an active site → warn (remove / id change / mode clear).
  await openSite(page, STANDARD);
  let n = await count();
  await removeButtons(page).first().click();
  await page.waitForTimeout(100);
  assert((await count()) === n + 1 && (await lastName()) === 'credential-field-remove' && (await credentialCount(page)) === 2, 'R4: remove saved field (active) → warning; cancel keeps it');
  await shot(page, '122-5-field-warning');
  const first = page.locator('[data-tab-panel="details"] .admin-credential-field').first();
  await first.locator('[data-control="advanced"] summary').click();
  const idInput = first.locator('[data-control="advanced"] input');
  await idInput.fill('username2');
  await idInput.blur();
  await page.waitForTimeout(100);
  assert((await count()) === n + 2 && (await lastName()) === 'credential-field-id' && (await idInput.inputValue()) === 'username', 'R4: id change of saved field (active) → warning; cancel keeps the id');
  const modeSelect = page.locator('[data-tab-panel="details"] label.admin-field', { hasText: 'פרטי כניסה' }).locator('select');
  await modeSelect.selectOption('no_stored_credentials');
  await page.waitForTimeout(100);
  assert((await count()) === n + 3 && (await lastName()) === 'credential-mode-clear' && (await modeSelect.inputValue()) === 'credential_fields' && (await credentialCount(page)) === 2, 'R4: mode clear with saved fields (active) → warning; cancel keeps fields');

  // No warning: new field, label / attribute edits.
  n = await count();
  await page.click('[data-tab-panel="details"] [data-part="credentials-card"] button:has-text("הוסף שדה")');
  assert((await credentialCount(page)) === 3, 'fixture: field added');
  const added = page.locator('[data-tab-panel="details"] .admin-credential-field').nth(2);
  await added.locator('[data-control="label"] input').fill('קוד');
  await added.locator('[data-control="advanced"] summary').click();
  await added.locator('[data-control="advanced"] input').fill('code');
  await added.locator('[data-control="advanced"] input').blur();
  await page.waitForTimeout(80);
  assert((await count()) === n && (await added.locator('[data-control="advanced"] input').inputValue()) === 'code', 'R4: id change of a new field → no warning');
  await removeButtons(page).nth(2).click();
  await page.waitForTimeout(80);
  assert((await count()) === n && (await credentialCount(page)) === 2, 'R4: remove a new (unsaved) field → no warning');
  await credentialFieldEdit(page);
  await first.locator('[data-control="required"] input').click();
  await first.locator('[data-control="allowed-value"] select').selectOption('number');
  await page.waitForTimeout(60);
  assert((await count()) === n, 'R4: label / attribute edits → no warning');
  // Saved status counts (not the unsaved form status).
  await page.locator('label.admin-field', { hasText: /^סטטוס/ }).locator('select').selectOption('disabled');
  await removeButtons(page).first().click();
  await page.waitForTimeout(100);
  assert((await count()) === n + 1 && (await credentialCount(page)) === 2, 'R4: rule reads the saved status (active), not the unsaved form status');
  await answer(s, true);
  await back(page);

  // Inactive (saved status disabled) → no warning.
  await answer(s, false);
  await openSite(page, FILLER_INACTIVE);
  n = await count();
  await removeButtons(page).first().click();
  await page.waitForTimeout(80);
  assert((await count()) === n && (await credentialCount(page)) === 1, 'R4: inactive site → remove without warning');
  const inactiveMode = page.locator('[data-tab-panel="details"] label.admin-field', { hasText: 'פרטי כניסה' }).locator('select');
  await inactiveMode.selectOption('no_stored_credentials');
  await page.waitForTimeout(80);
  assert((await count()) === n && (await inactiveMode.inputValue()) === 'no_stored_credentials', 'R4: inactive site → mode clear without warning');
  await answer(s, true);
  await back(page);

  // User-owned → no credential editor (no warning possible); create mode → no warning.
  await openSite(page, USER_OWNED);
  assert(!(await page.$('[data-part="credentials-card"]')), 'R4: user-owned row → no credential editor');
  await back(page);
  await answer(s, false);
  await page.click('[data-action="new-site"]');
  await page.locator('[data-tab-panel="details"] label.admin-field', { hasText: 'פרטי כניסה' }).locator('select').selectOption('credential_fields');
  await page.click('[data-tab-panel="details"] [data-part="credentials-card"] button:has-text("הוסף שדה")');
  n = await count();
  await removeButtons(page).first().click();
  await page.waitForTimeout(80);
  assert((await count()) === n && (await credentialCount(page)) === 0, 'R4: create mode → no warning');
  await answer(s, true);
  await close(s);
  return 'R4 matrix: saved field of an active site → warn on remove / id change / mode clear (cancel keeps it; saved status, not the unsaved form status); new field, label / attribute edits, inactive site, user-owned, create mode → no warning';
}

// ─── 122.7 checks ─────────────────────────────────────────────────────────────
const openLinks = (page) =>
  page.$$eval('[data-tab-panel="details"] [data-action="open-url"]', (els) =>
    els.map((a) => ({ text: a.textContent, href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })));
const homeInput = (page) => page.locator('[data-tab-panel="details"] label.admin-field', { hasText: 'כתובת הבית' }).locator('input');
const loginInput = (page) => page.locator('[data-tab-panel="details"] label.admin-field', { hasText: /^כתובת כניסה/ }).locator('input');

async function checkDetailsLinks(dir) {
  const s = await openApp(dir);
  const { page } = s;
  await openSite(page, STANDARD);
  const links = await openLinks(page);
  assert(JSON.stringify(links.map((l) => l.text)) === '["דף הבית","דף כניסה"]', `122.7: «דף הבית» / «דף כניסה» next to the URLs (${links.map((l) => l.text).join(' / ')})`);
  assert(links[0].href === 'https://plain.example.test/' && links[1].href === 'https://plain.example.test/login', `122.7: links open the URLs (${links.map((l) => l.href).join(' / ')})`);
  assert(links.every((l) => l.target === '_blank' && l.rel === 'noopener noreferrer'), '122.7: links open in a new tab (noopener noreferrer)');
  assert((await page.$$('[data-tab-panel="details"] .admin-url-field-row .admin-copy-btn')).length === 2, '122.7: copy buttons stay');
  await homeInput(page).fill('https://edited.example.test/path');
  await loginInput(page).fill('http://edited.example.test/login');
  const live = await openLinks(page);
  assert(live[0]?.href === 'https://edited.example.test/path' && live[1]?.href === 'http://edited.example.test/login', `122.7: links follow the unsaved form value (${live.map((l) => l.href).join(' / ')})`);
  assert((await writeCount(page)) === 0, '122.7: editing writes nothing');
  await shot(page, '122-7-details-links');
  for (const bad of ['not a url', 'javascript:alert(1)', 'ftp://files.example.test/', 'https://']) {
    await homeInput(page).fill(bad);
    const now = await openLinks(page);
    assert(!now.some((l) => l.text === 'דף הבית') && now.some((l) => l.text === 'דף כניסה'), `122.7: no «דף הבית» link for an invalid URL «${bad}»`);
  }
  await homeInput(page).fill('https://plain.example.test/');
  await page.locator('[data-tab-panel="details"] label.admin-field', { hasText: 'סוג כניסה' }).locator('select').selectOption('primary_page');
  await page.waitForTimeout(60);
  const homeEntry = await openLinks(page);
  assert(JSON.stringify(homeEntry.map((l) => l.text)) === '["דף הבית"]', `122.7: «דף כניסה» hidden for home-page entry (${homeEntry.map((l) => l.text).join(' / ')})`);
  const ws = await page.textContent('[data-part="workspace"]');
  assert(!ws.includes('שמור ידנית') && !ws.includes('סמן כלא תקין') && !ws.includes('כתובת כניסה — עריכה ידנית'), '122.7: «כתובת כניסה» side card gone («שמור ידנית» / «סמן כלא תקין»)');
  assert(!(await page.$('[data-part="details-aside"] input[name="loginUrl"]')), '122.7: no login-URL input in the side stack');
  await back(page);
  await close(s);
  return '122.7 links: «דף הבית» / «דף כניסה» (new tab, noopener noreferrer) from the live form value; hidden for invalid / non-http(s) URLs; «דף כניסה» hidden for home-page entry; copy buttons kept; «כתובת כניסה» side card («שמור ידנית» / «סמן כלא תקין») gone';
}

async function checkHeader(dir) {
  const s = await openApp(dir);
  const bar = await s.page.textContent('[data-part="app-bar"]');
  assert(!bar.includes('חזרה לבית הדיגיטלי') && !(await s.page.$('[data-part="app-bar"] a[href="#/"]')), '122.7: no «חזרה לבית הדיגיטלי» in the app bar');
  const user = await s.page.textContent('[data-part="signed-in-admin"]');
  assert(user === `${ADMIN_FIRST} ${ADMIN_LAST} · ${ADMIN_EMAIL}`, `122.7: «<first> <last> · <email>» (${user})`);
  await shot(s.page, '122-7-header');
  await close(s);
  const noName = await openApp(dir, { init: `window.__pvAdmin = { firstName: '  ', lastName: null, email: ${JSON.stringify(ADMIN_EMAIL)} };` });
  const only = await noName.page.textContent('[data-part="signed-in-admin"]');
  assert(only === ADMIN_EMAIL && !(await noName.page.$('[data-part="signed-in-name"]')), `122.7: empty name → email only (${only})`);
  await close(noName);
  const firstOnly = await openApp(dir, { init: `window.__pvAdmin = { firstName: 'רון', lastName: '', email: ${JSON.stringify(ADMIN_EMAIL)} };` });
  assert((await firstOnly.page.textContent('[data-part="signed-in-admin"]')) === `רון · ${ADMIN_EMAIL}`, '122.7: first name only → «רון · email»');
  await close(firstOnly);
  return '122.7 header: no «חזרה לבית הדיגיטלי»; «<first> <last> · <email>»; empty name → email only';
}

async function checkCatalogToolbar(dir) {
  for (const width of [1440, 1280, 1920]) {
    const s = await openApp(dir, { width });
    const r = (sel) => s.page.$eval(sel, (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, height: b.height }; });
    const btn = await r('[data-action="new-site"]');
    const row = await r('.admin-catalog-bar .admin-filters');
    assert(Math.abs(btn.height - row.height) <= 1 && Math.abs(btn.top - row.top) <= 1, `${width}px: «אתר חדש» height / top = search row (${Math.round(btn.height)}/${Math.round(row.height)}, top ${Math.round(btn.top)}/${Math.round(row.top)})`);
    if (width === 1440) await shot(s.page, '122-7-catalog-toolbar');
    await close(s);
  }
  return '122.7 toolbar: «אתר חדש» height and top = the search / filter row (±1px) at 1280 / 1440 / 1920';
}

async function checkSubmissionCards(dir) {
  // UTC browser: the card must still show Israel time (21:05 UTC → 00:05 next day).
  const s = await openApp(dir, { timezoneId: 'UTC' });
  const { page } = s;
  await page.click('[data-nav="approvals"]');
  await page.waitForSelector('.admin-pending-card');
  await page.waitForFunction(() => document.querySelector('[data-submission="sub-one"] [data-part="submitter-name"]')?.textContent === 'נועה לוי', null, { timeout: 5000 });
  const rpc = await page.evaluate(() => globalThis.__rpc);
  assert(rpc.length === 1 && JSON.stringify([...rpc[0]].sort()) === '["user-1001","user-1002","user-1003"]', `122.7: one profile call per queue load with the distinct owner ids (${JSON.stringify(rpc)})`);
  const card = (id) => page.locator(`[data-submission="${id}"]`);
  const fact = (id, f) => card(id).locator(`[data-fact="${f}"] dd`);
  const attrs = (loc) => loc.evaluate((a) => ({ tag: a.tagName, href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), text: a.textContent }));

  const one = await fact('sub-one', 'submitted-by').textContent();
  const mail = await attrs(card('sub-one').locator('[data-part="submitter-email"]'));
  assert(one === 'נועה לוי · noa@example.test' && mail.tag === 'A' && mail.href === 'mailto:noa@example.test', `122.7: «הוגש ע"י: <first> <last>» + mailto (${one}, ${mail.href})`);
  assert((await card('sub-one').locator('[data-fact="submitted-by"] dt').textContent()) === 'הוגש ע"י:', '122.7: label «הוגש ע"י:»');
  const when = await fact('sub-one', 'submitted-at').textContent();
  assert(/00:05/.test(when) && !/21:05/.test(when) && /2026/.test(when), `122.7: submission date + HH:mm in Israel time (${when})`);
  const whenTwo = await fact('sub-two', 'submitted-at').textContent();
  assert(whenTwo.includes('11:30') && !whenTwo.includes('08:30'), `122.7: 08:30 UTC → 11:30 Israel time (${whenTwo})`);
  const home = await attrs(card('sub-one').locator('[data-part="home-url"]'));
  const login = await attrs(card('sub-one').locator('[data-part="login-url"]'));
  assert(home.tag === 'A' && home.href === 'https://sub-one.example.test/' && home.text === home.href && home.target === '_blank' && home.rel === 'noopener noreferrer', `122.7: «כתובת הבית» link (new tab) + URL text (${JSON.stringify(home)})`);
  assert(login.tag === 'A' && login.href === 'https://sub-one.example.test/login' && login.text === login.href && login.target === '_blank', `122.7: «כתובת כניסה» link + text (${JSON.stringify(login)})`);

  const two = await fact('sub-two', 'submitted-by').textContent();
  assert(two === 'anon@example.test' && (await card('sub-two').locator('[data-part="submitter-name"]').count()) === 0, `122.7: empty name → email (mailto) only (${two})`);
  assert((await fact('sub-two', 'login-url').textContent()) === '—', '122.7: empty «כתובת כניסה» → «—» (row always shown)');
  const three = await fact('sub-three', 'submitted-by').textContent();
  assert(three === 'משתמש לא מזוהה' && (await card('sub-three').locator('a[href^="mailto:"]').count()) === 0, `122.7: unresolved submitter → «משתמש לא מזוהה» (${three})`);
  const ftp = await attrs(card('sub-three').locator('[data-part="home-url"]'));
  assert(ftp.tag !== 'A' && ftp.text === 'ftp://files.example.test/', '122.7: non-http(s) URL shown as text, no link');

  const text = await page.textContent('.admin-section--approvals');
  assert(!text.includes('ממתין לאישור') && (await page.$$('.admin-pending-card .admin-badge--warn, .admin-pending-card .admin-status-chip')).length === 0, '122.7: no status chip on the cards');
  assert(!/משתמש user-|owner_user_id/.test(text), '122.7: no «משתמש <uuid>» on the cards');
  const cols = await columns(page, '.admin-pending-grid > li');
  assert(cols >= 2 && cols <= 3, `122.7: 2–3 cards per row at 1440 (${cols})`);
  await shot(page, '122-7-submissions-1440');

  await card('sub-one').locator('.admin-site-card-head').click();
  await page.click('[data-submission="sub-one"] button:has-text("פרטים נוספים")');
  const modal = await page.textContent('.admin-modal');
  assert(modal.includes('owner_user_id') && modal.includes('user-1001') && modal.includes('source_type'), '122.7: the details modal keeps its content');
  await close(s);
  return '122.7 queue cards: «הוגש ע"י: <first> <last>» + mailto (email only when the name is empty, «משתמש לא מזוהה» otherwise); date + HH:mm Israel time (UTC browser); «כתובת הבית» / «כתובת כניסה» links (new tab) + text, «—» when empty, text for non-http(s); no status chip, no uuid; 2–3 per row at 1440; one profile call with distinct owner ids; details modal unchanged';
}

// ─── G-122-8 / G-122-9 checks ─────────────────────────────────────────────────
async function checkSubmissionLoginUrl(dir) {
  const s = await openApp(dir);
  const { page } = s;
  await page.click('[data-nav="approvals"]');
  await page.waitForSelector('[data-submission="sub-six"]');
  const loginText = (id) => page.locator(`[data-submission="${id}"] [data-fact="login-url"] dd`).textContent();
  const loginLinks = (id) => page.locator(`[data-submission="${id}"] [data-fact="login-url"] a`);
  assert(
    (await loginLinks('sub-one').count()) === 1 && (await loginLinks('sub-one').getAttribute('href')) === 'https://sub-one.example.test/login',
    'G-122-8: direct_url + valid URL → «כתובת כניסה» link',
  );
  const dash = [
    ['sub-four', 'primary_page (login_url = home URL)'],
    ['sub-two', 'primary_page without a login URL'],
    ['sub-five', 'missing metadata'],
    ['sub-six', 'direct_url with an invalid URL'],
  ];
  for (const [id, why] of dash) {
    const text = await loginText(id);
    assert(text === '—' && (await loginLinks(id).count()) === 0, `G-122-8: ${why} → «—» (${text})`);
  }
  assert(
    (await page.locator('[data-submission="sub-four"] [data-part="home-url"]').getAttribute('href')) === 'https://sub-four.example.test/',
    'G-122-8: «כתובת הבית» still shown for home-page entry',
  );
  await shot(page, 'g-122-8-submissions-1440');

  const modalLogin = async (id) => {
    await page.locator(`[data-submission="${id}"] .admin-site-card-head`).click();
    await page.click(`[data-submission="${id}"] button:has-text("פרטים נוספים")`);
    const dd = page.locator('.admin-modal [data-fact="modal-login-url"] dd');
    const links = dd.locator('a');
    const result = { text: await dd.textContent(), href: (await links.count()) ? await links.getAttribute('href') : null };
    await page.click('.admin-modal-close');
    return result;
  };
  const one = await modalLogin('sub-one');
  assert(one.href === 'https://sub-one.example.test/login' && one.text === one.href, `G-122-8: modal — direct_url → link (${JSON.stringify(one)})`);
  for (const [id, why] of dash) {
    const m = await modalLogin(id);
    assert(m.text === '—' && m.href === null, `G-122-8: modal — ${why} → «—» (${JSON.stringify(m)})`);
  }
  assert((await writeCount(page)) === 0, 'G-122-8: presentation only (no writes)');
  await close(s);
  return 'G-122-8 login URL: queue cards and the details modal show the «כתובת כניסה» link only for direct_url + valid http(s); primary_page (login_url = home URL), missing metadata, invalid URL → «—»; home URL unchanged; no writes';
}

const stepCardGeometry = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const q = (s) => document.querySelector(s);
    const save = q('[data-action="save-special-draft"]');
    const columns = '[data-panel="step-buttons"], [data-panel="step-fields-card"]';
    return {
      cards: box(q('[data-panel="step-cards"]')),
      buttons: box(q('[data-panel="step-buttons"]')),
      buttonCards: [...document.querySelectorAll('[data-panel="step-buttons"] > .admin-special-approval')].map(box),
      fields: box(q('[data-panel="step-fields-card"]')),
      gap: box(q('[data-status="mapping-completeness"]')),
      actions: box(save?.parentElement),
      help: box(q('[data-panel="action-bar-explanation"]')),
      outside: [q('[data-status="mapping-completeness"]'), save, q('[data-action="activate-special"]'), q('[data-panel="action-bar-explanation"]')].every((el) => el && !el.closest(columns)),
    };
  });

function assertSideBySide(g, label) {
  const lastButton = g.buttonCards[g.buttonCards.length - 1];
  assert(g.buttons && g.fields && Math.abs(g.buttons.top - g.fields.top) <= 1, `${label}: button card and «מיפוי שדות» share the top (${g.buttons && Math.round(g.buttons.top)} / ${g.fields && Math.round(g.fields.top)})`);
  assert(g.buttons.left >= g.fields.right - 1, `${label}: button card on the right (RTL start), «מיפוי שדות» on the left (button ${Math.round(g.buttons.left)}–${Math.round(g.buttons.right)}, fields ${Math.round(g.fields.left)}–${Math.round(g.fields.right)})`);
  assert(Math.abs(g.buttons.height - g.fields.height) <= 1 && lastButton && Math.abs(lastButton.bottom - g.fields.bottom) <= 1, `${label}: equal heights (${Math.round(g.buttons.height)} / ${Math.round(g.fields.height)})`);
  const below = Math.max(g.buttons.bottom, g.fields.bottom);
  assert(g.outside, `${label}: gap message / «שמור מיפוי» / «אשר מיפוי» / help text outside both columns`);
  assert(g.gap.top >= below - 1 && g.actions.top >= below - 1 && g.help.top >= below - 1, `${label}: gap message, actions and help text below both cards`);
  for (const [name, b] of [['gap message', g.gap], ['actions', g.actions], ['help text', g.help]]) {
    assert(b.width >= g.cards.width - 2, `${label}: ${name} spans the full width (${Math.round(b.width)} ≥ ${Math.round(g.cards.width)})`);
  }
}

async function analyzeFloating(page) {
  await page.click('[data-action="special-analyze-current-tab"]');
  await page.waitForSelector('[data-panel="step-buttons"] [data-panel="progressive-approval"]', { timeout: 5000 });
  await page.waitForTimeout(80);
}

async function checkStepCards(dir) {
  const init = 'window.__pvFloat = true;';
  // Field-only step (floating screen before «נתח»): readable width, not stretched.
  for (const width of [1440, 1920]) {
    const s = await openApp(dir, { width, init });
    await openSite(s.page, FLOAT);
    await tab(s.page, 'login');
    const g = await stepCardGeometry(s.page);
    assert(!g.buttons && g.fields && g.fields.width <= CAP.categories + 0.5 && g.fields.width < g.cards.width - 50, `${width}px field-only step: «מיפוי שדות» ≤ ${CAP.categories}px, not stretched (${g.fields && Math.round(g.fields.width)} of ${g.cards && Math.round(g.cards.width)})`);
    await close(s);
  }

  for (const width of [1280, 1440, 1920]) {
    const s = await openApp(dir, { width, init });
    const { page } = s;
    await openSite(page, FLOAT);
    await tab(page, 'login');
    await analyzeFloating(page);
    assertSideBySide(await stepCardGeometry(page), `${width}px floating screen`);
    await auditWorkspace(page, width, 'FLOATING «login» (button card + fields)');
    if (width === 1440) {
      await page.locator('[data-panel="step-cards"]').scrollIntoViewIfNeeded();
      await shot(page, 'g-122-9-floating-1440');
    }
    await back(page);
    await openSite(page, MULTI);
    await tab(page, 'login');
    assertSideBySide(await stepCardGeometry(page), `${width}px multi-step`);
    await auditWorkspace(page, width, 'MULTI «login» (button card + fields)');
    if (width === 1440) {
      await page.locator('[data-panel="step-cards"]').scrollIntoViewIfNeeded();
      await shot(page, 'g-122-9-multi-1440');
    }
    await close(s);
  }

  const narrow = await openApp(dir, { width: 1024, init });
  const np = narrow.page;
  await openSite(np, FLOAT);
  await tab(np, 'login');
  await analyzeFloating(np);
  let g = await stepCardGeometry(np);
  const opener = g.buttonCards[0];
  assert(opener && opener.bottom <= g.fields.top + 1 && Math.abs(opener.width - g.fields.width) <= 2, `1024px floating screen: stacked, button card above «מיפוי שדות» as today (opener ${opener && Math.round(opener.bottom)}, fields ${Math.round(g.fields.top)})`);
  assert(g.outside && g.gap.top >= g.fields.bottom - 1 && g.actions.top >= g.gap.bottom - 1, '1024px floating screen: gap message and actions below the cards');
  await auditWorkspace(np, 1024, 'FLOATING «login»');
  await np.locator('[data-panel="step-cards"]').scrollIntoViewIfNeeded();
  await shot(np, 'g-122-9-floating-1024');
  await back(np);
  await openSite(np, MULTI);
  await tab(np, 'login');
  g = await stepCardGeometry(np);
  const exit = g.buttonCards[g.buttonCards.length - 1];
  assert(exit && exit.top >= g.fields.bottom - 1, `1024px multi-step: stacked as today, fields table then the step button card (fields ${Math.round(g.fields.bottom)}, button ${exit && Math.round(exit.top)})`);
  await close(narrow);
  return 'G-122-9 step cards: from 1280px button card (right) | «מיפוי שדות» (left), same top, equal height, floating screen and multi-step; gap message / «שמור מיפוי» / «אשר מיפוי» / help text full width below; 1024px stacked in today\'s order; field-only step ≤ 960px; no overflow / cap breach at 1280 / 1440 / 1920 / 1024';
}

// ─── G-122-7 check ────────────────────────────────────────────────────────────
const OWNER_NAMED = 'a1b2c3d4-0000-4000-8000-000000002001';
const OWNER_EMAIL = 'b2c3d4e5-0000-4000-8000-000000002002';
const OWNER_UNKNOWN = 'c3d4e5f6-0000-4000-8000-000000002003';
const catalogUser = (id, name, owner) => ({
  id, display_name: name, primary_url: `https://${id}.example.test/`, login_url: null, login_url_status: null,
  category_id: 'cat-a', icon: '🔗', adapter_id: null, source_type: 'user', service_status: 'pending_review',
  owner_user_id: owner, login_fields: null, metadata: { loginEntryType: 'primary_page' }, metadata_version: 1,
  created_at: '2026-09-20T10:00:00.000Z', updated_at: 'u1',
});
const CATALOG_USERS = [
  catalogUser('cu-named', 'הגשה בקטלוג עם שם', OWNER_NAMED),
  catalogUser('cu-email', 'הגשה בקטלוג בלי שם', OWNER_EMAIL),
  catalogUser('cu-unknown', 'הגשה בקטלוג לא מזוהה', OWNER_UNKNOWN),
  catalogUser('cu-named-2', 'הגשה בקטלוג שנייה', OWNER_NAMED),
];
const CATALOG_PROFILES = [
  { id: OWNER_NAMED, first_name: 'יעל', last_name: 'אברהם', email: 'yael@example.test' },
  { id: OWNER_EMAIL, first_name: null, last_name: ' ', email: 'only@example.test' },
];
const catalogInit = (extra = '') =>
  `window.__pvCatalogUsers = ${JSON.stringify(CATALOG_USERS)}; window.__pvCatalogProfiles = ${JSON.stringify(CATALOG_PROFILES)};${extra}`;
const addedBy = (page, name) =>
  page.locator('[data-part="catalog"] li', { hasText: name }).locator('[data-part="added-by"]').textContent();
const catalogRpcCalls = (page) =>
  page.evaluate(() => globalThis.__rpc.filter((ids) => ids.some((id) => !id.startsWith('user-1'))));

async function checkCatalogSubmitters(dir) {
  const s = await openApp(dir, { init: catalogInit() });
  const { page } = s;
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-part="added-by"]')].some((el) => el.textContent === 'יעל אברהם'),
    null,
    { timeout: 5000 },
  );
  assert((await addedBy(page, 'הגשה בקטלוג עם שם')) === 'יעל אברהם', 'G-122-7: catalog card «על ידי: <first> <last>»');
  assert((await addedBy(page, 'הגשה בקטלוג שנייה')) === 'יעל אברהם', 'G-122-7: same submitter on a second card');
  assert((await addedBy(page, 'הגשה בקטלוג בלי שם')) === 'only@example.test', 'G-122-7: empty name → email');
  const unknown = await addedBy(page, 'הגשה בקטלוג לא מזוהה');
  assert(unknown === 'משתמש לא מזוהה', `G-122-7: no profile → «משתמש לא מזוהה» (${unknown})`);
  assert((await addedBy(page, USER_OWNED)) === 'משתמש לא מזוהה', 'G-122-7: other owned row → «משתמש לא מזוהה», not the uuid');
  assert((await addedBy(page, 'אתר מילוי 1')) === 'מנהל מערכת', 'G-122-7: admin rows unchanged («מנהל מערכת»)');
  const catalogText = await page.textContent('[data-part="catalog"]');
  for (const id of [OWNER_NAMED, OWNER_EMAIL, OWNER_UNKNOWN, 'user-0001']) {
    assert(!catalogText.includes(id.slice(0, 8)), `G-122-7: no uuid text on the catalog (${id.slice(0, 8)})`);
  }
  assert(!/משתמש [0-9a-f]{4}/i.test(catalogText), 'G-122-7: no «משתמש <id>» label on the catalog');
  let calls = await catalogRpcCalls(page);
  assert(
    calls.length === 1 && JSON.stringify([...calls[0]].sort()) === JSON.stringify([OWNER_NAMED, OWNER_EMAIL, OWNER_UNKNOWN].sort()),
    `G-122-7: one profile call per catalog load with the distinct user-submitted owner ids (${JSON.stringify(calls)})`,
  );
  await page.locator('.admin-catalog-bar select:has(option[value="user_submitted"])').selectOption('user_submitted');
  await page.waitForTimeout(80);
  await shot(page, 'g-122-7-catalog-1440');
  await page.click('[data-nav="approvals"]');
  await page.waitForSelector('.admin-pending-card');
  await page.click('[data-nav="registry"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-part="added-by"]').length > 0);
  await page.waitForTimeout(120);
  calls = await catalogRpcCalls(page);
  assert(calls.length === 2, `G-122-7: a second catalog load makes exactly one more call (${calls.length})`);
  await close(s);

  const failing = await openApp(dir, { init: catalogInit(' window.__pvRpcFail = true;') });
  const fp = failing.page;
  await fp.waitForFunction(() => globalThis.__rpc?.length > 0, null, { timeout: 5000 });
  await fp.waitForTimeout(150);
  const cards = await fp.$$eval('[data-part="catalog"] li', (els) => els.length);
  assert(cards === 12 + CATALOG_USERS.length, `G-122-7: RPC error → the catalog still renders every card (${cards})`);
  for (const row of CATALOG_USERS) {
    const label = await addedBy(fp, row.display_name);
    assert(label === 'משתמש לא מזוהה', `G-122-7: RPC error → fallback label (${row.display_name}: ${label})`);
  }
  assert(!(await fp.$('.admin-error')), 'G-122-7: RPC error → no catalog error message');
  assert((await addedBy(fp, 'אתר מילוי 1')) === 'מנהל מערכת', 'G-122-7: RPC error → other labels unchanged');
  await close(failing);
  return 'G-122-7 catalog: user-submitted cards «על ידי: <first> <last>» / email when the name is empty / «משתמש לא מזוהה» without a profile; no uuid text; one profile call per catalog load (distinct owners of source_type=user rows); RPC error → every card renders with the fallback, no error message';
}

// ─── 122.8 checks ─────────────────────────────────────────────────────────────
const INIT_1228 = 'window.__pv1228 = true;';
const LONG_NAME = 'אתר עם שם ארוך מאוד מאוד שממשיך וממשיך ולא נגמר גם אחרי שתי שורות שלמות של טקסט בכרטיס';
const LONG_CATEGORY = 'קטגוריה עם שם ארוך מאוד שלא נכנס בשורה אחת של הכרטיס';

/** Card geometry of one grid: heights, footer gap to the card bottom, name clamp, chip row. */
const cardGeometry = (page, cardSel, footerSel) =>
  page.$$eval(
    cardSel,
    (cards, footerSel) =>
      cards.map((card) => {
        const r = card.getBoundingClientRect();
        const footer = card.querySelector(footerSel)?.getBoundingClientRect();
        const name = card.querySelector('.admin-site-card-name');
        const lh = name ? parseFloat(getComputedStyle(name).lineHeight) : 0;
        const row = card.querySelector('[data-part="chip-row"]');
        const chips = row ? [...row.children].filter((c) => c.matches('.admin-badge')) : [];
        return {
          text: name?.textContent ?? '',
          title: name?.getAttribute('title') ?? null,
          height: r.height,
          footerGap: footer ? r.bottom - footer.bottom : null,
          nameLines: name && lh ? Math.round(name.getBoundingClientRect().height / lh) : 0,
          nameClipped: name ? name.scrollHeight > name.clientHeight + 1 : false,
          chipTops: chips.map((c) => Math.round(c.getBoundingClientRect().top)),
          chipLabels: chips.map((c) => c.textContent),
          more: row?.querySelector('[data-chip="more"]')?.getAttribute('title') ?? null,
          rowOverflow: row ? row.scrollWidth > row.clientWidth + 1 : false,
        };
      }),
    footerSel,
  );

function assertUniform(cards, label) {
  assert(cards.length > 1, `${label}: cards rendered (${cards.length})`);
  const hs = cards.map((c) => c.height);
  assert(Math.max(...hs) - Math.min(...hs) <= 1, `${label}: every card has one height (${Math.round(Math.min(...hs))}–${Math.round(Math.max(...hs))})`);
  const gaps = cards.map((c) => c.footerGap);
  assert(gaps.every((g) => g !== null && g >= 0) && Math.max(...gaps) - Math.min(...gaps) <= 1, `${label}: footer pinned to the card bottom (${gaps.map((g) => g === null ? 'none' : Math.round(g)).join(',')})`);
  for (const c of cards) {
    assert(c.nameLines >= 1 && c.nameLines <= 2, `${label}: name ≤ 2 lines (${c.text.slice(0, 20)}: ${c.nameLines})`);
    assert(c.title === c.text, `${label}: name tooltip = full name (${c.text.slice(0, 20)})`);
    assert(new Set(c.chipTops).size <= 1 && !c.rowOverflow, `${label}: chips on one line, no overflow (${c.text.slice(0, 20)})`);
  }
}

async function checkUniformCards(dir) {
  for (const width of [1280, 1440, 1920]) {
    const s = await openApp(dir, { width, init: INIT_1228 });
    const { page } = s;
    await page.waitForTimeout(120);
    const catalog = await cardGeometry(page, '.admin-card-grid > li > .admin-site-card', '[data-part="card-footer"]');
    assertUniform(catalog, `${width}px catalog`);
    const long = catalog.find((c) => c.text === LONG_NAME);
    assert(long && long.nameLines === 2 && long.nameClipped, `${width}px: long name clamped to 2 lines (${long?.nameLines}, clipped ${long?.nameClipped})`);
    assert(long.more !== null && long.more.includes(LONG_CATEGORY) === !long.chipLabels.includes(LONG_CATEGORY), `${width}px: overflow → «+N» chip whose tooltip lists the hidden chips (${long.chipLabels.join(' | ')} / ${long.more})`);
    const hidden = long.more.split(', ');
    const plus = long.chipLabels.find((t) => t.startsWith('+'));
    assert(plus === `+${hidden.length}` && long.chipLabels.length - 1 + hidden.length === 3, `${width}px: «+N» counts the hidden chips, none removed (${plus}, ${hidden.length})`);
    const short = catalog.find((c) => c.text === 'אתר מילוי 1');
    assert(short && short.more === null && short.chipLabels.length === 3, `${width}px: cards that fit show every chip, no «+N»`);
    const bad = await audit(page, 'section.admin-section--registry', '.admin-catalog');
    assert(bad.length === 0, `${width}px catalog: ${bad.slice(0, 3).join('; ')}`);
    if (width === 1440) {
      await shot(page, '122-8-catalog-1440');
      await page.locator('[data-card-id="svc-sp-invalid"]').scrollIntoViewIfNeeded();
      await shot(page, '122-8-catalog-1440-badges');
    }

    await page.click('[data-nav="approvals"]');
    await page.waitForSelector('.admin-pending-card');
    await page.waitForTimeout(120);
    assertUniform(await cardGeometry(page, '.admin-pending-grid > li.admin-pending-card', '[data-part="card-footer"]'), `${width}px submissions`);
    if (width === 1440) await shot(page, '122-8-submissions-1440');

    await page.click('.admin-nav-btn:has-text("קטגוריות")');
    await page.waitForSelector('.admin-category-rows > li');
    const rowsH = await page.$$eval('.admin-category-rows > li', (els) => els.map((e) => e.getBoundingClientRect().height));
    assert(rowsH.length > 1 && Math.max(...rowsH) - Math.min(...rowsH) <= 1, `${width}px categories: every row one height (${Math.round(Math.min(...rowsH))}–${Math.round(Math.max(...rowsH))})`);
    await close(s);
  }
  return '122.8 R1: catalog, submissions and categories — one card / row height per grid at 1280 / 1440 / 1920; name ≤ 2 lines with a full-name tooltip; chips on one line, overflow → «+N» with the hidden chips in its tooltip (none removed); footer pinned to the bottom; no overflow';
}

const APPROVAL_EXPECTED = {
  'svc-std-approved': 'approved',
  'svc-std-changed': 'not_approved',
  'svc-std-partial': 'not_approved',
  'svc-plain': 'not_approved',
  'svc-multi': 'not_approved',
  'svc-sp-partial': 'not_approved',
  'svc-sp-approved': 'approved',
  'svc-sp-changed': 'approved',
  'svc-sp-invalid': 'blocked',
  'svc-f1': 'no_mapping',
};
const APPROVAL_HE = { approved: 'מאושר למשתמשים', not_approved: 'טרם אושר למשתמשים', blocked: 'חסום למשתמשים', no_mapping: 'אין מיפוי' };

async function checkApprovalBadge(dir) {
  const s = await openApp(dir, { init: INIT_1228 });
  const { page } = s;
  const names = await page.evaluate(() => Object.fromEntries(globalThis.__pvdb.rows.map((r) => [r.id, r.display_name])));
  for (const [id, want] of Object.entries(APPROVAL_EXPECTED)) {
    const card = page.locator(`[data-card-id="${id}"]`);
    const pill = card.locator('[data-approval]');
    assert((await pill.count()) === 1, `R3: one badge on the ${id} card`);
    const got = await pill.getAttribute('data-approval');
    assert(got === want && (await pill.textContent()) === APPROVAL_HE[want], `R3: ${id} card → «${APPROVAL_HE[want]}» (got ${got})`);
    const pos = await card.evaluate((c) => {
      const p = c.querySelector('[data-approval]').getBoundingClientRect();
      const r = c.getBoundingClientRect();
      return { top: p.top - r.top, left: p.left - r.left, first: c.firstElementChild?.contains(c.querySelector('[data-approval]')) };
    });
    assert(pos.first && pos.top <= 20 && pos.left <= 24, `R3: ${id} badge in the top corner (top ${Math.round(pos.top)}, left ${Math.round(pos.left)})`);
  }
  const fills = await page.$$eval('[data-card-id] [data-approval]', (els) =>
    Object.fromEntries(els.map((e) => [e.getAttribute('data-approval'), getComputedStyle(e).backgroundColor])));
  assert(fills.approved === 'rgb(21, 128, 61)' && fills.not_approved === 'rgb(217, 119, 6)' && fills.blocked === 'rgb(190, 18, 60)', `R3: filled green / amber / red (${JSON.stringify(fills)})`);
  assert(fills.no_mapping === 'rgb(241, 245, 249)', `R3: «אין מיפוי» neutral (${fills.no_mapping})`);

  // Header: same helper (same state as the card), larger filled pill with an icon, dominant over the status chip.
  for (const id of Object.keys(APPROVAL_EXPECTED)) {
    await openSite(page, names[id]);
    const head = page.locator('[data-part="site-strip"] [data-approval]');
    assert((await head.getAttribute('data-approval')) === APPROVAL_EXPECTED[id], `R3: header = card for ${id} (${await head.getAttribute('data-approval')})`);
    if (id === 'svc-std-approved') {
      const cmp = await page.evaluate(() => {
        const pill = document.querySelector('[data-part="site-strip"] [data-approval]');
        const chip = document.querySelector('[data-status="site-status"]');
        const name = document.querySelector('[data-part="site-name"]');
        const b = (el) => el.getBoundingClientRect();
        return {
          pillH: b(pill).height, chipH: b(chip).height, pillW: b(pill).width, chipW: b(chip).width,
          pillFont: parseFloat(getComputedStyle(pill).fontSize), chipFont: parseFloat(getComputedStyle(chip).fontSize),
          icon: Boolean(pill.querySelector('svg')), nextToName: Math.abs(b(pill).top + b(pill).height / 2 - (b(name).top + b(name).height / 2)) < 12,
          beforeChip: Boolean(pill.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING),
        };
      });
      assert(cmp.pillH > cmp.chipH && cmp.pillFont > cmp.chipFont && cmp.pillW > cmp.chipW && cmp.icon, `R3: header pill larger than «פעיל» with an icon (${JSON.stringify(cmp)})`);
      assert(cmp.nextToName && cmp.beforeChip, 'R3: header pill next to the site name, before the status chip');
      await shot(page, '122-8-header-approved');
      // Editor state never changes the badge: unsaved «פרטי כניסה» change keeps «מאושר למשתמשים».
      await page.locator('label.admin-field', { hasText: 'פרטי כניסה' }).locator('select').selectOption('no_stored_credentials');
      await page.waitForTimeout(80);
      assert((await head.getAttribute('data-approval')) === 'approved', 'R3: unsaved editor change does not move the header badge');
      await answer(s, true);
    }
    if (id === 'svc-sp-approved') {
      await tab(page, 'login');
      await page.click('[data-action="special-remove-field"]');
      await page.waitForTimeout(80);
      assert((await head.getAttribute('data-approval')) === 'approved', 'R3: unsaved SPECIAL draft change does not move the header badge');
      await answer(s, true);
    }
    await back(page);
  }
  assert((await writeCount(page)) === 0, 'R3: presentation only (no writes)');
  await close(s);
  return '122.8 R3: one badge per catalog card, top corner — approved STANDARD green; STANDARD changed after approval / partial / unapproved amber; SPECIAL approved and SPECIAL changes_not_approved green; SPECIAL_INVALID red; no mapping neutral; header pill = card state (same helper), larger, filled, icon, next to the name before «פעיל»; unsaved editor changes never move it';
}

async function checkFillTestGate(dir) {
  const s = await openApp(dir, { init: INIT_1228 });
  const { page } = s;
  const fillAll = async () => {
    const inputs = page.locator('[data-tab-panel="test"] [data-temp-test-field]');
    const n = await inputs.count();
    for (let i = 0; i < n; i += 1) await inputs.nth(i).fill(`v${i}`);
    return n;
  };
  const runEnabled = () => page.getAttribute('[data-tab-panel="test"] [data-action="managed-test"]', 'data-enabled');
  const notice = '[data-tab-panel="test"] [data-notice="fill-test-incomplete"]';
  const title = 'המיפוי השמור עדיין לא הושלם — לא ניתן להריץ בדיקת מילוי.';

  await openSite(page, 'רגיל חלקי');
  await tab(page, 'test');
  assert((await fillAll()) === 2, 'R2 STANDARD partial: temp inputs shown');
  assert((await runEnabled()) === 'false' && (await page.isDisabled('[data-tab-panel="test"] [data-action="managed-test"]')), 'R2 STANDARD 1 of 2 mapped: run disabled (all temp values filled)');
  assert(await visible(page, notice), 'R2 STANDARD partial: in-tab notice shown');
  assert((await page.textContent(`${notice} .admin-fill-test-incomplete-title`)) === title, 'R2: notice title');
  const detail = await page.textContent(`${notice} [data-part="fill-test-incomplete-detail"]`);
  assert(detail.includes('סיסמה') && !detail.includes('אימייל'), `R2 STANDARD: notice names the unmapped field only (${detail})`);
  assert(!(await page.$('.admin-toast, [role="alert"][data-toast]')), 'R2: notice, not a toast');
  await shot(page, '122-8-test-blocked');
  await page.click(`${notice} [data-action="go-to-login-tab"]`);
  await page.waitForTimeout(60);
  assert((await activeTab(page)) === 'login', 'R2: «מעבר להגדרת כניסה ומילוי» switches to the login tab');
  await back(page);

  await openSite(page, STANDARD);
  await tab(page, 'test');
  await fillAll();
  assert((await runEnabled()) === 'true' && !(await page.$(notice)), 'R2 STANDARD all fields mapped: run enabled, no notice');
  await back(page);

  await openSite(page, 'מיוחד חלקי');
  await tab(page, 'test');
  const spInputs = await fillAll();
  assert(spInputs >= 1 && (await runEnabled()) === 'false', `R2 SPECIAL incomplete: run disabled (${spInputs} temp inputs filled)`);
  const gap = await page.evaluate(() => globalThis.__pvSpecialGap['svc-sp-partial']);
  assert((await page.textContent(`${notice} [data-part="fill-test-incomplete-detail"]`)) === gap, `R2 SPECIAL: notice shows the checkSpecialDraft message (${gap})`);
  await page.click(`${notice} [data-action="go-to-login-tab"]`);
  await page.waitForTimeout(60);
  assert((await activeTab(page)) === 'login', 'R2 SPECIAL: button switches to the login tab');
  // Partial saves stay allowed.
  const before = await writeCount(page);
  await page.click('[data-action="special-remove-field"]');
  await page.waitForTimeout(60);
  await page.click('[data-action="save-special-draft"]');
  await page.waitForFunction((n) => globalThis.__writes.length > n, before, { timeout: 3000 });
  await page.waitForTimeout(120);
  await back(page);

  await openSite(page, MULTI);
  await tab(page, 'test');
  await fillAll();
  assert((await runEnabled()) === 'true' && !(await page.$(notice)), 'R2 SPECIAL complete: run enabled, no notice');
  await answer(s, true);
  await close(s);
  return '122.8 R2: STANDARD 1 of 2 mapped → run disabled + in-tab notice naming the unmapped field; all mapped → enabled; SPECIAL incomplete → disabled + the checkSpecialDraft message; complete → enabled; «מעבר להגדרת כניסה ומילוי» switches tabs; partial SPECIAL save still written';
}

async function checkNotes(dir) {
  const s = await openApp(dir, { init: INIT_1228 });
  const { page } = s;
  await page.waitForTimeout(100);
  assert((await page.evaluate(() => globalThis.__noteIdCalls)) === 1, 'R4: one ids-only notes query per catalog load');
  const marker = (id) => page.locator(`[data-card-id="${id}"] [data-marker="has-note"]`);
  assert((await marker('svc-f1').count()) === 1 && (await marker('svc-f2').count()) === 0, 'R4: «יש הערה» only on cards with a note');
  assert((await marker('svc-f1').textContent()) === 'יש הערה', 'R4: marker text');

  await openSite(page, 'אתר מילוי 1');
  await tab(page, 'notes');
  assert((await activeTab(page)) === 'notes' && (await panelShown(page, 'notes')) && !(await panelShown(page, 'test')), 'R4: «הערות» tab shown');
  const area = page.locator('[data-tab-panel="notes"] [data-field="admin-note"]');
  await page.waitForSelector('[data-tab-panel="notes"] [data-field="admin-note"]');
  assert((await area.inputValue()) === 'להתקשר לתמיכה לפני שינוי מיפוי.', 'R4: saved note loaded');
  const updated = () => page.textContent('[data-tab-panel="notes"] [data-part="notes-updated-at"]');
  const u1 = await updated();
  assert(u1.startsWith('עודכן לאחרונה: ') && u1.includes('10:30') && u1.includes('2026'), `R4: «עודכן לאחרונה: <date HH:mm>» in Israel time (${u1})`);
  assert((await page.textContent('[data-tab-panel="notes"] [data-part="notes-helper"]')) === 'ההערות גלויות למנהלים בלבד. לא לשמור כאן סיסמאות.', 'R4: helper line');
  const save = '[data-tab-panel="notes"] [data-action="save-note"]';
  const cancel = '[data-tab-panel="notes"] [data-action="cancel-note"]';
  assert((await page.textContent(save)) === 'שמור הערה' && (await page.textContent(cancel)) === 'בטל שינויים', 'R4: «שמור הערה» / «בטל שינויים» inside the tab');
  assert((await page.isDisabled(save)) && (await page.isDisabled(cancel)), 'R4: buttons disabled while clean');
  assert(!(await visible(page, '[data-part="save-bar"] button[type="submit"]')), 'R4: no service save bar on «הערות»');
  const measure = () =>
    page.$eval('[data-tab-panel="notes"] [data-field="admin-note"]', (el) => {
      const card = el.closest('[data-section="admin-notes"]');
      const cc = getComputedStyle(card);
      const tc = getComputedStyle(el);
      return {
        w: el.getBoundingClientRect().width,
        h: el.getBoundingClientRect().height,
        cardW: card.getBoundingClientRect().width,
        cardContent: card.clientWidth - parseFloat(cc.paddingLeft) - parseFloat(cc.paddingRight),
        lines: (el.clientHeight - parseFloat(tc.paddingTop) - parseFloat(tc.paddingBottom)) / parseFloat(tc.lineHeight),
        sh: el.scrollHeight,
        ch: el.clientHeight,
        overflowY: tc.overflowY,
        max: window.innerHeight * 0.7,
      };
    });
  const geo = await measure();
  assert(
    Math.abs(geo.w - geo.cardContent) <= 1 && geo.w <= 960.5 && geo.cardW <= 960.5 && geo.w > 600,
    `G-122-10: textarea = card content width, card ≤ 960px, not the 560px cap (textarea ${Math.round(geo.w)}, card content ${Math.round(geo.cardContent)}, card ${Math.round(geo.cardW)})`,
  );
  assert(geo.lines >= 13.9, `G-122-10: textarea starts at ≥ 14 lines (${geo.lines.toFixed(1)})`);

  await area.fill(Array.from({ length: 20 }, (_, i) => `שורה ${i + 1}`).join('\n'));
  await page.waitForTimeout(60);
  const mid = await measure();
  assert(mid.h > geo.h + 60 && mid.h < mid.max && mid.sh <= mid.ch + 2, `G-122-10: textarea grows with the text, no inner scroll below the max (${Math.round(geo.h)} → ${Math.round(mid.h)}, max ${Math.round(mid.max)})`);
  await area.fill(Array.from({ length: 30 }, (_, i) => `שורה ארוכה מספר ${i + 1} — הערה פנימית למנהלים על האתר`).join('\n'));
  await page.waitForTimeout(60);
  const tall = await measure();
  assert(
    tall.h > mid.h && Math.abs(tall.h - tall.max) <= 2 && tall.sh > tall.ch + 2 && tall.overflowY === 'auto',
    `G-122-10: 30 lines → grows up to ~70vh, then scrolls inside (${Math.round(tall.h)} / max ${Math.round(tall.max)}, overflow ${tall.overflowY})`,
  );
  await shot(page, 'g-122-10-notes-long');
  await page.click(cancel);
  assert((await area.inputValue()) === 'להתקשר לתמיכה לפני שינוי מיפוי.' && (await page.isDisabled(save)), 'R4: «בטל שינויים» restores the saved note');

  await area.fill('הערה חדשה למנהלים');
  await answer(s, false);
  await back(page);
  assert((await dialogs(s)).at(-1) === HE.unsavedLeave && (await mode(page)) === 'workspace', 'R4: unsaved note → leave guard asks; Cancel stays');
  assert((await area.inputValue()) === 'הערה חדשה למנהלים', 'R4: Cancel keeps the unsaved note');
  await page.click(save);
  await page.waitForSelector('[data-tab-panel="notes"] [data-notice="note-saved"]');
  const w = await page.evaluate(() => globalThis.__writes.filter((x) => x.fn === 'saveAdminServiceNote'));
  assert(w.length === 1 && w[0].args[0] === 'svc-f1' && w[0].args[1] === 'הערה חדשה למנהלים', `R4: «שמור הערה» saves the note (${JSON.stringify(w)})`);
  assert(!(await page.evaluate(() => globalThis.__writes.some((x) => x.fn !== 'saveAdminServiceNote'))), 'R4: saving a note writes nothing else (no registry / metadata write)');
  const u2 = await updated();
  assert(u2.includes('12:15') && u2 !== u1, `R4: «עודכן לאחרונה» updated after save (${u2})`);
  await shot(page, '122-8-notes');
  const asked = (await dialogs(s)).length;
  await back(page);
  assert((await dialogs(s)).length === asked && (await mode(page)) === 'catalog', 'R4: saved note → leave without asking');

  await openSite(page, 'אתר מילוי 2');
  await tab(page, 'notes');
  await page.waitForSelector('[data-tab-panel="notes"] [data-field="admin-note"]');
  assert((await updated()) === 'אין עדיין הערה לאתר זה.' && (await area.inputValue()) === '', 'R4: site without a note → empty textarea');
  await area.fill('הערה ראשונה');
  await page.click(save);
  await page.waitForSelector('[data-tab-panel="notes"] [data-notice="note-saved"]');
  await back(page);
  assert((await marker('svc-f2').count()) === 1, 'R4: marker appears after saving a first note');
  await openSite(page, 'אתר מילוי 2');
  await tab(page, 'notes');
  await page.waitForSelector('[data-tab-panel="notes"] [data-field="admin-note"]');
  await area.fill('');
  await page.click(save);
  await page.waitForTimeout(120);
  await back(page);
  assert((await marker('svc-f2').count()) === 0, 'R4: emptied note → marker removed');
  await openSite(page, 'רגיל חלקי');
  await tab(page, 'notes');
  assert(await visible(page, '[data-tab-panel="notes"] [data-section="admin-notes"]'), 'R4: «הערות» available on every site');
  await back(page);
  await openSite(page, USER_OWNED);
  await tab(page, 'notes');
  assert(await visible(page, '[data-tab-panel="notes"] [data-section="admin-notes"]'), 'R4: «הערות» available on a user submission too');
  await back(page);
  await close(s);

  const failing = await openApp(dir, { init: `${INIT_1228} window.__pvNoteIdsFail = true;` });
  await failing.page.waitForTimeout(150);
  assert((await failing.page.$$('[data-marker="has-note"]')).length === 0, 'R4: notes query error → no markers');
  assert((await failing.page.$$eval('[data-part="catalog"] li', (els) => els.length)) >= 12 && !(await failing.page.$('.admin-error')), 'R4: notes query error → catalog still loads, no error');
  await close(failing);
  return '122.8 R4 / G-122-10: «הערות» tab (every site, user submissions too): saved note + «עודכן לאחרונה» (Israel time) + helper line; textarea = card content width (≤ 960px), ≥ 14 lines, auto-grows to ~70vh then scrolls; «שמור הערה» / «בטל שינויים» in the tab; unsaved note joins the leave guard; save writes the note only; «יש הערה» marker from one ids-only query, updated after save / clear; query error → no markers, catalog loads';
}

async function checkHelperShared() {
  const reg = read('src/admin/RegistryAdmin.tsx');
  const uses = [...reg.matchAll(/<UserApprovalBadge row=\{([^}]+)\}/g)].map((m) => m[1]);
  assert(uses.length === 2 && uses.includes('row') && uses.includes('selectedRow'), `R3: header and cards render UserApprovalBadge from the saved row (${uses.join(', ')})`);
  const badge = read('src/admin/UserApprovalBadge.tsx');
  assert(/userApprovalState\(row\)/.test(badge), 'R3: the badge reads the shared pure helper');
  const helper = read('src/admin/userApproval.ts');
  assert(/resolveActiveLoginContract\(metadata\)/.test(helper) && /isVersionMatchedValidated\(profile\)/.test(helper) && /mappingsCoverRequiredSchema\(profile, resolved\.fields\)/.test(helper), 'R3: helper follows the runtime (active contract; version-matched validated profile covering the login fields)');
  assert(!/from 'react'|useState|draftDirty|specialDraftDirty/.test(helper), 'R3: helper is pure, no editor state');
  return '122.8 R3: header and cards render the same UserApprovalBadge from the saved row; one pure helper derived from the runtime contract (no editor state)';
}

/** D-121-72 «עצור» in «בדיקת מילוי» + G-122-11 (a) field-to-action spacing. */
async function checkStopFillTest(dir) {
  const s = await openApp(dir, { init: INIT_1228 });
  const { page } = s;
  const runBtn = '[data-tab-panel="test"] [data-action="managed-test"]';
  const stopBtn = '[data-tab-panel="test"] [data-action="stop-fill-test"]';
  const stopped = '[data-tab-panel="test"] [data-notice="fill-test-stopped"]';
  const fillAll = async () => {
    const inputs = page.locator('[data-tab-panel="test"] [data-temp-test-field]');
    const n = await inputs.count();
    for (let i = 0; i < n; i += 1) await inputs.nth(i).fill(`v${i}`);
    return n;
  };
  const extTypes = () => page.evaluate(() => window.__ext.slice());

  await openSite(page, STANDARD);
  await tab(page, 'test');
  assert((await fillAll()) > 0, 'D-121-72: STANDARD temp inputs shown');
  const gap = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('[data-tab-panel="test"] [data-temp-test-field]')];
    const btn = document.querySelector('[data-tab-panel="test"] [data-action="managed-test"]');
    const token = parseFloat(getComputedStyle(btn).getPropertyValue('--admin-space-2'));
    return { gap: btn.getBoundingClientRect().top - inputs.at(-1).getBoundingClientRect().bottom, token };
  });
  assert(gap.token > 0 && Math.abs(gap.gap - gap.token) <= 0.5, `G-122-11 (a): last temp input → «כניסה לאתר ומילוי שדות» gap = 122.4 token (${gap.gap.toFixed(1)}px vs --admin-space-2 ${gap.token}px)`);
  assert(!(await page.$(stopBtn)), 'D-121-72: «עצור» hidden while idle');

  await page.click(runBtn);
  await page.waitForFunction((sel) => document.querySelector(sel)?.textContent === 'ממלא…', runBtn, { timeout: 3000 });
  assert(await visible(page, stopBtn), 'D-121-72: «עצור» shown while running');
  assert((await page.textContent(stopBtn)) === 'עצור', 'D-121-72: «עצור» label');
  const row = await page.evaluate(([a, b]) => {
    const r1 = document.querySelector(a).getBoundingClientRect();
    const r2 = document.querySelector(b).getBoundingClientRect();
    return { sameRow: Math.abs(r1.top - r2.top) < 1, apart: Math.abs(r1.left - r2.left) > 0 };
  }, [runBtn, stopBtn]);
  assert(row.sameRow && row.apart, 'D-121-72: «עצור» next to «ממלא…»');
  await shot(page, 'd-121-72-running-stop');

  await page.click(stopBtn);
  await page.waitForSelector(stopped, { timeout: 2000 });
  assert((await page.textContent(stopped)) === 'הבדיקה נעצרה.', 'D-121-72: «הבדיקה נעצרה.» after «עצור»');
  assert((await page.textContent(runBtn)) === 'כניסה לאתר ומילוי שדות' && !(await page.$(stopBtn)), 'D-121-72: back to idle, «עצור» hidden');
  assert(!(await page.$('[data-tab-panel="test"] .admin-error')), 'D-121-72: a stop is a notice, not an error');
  const types = await extTypes();
  assert(types.indexOf('HUB_MANAGED_AUTOFILL_CANCEL') > types.indexOf('HUB_MANAGED_AUTOFILL') && types.includes('HUB_MANAGED_AUTOFILL'), `D-121-72: «עצור» sends the cancel after the run (${types.join(', ')})`);
  await shot(page, 'd-121-72-stopped');

  await page.click(runBtn);
  await page.waitForFunction((sel) => document.querySelector(sel)?.textContent === 'ממלא…', runBtn, { timeout: 3000 });
  assert(!(await page.textContent('[data-tab-panel="test"]')).includes('כבר בתהליך'), 'D-121-72: a new run is allowed right after «עצור» (not busy)');
  assert(!(await page.$(stopped)), 'D-121-72: the stop notice clears on a new run');
  await page.click(stopBtn);
  await page.waitForSelector(stopped, { timeout: 2000 });
  await back(page);

  await openSite(page, MULTI);
  await tab(page, 'test');
  await fillAll();
  await page.click(runBtn);
  await page.waitForFunction((sel) => document.querySelector(sel)?.textContent === 'ממלא…', runBtn, { timeout: 3000 });
  assert(await visible(page, stopBtn), 'D-121-72: «עצור» on a SPECIAL run too');
  await page.click(stopBtn);
  await page.waitForSelector(stopped, { timeout: 2000 });
  assert(!(await page.$('[data-tab-panel="test"] [data-part="special-test-result"], [data-tab-panel="test"] .admin-error')), 'D-121-72: SPECIAL stop shows the notice, no failure card');
  const spTypes = await extTypes();
  assert(spTypes.includes('HUB_SPECIAL_LOGIN_FLOW') && spTypes.lastIndexOf('HUB_MANAGED_AUTOFILL_CANCEL') > spTypes.lastIndexOf('HUB_SPECIAL_LOGIN_FLOW'), 'D-121-72: SPECIAL «עצור» sends the cancel');
  await close(s);
  return 'D-121-72 / G-122-11 (a): «עצור» only while «ממלא…», next to it; stop → cancel sent, «הבדיקה נעצרה.» notice (STANDARD + SPECIAL), new run allowed at once; last temp input → run button gap = --admin-space-2';
}

/** G-122-11 (b): notes textarea per-line direction (rtl base, plaintext, start); saved text unchanged. */
async function checkNotesBidi(dir) {
  const s = await openApp(dir, { init: INIT_1228 });
  const { page } = s;
  await openSite(page, 'אתר מילוי 2');
  await tab(page, 'notes');
  const sel = '[data-tab-panel="notes"] [data-field="admin-note"]';
  await page.waitForSelector(sel);
  const style = await page.$eval(sel, (el) => {
    const cs = getComputedStyle(el);
    return { dir: el.getAttribute('dir'), bidi: cs.unicodeBidi, align: cs.textAlign, direction: cs.direction };
  });
  assert(style.dir === 'rtl' && style.direction === 'rtl', `G-122-11 (b): textarea dir="rtl" (${style.dir} / ${style.direction})`);
  assert(style.bidi === 'plaintext', `G-122-11 (b): computed unicode-bidi plaintext (${style.bidi})`);
  assert(style.align === 'start', `G-122-11 (b): computed text-align start (${style.align})`);
  const text = ['הערה בעברית לפני שינוי מיפוי', 'Login page moved to /signin', '123.', 'Support: +972-3-5551234', 'לבדוק את English login מחר', '2FA code via SMS — לא לשמור כאן'].join('\n');
  await page.fill(sel, text);
  await shot(page, 'g-122-11-notes-bidi');
  await page.click('[data-tab-panel="notes"] [data-action="save-note"]');
  await page.waitForSelector('[data-tab-panel="notes"] [data-notice="note-saved"]');
  const w = await page.evaluate(() => globalThis.__writes.filter((x) => x.fn === 'saveAdminServiceNote'));
  assert(w.length === 1 && w[0].args[1] === text, 'G-122-11 (b): the saved text is unchanged (no direction marks added)');
  await close(s);
  return 'G-122-11 (b): notes textarea dir="rtl" + unicode-bidi: plaintext + text-align: start (computed); mixed Hebrew / English / number lines saved byte-identical';
}

/** G-122-12 (a): «אתר חדש» ~ one filter select wide next to the search / filter card; full width above it ≤ 1024px. */
async function checkNewSiteButton(dir) {
  const box = (page, sel) => page.$eval(sel, (el) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }; });
  const overflow = (page) => page.evaluate(() => {
    const doc = document.documentElement;
    const bar = document.querySelector('.admin-catalog-bar');
    return { page: doc.scrollWidth - doc.clientWidth, bar: bar.scrollWidth - bar.clientWidth };
  });
  for (const width of [1280, 1440, 1920, 1024]) {
    const s = await openApp(dir, { width });
    const { page } = s;
    const btn = await box(page, '[data-action="new-site"]');
    const card = await box(page, '.admin-catalog-bar .admin-filters');
    const bar = await box(page, '.admin-catalog-bar');
    const ov = await overflow(page);
    assert(ov.page <= 0 && ov.bar <= 0, `G-122-12 ${width}px: no horizontal overflow (page ${ov.page}px, bar ${ov.bar}px)`);
    assert((await page.$$('[data-action="new-site"] svg.admin-icon')).length === 1 && (await page.textContent('[data-action="new-site"]')) === 'אתר חדש', `G-122-12 ${width}px: «+» icon + «אתר חדש»`);
    if (width > 1024) {
      assert(btn.width >= 160 && btn.width <= 200, `G-122-12 ${width}px: «אתר חדש» ~ one filter select wide (${Math.round(btn.width)}px, expected 160–200)`);
      assert(Math.abs(btn.height - card.height) <= 1 && Math.abs(btn.top - card.top) <= 1, `G-122-12 ${width}px: same height / top as the search / filter card (${Math.round(btn.height)}/${Math.round(card.height)})`);
      assert(Math.abs(card.width + btn.width - bar.width) <= 12 && card.right > btn.right, `G-122-12 ${width}px: the card takes the remaining width, button on the end side (card ${Math.round(card.width)} + button ${Math.round(btn.width)} of ${Math.round(bar.width)})`);
      if (width === 1440) await shot(page, 'g-122-12-toolbar-1440');
    } else {
      assert(Math.abs(btn.width - card.width) <= 1 && Math.abs(btn.width - bar.width) <= 1, `G-122-12 1024px: «אתר חדש» full width (${Math.round(btn.width)} / card ${Math.round(card.width)})`);
      assert(btn.bottom <= card.top, `G-122-12 1024px: button above the card (button bottom ${Math.round(btn.bottom)}, card top ${Math.round(card.top)})`);
      await shot(page, 'g-122-12-toolbar-1024');
    }
    await close(s);
  }
  return 'G-122-12 (a): «+ אתר חדש» 160–200px wide, same height / top as the search / filter card, card takes the rest (1280 / 1440 / 1920); full width above the card at 1024; no horizontal overflow';
}

/** G-122-12 (b): category required on every «שמור» in «פרטי אתר» (create and edit); new site starts empty. */
async function checkCategoryRequired(dir) {
  const noCategory = { id: 'svc-nocat', display_name: 'אתר בלי קטגוריה', host: 'nocat.example.test', fields: { category_id: null } };
  const s = await openApp(dir, { init: `window.__pvExtraRows = ${JSON.stringify([noCategory])};` });
  const { page } = s;
  const select = '[data-tab-panel="details"] select[data-field="category"]';
  const err = '[data-tab-panel="details"] [data-error="category-required"]';
  const submit = 'form.admin-edit-shell button[type="submit"]';
  const writes = () => page.evaluate(() => globalThis.__writes.slice());
  const focused = () => page.evaluate((sel) => document.activeElement === document.querySelector(sel), select);

  await page.click('[data-action="new-site"]');
  assert((await page.inputValue(select)) === '', `G-122-12: new site starts with no category (${await page.inputValue(select)})`);
  const placeholder = await page.$eval(`${select} option[value=""]`, (o) => ({ text: o.textContent, disabled: o.disabled }));
  assert(placeholder.text === 'בחרו קטגוריה' && placeholder.disabled, `G-122-12: placeholder «בחרו קטגוריה», not selectable (${JSON.stringify(placeholder)})`);
  assert(!(await page.$(`${select} option:not([value=""])[selected]`)) && !(await page.$(err)), 'G-122-12: nothing pre-selected, no error before save');
  await nameInput(page).fill('אתר חדש לקטגוריה');
  await page.locator('.admin-field', { hasText: 'כתובת הבית' }).locator('input').first().fill('https://newcat.example.test/');
  await page.click(submit);
  await page.waitForSelector(err, { timeout: 2000 });
  assert((await page.textContent(err)) === 'יש לבחור קטגוריה', 'G-122-12: inline «יש לבחור קטגוריה»');
  assert((await page.getAttribute(select, 'aria-invalid')) === 'true' && (await focused()), 'G-122-12: the select is marked invalid and focused');
  await page.waitForTimeout(250); // the input border-color transition (--admin-motion)
  const errColor = await page.$eval(err, (el) => getComputedStyle(el).color);
  const borderColor = await page.$eval(select, (el) => getComputedStyle(el).borderTopColor);
  assert(errColor === borderColor, `G-122-12: error text in the field-error colour (${errColor} vs border ${borderColor})`);
  assert((await writes()).length === 0, 'G-122-12: empty category → no save call');
  assert(!(await page.$('.admin-error[role="alert"]')) && (await mode(page)) === 'workspace', 'G-122-12: inline field error only (no page error), stays in the form');
  await shot(page, 'g-122-12-category-error');
  await page.selectOption(select, 'cat-b');
  assert(!(await page.$(err)) && (await page.getAttribute(select, 'aria-invalid')) === 'false', 'G-122-12: choosing a category clears the error');
  await page.click(submit);
  await page.waitForFunction(() => globalThis.__writes.length > 0, null, { timeout: 3000 });
  const created = (await writes()).filter((w) => w.fn === 'createGlobalRegistryRow');
  assert(created.length === 1 && created[0].args[0].category_id === 'cat-b', `G-122-12: save called with the chosen category_id (${JSON.stringify(created.map((w) => w.args[0].category_id))})`);
  await page.waitForTimeout(150);
  await back(page);

  await page.evaluate(() => globalThis.__writes.splice(0));
  await openSite(page, noCategory.display_name);
  assert((await page.inputValue(select)) === '', 'G-122-12: a row without a category shows the placeholder');
  await nameInput(page).fill(`${noCategory.display_name} ערוך`);
  await tab(page, 'login');
  await page.evaluate(() => document.querySelector('form.admin-edit-shell').requestSubmit());
  await page.waitForSelector(err, { timeout: 2000 });
  assert((await activeTab(page)) === 'details' && (await focused()), 'G-122-12 edit: a submit from another tab returns to «פרטי אתר» with the select focused');
  assert((await writes()).length === 0, 'G-122-12 edit: row without a category → no save call');
  await page.selectOption(select, 'cat-a');
  await page.click(submit);
  await page.waitForFunction(() => globalThis.__writes.length > 0, null, { timeout: 3000 });
  const updated = (await writes()).filter((w) => w.fn === 'updateGlobalRegistryRow');
  assert(updated.length === 1 && updated[0].args[0] === 'svc-nocat' && updated[0].args[1].category_id === 'cat-a', `G-122-12 edit: saved with the chosen category (${JSON.stringify(updated.map((w) => w.args))})`);
  await page.waitForTimeout(150);
  await back(page);

  await page.evaluate(() => globalThis.__writes.splice(0));
  await openSite(page, STANDARD);
  assert((await page.inputValue(select)) === 'cat-a' && !(await page.$(err)), 'G-122-12: a row with a category is unchanged');
  await nameInput(page).fill(`${STANDARD} 3`);
  await page.click(submit);
  await page.waitForFunction(() => globalThis.__writes.length > 0, null, { timeout: 3000 });
  const kept = (await writes()).filter((w) => w.fn === 'updateGlobalRegistryRow');
  assert(kept.length === 1 && kept[0].args[1].category_id === 'cat-a', 'G-122-12: a row with a category saves as before (payload equality: checkSavePayload)');
  await page.waitForTimeout(150);
  await close(s);
  return 'G-122-12 (b): new site starts with no category («בחרו קטגוריה» placeholder, not selectable); «שמור» with no category → inline «יש לבחור קטגוריה», select invalid + focused, no save call (create, and edit from any tab); choosing one clears the error and saves that category_id; rows with a category unchanged';
}

/** G-122-10 (b): notes live only in `admin_service_notes` — nothing in src/ writes or reads `metadata.adminNotes`. */
async function checkNoMetadataNotes(dir) {
  const overrides = harnessOverrides.get(dir) ?? {};
  const hits = [];
  const walk = (rel) => {
    for (const name of readdirSync(join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${name.name}`;
      if (name.isDirectory()) walk(child);
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name.name)) {
        const src = Object.hasOwn(overrides, child) ? overrides[child] : read(child);
        if (/updateAdminNotes|\badminNotes\b/.test(src)) hits.push(child);
      }
    }
  };
  walk('src');
  assert(hits.length === 0, `G-122-10: no updateAdminNotes / metadata.adminNotes in src/ (${hits.join(', ')})`);
  return 'G-122-10: no updateAdminNotes / metadata.adminNotes writer or reader anywhere in src/ (notes only in admin_service_notes)';
}

const GROUPS = [
  [1, checkWidths],
  [1, checkModes],
  [1, checkGuard],
  [2, checkTabs],
  [2, checkTabRules],
  [2, checkSavePayload],
  [3, checkMultiStepLayout],
  [3, checkSaveBarSpace],
  [4, checkReadableWidths],
  [4, checkCategoriesTable],
  [5, checkSaveBarOnDetails],
  [5, checkPatternChange],
  [5, checkPatternReturn],
  [5, checkInAppDialogs],
  [5, checkFieldWarnings],
  [7, checkDetailsLinks],
  [7, checkHeader],
  [7, checkCatalogToolbar],
  [7, checkSubmissionCards],
  [7, checkCatalogSubmitters],
  [7, checkSubmissionLoginUrl],
  [7, checkStepCards],
  [8, checkNoMetadataNotes],
  [8, checkUniformCards],
  [8, checkApprovalBadge],
  [8, checkHelperShared],
  [8, checkFillTestGate],
  [8, checkNotes],
  [8, checkStopFillTest],
  [8, checkNotesBidi],
  [8, checkNewSiteButton],
  [8, checkCategoryRequired],
];

const G9_COMPLETENESS = [
  '          {draftCheck.complete ? (',
  '            <p className="admin-muted" data-status="mapping-completeness">',
  '              {draftCheck.message}',
  '            </p>',
  '          ) : (',
  '            <p className="admin-error" role="status" data-status="mapping-completeness">',
  '              {draftCheck.message}',
  '            </p>',
  '          )}',
].join('\n');
const G9_ACTIONS = [
  '          <div className="admin-actions-row">',
  '            <button',
  '              type="button"',
  '              className="admin-btn admin-btn-primary"',
  '              data-action="save-special-draft"',
  '              disabled={busy}',
  '              onClick={() => void saveDraft()}',
  '            >',
  '              {SPECIAL_ACTION_BAR_HE.saveDraft}',
  '            </button>',
  '            <button',
  '              type="button"',
  '              className="admin-btn admin-btn-primary"',
  '              data-action="activate-special"',
  '              disabled={busy || draftDirty || !draftCheck.complete || !approveGate.allowed}',
  '              onClick={requestActivateSpecial}',
  '            >',
  '              {SPECIAL_ACTIVATE_LABEL_HE[pattern as SpecialLoginPattern]}',
  '            </button>',
  '          </div>',
].join('\n');

const MUTATIONS = [
  [1, 'M1 guard missing (leave never asks)', 'src/admin/adminWorkspace.ts', '  return ask(ADMIN_WORKSPACE_HE.unsavedLeave);', '  return true;'],
  [1, 'M2 guard ignores the SPECIAL draft', 'src/admin/adminWorkspace.ts', '  return formDirty || specialDirty || notesDirty;', '  return formDirty || notesDirty;'],
  [1, 'M3 Admin nav leaves without asking', 'src/admin/AdminApp.tsx', "    if (tab === 'registry' && !(await confirmLeaveWorkspace(", "    if (false && !(await confirmLeaveWorkspace("],
  [1, 'M4 1100px cap restored', 'src/admin/admin.css', '  width: calc(100% - 3rem);\n  max-width: none;', '  width: min(1100px, calc(100% - 2.5rem));\n  max-width: 1100px;'],
  [1, 'M5 catalog kept next to the workspace', 'src/admin/RegistryAdmin.tsx', '      {!editing ? (\n        <>\n      <div className="admin-catalog-bar">', '      {true ? (\n        <>\n      <div className="admin-catalog-bar">'],
  [2, 'M6 login tab unmounts its editors', 'src/admin/RegistryAdmin.tsx', "                {!isUserOwnedRow && (\n                  <>\n                    {credentialMode === 'credential_fields' &&", "                {!isUserOwnedRow && workspaceTab === 'login' && (\n                  <>\n                    {credentialMode === 'credential_fields' &&"],
  [2, 'M7 test tab unmounts «בדיקת מילוי»', 'src/admin/RegistryAdmin.tsx', '                {managedGridsMounted && selectedRow ? (', "                {managedGridsMounted && selectedRow && workspaceTab === 'test' ? ("],
  [2, 'M8 tab switch changes the save payload', 'src/admin/RegistryAdmin.tsx', '                  onClick={() => setWorkspaceTab(tab.id)}', '                  onClick={() => { setWorkspaceTab(tab.id); setConfigurationTouched(false); }}'],
  [2, 'M9 invalid hidden field keeps the current tab', 'src/admin/RegistryAdmin.tsx', "              onInvalid={() => setWorkspaceTab('details')}\n", ''],
  [2, 'M10 create mode enables every tab', 'src/admin/adminWorkspace.ts', "  return tab === 'details' || !isCreating;", '  return true;'],
  [3, 'M11 «שילוב» selectable', 'src/admin/LoginPatternGrid.tsx', "  return pattern === 'FLOATING_SCREEN_MULTI_STEP';", '  return false;'],
  [3, 'M12 sidebar not driving the selected step', 'src/admin/SpecialLoginDraftEditor.tsx', '                      onClick={() => setSelectedStepId(item.stepId)}', '                      onClick={() => undefined}'],
  [3, 'M13 sidebar not following the selected step', 'src/admin/SpecialLoginDraftEditor.tsx', "aria-current={item.stepId === currentStepId ? 'step' : undefined}", "aria-current={item.stepId === 'step-1' ? 'step' : undefined}"],
  [3, 'M14 step button card dropped', 'src/admin/SpecialLoginDraftEditor.tsx', '            {stepSelector ? renderStepButtonPanel() : null}\n', ''],
  [3, 'M15 «שלב נוכחי» select rendered again', 'src/admin/SpecialLoginDraftEditor.tsx', '              <ol className="admin-special-steps-list"', '              <label className="admin-field" data-field="special-current-step"><span>שלב נוכחי</span><select value={selectedStepId} onChange={(e) => setSelectedStepId(e.target.value)}>{draft.steps.map((step) => <option key={step.stepId} value={step.stepId}>{step.stepId}</option>)}</select></label>\n              <ol className="admin-special-steps-list"'],
  [3, 'M16 bottom space for the save bar removed', 'src/admin/admin.css', '  scroll-padding-bottom: var(--admin-save-bar-height);\n', ''],
  [4, 'M17 input width cap removed', 'src/admin/admin.css', '  max-width: var(--admin-input-max);\n  min-height: var(--admin-input-h);', '  max-width: none;\n  min-height: var(--admin-input-h);'],
  [4, 'M18 horizontal overflow reintroduced', 'src/admin/admin.css', '.admin-field-grid {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);', '.admin-field-grid {\n  display: grid;\n  grid-template-columns: minmax(36rem, 1fr);'],
  [4, 'M19 nested scroll reintroduced (side stack)', 'src/admin/admin.css', '.admin-workspace-aside {\n  grid-row: 3;\n', '.admin-workspace-aside {\n  grid-row: 3;\n  max-height: 8rem;\n  overflow-y: auto;\n'],
  [4, 'M20 save bar not flush with the bottom', 'src/admin/admin.css', '  padding: 20px var(--admin-body-pad-x) 0;', '  padding: 20px var(--admin-body-pad-x) 0.65rem;'],
  [4, 'M21 category table width cap removed', 'src/admin/admin.css', '.admin-category-table {\n  width: 100%;\n  max-width: 960px;', '.admin-category-table {\n  width: 100%;\n  max-width: none;'],
  [5, 'M22 save bar on another tab', 'src/admin/RegistryAdmin.tsx', ' data-part="save-bar" hidden={workspaceTab !== \'details\'}>', ' data-part="save-bar">'],
  [5, 'M23 pattern switch without the dialog when a mapping exists', 'src/admin/RegistryAdmin.tsx', '    if (patternChangeNeedsWarning(selectedRow.metadata) && !(await ask(PATTERN_CHANGE_DIALOG))) return;', '    if (false && !(await ask(PATTERN_CHANGE_DIALOG))) return;'],
  [5, 'M24 window.confirm reintroduced', 'src/admin/CategoriesAdmin.tsx', "    const confirmed = await ask({\n      name: 'delete-category',", "    const confirmed = window.confirm('למחוק את הקטגוריה?') && await ask({\n      name: 'delete-category',"],
  [5, 'M25 warning on a new field', 'src/admin/CredentialFieldsEditor.tsx', '    return protectedFieldIds.includes(id);', '    return true;'],
  [5, 'M26 no warning on a saved field of an active site', 'src/admin/CredentialFieldsEditor.tsx', '    return protectedFieldIds.includes(id);', '    return false;'],
  [5, 'M27 categories table not centered', 'src/admin/admin.css', '  .admin-section--categories > .admin-category-table {\n    margin-inline: auto;\n  }\n', ''],
  [5, 'M28 Esc does not cancel the dialog', 'src/admin/AdminConfirmDialog.tsx', "      if (event.key === 'Escape') {", "      if (event.key === 'Esc-disabled') {"],
  [5, 'M29 no focus trap in the dialog', 'src/admin/AdminConfirmDialog.tsx', "      if (event.key !== 'Tab') return;", '      if (event.key) return;'],
  [5, 'M30 mode-clear / field warning on an inactive site', 'src/admin/RegistryAdmin.tsx', " || selectedRow.service_status !== 'active') {", ') {'],
  [5, 'M31 unsaved-details notice missing', 'src/admin/RegistryAdmin.tsx', "    workspaceTab !== 'details' && formBaseline !== null && formSnapshot !== formBaseline;", '    false;'],
  [5, 'M32 pattern cards shown without «שינוי אופי הכניסה»', 'src/admin/LoginPatternGrid.tsx', '        hidden={!chooserOpen}', '        hidden={false}'],
  [5, 'M33 «שדות כניסה» card missing from «פרטי אתר»', 'src/admin/RegistryAdmin.tsx', '                {!isUserOwnedRow && (\n                  <section className="admin-card admin-credentials-card" data-part="credentials-card">', '                {false && (\n                  <section className="admin-card admin-credentials-card" data-part="credentials-card">'],
  [5, 'M34 no reload of the saved draft on return (G-122-5)', 'src/admin/SpecialLoginDraftEditor.tsx', '    if (savedDraft && savedDraft.pattern === next) {', '    if (false) {'],
  [5, 'M35 saved draft reloaded for a different SPECIAL pattern too', 'src/admin/SpecialLoginDraftEditor.tsx', '    if (savedDraft && savedDraft.pattern === next) {', '    if (savedDraft) {'],
  [5, 'M36 editor dirty after the reload', 'src/admin/SpecialLoginDraftEditor.tsx', '      setDraft(normalizeLegacyDraftReadiness(ensureSpecialDraft(next, savedDraft)));', '      setDraft(normalizeLegacyDraftReadiness(ensureSpecialDraft(next, { ...savedDraft, planVersion: savedDraft.planVersion + 1 })));'],
  [7, 'M38 status chip back on the queue cards', 'src/admin/ApprovalQueue.tsx', "<AdminChipRow chips={[{ key: 'category', label: categoryLabel(row.category_id) }]} />", "<AdminChipRow chips={[{ key: 'category', label: categoryLabel(row.category_id) }, { key: 'status', label: 'ממתין לאישור', className: 'admin-badge--warn' }]} />"],
  [7, 'M39 link uses the saved value instead of the form value', 'src/admin/UrlFieldWithCopy.tsx', '  const openHref = !openLabel ? null : openUrl !== undefined ? openUrl : httpUrlOrNull(value);', '  const [savedValue] = useState(value);\n  const openHref = !openLabel ? null : httpUrlOrNull(savedValue);'],
  [7, 'M40 header link «חזרה לבית הדיגיטלי» back', 'src/admin/AdminApp.tsx', '            <div className="admin-app-account">\n', '            <div className="admin-app-account">\n              <a className="admin-link" href="#/">חזרה לבית הדיגיטלי</a>\n'],
  [7, 'M41 link shown for any URL scheme', 'src/admin/adminPresentation.ts', "    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname ? trimmed : null;", '    return trimmed;'],
  [7, 'M42 «אתר חדש» not stretched to the search row', 'src/admin/admin.css', '.admin-catalog-bar {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: stretch;', '.admin-catalog-bar {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: flex-start;'],
  [7, 'M43 submission time not in Israel time', 'src/admin/adminPresentation.ts', "    hour12: false,\n    timeZone: 'Asia/Jerusalem',\n", '    hour12: false,\n'],
  [7, 'M44 submitter shown as «משתמש <uuid>» again', 'src/admin/ApprovalQueue.tsx', "                    <Submitter profile={row.owner_user_id ? profiles[row.owner_user_id] : undefined} />", "                    {row.owner_user_id ? `משתמש ${row.owner_user_id}` : 'משתמש'}"],
  [7, 'M45 «כתובת כניסה» side card back', 'src/admin/RegistryAdmin.tsx', '                  />\n                </>\n              )}\n              <details\n                className="admin-collapse admin-card admin-more-details"', '                  />\n                  <section className="admin-panel"><h3 className="admin-panel-title">כתובת כניסה</h3><form className="admin-form"><input name="loginUrl" type="url" /><button type="submit" className="admin-btn admin-btn-primary">שמור ידנית</button><button type="button" className="admin-btn admin-btn-secondary">סמן כלא תקין</button></form></section>\n                </>\n              )}\n              <details\n                className="admin-collapse admin-card admin-more-details"'],
  [7, 'M46 «דף כניסה» shown for home-page entry', 'src/admin/RegistryAdmin.tsx', "                ) : (\n                  <p className=\"admin-field-hint\">\n                    כניסה מדף הבית תישמר ככתובת הבית.", "                ) : (\n                  <p className=\"admin-field-hint\">\n                    <a data-action=\"open-url\" href={form.login_url ?? ''} target=\"_blank\" rel=\"noopener noreferrer\">דף כניסה</a>\n                    כניסה מדף הבית תישמר ככתובת הבית."],
  [7, 'M47 catalog «משתמש <uuid>» label back (G-122-7)', 'src/admin/adminPresentation.ts', '    return name || email || UNKNOWN_SUBMITTER_HE;', "    return name || email || `משתמש ${row.owner_user_id?.slice(0, 8)}…`;"],
  [7, 'M48 one profile call per catalog card (G-122-7)', 'src/admin/RegistryAdmin.tsx', '      setSubmitters(await loadSubmitterProfiles(registryRows));', '      setSubmitters(Object.assign({}, ...(await Promise.all(registryRows.map((row) => loadSubmitterProfiles([row]))))));'],
  [7, 'M49 profile RPC error breaks the catalog (G-122-7)', 'src/admin/submitterProfiles.ts', '  } catch {\n    return {};\n  }', '  } catch (err) {\n    throw err;\n  }'],
  [7, 'M50 login URL shown regardless of the entry type (G-122-8)', 'src/admin/adminPresentation.ts', "  return loginEntryType === 'direct_url' ? httpUrlOrNull(loginUrl) : null;", '  return httpUrlOrNull(loginUrl);'],
  [7, 'M51 modal skips the login-URL helper (G-122-8)', 'src/admin/ApprovalQueue.tsx', '                    value={dedicatedLoginUrlOrNull(selected.metadata?.loginEntryType, selected.login_url)}', '                    value={selected.login_url}'],
  [7, 'M52 step-card grid removed (stacked at 1440) (G-122-9)', 'src/admin/admin.css', '    display: grid;\n    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);', '    display: flex;\n    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);'],
  [7, 'M53 actions inside a column (G-122-9)', 'src/admin/SpecialLoginDraftEditor.tsx', `            ) : null}\n          </div>\n          </div>\n\n${G9_COMPLETENESS}\n          </div>\n          </div>\n\n${G9_ACTIONS}\n`, `            ) : null}\n${G9_ACTIONS}\n          </div>\n          </div>\n\n${G9_COMPLETENESS}\n          </div>\n          </div>\n\n`],
  [5, 'M37 old long pattern-change copy', 'src/admin/patternChange.ts', "    'המשתמשים ממשיכים לקבל את המיפוי המאושר עד «אשר מיפוי».',\n", "    '• מעבר לכניסה רגילה מבטל שינויים שלא נשמרו במיפוי המיוחד, ומיפוי מיוחד חדש יתחיל ריק.',\n"],
  [8, 'M54 test enabled with a partial STANDARD mapping', 'src/admin/AdminFillTestGrid.tsx', '    savedProfileReady &&\n    standardComplete &&\n', '    savedProfileReady &&\n'],
  [8, 'M55 SPECIAL test without checkSpecialDraft', 'src/admin/AdminFillTestGrid.tsx', 'specialContext && specialRunnable && specialComplete && !draftDirty', 'specialContext && specialRunnable && !draftDirty'],
  [8, 'M56 header badge read from editor state', 'src/admin/RegistryAdmin.tsx', '<UserApprovalBadge row={selectedRow} size="lg" />', '<UserApprovalBadge row={{ ...selectedRow, metadata: { ...selectedRow.metadata, credentialMode } }} size="lg" />'],
  [8, 'M57 STANDARD changes_not_approved shown green', 'src/admin/userApproval.ts', "    return runs ? 'approved' : 'blocked';\n  }\n", "    return runs ? 'approved' : 'blocked';\n  }\n  if (profile?.validation) return 'approved';\n"],
  [8, 'M58 SPECIAL_INVALID not shown as blocked', 'src/admin/userApproval.ts', "  if (contract.mode === 'SPECIAL_INVALID') return 'blocked';\n", ''],
  [8, 'M59 cards not equal height', 'src/admin/admin.css', '.admin-card-grid,\n.admin-pending-grid {\n  grid-auto-rows: 1fr;\n}\n', ''],
  [8, 'M60 card footer not pinned to the bottom', 'src/admin/admin.css', '.admin-site-card-footer {\n  margin-top: auto;', '.admin-site-card-footer {\n  margin-top: 0;'],
  [8, 'M61 overflow chips dropped without «+N»', 'src/admin/AdminChipRow.tsx', '      {hidden.length > 0 ? (', '      {false ? ('],
  [8, 'M62 unsaved note not in the leave guard', 'src/admin/adminWorkspace.ts', '  return formDirty || specialDirty || notesDirty;', '  return formDirty || specialDirty;'],
  [8, 'M63 notes query error breaks the catalog', 'src/admin/RegistryAdmin.tsx', 'await fetchAdminNoteServiceIds().catch(() => [] as string[])', 'await fetchAdminNoteServiceIds()'],
  [8, 'M64 notes textarea back at the 560px input cap', 'src/admin/admin.css', '  width: 100%;\n  max-width: none;\n  /* ~14 lines', '  width: 100%;\n  /* ~14 lines'],
  [8, 'M65 notes textarea does not auto-grow', 'src/admin/AdminNotesPanel.tsx', '    el.style.height = `${Math.min(full, max)}px`;\n', ''],
  [
    8,
    'M66 legacy updateAdminNotes (metadata.adminNotes) back',
    'src/admin/adminRegistryApi.ts',
    'export interface AdminRediscoveryResult {',
    "export async function updateAdminNotes(serviceId: string, adminNotes: string): Promise<void> {\n  const row = await fetchRegistryRowForAdmin(serviceId);\n  if (!row) return;\n  await updateGlobalRegistryRow(serviceId, { metadata: { ...withoutLoginContractKeys(row.metadata), adminNotes: adminNotes.trim() } });\n}\n\nexport interface AdminRediscoveryResult {",
  ],
  [8, 'M67 run button spacing removed (G-122-11 a)', 'src/admin/admin.css', '  gap: var(--admin-space-1);\n  margin-top: var(--admin-space-2);\n}', '  gap: var(--admin-space-1);\n}'],
  [8, 'M68 notes unicode-bidi plaintext removed (G-122-11 b)', 'src/admin/admin.css', '  unicode-bidi: plaintext;\n  text-align: start;\n', ''],
  [8, 'M69 notes textarea back to dir="auto" (G-122-11 b)', 'src/admin/AdminNotesPanel.tsx', '              dir="rtl"\n', '              dir="auto"\n'],
  [8, 'M70 «עצור» never shown (D-121-72)', 'src/admin/AdminFillTestGrid.tsx', '            {testing ? (\n              <button', '            {false ? (\n              <button'],
  [8, 'M72 new site pre-selects categories[0] again (G-122-12 b)', 'src/admin/RegistryAdmin.tsx', '    const nextForm: GlobalRegistryInput = { ...EMPTY_FORM };', '    const nextForm: GlobalRegistryInput = { ...EMPTY_FORM, category_id: categories[0]?.id ?? null };'],
  [8, 'M73 save allowed with an empty category (G-122-12 b)', 'src/admin/RegistryAdmin.tsx', '    if (!form.category_id) {\n', '    if (false) {\n'],
  [8, 'M74 «אתר חדש» back to the narrow block (G-122-12 a)', 'src/admin/admin.css', '.admin-catalog-bar .admin-toolbar {\n  flex: 0 0 180px;\n}', '.admin-catalog-bar .admin-toolbar {\n  flex: 0 0 auto;\n}'],
  [8, 'M71 stop shown as a failure, not the notice (D-121-72)', 'src/admin/AdminFillTestGrid.tsx', "      if (!outcome.ok && outcome.reason === 'cancelled') {\n        setStopped(true);\n        return;\n      }\n      setTestOutcome(outcome);", '      setTestOutcome(outcome);'],
];

/**
 * `mutationSlice`: 122.8 mutations run the 122.8 groups only; older mutations run the groups of
 * slices before 122.8 (they were all caught there before 122.8 existed). Clean runs use every group.
 */
async function runGroups(dir, log, mutationSlice = null) {
  for (const [slice, g] of GROUPS) {
    if (slice > SLICE || (ONLY && g.name !== ONLY)) continue;
    if (mutationSlice !== null && (mutationSlice >= 8) !== (slice >= 8)) continue;
    const what = await g(dir);
    if (log) console.log(`  ✓ ${what}`);
  }
}

const selectedMutations = ONLY ? [] : selectMutations(MUTATIONS, MUTATION_ARGS, (m) => m[1]);
const outOfSlice = selectedMutations.filter(([slice]) => slice > SLICE);
if (MUTATION_ARGS.mode === 'ids' && outOfSlice.length) {
  throw new Error(`mutation(s) outside --slice=122.${SLICE}: ${outOfSlice.map((m) => mutationId(m[1])).join(', ')}`);
}

console.log(`Phase 122 — Admin Workspace (slices up to 122.${SLICE})\n`);
browser = await chromium.launch({ channel: 'msedge' });
try {
  await withHarness({}, {}, (dir) => runGroups(dir, true));
  const groupCount = GROUPS.filter(([s]) => s <= SLICE).length;
  if (ONLY) {
    console.log(`\nPASS — ${ONLY} only (no mutations) — ${formatElapsed(Date.now() - STARTED)}`);
  } else if (MUTATION_ARGS.mode === 'none') {
    console.log(`\nPASS — Phase 122 Admin Workspace up to 122.${SLICE}: ${groupCount} check groups, mutation sweep skipped (--no-mutations) — ${formatElapsed(Date.now() - STARTED)}`);
  } else {
    console.log(MUTATION_ARGS.mode === 'all' ? '\nMutations (full sweep)' : `\nMutations (selected: ${[...MUTATION_ARGS.ids].join(', ')})`);
    let caughtCount = 0;
    for (const [slice, label, rel, from, to] of selectedMutations) {
      if (slice > SLICE) continue;
      const mutated = replaceOnce(read(rel), from, to, label);
      let caught = null;
      try {
        await withHarness({ [rel]: mutated }, {}, (dir) => runGroups(dir, false, slice));
      } catch (e) {
        caught = e instanceof Error ? e.message.split('\n')[0] : String(e);
      }
      assert(caught, `mutation NOT caught: ${label}`);
      assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
      caughtCount += 1;
      console.log(`  ✓ mutation caught: ${label} — ${caught.slice(0, 140)}`);
    }
    const scope = MUTATION_ARGS.mode === 'all' ? 'mutations caught' : 'selected mutations caught';
    console.log(`\nPASS — Phase 122 Admin Workspace up to 122.${SLICE}: ${groupCount} check groups, ${caughtCount} ${scope} — ${formatElapsed(Date.now() - STARTED)}`);
  }
} finally {
  await browser.close();
}
process.exit(0);
