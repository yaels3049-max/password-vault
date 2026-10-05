/**
 * Phase 123.4 — navigation unification (AD-123-1, AD-123-9, AD-123-15) + 123.4 bindings.
 *
 * Four layers, each run on the real sources (mutations are applied in memory):
 *  - static: no 'manage' screen / ManageServices file or import, post-login always Digital Home,
 *    no «ניהול אתרים» in user src/, no full-screen catalog error, the parity-matrix symbols exist,
 *    the single AD-123-14 "custom" rule is the only one left, N-1 / N-4 / N-5 / N-6 / N-8;
 *  - migration static: the AD-123-15 aggregate is counts only, admin-gated, no table / policy change;
 *  - SQL (PGlite, real Postgres): the REAL migration with the REAL Phase 101 schema and the REAL
 *    Phase 109 is_admin(): non-admins refused, admin gets ONE row of counts, read-only;
 *  - browser (Edge via Playwright): the REAL App.tsx with the real Dashboard, panel, catalog modal
 *    and reconcile path. Stubbed seams only (cloud, vault storage without crypto, auth, catalog
 *    loaders). Synthetic fixtures only; no credential value is logged.
 *
 * Usage: node scripts/verifyPhase123Navigation.mjs [--no-mutations | --mutations=M1,M2]
 *        No mutation switch = full sweep (END OF ROUND only, test policy T-1).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { PGlite } from '@electric-sql/pglite';
import { makeTempDir, removeTempDir } from './lib/tempDir.mjs';
import { formatElapsed, mutationId, parseMutationArgs, selectMutations } from './lib/mutationArgs.mjs';
import { checkTimeoutMessage, closeServer, failRun, isTimeout, mutationTimeoutMessage, withTimeout } from './lib/withTimeout.mjs';

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
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
/** The 123.4 baseline (WIP commit of the approved 123.3 tree). */
const BASE = 'c700cd60';
const MUTATION_ARGS = parseMutationArgs();
const STARTED = Date.now();
const source = (overrides, rel) => overrides[rel] ?? read(rel);

const APP = 'src/App.tsx';
const DASH = 'src/Dashboard.tsx';
const PANEL = 'src/loginAssistance/LoginAssistancePanel.tsx';
const RECONCILE = 'src/digitalHome/cloudReconcile.ts';
const CSS = 'src/App.css';
const MIGRATION = 'supabase/migrations/20261005120000_phase123_admin_apps_without_profile.sql';
const EXECUTION = 'src/execution/serviceExecution.ts';
const LA_MESSAGES = 'src/loginAssistance/messages.ts';

const HE = {
  manage: 'ניהול אתרים',
  manageScreen: 'ניהול האתרים',
  addMoreSites: 'הוסף אתרים נוספים',
  addApp: '+ הוספת אפליקציה',
  empty: 'עדיין אין אפליקציות בבית הדיגיטלי. הוסיפו את האפליקציה הראשונה כדי להתחיל.',
  hint: 'לחצו על האייקון של אפליקציה כדי לפתוח אותה.',
  catalogDownEmpty: 'קטלוג האפליקציות אינו זמין כרגע.',
  fullScreenError: 'לא ניתן לטעון את קטלוג האתרים מהרשת.',
  retry: 'נסו שוב',
  removedClosed: 'האפליקציה או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.',
  removedPlain: 'האפליקציה או הפרופיל נמחקו בחלון אחר.',
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const T0 = '2026-10-01T00:00:00.000Z';
const FIELDS = [
  { id: 'username', label: 'שם משתמש', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];
const approvedMapping = (host) => ({
  supportState: 'validated',
  configVersion: 1,
  loginEntryUrl: `https://${host}/login`,
  allowedOrigin: `https://${host}`,
  fieldMappings: FIELDS.map((f) => ({ fieldId: f.id, locatorType: 'css', locator: `#${f.id}` })),
  validation: { metadataVersion: 1, validatedBy: 'admin' },
});
const def = (id, displayName, category, host) => ({
  schemaVersion: 1,
  id,
  displayName,
  url: `https://${host}/`,
  category,
  icon: '🔗',
  source: 'built-in-catalog',
  loginFields: FIELDS,
  metadata: { credentialMode: 'credential_fields', autofillProfile: approvedMapping(host) },
});
const OWN = { ...def('svc-own', 'האתר שלי', 'custom', 'own-site.example.test'), source: 'user-created', metadata: undefined };
const APPS_VAULT = {
  selectedIds: ['svc-cred', 'svc-extra', 'svc-third', 'svc-four', 'svc-own'],
  customServices: [OWN],
  accessProfiles: [{ schemaVersion: 1, id: 'p-cred', serviceId: 'svc-cred', displayName: 'ראשי', createdAt: T0, updatedAt: T0, isDefault: true }],
  credentials: { 'p-cred': { username: 'fixture-user', password: 'fixture-pass' } },
  syncOutbox: { serviceIds: [], profileIds: [] },
};
const EMPTY_VAULT = { selectedIds: [], customServices: [], accessProfiles: [], credentials: {}, syncOutbox: { serviceIds: [], profileIds: [] } };
const FIXTURE = {
  profile: { id: 'user-1234-test', email: 'fixture@example.test', firstName: 'בדיקה', lastName: '' },
  categories: [
    { id: 'banking', display_name: 'בנקים', sort_order: 10 },
    { id: 'shopping', display_name: 'קניות', sort_order: 30 },
    { id: 'custom', display_name: 'מותאם אישית', sort_order: 100 },
  ],
  catalog: [
    def('svc-cred', 'בנק עם פרטים', 'banking', 'cred-bank.example.test'),
    def('svc-extra', 'חנות נוספת', 'shopping', 'extra-shop.example.test'),
    def('svc-third', 'חנות שלישית', 'shopping', 'third-shop.example.test'),
    def('svc-four', 'חנות רביעית', 'shopping', 'four-shop.example.test'),
    def('svc-avail', 'חנות זמינה', 'shopping', 'avail-shop.example.test'),
  ],
  vault: APPS_VAULT,
};

// ─── Layer 1: static ──────────────────────────────────────────────────────────
function fnBody(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) return null;
  const open = src.indexOf('{', src.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** User src/ = everything under src/ except src/admin/** (AD-123-1 scope). */
function userSrcFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (rel === 'src/admin') continue;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx|css|json|md)$/.test(name)) out.push(rel);
    }
  };
  walk('src');
  return out;
}

function checkNoManageScreen(overrides) {
  assert(!existsSync(join(root, 'src/ManageServices.tsx')), 'AD-123-1: src/ManageServices.tsx deleted');
  for (const rel of userSrcFiles()) {
    assert(!/ManageServices/.test(source(overrides, rel)), `AD-123-1: no ManageServices reference left in ${rel}`);
  }
  const app = source(overrides, APP);
  assert(!/'manage'/.test(app) && !/type Screen\b/.test(app) && !/setScreen\(/.test(app), "AD-123-1: App has no 'manage' screen (no Screen state)");
  assert(!/manageIsFirstRun|onContinue|resolvePostAuthScreen|countUserServices/.test(app), 'AD-123-1: no manageIsFirstRun / onContinue / post-auth screen choice');
  const auth = fnBody(app, 'async function handleAuthenticated(');
  assert(auth && /setIsUnlocked\(true\);\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*setShowMagicMomentHint\(hydrated\.selectedIds\.length === 0\);\s*\} catch/.test(auth), 'FR-01: after login the user always lands on Digital Home (no screen branch)');
  assert(!/onAddMore/.test(source(overrides, DASH)), 'AD-123-1: Dashboard has no onAddMore («ניהול אתרים») prop');
  return 'static: ManageServices deleted and unreferenced; no manage screen / manageIsFirstRun / onContinue / post-auth screen choice; login → Digital Home';
}

function checkNoManageString(overrides) {
  const files = userSrcFiles();
  for (const rel of files) {
    // src/execution is frozen (N-2); its credentials_missing copy is replaced in assistanceActions below.
    if (rel === EXECUTION) continue;
    const text = source(overrides, rel);
    for (const s of [HE.manage, HE.manageScreen, HE.addMoreSites]) {
      assert(!text.includes(s), `AD-123-1: copy pointing to the removed screen («${s}») in user ${rel}`);
    }
  }
  const assist = source(overrides, 'src/loginAssistance/assistanceActions.ts');
  const fnStart = assist.indexOf('export async function attemptExistingAutomaticCompletion(');
  const mapAt = assist.indexOf("if (result.status === 'credentials_missing') {\n    return { attempted: true, message: MSG_AUTOFILL_CREDENTIALS_MISSING, outcome: 'failure' };", fnStart);
  assert(fnStart >= 0 && mapAt > fnStart && mapAt < assist.indexOf('result.userMessage', fnStart), 'AD-123-1: the execution credentials_missing copy (removed screen) is replaced before any userMessage is shown');
  assert(!source(overrides, 'src/loginAssistance/messages.ts').match(/MSG_AUTOFILL_CREDENTIALS_MISSING =\s*'[^']*(ניהול|הוסף אתרים)/), 'AD-123-1: replacement copy does not name the removed screen');
  const otherCallers = files.filter((rel) => rel !== EXECUTION && rel !== 'src/pocAutofill.ts' && rel !== 'src/serviceManagement/openWithProfile.ts' && /executeServiceFromTile\(/.test(source(overrides, rel)));
  assert(JSON.stringify(otherCallers) === '["src/loginAssistance/assistanceActions.ts"]', `AD-123-1: Digital Home reaches execution only via assistanceActions (got ${otherCallers.join(', ')})`);
  return `static: no «${HE.manage}» / «${HE.manageScreen}» / «${HE.addMoreSites}» in ${files.length - 1} user src/ files (src/admin excluded; frozen src/execution copy replaced in assistanceActions)`;
}

function checkEmptyHomeAndError(overrides) {
  const app = source(overrides, APP);
  assert(!app.includes(HE.fullScreenError) && !/catalogError && selectedIds\.size === 0/.test(app), '123.4 binding: no full-screen catalog error for 0 apps');
  const retry = fnBody(app, 'async function retryCatalogLoad()');
  assert(retry && !/setCatalogHydrated\(false\)/.test(retry), '123.4 binding: retry keeps Digital Home (no full-screen loading)');
  const dash = source(overrides, DASH);
  assert(dash.includes(HE.empty) && /data-action="open-catalog-empty"/.test(dash), 'FR-30: empty state with «+ הוספת אפליקציה»');
  assert(!/useEffect\([^)]*\)\s*=>\s*\{[^}]*onOpenCatalog/.test(dash), 'FR-30: the catalog never opens by itself');
  return 'static: no full-screen catalog error / loading on retry; empty state + «+ הוספת אפליקציה»; no auto-open';
}

/** AD-123-9 parity matrix (dev-phase123.md, Slice 123.4): every new home exists. */
const PARITY = [
  ['1 list → grid', DASH, /function renderTile\(service: Service\)/],
  ['1 category sections', 'src/digitalHome/homeLayout.ts', /export function shouldUseCategoryLayout[\s\S]*export function groupSelectedServicesByCategory/],
  ['2 search', 'src/digitalHome/catalogModel.ts', /export function filterCatalog[\s\S]*filterDiscoveryServices\(/],
  ['2 in-home apps listed', 'src/catalog/catalogVisibility.ts', /export function isShownInUserCatalog\(/],
  ['3 launch kind', 'src/loginAssistance/credentialsGate.ts', /export function resolveDigitalHomeLaunchKind\([\s\S]*export function launchKindOffersProfileUi\(/],
  ['3/4 dot', 'src/digitalHome/appContext.ts', /export function appHasProfile\(/],
  ['4 switcher', PANEL, /const showProfileChips = profileUi && actions\.switcher;/],
  ['5 profile actions', PANEL, /data-action="edit-profile"[\s\S]*data-action="add-first-profile"[\s\S]*data-action="add-profile"/],
  ['5 host', APP, /function openProfileManagement\(request: ProfileManagementRequest\) \{[\s\S]*offersCredentialManagementPanel\(service\)[\s\S]*<DigitalHomeCredentialModal/],
  ['5a not configured', 'src/loginAssistance/messages.ts', /export const MSG_NOT_CONFIGURED_LAUNCH =/],
  ['6 no stored credentials', 'src/loginAssistance/messages.ts', /export const MSG_NO_STORED_CREDENTIALS_LAUNCH =/],
  ['7 remove', APP, /async function requestRemoveApp\(serviceId: string\)[\s\S]*function beginPendingRemoval\(serviceId: string\)[\s\S]*function commitPendingRemoval\(\)/],
  ['7 remove menu', PANEL, /data-action="remove-app"/],
  ['8 edit site', APP, /function openSiteDetailsEdit\(serviceId: string\)[\s\S]*<EditSiteDetailsModal|<EditSiteDetailsModal[\s\S]*function openSiteDetailsEdit\(serviceId: string\)/],
  ['8 edit save', APP, /async function updateCustomService\(definition: ServiceDefinition\)/],
  ['8 edit menu', PANEL, /data-action="edit-site-details"/],
  ['9 catalog', APP, /<AppCatalogModal[\s\S]*onAddApp=\{addApp\}[\s\S]*onAddCustom=\{addCustomService\}/],
  ['9 custom add', 'src/digitalHome/AppCatalog.tsx', /export const LABEL_ADD_CUSTOM_SITE =/],
  ['10 inline retry', APP, /onRetryCatalog=\{\(\) => void retryCatalogLoad\(\)\}/],
  ['11 error banner', APP, /const homeError = removeError \?\? \(catalogOpen \? null : selectionError\);/],
  ['12 pending', APP, /pendingIds=\{pendingIds\}/],
  ['13 lock', DASH, /<VaultStateBadge unlocked=\{vaultUnlocked\} onLock=\{onLockVault\} \/>/],
  ['14 logos', DASH, /useServiceLogos\(services\)/],
  ['15 empty state', DASH, /data-home-empty="true"/],
  ['17 focus return', APP, /const profileReturnFocusId = useRef<string \| null>\(null\);/],
];
function checkParitySymbols(overrides) {
  for (const [row, rel, re] of PARITY) {
    assert(existsSync(join(root, rel)) && re.test(source(overrides, rel)), `AD-123-9 parity row ${row}: ${rel} ${re}`);
  }
  for (const rel of ['src/loginAssistance/DigitalHomeCredentialModal.tsx', 'src/digitalHome/EditSiteDetailsModal.tsx', 'src/digitalHome/AppCatalogModal.tsx', 'src/digitalHome/RemoveAppConfirmDialog.tsx', 'src/digitalHome/UndoToast.tsx']) {
    assert(existsSync(join(root, rel)), `AD-123-9: ${rel} exists`);
  }
  return `static: ${PARITY.length} parity-matrix symbols exist (AD-123-9)`;
}

function checkSingleCustomRule(overrides) {
  const ctx = source(overrides, 'src/digitalHome/appContext.ts');
  assert(/export function isUserCustomApp\(service: \{ source\?: string \}, inVaultCustomServices: boolean\): boolean \{\s*return inVaultCustomServices && service\.source === 'user-created';/.test(ctx), 'AD-123-14: isUserCustomApp = in vault customServices AND runtime user-created');
  const app = source(overrides, APP);
  const edit = fnBody(app, 'function openSiteDetailsEdit(serviceId: string)');
  assert(edit && /isUserCustomApp\(service, true\)/.test(edit) && !/user-created/.test(edit), 'AD-123-14: edit-site decided by isUserCustomApp only');
  const begin = fnBody(app, 'function beginPendingRemoval(serviceId: string)');
  assert(begin && /deleteOwnRow: isUserCustomApp\(service, customServiceIds\.has\(serviceId\.trim\(\)\)\)/.test(begin) && !/user-created/.test(begin), 'AD-123-14: remove step 5 decided by isUserCustomApp only');
  assert(/const actions = appContextActions\(service, profiles, isUserCustomApp\(service, isCustom\)\);/.test(source(overrides, PANEL)), 'AD-123-14: panel menu decided by isUserCustomApp');
  for (const rel of [PANEL, DASH]) assert(!/user-created/.test(stripComments(source(overrides, rel))), `AD-123-14: no own "custom" rule in ${rel}`);
  for (const rel of userSrcFiles()) {
    const code = stripComments(source(overrides, rel));
    if (rel !== 'src/digitalHome/appContext.ts' && rel !== PANEL) {
      assert(!/edit_site_details/.test(code), `AD-123-14: no second edit-site decision in ${rel}`);
    }
    if (rel !== APP) assert(!/deleteOwnRow:/.test(code), `AD-123-14: no second step-5 decision in ${rel}`);
  }
  return 'static: one "custom" rule (isUserCustomApp) for edit-site, step 5 and the panel menu; no second rule in user src/';
}

function checkNChecks(overrides) {
  for (const rel of [APP, DASH, RECONCILE]) {
    source(overrides, rel).split('\n').forEach((line, i) => {
      assert(!/window\.(confirm|alert|prompt)\s*\(|(?<![\w.$])(confirm|alert|prompt)\s*\(/.test(line.replace(/\/\/.*$/, '')), `N-4: browser dialog call in ${rel}:${i + 1}`);
    });
  }
  for (const rel of [DASH, RECONCILE]) {
    const src = source(overrides, rel);
    assert(!/from ['"][./]*admin\//.test(src), `N-8: ${rel} imports nothing from src/admin`);
    assert(!/(service\.id|serviceId)\s*[!=]==?\s*['"`]/.test(src), `N-5: no serviceId literal branch in ${rel}`);
    assert(!/hostname|svc-/.test(stripComments(src)), `N-5: no hostname / fixture branch in ${rel}`);
  }
  const dash = source(overrides, DASH);
  assert(/className="dh-reconcile-notice" role="status" dir="rtl"/.test(dash), 'N-6 / AD-123-18: the notice is an RTL status');
  assert(source(overrides, LA_MESSAGES).includes(`'${HE.removedPlain}'`) && source(overrides, RECONCILE).includes(`'${HE.removedClosed}'`), 'N-6: Hebrew notice copy');
  assert(git('diff', '--name-only', BASE, '--', RECONCILE).trim() === '', `N-2: ${RECONCILE} unchanged since ${BASE.slice(0, 8)} (frozen by verifyPhase123D8OwnSite)`);
  assert(source(overrides, 'src/digitalHome/AppCatalogModal.tsx').includes(`'${HE.addApp}'`), 'N-6: «+ הוספת אפליקציה»');
  const adminChanged = git('diff', '--name-only', BASE, '--', 'src/admin').trim();
  assert(adminChanged === '' && git('ls-files', '--others', '--exclude-standard', '--', 'src/admin').trim() === '', `N-1 / STOP rule: src/admin unchanged since ${BASE} (${adminChanged})`);
  const supa = [
    ...git('diff', '--name-only', BASE, '--', 'supabase').split('\n'),
    ...git('ls-files', '--others', '--exclude-standard', '--', 'supabase').split('\n'),
  ].map((p) => p.trim()).filter(Boolean);
  assert(supa.every((p) => p === MIGRATION) && git('diff', '--name-only', '--diff-filter=MDR', BASE, '--', 'supabase').trim() === '', `AD-123-15: the only supabase change is the aggregate migration (${supa.join(', ')})`);
  return `N-1 (src/admin unchanged since ${BASE}; supabase = the one migration) / N-4 / N-5 / N-6 / N-8`;
}

// ─── Layer 2: migration static ────────────────────────────────────────────────
const AGG_COLUMNS = [
  'apps_total',
  'apps_with_profile',
  'apps_without_profile',
  'apps_without_profile_over_1d',
  'apps_without_profile_over_7d',
  'apps_first_profile_after_1d',
  'users_with_apps',
  'users_with_app_without_profile',
];
function checkMigrationStatic(overrides) {
  const src = source(overrides, MIGRATION);
  const start = src.indexOf('create or replace function public.admin_apps_without_profile_counts()');
  assert(start >= 0, 'AD-123-15: function admin_apps_without_profile_counts() defined (no arguments)');
  const body = src.slice(start, src.indexOf('$$;', start));
  const ret = body.match(/returns table \(([\s\S]*?)\n\)/);
  assert(ret, 'AD-123-15: returns a table');
  const cols = ret[1].split(',').map((c) => c.trim().split(/\s+/));
  assert(cols.every(([, type, ...rest]) => type === 'bigint' && rest.length === 0), `AD-123-15: counts only — every column bigint (${ret[1].replace(/\s+/g, ' ')})`);
  assert(JSON.stringify(cols.map(([n]) => n)) === JSON.stringify(AGG_COLUMNS), 'AD-123-15: the count columns');
  assert(/security definer/.test(body) && /set search_path = public/.test(body) && /\bstable\b/.test(body), 'AD-123-15: stable security definer, search_path = public');
  assert(/if not public\.is_admin\(\) then\s+raise exception 'Admin access required';/.test(body), 'AD-123-15: admin-gated by the existing public.is_admin()');
  const sig = 'admin_apps_without_profile_counts()';
  assert(src.includes(`revoke all on function public.${sig} from public;`) && src.includes(`revoke all on function public.${sig} from anon;`), 'AD-123-15: revoked from public / anon');
  assert(src.includes(`grant execute on function public.${sig} to authenticated;`), 'AD-123-15: granted to authenticated (gate inside)');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert(!/\b(create|alter|drop)\s+(table|policy|index|view)\b|row level security|\b(insert|update|delete)\b/i.test(code), 'AD-123-15: no table / policy change, no writes');
  assert(!/encrypted_credentials|ciphertext|display_name|local_profile_id|\bservice_id\b|email|first_name|last_name/i.test(code), 'AD-123-15: no credential, name or service data read');
  assert(!/group by/i.test(code), 'AD-123-15: one aggregate row (no per-user grouping)');
  return 'migration static: one admin-gated stable security-definer function; bigint counts only; revoke public / anon; no table / policy / write; no names, ids or credential data';
}

// ─── Layer 3: SQL (PGlite) ────────────────────────────────────────────────────
const ADMIN = '00000000-0000-4000-8000-00000000000a';
const DISABLED_ADMIN = '00000000-0000-4000-8000-00000000000d';
const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const U3 = '00000000-0000-4000-8000-000000000003';
const US = (n) => `10000000-0000-4000-8000-00000000000${n}`;

function isAdminSql() {
  const src = read('supabase/migrations/20260712200000_phase109_user_profile_auth.sql');
  const m = src.match(/create or replace function public\.is_admin\(\)[\s\S]*?\$\$;\n/);
  if (!m) throw new Error('fixture: Phase 109 is_admin() not found');
  return m[0];
}

const SEED = `
insert into auth.users (id) values ('${ADMIN}'), ('${DISABLED_ADMIN}'), ('${U1}'), ('${U2}'), ('${U3}');
insert into public.users (id, is_admin, role, status) values
  ('${ADMIN}', true, 'admin', 'active'), ('${DISABLED_ADMIN}', true, 'admin', 'disabled'),
  ('${U1}', false, 'user', 'active'), ('${U2}', false, 'user', 'active'), ('${U3}', false, 'user', 'active');
insert into public.user_services (id, user_id, service_id, created_at) values
  ('${US(1)}', '${U1}', 'svc-a', now() - interval '10 days'),
  ('${US(2)}', '${U1}', 'svc-b', now() - interval '10 days'),
  ('${US(3)}', '${U2}', 'svc-a', now() - interval '2 days'),
  ('${US(4)}', '${U2}', 'svc-c', now() - interval '1 hour'),
  ('${US(5)}', '${U3}', 'svc-a', now() - interval '3 days');
insert into public.access_profiles (user_id, user_service_id, local_profile_id, display_name, created_at) values
  ('${U1}', '${US(2)}', 'profile-b', 'ראשי', now() - interval '8 days'),
  ('${U3}', '${US(5)}', 'profile-a1', 'ראשי', now() - interval '3 days' + interval '1 minute'),
  ('${U3}', '${US(5)}', 'profile-a2', 'שני', now() - interval '1 day');
`;
const EXPECTED = {
  apps_total: 5,
  apps_with_profile: 2,
  apps_without_profile: 3,
  apps_without_profile_over_1d: 2,
  apps_without_profile_over_7d: 1,
  apps_first_profile_after_1d: 1,
  users_with_apps: 3,
  users_with_app_without_profile: 2,
};

async function schemaFingerprint(db) {
  const cols = await db.query(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' order by 1, 2`);
  const pols = await db.query(`select tablename, policyname from pg_policies where schemaname = 'public' order by 1, 2`);
  const rls = await db.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`);
  return JSON.stringify([cols.rows, pols.rows, rls.rows]);
}
async function as(db, who, sql) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${who === 'anon' || who === null ? '' : who}', false)`);
  await db.exec(who === 'anon' ? 'set role anon' : 'set role authenticated');
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}
async function expectError(promise, pattern, label) {
  try {
    await promise;
  } catch (err) {
    assert(pattern.test(String(err.message)), `${label}: unexpected error "${err.message}"`);
    return;
  }
  throw new Error(`${label}: expected an error`);
}
const AGG = 'select * from public.admin_apps_without_profile_counts()';

async function checkAggregateSql(overrides) {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      alter default privileges in schema public grant all on functions to anon, authenticated;
    `);
    await db.exec(read('supabase/migrations/20260702121500_phase101_schema.sql'));
    await db.exec(`alter table public.users add column is_admin boolean not null default false,
      add column role text not null default 'user', add column status text not null default 'active';`);
    await db.exec(isAdminSql());
    const before = await schemaFingerprint(db);
    await db.exec(source(overrides, MIGRATION));
    await db.exec(SEED);

    await expectError(as(db, 'anon', AGG), /permission denied/, 'AD-123-15: anon refused');
    for (const who of [U1, U2, DISABLED_ADMIN]) await expectError(as(db, who, AGG), /Admin access required/, `AD-123-15: non-admin ${who} refused`);
    await expectError(as(db, null, AGG), /Admin access required/, 'AD-123-15: no session refused');

    const res = await as(db, ADMIN, AGG);
    assert(res.rows.length === 1, `AD-123-15: admin gets ONE aggregate row (got ${res.rows.length})`);
    const cols = res.fields.map((f) => f.name);
    assert(JSON.stringify(cols) === JSON.stringify(AGG_COLUMNS), `AD-123-15: count columns only (got ${cols.join(', ')})`);
    const row = res.rows[0];
    for (const [k, v] of Object.entries(EXPECTED)) assert(Number(row[k]) === v, `AD-123-15: ${k} = ${v} (got ${row[k]})`);
    const text = JSON.stringify(row, (_k, v) => (typeof v === 'bigint' ? Number(v) : v));
    assert(!/[0-9a-f]{8}-[0-9a-f]{4}-|svc-|profile-|ראשי/.test(text), 'AD-123-15: no ids, service ids or names in the result');
    assert(Object.values(row).every((v) => typeof v === 'number' || typeof v === 'bigint'), 'AD-123-15: every value is a count');

    assert((await schemaFingerprint(db)) === before, 'AD-123-15: no table, column, RLS flag or policy change');
    const n = await db.query('select (select count(*) from public.user_services)::int s, (select count(*) from public.access_profiles)::int p');
    assert(n.rows[0].s === 5 && n.rows[0].p === 3, 'AD-123-15: the read writes nothing');
  } finally {
    await db.close();
  }
  return 'SQL (PGlite, real migration + Phase 101 schema + Phase 109 is_admin): anon / non-admin / disabled admin / no session refused; admin gets one row of 8 counts (exact values on the fixture), no ids / names; read-only; schema and policies unchanged';
}

// ─── Layer 4: browser (real App) ──────────────────────────────────────────────
const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
const exportNames = (rel) => new Set([...read(rel).matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)].map((m) => m[1]));
const LOG = 'function log(kind, fn, args) { (globalThis.__pvSeq ??= []).push({ kind, fn, args }); }';

function persistenceStub() {
  const impl = {
    bumpDualWriteGeneration: '() => ++gen',
    getDualWriteGeneration: '() => gen',
    removeUserServiceFromCloud: 'async (id) => { log("cloud", "removeUserServiceFromCloud", [id]); }',
    hydrateWorkspaceFromCloud: 'async (_u, _k, local) => local',
    fetchCloudSyncBaseline: 'async () => null',
    refreshWorkspaceFromCloud: 'async () => null',
    syncVaultStateToSupabase: 'async () => ({ goneServiceIds: [], goneProfileIds: [], confirmed: { serviceIds: [], profileIds: [] } })',
    syncVaultStateToSupabaseSafe: 'async () => ({ ok: true })',
    setCloudGoneListener: '(fn) => { globalThis.__pvGone = fn; }',
    setCloudConfirmedListener: '() => {}',
    fetchVaultKdf: 'async () => null',
    ensureVaultKdfSeeded: 'async () => {}',
  };
  const lines = ['let gen = 0;', LOG];
  for (const n of exportNames('src/supabase/persistence.ts')) lines.push(`export const ${n} = ${impl[n] ?? `async (...args) => { log("cloud", ${JSON.stringify(n)}, args); }`};`);
  return lines.join('\n');
}

const VAULT_STUB = () => `
const KEY = 'pv-fake-vault';
let unlocked = null;
export class WrongPasswordError extends Error {}
export function vaultStorageIdForUser(u) { return 'user:' + u; }
export function emptyVaultState() { return { credentials: {}, accessProfiles: [], selectedIds: [], customServices: [] }; }
export function isVaultUnlocked() { return unlocked !== null; }
export function getActiveVaultUserId() { return unlocked; }
export function getActiveVaultCryptoKey() { return unlocked ? { fake: 'vault-key' } : null; }
export function getCloudCredentialCryptoKey() { return unlocked ? { fake: 'cloud-key' } : null; }
export function lockVault() { unlocked = null; }
export async function unlockVault(_password, userId) {
  unlocked = userId;
  const raw = localStorage.getItem(KEY);
  return JSON.parse(raw ?? JSON.stringify(globalThis.__pvFix.vault));
}
export async function persistVault(state) {
  globalThis.__pvSeq.push({ kind: 'persist', selectedIds: [...state.selectedIds] });
  await Promise.resolve();
  localStorage.setItem(KEY, JSON.stringify(state));
}
export async function vaultExists() { return true; }
`;

const STUBS = {
  'src/supabase/persistence.ts': persistenceStub,
  'src/vault/vault.ts': VAULT_STUB,
  'src/supabase/client.ts': () => 'export function getSupabaseClient() { return null; }\nexport function resetSupabaseClient() {}\nexport function resetSupabaseClientForTests() {}',
  'src/catalog/catalogLoader.ts': () => 'export async function loadBuiltinCatalogDefinitions() { if (globalThis.__pvCtl.catalogFail) throw new Error("catalog down (fixture)"); return JSON.parse(JSON.stringify(globalThis.__pvFix.catalog)); }\nexport function getBuiltinCatalogDefinitions() { throw new Error("not used"); }',
  'src/auth/AuthEntryScreen.tsx': () => 'export default function AuthEntryScreen({ onAuthenticated }) { return <button type="button" data-pv-login="true" onClick={() => void onAuthenticated(globalThis.__pvFix.profile, "fixture-master")}>login</button>; }',
  'src/useServiceLogos.ts': () => 'export function useServiceLogos() { return {}; }\nexport default useServiceLogos;',
  'src/logoCache.ts': () => 'export async function getCachedServiceLogo() { return null; }\nexport function preloadServiceLogos() {}\nexport function peekCachedLogo() { return undefined; }\nexport function invalidateServiceLogoCache() {}',
};

const PARTIAL = {
  'src/auth/index.ts': () => `
export async function restoreAccountSession() { return null; }
export async function signOutAccount() {}
export async function requireAuthenticatedUserId() { return globalThis.__pvFix.profile.id; }
export async function tryGetAuthenticatedUserId() { return globalThis.__pvFix.profile.id; }`,
  'src/registry/categoryCatalog.ts': () => 'export async function loadRegistryCategories() { return JSON.parse(JSON.stringify(globalThis.__pvFix.categories)); }',
  'src/supabase/registryPersistence.ts': () => `
export async function deleteCustomServiceRegistryRow() {}
export async function upsertCustomServiceRegistryRow() {}
export async function ensureKnownBuiltinRegistryRow() {}`,
};

function seamsPlugin(overrides, used) {
  const stubs = new Map(Object.entries(STUBS).map(([rel, fn]) => [abs(rel), fn]));
  const partial = new Map(Object.entries(PARTIAL).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).filter(([rel]) => rel.startsWith('src/')).map(([rel, src]) => [abs(rel), src]));
  const loaderOf = (key) => (key.endsWith('.css') ? 'css' : key.endsWith('.tsx') ? 'tsx' : 'ts');
  return {
    name: 'phase1234-seams',
    setup(b) {
      b.onResolve({ filter: /^pv-real:/ }, (args) => ({ path: args.path.slice('pv-real:'.length), namespace: 'pv-real' }));
      b.onLoad({ filter: /.*/, namespace: 'pv-real' }, (args) => ({
        contents: readFileSync(args.path, 'utf8'),
        loader: loaderOf(args.path.toLowerCase()),
        resolveDir: dirname(args.path),
      }));
      b.onLoad({ filter: /\.(ts|tsx|css)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        const loader = loaderOf(key);
        if (stubs.has(key)) return { contents: stubs.get(key)(), loader, resolveDir: dirname(args.path) };
        if (partial.has(key)) {
          return { contents: `export * from ${JSON.stringify(`pv-real:${args.path}`)};\n${partial.get(key)()}`, loader, resolveDir: dirname(args.path) };
        }
        if (overridden.has(key)) {
          used.add(key);
          return { contents: overridden.get(key), loader, resolveDir: dirname(args.path) };
        }
        return undefined;
      });
    },
  };
}

const HARNESS_ENTRY = `
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/index.css';

globalThis.__pvFix = ${JSON.stringify(FIXTURE)};
globalThis.__pvSeq = [];
globalThis.__pvCtl = { catalogFail: false };
try {
  createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
  window.__pvReady = true;
} catch (e) {
  window.__pvBootError = String((e && e.stack) || e);
}
`;
const INDEX_HTML = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="harness.css"></head><body><div id="root"></div><script src="harness.js"></script></body></html>';

async function bundleHarness(dir, overrides) {
  const used = new Set();
  const srcOverrides = Object.keys(overrides).filter((rel) => rel.startsWith('src/'));
  await build({
    bundle: true,
    write: true,
    logLevel: 'silent',
    jsx: 'automatic',
    nodePaths: [join(root, 'node_modules')],
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
    define: {
      'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production' }),
      'process.env.NODE_ENV': '"production"',
    },
    stdin: { contents: HARNESS_ENTRY, resolveDir: root, loader: 'tsx', sourcefile: 'harness.tsx' },
    outfile: join(dir, 'harness.js'),
    format: 'iife',
    platform: 'browser',
    plugins: [seamsPlugin(overrides, used)],
  });
  assert(used.size === srcOverrides.length, `fixture: every override loaded (${used.size}/${srcOverrides.length})`);
  if (!existsSync(join(dir, 'harness.css'))) writeFileSync(join(dir, 'harness.css'), '');
  writeFileSync(join(dir, 'index.html'), INDEX_HTML);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = join(dir, rel);
      if (relative(dir, file).startsWith('..') || !existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => closeServer(server) }));
  });
}

// H-1: every browser group / mutation run is bounded; contexts are closed in the group finally.
const GROUP_TIMEOUT_MS = 90_000;
const MUTATION_TIMEOUT_MS = 300_000;
const openContexts = new Set();
let reclaimedContexts = 0;
async function closeOpenContexts() {
  const contexts = [...openContexts];
  openContexts.clear();
  reclaimedContexts += contexts.length;
  await Promise.allSettled(contexts.map((c) => withTimeout(() => c.close(), 10_000, checkTimeoutMessage('browser context close'))));
}

let browser = null;
/** Opens the app and logs in; `vault` / `catalogFail` are set before login. Waits for the first screen. */
async function openPage(url, { vault = null, catalogFail = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' });
  openContexts.add(context);
  const page = await context.newPage();
  const s = { page, context, errors: [], native: [] };
  page.on('pageerror', (e) => s.errors.push(String(e)));
  page.on('dialog', async (d) => {
    s.native.push(d.type());
    await d.dismiss();
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__pvReady || window.__pvBootError, null, { timeout: 30000, polling: 100 });
  const bootError = await page.evaluate(() => window.__pvBootError ?? null);
  assert(!bootError, `fixture: harness boot failed: ${bootError}`);
  await page.locator('[data-pv-login]').waitFor({ timeout: 15000 });
  await page.evaluate(({ v, fail }) => {
    if (v) globalThis.__pvFix.vault = v;
    globalThis.__pvCtl.catalogFail = fail;
  }, { v: vault, fail: catalogFail });
  await page.locator('[data-pv-login]').click();
  await page.waitForFunction(() => {
    if (document.querySelector('.dashboard')) return true;
    const o = document.querySelector('.onboarding');
    return Boolean(o && !/טוען/.test(o.textContent ?? ''));
  }, null, { timeout: 15000, polling: 50 });
  await page.waitForTimeout(400);
  return s;
}
async function closePage(s) {
  try {
    assert(s.errors.length === 0, `page errors: ${s.errors.join(' | ')}`);
    assert(s.native.length === 0, `N-4: native browser dialog shown: ${s.native.join(', ')}`);
  } finally {
    openContexts.delete(s.context);
    await withTimeout(() => s.context.close(), 10_000, checkTimeoutMessage('browser context close'));
  }
}
const panel = (s) => s.page.locator('section[data-login-assistance]');
const catalog = (s) => s.page.locator('[data-catalog-modal]');
const notice = (s) => s.page.locator('[data-reconcile-notice][role="status"]');
async function openTile(s, id) {
  await s.page.click(`[data-service-id="${id}"] button.app-icon`);
  await panel(s).waitFor({ state: 'visible', timeout: 5000 });
}
async function menuItems(s) {
  const btn = panel(s).locator('[data-app-menu] button[aria-haspopup="menu"]');
  if ((await btn.count()) === 0) return [];
  await btn.click();
  return panel(s).locator('[role="menuitem"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-action')));
}
async function bodyText(s) {
  return s.page.evaluate(() => document.body.innerText);
}
async function assertOnDigitalHome(s, label) {
  assert((await s.page.locator('.dashboard').count()) === 1, `${label}: Digital Home shown (not another screen)`);
  assert(!(await bodyText(s)).includes(HE.manage), `${label}: no «${HE.manage}»`);
}

async function checkZeroAppsLogin(url) {
  const s = await openPage(url, { vault: EMPTY_VAULT });
  await assertOnDigitalHome(s, 'FR-01 (0 apps)');
  const empty = s.page.locator('[data-home-empty]');
  assert((await empty.textContent()).includes(HE.empty), 'FR-30: Hebrew empty state');
  const cta = empty.locator('[data-action="open-catalog-empty"]');
  assert((await cta.count()) === 1 && (await cta.textContent()) === HE.addApp, 'FR-30: central «+ הוספת אפליקציה» in the empty state');
  assert((await s.page.locator('[data-action="open-catalog"]').count()) === 1, 'FR-30: header «+ הוספת אפליקציה» too');
  await s.page.waitForTimeout(600);
  assert((await catalog(s).count()) === 0, 'FR-30: the catalog does not open by itself on an empty home');
  assert((await s.page.locator('.dashboard-banner--hint').count()) === 0, 'the open-an-app hint waits for the first app');
  await cta.click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
  await catalog(s).locator('[data-catalog-item="svc-avail"] button', { hasText: 'הוספה' }).click();
  await s.page.waitForFunction(() => document.querySelector('[data-catalog-item="svc-avail"]')?.getAttribute('data-catalog-state') === 'added', null, { timeout: 8000 });
  await s.page.keyboard.press('Escape');
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  await s.page.locator('[data-service-id="svc-avail"]').waitFor({ timeout: 5000 });
  const hint = s.page.locator('.dashboard-banner--hint');
  assert((await hint.count()) === 1 && (await hint.textContent()).includes(HE.hint), 'first app added → the updated Hebrew hint (no «ניהול אתרים»)');
  await assertOnDigitalHome(s, 'after the first add');
  await closePage(s);
  return 'browser: 0 apps → login lands on Digital Home; Hebrew empty state + central and header «+ הוספת אפליקציה»; no auto catalog; first add from the empty state → tile + updated hint';
}

async function checkAppsLoginReachability(url) {
  const s = await openPage(url);
  await assertOnDigitalHome(s, 'FR-01 (> 0 apps)');
  assert((await s.page.locator('[data-service-tile]').count()) === APPS_VAULT.selectedIds.length, 'FR-01: the grid shows every app');
  assert((await s.page.locator('.dashboard-banner--hint').count()) === 0, 'no first-login hint for a user with apps');
  assert((await s.page.locator('.vault-state-badge-lock').count()) === 1, 'FR-01 reachability: lock / logout');
  await openTile(s, 'svc-cred');
  assert((await panel(s).locator('[data-action="edit-profile"]').count()) >= 1 && (await panel(s).locator('[data-action="add-profile"]').count()) >= 1, 'FR-01 reachability: edit profile + add profile from the window');
  assert(JSON.stringify(await menuItems(s)) === '["remove-app"]', 'FR-01 reachability: remove app from the window menu');
  await s.page.keyboard.press('Escape');
  await s.page.keyboard.press('Escape');
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  await openTile(s, 'svc-own');
  assert(JSON.stringify(await menuItems(s)) === '["edit-site-details","remove-app"]', 'FR-01 reachability: edit site details (own site) from the window menu');
  await s.page.keyboard.press('Escape');
  await s.page.keyboard.press('Escape');
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  await openTile(s, 'svc-cred');
  await panel(s).locator('[data-action="edit-profile"]').first().click();
  await s.page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 5000 });
  await s.page.keyboard.press('Escape');
  await s.page.locator('[role="dialog"]').first().waitFor({ state: 'detached', timeout: 5000 });
  await s.page.waitForTimeout(100);
  const focusedTile = await s.page.evaluate(() => document.activeElement?.closest('[data-service-tile]')?.getAttribute('data-service-id') ?? null);
  assert(focusedTile === 'svc-cred', `AC-113-45 parity: focus returns to the app tile after the profile host closes (got ${focusedTile})`);
  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
  assert((await catalog(s).locator('[data-action="add-custom-site"]').count()) === 1, 'FR-01 reachability: custom add from the catalog');
  assert((await catalog(s).locator('[data-catalog-item="svc-avail"] button', { hasText: 'הוספה' }).count()) === 1, 'FR-01 reachability: catalog add');
  await closePage(s);
  return 'browser: > 0 apps → login lands on Digital Home; every FR action reachable (open / edit / add profile, remove, edit own site, catalog add, custom add, lock); focus returns to the tile after the profile host';
}

async function checkCatalogFailureZeroApps(url) {
  const s = await openPage(url, { vault: EMPTY_VAULT, catalogFail: true });
  await assertOnDigitalHome(s, '123.4 binding (0 apps + catalog failure)');
  const text = await bodyText(s);
  assert(!text.includes(HE.fullScreenError), '123.4 binding: no full-screen catalog error');
  assert((await s.page.locator('[data-home-empty]').count()) === 1, '123.4 binding: the empty state stays');
  assert(text.includes(HE.catalogDownEmpty), '123.4 binding: Hebrew catalog notice on the empty home');
  assert((await s.page.locator('.vault-state-badge-lock').count()) === 1, '123.4 binding: lock / logout stays usable');
  await s.page.locator('[data-action="open-catalog-empty"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
  const err = catalog(s).locator('.sm-discover-error[role="alert"]');
  await err.waitFor({ timeout: 5000 });
  await err.locator('button', { hasText: HE.retry }).click();
  await err.waitFor({ timeout: 5000 });
  await s.page.waitForTimeout(300);
  await assertOnDigitalHome(s, 'failed retry');
  assert((await catalog(s).count()) === 1 && (await err.count()) === 1, '123.4 binding: a failed retry keeps the modal with its inline error');
  await s.page.evaluate(() => { globalThis.__pvCtl.catalogFail = false; });
  await err.locator('button', { hasText: HE.retry }).click();
  await catalog(s).locator('[data-catalog-item="svc-avail"]').waitFor({ timeout: 5000 });
  assert((await err.count()) === 0, 'retry after recovery → catalog listed, error gone');
  await closePage(s);
  return 'browser: 0 apps + catalog failure → Digital Home empty state + Hebrew notice; modal inline error with «נסו שוב»; failed retry stays inline; recovery lists the catalog';
}

async function dropElsewhere(s, ids) {
  await s.page.evaluate((gone) => window.__pvGone({ goneServiceIds: gone, goneProfileIds: [] }), ids);
}
async function noticeOnTop(s) {
  const box = await notice(s).boundingBox();
  assert(box, 'notice has a box');
  return s.page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-reconcile-notice]')), { x: box.x + 8, y: box.y + box.height / 2 });
}
async function dismissNotice(s) {
  await notice(s).locator('button[aria-label="סגירה"]').click();
  await notice(s).waitFor({ state: 'detached', timeout: 5000 });
}

async function checkRemovedElsewhereNotice(url) {
  const s = await openPage(url);
  await dropElsewhere(s, ['svc-extra']);
  await notice(s).waitFor({ state: 'visible', timeout: 5000 });
  assert((await notice(s).textContent()).includes(HE.removedPlain) && (await notice(s).getAttribute('dir')) === 'rtl', 'AD-123-18: Digital Home → Hebrew RTL status notice');
  assert((await s.page.locator('[data-service-id="svc-extra"]').count()) === 0, 'KI-3 drop path: the tile left the home');
  await dismissNotice(s);

  await s.page.locator('[data-action="open-catalog"]').click();
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
  await dropElsewhere(s, ['svc-third']);
  await notice(s).waitFor({ state: 'visible', timeout: 5000 });
  assert(await noticeOnTop(s), 'AD-123-18: the notice is visible above the open catalog modal');
  assert((await catalog(s).count()) === 1, 'the catalog modal stays open');
  await dismissNotice(s);
  await s.page.keyboard.press('Escape');
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });

  await openTile(s, 'svc-cred');
  await dropElsewhere(s, ['svc-four']);
  await notice(s).waitFor({ state: 'visible', timeout: 5000 });
  assert(await panel(s).isVisible(), 'a window on an unaffected app stays open');
  assert(await noticeOnTop(s), 'AD-123-18: the notice is visible with the floating window open');
  await dismissNotice(s);

  if ((await panel(s).count()) === 0) await openTile(s, 'svc-cred');
  await dropElsewhere(s, ['svc-cred']);
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  await notice(s).waitFor({ state: 'visible', timeout: 5000 });
  const closedText = await notice(s).textContent();
  assert(closedText.includes(HE.removedClosed), `AD-123-18: window on the removed app closes with the "window closed" notice (got "${closedText}")`);
  await closePage(s);
  return 'browser: "removed elsewhere" (KI-3 drop path) → Hebrew RTL role="status" notice on Digital Home, above the open catalog modal and with the floating window open; affected window closes with its variant; no browser dialog';
}

// ─── Runner ───────────────────────────────────────────────────────────────────
const STATIC_GROUPS = [checkNoManageScreen, checkNoManageString, checkEmptyHomeAndError, checkParitySymbols, checkSingleCustomRule, checkNChecks, checkMigrationStatic];
const SQL_GROUPS = [checkAggregateSql];
const BROWSER_GROUPS = [checkZeroAppsLogin, checkAppsLoginReachability, checkCatalogFailureZeroApps, checkRemovedElsewhereNotice];

async function runAll(overrides, log) {
  for (const g of STATIC_GROUPS) {
    const what = g(overrides);
    if (log) console.log(`  ✓ ${what}`);
  }
  for (const g of SQL_GROUPS) {
    const what = await withTimeout(() => g(overrides), GROUP_TIMEOUT_MS, checkTimeoutMessage(g.name));
    if (log) console.log(`  ✓ ${what}`);
  }
  const dir = makeTempDir('pv-1234-web-');
  let server = null;
  try {
    await bundleHarness(dir, overrides);
    server = await serve(dir);
    for (const g of BROWSER_GROUPS) {
      try {
        const what = await withTimeout(() => g(server.url), GROUP_TIMEOUT_MS, checkTimeoutMessage(g.name));
        if (log) console.log(`  ✓ ${what}`);
      } finally {
        await closeOpenContexts();
      }
    }
  } finally {
    if (server) await server.close();
    removeTempDir(dir);
  }
}

/** Runs only the layers a mutation can reach (static always; SQL / browser as listed). */
async function runFor(overrides, layers) {
  for (const g of STATIC_GROUPS) g(overrides);
  if (layers.includes('sql')) for (const g of SQL_GROUPS) await withTimeout(() => g(overrides), GROUP_TIMEOUT_MS, checkTimeoutMessage(g.name));
  if (layers.includes('browser')) await runAll(overrides, false);
}

const edit = (rel, from, to) => (o) => ({ [rel]: replaceOnce(read(rel), from, to, o) });
const HOME_ANCHOR = '  // AD-123-1 — Digital Home is the only user screen';
const MUTATIONS = [
  ['M1 post-login to a non-dashboard screen with 0 apps', edit(APP, HOME_ANCHOR,
    `  if (selectedIds.size === 0) {\n    return <div className="onboarding"><p>בחרו אפליקציות</p></div>;\n  }\n${HOME_ANCHOR}`), ['browser']],
  ['M2 «ניהול אתרים» restored on Digital Home', edit(DASH,
    '        <div className="dashboard-manage-bar">\n',
    '        <div className="dashboard-manage-bar">\n          <button type="button" className="sm-action" onClick={onOpenCatalog}>{"ניהול " + "אתרים"}</button>\n'), ['browser']],
  ['M3 auto-open catalog on an empty home', edit(DASH,
    '  const handledReconcileSeq = useRef(cloudReconcile?.seq ?? 0);',
    '  const autoOpen = useRef(false);\n  if (services.length === 0 && !autoOpen.current && onOpenCatalog) {\n    autoOpen.current = true;\n    window.setTimeout(onOpenCatalog, 0);\n  }\n  const handledReconcileSeq = useRef(cloudReconcile?.seq ?? 0);'), ['browser']],
  ['M4 aggregate exposes a non-count column', edit(MIGRATION,
    "  users_with_app_without_profile bigint\n)",
    "  users_with_app_without_profile bigint,\n  some_user_id uuid\n)"), ['sql'], (src) => src.replace(
    'count(distinct a.user_id) filter (where a.first_profile_at is null)::bigint\n',
    'count(distinct a.user_id) filter (where a.first_profile_at is null)::bigint,\n      max(a.user_id::text)::uuid\n')],
  ['M5 aggregate allowed for non-admins', edit(MIGRATION,
    "  if not public.is_admin() then\n    raise exception 'Admin access required';\n  end if;\n", ''), ['sql']],
  ['M6 aggregate returns per-user rows', edit(MIGRATION,
    '    from apps a;', '    from apps a\n    group by a.user_id;'), ['sql']],
  ['M7 full-screen catalog error restored for 0 apps', edit(APP, HOME_ANCHOR,
    `  if (catalogError && selectedIds.size === 0) {\n    return (\n      <div className="onboarding">\n        <p>{'לא ניתן לטעון את קטלוג ' + 'האתרים מהרשת.'}</p>\n        <button type="button" className="finish-btn" onClick={() => void retryCatalogLoad()}>נסי שוב</button>\n      </div>\n    );\n  }\n${HOME_ANCHOR}`), ['browser']],
  ['M8 removed-elsewhere notice not rendered on Digital Home', edit(DASH,
    '      {reconcileNotice && (', '      {reconcileNotice && false && ('), ['browser']],
  ['M9 notice hidden under the catalog modal', edit(CSS,
    '  bottom: 5.5rem;\n  z-index: 100;', '  bottom: 5.5rem;\n  z-index: 80;'), ['browser']],
  ['M10 notice only when a window closed (drop path silent)', edit(DASH,
    '    setReconcileNotice(message);',
    '    if (closesPanel || cloudReconcile.closedOtherSurface) setReconcileNotice(message);'), ['browser']],
  ['M11 second "custom" rule for edit-site', edit(APP,
    '    if (!service || !isUserCustomApp(service, true)) {',
    "    if (!service || service.source !== 'user-created') {"), ['browser']],
  ['M12 empty state without «+ הוספת אפליקציה»', edit(DASH,
    '            {onOpenCatalog && (\n              <button\n                type="button"\n                className="sm-action sm-action--primary dashboard-empty-cta"',
    '            {false && (\n              <button\n                type="button"\n                className="sm-action sm-action--primary dashboard-empty-cta"'), ['browser']],
  ['M13 anon may execute the aggregate', edit(MIGRATION,
    'revoke all on function public.admin_apps_without_profile_counts() from anon;\n', ''), ['sql']],
  ['M14 execution credentials_missing copy (removed manage screen) shown again', edit('src/loginAssistance/assistanceActions.ts',
    "  if (result.status === 'credentials_missing') {\n",
    "  if (false) {\n"), []],
  ['M15 no focus return after the profile host closes', edit(APP,
    '    if (!serviceId) return;\n    document\n',
    '    if (serviceId) return;\n    document\n'), ['browser']],
];

const selectedMutations = selectMutations(MUTATIONS, MUTATION_ARGS, (m) => m[0]);

console.log('Phase 123.4 — navigation unification\n');
browser = await chromium.launch({ channel: 'msedge' });
const closeBrowser = () => browser.close();
try {
  await runAll({}, true);
  const groupCount = STATIC_GROUPS.length + SQL_GROUPS.length + BROWSER_GROUPS.length;
  if (MUTATION_ARGS.mode === 'none') {
    console.log(`\nPASS — Phase 123.4 navigation: ${groupCount} check groups, mutation sweep skipped (--no-mutations) — ${formatElapsed(Date.now() - STARTED)}`);
  } else {
    console.log(MUTATION_ARGS.mode === 'all' ? '\nMutations (full sweep)' : `\nMutations (selected: ${[...MUTATION_ARGS.ids].join(', ')})`);
    let caughtCount = 0;
    for (const [label, makeOverrides, layers, post] of selectedMutations) {
      const id = mutationId(label);
      const overrides = makeOverrides(label);
      if (post) for (const rel of Object.keys(overrides)) overrides[rel] = post(overrides[rel]);
      let caught = null;
      try {
        await withTimeout(() => runFor(overrides, layers), MUTATION_TIMEOUT_MS, mutationTimeoutMessage(id, MUTATION_TIMEOUT_MS));
      } catch (e) {
        if (isTimeout(e)) await failRun(`${e.message} (${label})`, closeBrowser);
        caught = e instanceof Error ? e.message.split('\n')[0] : String(e);
      } finally {
        await closeOpenContexts();
      }
      assert(caught, `mutation NOT caught: ${label}`);
      assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
      // AD-123-15: every aggregate mutation must also fail the database run alone, not only the scan.
      if (layers.includes('sql')) {
        let sqlErr = null;
        try {
          await withTimeout(() => checkAggregateSql(overrides), GROUP_TIMEOUT_MS, checkTimeoutMessage('checkAggregateSql'));
        } catch (e) {
          if (isTimeout(e)) await failRun(`${e.message} (${label})`, closeBrowser);
          sqlErr = e instanceof Error ? e.message.split('\n')[0] : String(e);
        }
        assert(sqlErr && !sqlErr.startsWith('fixture:'), `mutation passes the database checks: ${label}`);
        caught = `${caught.slice(0, 90)} | SQL alone: ${sqlErr.slice(0, 90)}`;
      }
      caughtCount += 1;
      console.log(`  ✓ mutation caught: ${id} ${label.slice(id.length + 1)} — ${caught.slice(0, 160)}`);
    }
    console.log(`  H-1: ${reclaimedContexts} browser context(s) left open by a failing check were closed by the group finally`);
    const scope = MUTATION_ARGS.mode === 'all' ? 'mutations caught' : 'selected mutations caught';
    console.log(`\nPASS — Phase 123.4 navigation: ${groupCount} check groups, ${caughtCount} ${scope} — ${formatElapsed(Date.now() - STARTED)}`);
  }
} catch (e) {
  await failRun(e instanceof Error ? e.message : String(e), closeBrowser);
}
await withTimeout(closeBrowser, 10_000, 'browser close timed out').catch(() => undefined);
process.exit(0);
