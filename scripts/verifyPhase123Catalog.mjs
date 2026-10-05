/**
 * Phase 123.2 — Digital Home catalog + «עריכת פרטי האתר» (AD-123-8, AD-123-14, AD-123-17).
 *
 * Three layers, each run on the real sources (mutations are applied in memory):
 *  - pure: catalogModel helpers, addToSelection (no profile), appContextActions edit_site_details;
 *  - static: App wiring (addApp → addService → changeSelection(id, 'add'); onAddCustom =
 *    addCustomService; onSave = updateCustomService — unchanged apart from the D-123-5 timing and
 *    background catalog reload), catalog imports
 *    (no profile reducers / admin / direct writes), AD-123-17 (app menu outside the profile gate),
 *    N-1 / N-2 (git vs HEAD), N-3 / N-4 / N-5 / N-8 scans of the new Digital Home files;
 *  - browser (Edge via Playwright): the real Dashboard, LoginAssistancePanel, AppCatalogModal,
 *    AppCatalog, AddSiteModal and EditSiteDetailsModal with the real vault.ts persistVault and the
 *    real addToSelection. The harness host mirrors App's addApp / onAddCustom / onSave contracts
 *    (App.tsx is checked statically). Fix round: D-123-2 fixed catalog height, D-123-3 backdrop
 *    rule (drag from an input keeps the dialog), D-123-4 required category on create.
 *    123.2b: AD-123-19 listing gate (hidden sites neither listed nor searchable; tiles kept).
 *    Stubbed seams only: supabase/persistence (cloud, recorded)
 *    and useServiceLogos (no logos). Synthetic fixtures only; no credential value is logged.
 *
 * Usage: node scripts/verifyPhase123Catalog.mjs [--no-mutations | --mutations=M1,M2]
 *        No mutation switch = full sweep (END OF ROUND only, test policy T-1).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
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
const MUTATION_ARGS = parseMutationArgs();
const STARTED = Date.now();

const HE = {
  addApp: '+ הוספת אפליקציה',
  catalogTitle: 'הוספת אפליקציה',
  addCustom: '+ הוספת אתר מותאם אישית',
  noMatch: 'לא נמצאו אתרים תואמים. נסו חיפוש אחר או הוסיפו אתר מותאם אישית.',
  loadFailed: 'לא ניתן לטעון את קטלוג האתרים כרגע. האתרים שלכם עדיין זמינים.',
  retry: 'נסו שוב',
  add: 'הוספה',
  alreadyAdded: '✓ כבר בבית הדיגיטלי',
  appActions: 'פעולות אפליקציה',
  editSite: 'עריכת פרטי האתר',
  removeApp: 'הסרת אפליקציה',
  addHome: 'הוסף לבית הדיגיטלי',
  dismiss: 'סגור',
  notNow: 'לא עכשיו',
  availablePrompt: 'רוצה להוסיף אותו לבית הדיגיטלי שלך?',
  categoryRequired: 'יש לבחור קטגוריה',
  categoryPlaceholder: 'בחרו קטגוריה',
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const T0 = '2026-10-01T00:00:00.000Z';
const prof = (id, serviceId, displayName, isDefault = false) => ({
  schemaVersion: 1,
  id,
  serviceId,
  displayName,
  createdAt: T0,
  updatedAt: T0,
  ...(isDefault ? { isDefault: true } : {}),
});
const FIELDS = [
  { id: 'username', label: 'שם משתמש', type: 'text' },
  { id: 'password', label: 'סיסמה', type: 'password' },
];
/** AD-123-19: a version-matched validated mapping covering FIELDS = «מאושר למשתמשים», so the site is listed. */
const approvedMapping = (host) => ({
  supportState: 'validated',
  configVersion: 1,
  loginEntryUrl: `https://${host}/login`,
  allowedOrigin: `https://${host}`,
  fieldMappings: FIELDS.map((f) => ({ fieldId: f.id, locatorType: 'css', locator: `#${f.id}` })),
  validation: { metadataVersion: 1, validatedBy: 'admin' },
});
const builtIn = (id, name, category, host) => ({
  id,
  name,
  icon: '🔗',
  url: `https://${host}/`,
  category,
  source: 'built-in-catalog',
  loginFields: FIELDS,
  metadata: { credentialMode: 'credential_fields', autofillProfile: approvedMapping(host) },
});
const userCreated = (id, name, host) => ({ id, name, icon: '🔗', url: `https://${host}/`, category: 'shopping', source: 'user-created' });
/** A custom site (in vault customServices) whose runtime source is the catalog (AD-123-14 promoted-site note). */
const promoted = (id, name, host, credentialMode) => ({ ...builtIn(id, name, 'health', host), metadata: { credentialMode } });
/** AD-123-19 hidden sites: a built-in waiting for its mapping, and a promoted submission without a mapping. */
const pendingBuiltIn = (id, name, host) => ({ ...builtIn(id, name, 'shopping', host), metadata: { credentialMode: 'credential_fields' } });
const promotedUnmapped = (id, name, host) => ({
  id,
  name,
  icon: '🔗',
  url: `https://${host}/`,
  category: 'shopping',
  source: 'built-in-catalog',
  metadata: { loginUrlSource: 'user', provenance: { promotedFromServiceId: 'custom-other' }, approvalStatus: 'approved' },
});

/**
 * Launch kinds of the four custom apps (AD-123-17). A user-created source always resolves to a credential
 * form, so `no-stored-credentials` / `not-configured` custom apps come from a catalog runtime source.
 */
const CUSTOM_KINDS = [
  ['svc-c-cred', 'credentials'],
  ['svc-c-missing', 'missing-user-credentials'],
  ['svc-c-nostored', 'no-stored-credentials'],
  ['svc-c-notconf', 'not-configured'],
];
const FIXTURE = {
  userId: 'user-1232-test',
  password: 'fixture-master-password',
  customIds: CUSTOM_KINDS.map(([id]) => id),
  services: [
    builtIn('svc-home-bank', 'בנק הבית', 'banking', 'home-bank.example.test'),
    builtIn('svc-bank-alpha', 'בנק אלפא', 'banking', 'alpha-bank.example.test'),
    builtIn('svc-bank-beta', 'בנק בטא', 'banking', 'beta-bank.example.test'),
    builtIn('svc-clinic', 'מרפאה כללית', 'health', 'clinic.example.test'),
    builtIn('svc-shop', 'חנות רשת', 'shopping', 'web-shop.example.test'),
    userCreated('svc-c-cred', 'אתר עם פרטים', 'custom-cred.example.test'),
    userCreated('svc-c-missing', 'אתר בלי פרטים', 'custom-missing.example.test'),
    promoted('svc-c-nostored', 'אתר ללא שמירה', 'custom-nostored.example.test', 'no_stored_credentials'),
    promoted('svc-c-notconf', 'אתר לא מוגדר', 'custom-notconf.example.test', 'not_configured'),
    pendingBuiltIn('svc-gate-pending', 'אתר ממתין למיפוי', 'pending-site.example.test'),
    { id: 'svc-gate-nostored', name: 'אתר מידע', icon: '🔗', url: 'https://info-site.example.test/', category: 'shopping', source: 'built-in-catalog', metadata: { credentialMode: 'no_stored_credentials' } },
    promotedUnmapped('svc-gate-promoted', 'הצעה שקודמה', 'promoted-site.example.test'),
    // AD-123-19 (b): the user's own custom site, not promoted, not in the home, no mapping.
    { ...userCreated('svc-own-new', 'האתר שלי', 'own-site.example.test'), category: 'custom' },
  ],
  state: {
    selectedIds: ['svc-home-bank', 'svc-c-cred', 'svc-c-missing', 'svc-c-nostored', 'svc-c-notconf'],
    customServices: [],
    accessProfiles: [prof('p-home', 'svc-home-bank', 'אישי', true), prof('p-c-cred', 'svc-c-cred', 'ראשי', true)],
    credentials: { 'p-c-cred': { username: 'fixture-user', password: 'fixture-pass' } },
  },
};
const AVAILABLE = ['svc-bank-alpha', 'svc-bank-beta', 'svc-clinic', 'svc-shop'];
/**
 * AD-123-19: not listed (gate) and not in the home → not shown.
 * AD-123-19 (a): svc-c-nostored / svc-c-notconf fail the gate (FIELDS next to an explicit mode =
 * configuration_invalid) but are in the home → shown, marked «✓ כבר בבית הדיגיטלי», tiles stay.
 */
const HIDDEN = ['svc-gate-pending', 'svc-gate-promoted'];
const KEPT_IN_HOME = ['svc-c-nostored', 'svc-c-notconf'];
const LISTED = FIXTURE.services.map((s) => s.id).filter((id) => !HIDDEN.includes(id));
/** Registry categories for the harness, incl. the seeded «מותאם אישית» (phase108 seed). */
const REGISTRY_CATEGORIES = [
  { id: 'banking', display_name: 'בנקים', sort_order: 10 },
  { id: 'health', display_name: 'בריאות', sort_order: 20 },
  { id: 'shopping', display_name: 'קניות', sort_order: 30 },
  { id: 'custom', display_name: 'מותאם אישית', sort_order: 100 },
];

// ─── Bundling (shared by the pure and browser layers) ─────────────────────────
const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();

function persistenceStub() {
  const names = new Set();
  for (const m of read('src/supabase/persistence.ts').matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.add(m[1]);
  const impl = {
    bumpDualWriteGeneration: '() => ++gen',
    getDualWriteGeneration: '() => gen',
    fetchVaultKdf: 'async () => null',
    ensureVaultKdfSeeded: 'async () => {}',
    syncVaultStateToSupabaseSafe: 'async () => { log("syncVaultStateToSupabaseSafe", []); return { ok: true }; }',
  };
  const lines = ['let gen = 0;', 'function log(fn, args) { (globalThis.__pvSeq ??= []).push({ kind: "cloud", fn, args }); }'];
  for (const n of names) lines.push(`export const ${n} = ${impl[n] ?? `async (...args) => { log(${JSON.stringify(n)}, args); }`};`);
  return lines.join('\n');
}

const STUBS = {
  'src/supabase/persistence.ts': persistenceStub,
  'src/useServiceLogos.ts': () => 'export function useServiceLogos() { return {}; }\nexport default useServiceLogos;',
};

function seamsPlugin(overrides, used) {
  const stubs = new Map(Object.entries(STUBS).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  return {
    name: 'phase1232-seams',
    setup(b) {
      b.onLoad({ filter: /\.(ts|tsx|css)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        const loader = key.endsWith('.css') ? 'css' : key.endsWith('.tsx') ? 'tsx' : 'ts';
        if (stubs.has(key)) return { contents: stubs.get(key)(), loader, resolveDir: dirname(args.path) };
        if (overridden.has(key)) {
          used.add(key);
          return { contents: overridden.get(key), loader, resolveDir: dirname(args.path) };
        }
        return undefined;
      });
    },
  };
}

const COMMON_BUILD = {
  bundle: true,
  write: true,
  logLevel: 'silent',
  jsx: 'automatic',
  nodePaths: [join(root, 'node_modules')],
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl', '.wasm': 'binary' },
  define: {
    'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production' }),
    'process.env.NODE_ENV': '"production"',
  },
};

/** Overrides that the browser bundle does not load (App.tsx / ManageServices.tsx) are checked by the static layer. */
const BROWSER_BUNDLED = (rel) => !['src/App.tsx', 'src/ManageServices.tsx'].includes(rel);

// ─── Layer 1: pure ────────────────────────────────────────────────────────────
const PURE_ENTRY = `
export * from './src/digitalHome/catalogModel.ts';
export { appContextActions } from './src/digitalHome/appContext.ts';
export { addToSelection } from './src/serviceManagement/serviceSelection.ts';
export { filterDiscoveryServices } from './src/serviceManagement/discoveryFilter.ts';
export { runtimeCategoryOrder } from './src/mockServices.ts';
`;

async function loadPure(overrides) {
  const dir = makeTempDir('pv-1232-pure-');
  try {
    const used = new Set();
    const pureOverrides = Object.fromEntries(Object.entries(overrides).filter(([rel]) => rel.endsWith('.ts')));
    await build({
      ...COMMON_BUILD,
      stdin: { contents: PURE_ENTRY, resolveDir: root, loader: 'ts', sourcefile: 'pure.ts' },
      outfile: join(dir, 'pure.mjs'),
      format: 'esm',
      platform: 'node',
      plugins: [seamsPlugin(pureOverrides, used)],
    });
    return await import(pathToFileURL(join(dir, 'pure.mjs')).href);
  } finally {
    removeTempDir(dir);
  }
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const ids = (list) => list.map((s) => s.id).join(',');

function checkCatalogHelpers(mod) {
  const cats = mod.userFacingCategories();
  assert(!cats.includes('practice') && cats.length === mod.runtimeCategoryOrder.filter((c) => c !== 'practice').length, `userFacingCategories = live order without practice (${cats.join(',')})`);
  const services = FIXTURE.services;
  const cases = [
    [{ query: '', category: null }, services.map((s) => s.id).join(',')],
    [{ query: 'בנק', category: null }, 'svc-home-bank,svc-bank-alpha,svc-bank-beta'],
    [{ query: 'web-shop', category: null }, 'svc-shop'],
    [{ query: '  BETA-BANK ', category: null }, 'svc-bank-beta'],
    [{ query: '', category: 'health' }, 'svc-clinic,svc-c-nostored,svc-c-notconf'],
    [{ query: 'אלפא', category: 'health' }, ''],
    [{ query: 'zzz-nothing', category: null }, ''],
  ];
  for (const [filter, want] of cases) {
    const got = ids(mod.filterCatalog(services, filter));
    assert(got === want, `FR-15/16: filterCatalog(${JSON.stringify(filter)}) = ${got} (want ${want})`);
    assert(got === ids(mod.filterDiscoveryServices(services, filter)), 'AD-123-8: filterCatalog reuses filterDiscoveryServices');
  }
  const selected = new Set(['a']);
  const pending = new Set(['a', 'b']);
  assert(mod.catalogItemState('a', selected, pending) === 'added', 'FR-17: selected app → added (even while pending)');
  assert(mod.catalogItemState('b', selected, pending) === 'pending', 'pending app → pending');
  assert(mod.catalogItemState('c', selected, pending) === 'available', 'other app → available');
  return 'pure: userFacingCategories (no practice); filterCatalog = filterDiscoveryServices (name / domain / category / no match); catalogItemState added > pending > available';
}

function checkAddNoProfile(mod) {
  const before = clone(FIXTURE.state);
  const after = mod.addToSelection(before, 'svc-bank-alpha');
  assert(after.selectedIds.includes('svc-bank-alpha'), 'FR-18: addToSelection adds the id');
  assert(JSON.stringify(after.accessProfiles) === JSON.stringify(FIXTURE.state.accessProfiles), 'FR-18: addToSelection creates 0 profiles');
  assert(JSON.stringify(after.credentials) === JSON.stringify(FIXTURE.state.credentials), 'FR-18: addToSelection writes no credential');
  const twice = mod.addToSelection(after, 'svc-bank-alpha');
  assert(twice.selectedIds.filter((id) => id === 'svc-bank-alpha').length === 1, 'FR-17: adding twice keeps one entry (no duplicate tile)');
  return 'pure: addToSelection adds the id only — 0 profiles, 0 credentials, idempotent';
}

function checkEditSiteMatrix(mod) {
  for (const n of [0, 1, 2]) {
    const profiles = Array.from({ length: n }, (_, i) => prof(`p${i}`, 's', `פ${i}`, i === 0));
    for (const isCustom of [true, false]) {
      const actions = mod.appContextActions({ id: 's' }, profiles, isCustom);
      assert(actions.menu.edit_site_details === isCustom, `AD-123-14: edit_site_details = isCustom (${n} profiles, custom=${isCustom})`);
    }
  }
  return 'pure: appContextActions.menu.edit_site_details = custom only (0 / 1 / 2 profiles)';
}

// ─── Layer 2: static ──────────────────────────────────────────────────────────
function srcFiles(dir = 'src') {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...srcFiles(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}
const source = (overrides, rel) => overrides[rel] ?? read(rel);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// Pre-Phase-123 tree (Phase 122 commit). HEAD can no longer be the baseline: the WIP commit
// af881f6b on wip/phase123-recovered already contains the Phase 123 changes.
const BASE = '909cc8bcceedd3b74d2e6fdbcc1ecac291a7b570';
const headSource = (rel) => {
  try {
    return git('show', `${BASE}:${rel}`).replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
};
/** Body of a top-level / nested function, by brace matching from its header. */
function fnBody(src, header) {
  const at = src.indexOf(header);
  if (at < 0) return null;
  const open = src.indexOf('{\n', at);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  return null;
}
function importsOf(src) {
  return [...src.matchAll(/^import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?$/gm)].map((m) => ({ names: m[1], from: m[2] }));
}

const CATALOG_FILES = [
  'src/digitalHome/AppCatalog.tsx',
  'src/digitalHome/AppCatalogModal.tsx',
  'src/digitalHome/catalogModel.ts',
  'src/digitalHome/customSiteForm.ts',
];
const NEW_DH_FILES = [...CATALOG_FILES, 'src/digitalHome/EditSiteDetailsModal.tsx'];
/** Read-only modules the catalog body may import (AD-123-8: no profile data, every write via host callbacks). */
const CATALOG_ALLOWED_IMPORTS = new Set([
  'react',
  '../AddSiteModal',
  '../components/ServiceCard',
  '../mockServices',
  '../service/serviceModel',
  '../supabase/registryPersistence',
  '../trust',
  '../useServiceLogos',
  '../serviceManagement/discoveryFilter',
  '../catalog',
  './catalogModel',
  './customSiteForm',
  './AppCatalog',
  './dialogDismiss', // D-123-3 backdrop / Escape hooks (UI only)
  '../catalog/catalogVisibility', // AD-123-19 listing gate (pure, reads catalog metadata only)
]);
const REGISTRY_COPY = new Set([
  'CATALOG_SERVICE_ADD_HOME_LABEL',
  'CATALOG_SERVICE_ALREADY_IN_HOME_DISMISS_LABEL',
  'catalogServiceAlreadyInHomeMessage',
  'CATALOG_SERVICE_AVAILABLE_PROMPT',
  'catalogServiceAvailableTitle',
  'CATALOG_SERVICE_NOT_NOW_LABEL',
  'type AddCustomServiceResult',
]);
const DIRECT_WRITE = /persistVault|putVault|indexedDB|getSupabaseClient|supabase\.from|\.rpc\s*\(|addToSelection|changeSelection|addCustomService\s*\(|updateCustomService\s*\(|upsertCustomServiceRegistryRow|addAccessProfile|addProfileWithCredential|saveCredentialForProfile|accessProfiles|credentialsByProfileId/;

function checkCatalogImports(overrides) {
  for (const rel of CATALOG_FILES) {
    const src = source(overrides, rel);
    for (const imp of importsOf(src)) {
      assert(!/(^|\/)admin(\/|$)/.test(imp.from), `N-8 / AD-123-8: ${rel} imports from src/admin (${imp.from})`);
      assert(CATALOG_ALLOWED_IMPORTS.has(imp.from), `AD-123-8: ${rel} imports outside the read-only allow-list (${imp.from})`);
      if (imp.from === '../supabase/registryPersistence') {
        const names = imp.names.replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
        assert(names.every((n) => REGISTRY_COPY.has(n)), `AD-123-8: ${rel} imports only copy / types from registryPersistence (${names.join(', ')})`);
      }
    }
    assert(!DIRECT_WRITE.test(src), `AD-123-4 / AD-123-8: ${rel} reads no profile data and writes nothing directly`);
  }
  const catalog = source(overrides, 'src/digitalHome/AppCatalog.tsx');
  assert(/await onAddApp\(serviceId\)/.test(catalog), 'FR-18: catalog add delegates to onAddApp');
  assert(/await onAddCustom\(definition\)/.test(catalog), 'FR-19: custom add delegates to onAddCustom');
  assert(/catalogItemState\(service\.id, selectedIds, pendingIds\)/.test(catalog), 'FR-17: item state from selectedIds / pendingIds');
  const props = catalog.slice(catalog.indexOf('export interface AppCatalogProps'), catalog.indexOf('}', catalog.indexOf('export interface AppCatalogProps')));
  assert(!/profile|credential|accessProfiles/i.test(props), 'AD-123-8: no profile input enters the catalog');
  const edit = source(overrides, 'src/digitalHome/EditSiteDetailsModal.tsx');
  assert(!DIRECT_WRITE.test(edit) && /await onSave\(next\)/.test(edit), 'AD-123-14: edit-site saves only via onSave');
  assert(/<AddSiteModal\s+mode="edit"/.test(edit), 'AD-123-14: edit-site = the existing AddSiteModal edit flow');
  return 'AD-123-8: catalog files import only read-only modules (no profile reducers / admin / vault / persistence), read no profile data, write only via onAddApp / onAddCustom; edit-site only via onSave';
}

const HEAD_CATALOG_RELOAD = `
    clearRegistryCatalogCache();
    const refreshed = await loadBuiltinCatalogDefinitions();
    setRuntimeCategoryCatalog(await loadRegistryCategories());
    setCatalogDefinitions(refreshed);`;
/** D-123-5 edits undone: timing lines removed, background reload replaced by the HEAD inline reload. */
function withoutD1235(body) {
  return body
    .replace(/\n {4}const timing = startSaveTiming\('[^']+'\);/, '')
    .replace(/\n +timing\.mark\('[^']+'\);/g, '')
    .replace(
      /\n {4}\/\/ D-123-5: the tile already comes from vault `customServices`; the catalog refresh runs in\n {4}\/\/ the background instead of holding the form on «שומר…»\.\n {4}void refreshCatalogAfterCustomSave\(timing\);|\n {4}void refreshCatalogAfterCustomSave\(timing\);/,
      HEAD_CATALOG_RELOAD,
    )
    // AD-123-12 (123.3): a pending removal of the same site commits before the add.
    .replace('\n    await commitPendingRemovalForUrl(normalizedUrl);', '')
    // AD-123-18 amendment A: the new custom site's membership enters the outbox.
    .replace(
      '\n    noteDeliberateAdd(definition.id);\n    const nextState = recordLocalCreations(persistBase, {\n      ...persistBase,\n      customServices: [...persistBase.customServices, definition],\n      selectedIds: [...new Set([...persistBase.selectedIds, definition.id])],\n    });',
      '\n    const nextState: VaultState = {\n      ...persistBase,\n      customServices: [...persistBase.customServices, definition],\n      selectedIds: [...new Set([...persistBase.selectedIds, definition.id])],\n    };',
    );
}

function checkAppWiring(overrides) {
  const app = source(overrides, 'src/App.tsx');
  const headApp = headSource('src/App.tsx');
  const addApp = fnBody(app, 'async function addApp(id: string)');
  assert(addApp && /await addService\(id\)/.test(addApp) && !/accessProfiles|Profile|credential|persistVault/i.test(addApp), 'AD-123-8 / FR-18: addApp → addService only (no profile)');
  assert(/selectedIds\.includes\(id\)[\s\S]*?status: 'already_added'/.test(addApp), 'FR-17: addApp short-circuits an already-added app');
  const addService = fnBody(app, 'function addService(id: string)');
  assert(addService && /return changeSelection\(id, 'add'\);/.test(addService), 'AD-123-8: addService → changeSelection(id, \'add\')');
  const change = fnBody(app, 'async function changeSelection(');
  assert(change && /mode === 'add' \? addToSelection\(vaultState, id\)/.test(change), 'changeSelection(add) → addToSelection');
  // Superseded by D-123-5 (was: byte-identical to HEAD): the only allowed differences are the
  // dev-only stage timing and the catalog reload moved to refreshCatalogAfterCustomSave (background).
  const reload = fnBody(app, 'async function refreshCatalogAfterCustomSave(');
  assert(reload && reload.includes(HEAD_CATALOG_RELOAD.trim().replace(/\n {4}/g, '\n      ')), 'D-123-5: background reload runs the same catalog / category reload as HEAD');
  for (const name of ['addCustomService', 'updateCustomService']) {
    const now = fnBody(app, `async function ${name}(`);
    assert(now && /void refreshCatalogAfterCustomSave\(timing\);/.test(now), `D-123-5: ${name} reloads the catalog in the background`);
    assert(now && withoutD1235(now) === fnBody(headApp, `async function ${name}(`), `AD-123-4 / D-123-5: ${name} unchanged vs HEAD apart from timing + background reload`);
  }
  const host = app.slice(app.indexOf('const catalogHost = catalogOpen ?'), app.indexOf(') : null;', app.indexOf('const catalogHost = catalogOpen ?')));
  assert(/<AppCatalogModal/.test(host) && /onAddApp=\{addApp\}/.test(host) && /onAddCustom=\{addCustomService\}/.test(host), 'AD-123-8: catalog modal hosted in App with onAddApp = addApp, onAddCustom = addCustomService');
  assert(!/accessProfiles|credentials|Profile/.test(host), 'AD-123-8: no profile data passed to the catalog modal');
  const editHost = app.slice(app.indexOf('const siteEditHost = siteEditService ?'), app.indexOf(') : null;', app.indexOf('const siteEditHost = siteEditService ?')));
  assert(/<EditSiteDetailsModal/.test(editHost) && /onSave=\{updateCustomService\}/.test(editHost), 'AD-123-14: edit-site saves via updateCustomService');
  const guard = fnBody(app, 'function openSiteDetailsEdit(serviceId: string)');
  assert(guard && /if \(!customServiceIds\.has\(serviceId\)\) \{\s*return;/.test(guard), 'AD-123-14: App opens edit-site only for vault customServices');
  assert(/onOpenCatalog=\{\(\) => setCatalogOpen\(true\)\}/.test(app), 'Digital Home «+ הוספת אפליקציה» opens the App-hosted catalog');
  // Superseded by AD-123-18 (was: no new persistVault call site): the reconcile commits are
  // local-only, so no new cloud-writing persistVault call site.
  const cloudWriting = (s) => (s.match(/persistVault\s*\((?![^)]*skipCloudSync: true)/g) ?? []).length;
  assert(cloudWriting(app) <= cloudWriting(headApp), 'AD-123-4: no new cloud-writing persistVault call site in App.tsx');
  return 'App: addApp → addService → changeSelection(id, \'add\') → addToSelection; onAddCustom = addCustomService and onSave = updateCustomService (unchanged vs HEAD apart from D-123-5 timing + background catalog reload); edit-site guarded by customServiceIds; no new cloud-writing persistVault';
}

function checkMenuOutsideProfileGate(overrides) {
  const panel = source(overrides, 'src/loginAssistance/LoginAssistancePanel.tsx');
  const def = panel.match(/const showAppMenu = ([^;]+);/);
  const edit = panel.match(/const showEditSiteDetails = ([^;]+);/);
  assert(def && edit, 'AD-123-17: showAppMenu / showEditSiteDetails definitions');
  const gate = /profileUi|showCredentialUi|launchKind|entry|credentialMode|launchKindOffersProfileUi|form/;
  assert(!gate.test(def[1]) && !gate.test(edit[1]), `AD-123-17: app menu does not depend on launch kind / profile UI (${def[1].trim()} | ${edit[1].trim()})`);
  assert(/actions\.menu\.edit_site_details/.test(edit[1]), 'AD-123-14: «עריכת פרטי האתר» = appContextActions(...).menu.edit_site_details');
  const header = panel.slice(panel.indexOf('<header className="la-panel-header">'), panel.indexOf('</header>'));
  assert(header.includes('{showAppMenu && ('), 'AD-123-17: the app menu renders in the panel header');
  assert(!gate.test(header.slice(0, header.indexOf('{showAppMenu && ('))), 'AD-123-17: no profile / launch-kind condition wraps the menu inside the header');
  const ret = panel.lastIndexOf('return (', panel.indexOf('<header className="la-panel-header">'));
  assert(!/profileUi|showCredentialUi|launchKind ===/.test(panel.slice(ret, panel.indexOf('<header className="la-panel-header">'))), 'AD-123-17: the header is not inside a profile / launch-kind condition');
  assert(/const profileUi = launchKindOffersProfileUi\(launchKind\);/.test(panel), 'profile UI keeps its gating (launchKindOffersProfileUi)');
  // Superseded by AD-123-11 (was: no remove-app entry before 123.3): «הסרת אפליקציה» =
  // menu.remove_app, gated only by its entry like «עריכת פרטי האתר».
  const remove = panel.match(/const showRemoveApp = ([^;]+);/);
  assert(remove && /actions\.menu\.remove_app/.test(remove[1]) && !gate.test(remove[1]), 'AD-123-11: «הסרת אפליקציה» = appContextActions(...).menu.remove_app, not gated by launch kind / profile UI');
  assert(/showEditSiteDetails/.test(def[1]) && /showRemoveApp/.test(def[1]), 'AD-123-11: showAppMenu = edit_site_details || remove_app');
  return 'AD-123-17: app menu in the panel header, gated only by its entries (edit_site_details / remove_app), not by launch kind / profile UI; profile UI gating unchanged';
}

function checkNoBrowserDialogsNew(overrides) {
  const hits = [];
  for (const rel of [...NEW_DH_FILES, 'src/loginAssistance/LoginAssistancePanel.tsx', 'src/Dashboard.tsx', 'src/App.tsx', 'src/ManageServices.tsx']) {
    source(overrides, rel).split('\n').forEach((line, i) => {
      if (/window\.(confirm|alert|prompt)\s*\(|(?<![\w.$])(confirm|alert|prompt)\s*\(/.test(line.replace(/\/\/.*$/, ''))) hits.push(`${rel}:${i + 1}`);
    });
  }
  assert(hits.length === 0, `N-4: browser dialog call: ${hits.join(', ')}`);
  return 'N-4: no window.confirm / alert / prompt in the catalog / edit-site / panel / Dashboard / App / ManageServices';
}

function checkNoSiteBranchesNew(overrides) {
  for (const rel of [...NEW_DH_FILES, 'src/loginAssistance/LoginAssistancePanel.tsx', 'src/Dashboard.tsx']) {
    const src = source(overrides, rel);
    assert(!/(service\.id|serviceId)\s*[!=]==?\s*['"`]/.test(src), `N-5: no serviceId literal branch in ${rel}`);
    assert(!/hostname|svc-(home|bank|clinic|shop|c-)/.test(src.replace(/\/\/.*$/gm, '')), `N-5: no hostname / fixture branch in ${rel}`);
  }
  const messages = source(overrides, 'src/loginAssistance/messages.ts');
  assert(messages.includes(`'${HE.editSite}'`) && messages.includes(`'${HE.appActions}'`), 'N-6: menu copy is Hebrew');
  const catalog = source(overrides, 'src/digitalHome/AppCatalog.tsx');
  for (const label of [HE.addCustom, HE.noMatch, HE.loadFailed]) assert(catalog.includes(label), `N-6: catalog copy is Hebrew (${label})`);
  assert(source(overrides, 'src/digitalHome/AppCatalogModal.tsx').includes(`'${HE.addApp}'`), 'N-6: «+ הוספת אפליקציה»');
  return 'N-5: no site / hostname / serviceId / fixture branches; N-6: new copy is Hebrew';
}

function checkProtectedUnchanged() {
  const tracked = git('ls-files').split('\n').filter(Boolean);
  const manifests = tracked.filter((p) => /(^|\/)manifest[^/]*$/.test(p) && !p.startsWith('node_modules/'));
  const protectedPaths = [
    // crypto.ts / vault.ts: AD-123-18 amendment A outbox payload field only (checked by
    // verifyPhase123AppContext checkVaultPayloadShapeOnly).
    'src/vault/db.ts',
    'src/vault/vaultMigration.ts',
    // persistence.ts: AD-123-18 (scope checked by verifyPhase123AppContext / verifyPhase123Sync).
    // AddSiteModal.tsx: D-123-3 / D-123-4 (checked by the browser layer below).
    'src/supabase/registryPersistence.ts',
    // serviceSelection.ts: superseded by AD-123-11 / arch §7 (was: unchanged) — removeAppFromVault
    // and the re-add leftover cleanup (checked by verifyPhase123RemoveApp).
    'src/execution',
    'extension',
    ...manifests,
  ];
  assert(manifests.length >= 1, 'N-2: at least one tracked manifest file found');
  for (const p of protectedPaths) {
    assert(existsSync(join(root, p)), `N-2: protected path exists (${p})`);
    assert(git('diff', '--name-only', BASE, '--', p).trim() === '', `N-2: ${p} unchanged vs HEAD`);
    assert(git('ls-files', '--others', '--exclude-standard', '--', p).trim() === '', `N-2: no new files under ${p}`);
  }
  // AD-123-19 (was: src/admin diff empty): src/admin/userApproval.ts becomes a re-export of the
  // shared helper — content checked by verifyPhase123CatalogGate. D-123-6 (N-1 copy exception):
  // ApprovalQueue.tsx success line — content checked by verifyPhase123FixD6D8.
  const adminChanged = git('diff', '--name-only', BASE, '--', 'src/admin').split('\n').filter(Boolean);
  assert(adminChanged.every((p) => p === 'src/admin/userApproval.ts' || p === 'src/admin/ApprovalQueue.tsx'), `N-1: only the AD-123-19 re-export (+ D-123-6 copy line) changes under src/admin (${adminChanged.join(', ')})`);
  assert(git('ls-files', '--others', '--exclude-standard', '--', 'src/admin').trim() === '', 'N-1: no new files under src/admin');
  return `N-1 / N-2: src/admin (apart from the AD-123-19 re-export) and ${protectedPaths.length} protected paths unchanged vs HEAD (${protectedPaths.join(', ')})`;
}

// ─── Layer 3: browser ─────────────────────────────────────────────────────────
const HARNESS_ENTRY = `
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './src/Dashboard';
import AppCatalogModal from './src/digitalHome/AppCatalogModal';
import EditSiteDetailsModal from './src/digitalHome/EditSiteDetailsModal';
import { userFacingCategories } from './src/digitalHome/catalogModel';
import { setRuntimeCategoryCatalog } from './src/mockServices';
import { addToSelection, SELECTION_PERSIST_FAILED_MESSAGE } from './src/serviceManagement/serviceSelection';
import { persistVault, unlockVault } from './src/vault/vault';
import './src/index.css';
import './src/App.css';

const FIX = ${JSON.stringify(FIXTURE)};
setRuntimeCategoryCatalog(${JSON.stringify(REGISTRY_CATEGORIES)});
const clone = (v) => JSON.parse(JSON.stringify(v));
const customIds = new Set(FIX.customIds);
window.__pvSeq = [];
window.__pvCtl = { addFail: false, customResult: { status: 'created' }, customThrow: false };

function Harness({ initial }) {
  const [state, setState] = useState(initial);
  const [services, setServices] = useState(FIX.services);
  const [pending, setPending] = useState(new Set());
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [siteEditId, setSiteEditId] = useState(null);
  const ref = useRef(state);
  ref.current = state;
  window.__pv.state = () => clone(ref.current);
  window.__pv.setCatalogError = setCatalogError;
  // Another screen removes an app from the home while the catalog stays open.
  window.__pv.removeFromHome = (id) => {
    const next = { ...ref.current, selectedIds: ref.current.selectedIds.filter((x) => x !== id) };
    ref.current = next;
    setState(next);
  };

  // Mirrors App.addApp → addService → changeSelection(id, 'add') (App wiring is checked statically).
  async function addApp(id) {
    window.__pvSeq.push({ kind: 'onAddApp', id });
    if (ref.current.selectedIds.includes(id)) return { status: 'already_added' };
    if (window.__pvCtl.addFail) return { status: 'failed', message: SELECTION_PERSIST_FAILED_MESSAGE };
    setPending((p) => new Set(p).add(id));
    try {
      const next = addToSelection(ref.current, id);
      window.__pvSeq.push({ kind: 'write', state: clone(next) });
      await persistVault(next);
      ref.current = next;
      setState(next);
      return { status: 'added' };
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }
  async function addCustom(definition) {
    window.__pvSeq.push({ kind: 'onAddCustom', definition: clone(definition) });
    if (window.__pvCtl.customThrow) throw new Error('registry offline');
    return clone(window.__pvCtl.customResult);
  }
  async function updateCustom(definition) {
    window.__pvSeq.push({ kind: 'onUpdateCustom', definition: clone(definition) });
    setServices((list) => list.map((s) => (s.id === definition.id ? { ...s, name: definition.displayName } : s)));
  }
  function openSiteEdit(serviceId) {
    window.__pvSeq.push({ kind: 'openSiteEdit', id: serviceId });
    if (!customIds.has(serviceId)) return;
    setSiteEditId(serviceId);
  }
  const selected = services.filter((s) => state.selectedIds.includes(s.id));
  const siteEditService = siteEditId ? services.find((s) => s.id === siteEditId) : null;
  return (
    <>
      <Dashboard
        services={selected}
        credentialsByProfileId={state.credentials}
        accessProfiles={state.accessProfiles}
        resolveProfile={() => ({ kind: 'unavailable' })}
        showMagicMomentHint={false}
        onDismissMagicMomentHint={() => {}}
        onAddMore={() => {}}
        customServiceIds={customIds}
        onOpenProfileManagement={(req) => window.__pvSeq.push({ kind: 'openProfile', req })}
        onOpenCatalog={() => setCatalogOpen(true)}
        onEditSiteDetails={(service) => openSiteEdit(service.id)}
        onRemoveApp={(service) => window.__pvSeq.push({ kind: 'removeApp', id: service.id })}
      />
      {catalogOpen ? (
        <AppCatalogModal
          services={services}
          categories={userFacingCategories()}
          selectedIds={new Set(state.selectedIds)}
          pendingIds={pending}
          catalogError={catalogError}
          onRetryCatalog={() => { window.__pvSeq.push({ kind: 'retryCatalog' }); setCatalogError(null); }}
          onAddApp={addApp}
          onAddCustom={addCustom}
          onClose={() => setCatalogOpen(false)}
        />
      ) : null}
      {siteEditService ? (
        <EditSiteDetailsModal
          service={siteEditService}
          definition={undefined}
          categories={userFacingCategories()}
          onSave={updateCustom}
          onClose={() => setSiteEditId(null)}
        />
      ) : null}
    </>
  );
}

window.__pv = {};
(async () => {
  try {
    await unlockVault(FIX.password, FIX.userId);
    await persistVault(FIX.state, { skipCloudSync: true });
    window.__pvSeq.length = 0;
    createRoot(document.getElementById('root')).render(<Harness initial={clone(FIX.state)} />);
    window.__pvReady = true;
  } catch (e) {
    window.__pvBootError = String((e && e.stack) || e);
  }
})();
`;

const INDEX_HTML = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="harness.css"></head><body><div id="root"></div><script src="harness.js"></script></body></html>';

async function bundleHarness(dir, overrides) {
  const used = new Set();
  const browserOverrides = Object.fromEntries(Object.entries(overrides).filter(([rel]) => BROWSER_BUNDLED(rel)));
  await build({
    ...COMMON_BUILD,
    stdin: { contents: HARNESS_ENTRY, resolveDir: root, loader: 'tsx', sourcefile: 'harness.tsx' },
    outfile: join(dir, 'harness.js'),
    format: 'iife',
    platform: 'browser',
    plugins: [seamsPlugin(browserOverrides, used)],
  });
  assert(used.size === Object.keys(browserOverrides).length, `fixture: every browser override loaded (${used.size}/${Object.keys(browserOverrides).length})`);
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

// H-1: every browser group / mutation run is bounded; pages a group opened are closed in its
// `finally` even when a check throws or times out.
const GROUP_TIMEOUT_MS = 90_000;
const MUTATION_TIMEOUT_MS = 240_000;
const openContexts = new Set();
let reclaimedContexts = 0;
async function closeOpenContexts() {
  const contexts = [...openContexts];
  openContexts.clear();
  reclaimedContexts += contexts.length;
  await Promise.allSettled(contexts.map((c) => withTimeout(() => c.close(), 10_000, checkTimeoutMessage('browser context close'))));
}

let browser = null;
async function openPage(url) {
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
  await page.waitForFunction(() => window.__pvReady || window.__pvBootError, null, { timeout: 30000 });
  const bootError = await page.evaluate(() => window.__pvBootError ?? null);
  assert(!bootError, `fixture: harness boot failed: ${bootError}`);
  await page.waitForSelector('[data-service-tile]', { timeout: 10000 });
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
const seq = (s) => s.page.evaluate(() => window.__pvSeq.slice());
const ofKind = async (s, kind) => (await seq(s)).filter((e) => e.kind === kind);
const state = (s) => s.page.evaluate(() => window.__pv.state());
const panel = (s) => s.page.locator('section[data-login-assistance]');
const catalog = (s) => s.page.locator('[data-catalog-modal]');
const item = (s, id) => catalog(s).locator(`[data-catalog-item="${id}"]`);
const itemIds = async (s) => catalog(s).locator('[data-catalog-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-catalog-item')).join(','));
const siteModal = (s) => s.page.locator('.modal-dialog', { hasText: 'עריכת כתובת כניסה' });
async function waitFor(s, fn, arg, message) {
  try {
    await s.page.waitForFunction(fn, arg, { timeout: 5000 });
  } catch {
    throw new Error(message);
  }
}
async function openCatalog(s) {
  await s.page.click('[data-action="open-catalog"]');
  await catalog(s).waitFor({ state: 'visible', timeout: 5000 });
}
async function search(s, text) {
  await catalog(s).locator('input[type="search"]').fill(text);
  await catalog(s).locator('button[aria-label="חיפוש"]').click();
}
async function openTile(s, id) {
  await s.page.click(`[data-service-id="${id}"] button.app-icon`);
  await panel(s).waitFor({ state: 'visible', timeout: 5000 });
}
const tileCount = (s, id) => s.page.locator(`[data-service-id="${id}"]`).count();
const insideCatalog = (s) => s.page.evaluate(() => Boolean(document.activeElement?.closest('[data-catalog-modal]')));

async function checkCatalogModalShell(url) {
  const s = await openPage(url);
  const opener = s.page.locator('[data-action="open-catalog"]');
  assert((await opener.textContent()) === HE.addApp, 'Digital Home shows «+ הוספת אפליקציה»');
  await openCatalog(s);
  assert((await catalog(s).getAttribute('role')) === 'dialog' && (await catalog(s).getAttribute('aria-modal')) === 'true', 'catalog = modal dialog');
  assert((await catalog(s).getAttribute('dir')) === 'rtl', 'catalog is Hebrew RTL');
  assert((await catalog(s).locator('#dh-catalog-title').textContent()) === HE.catalogTitle, 'catalog title');
  assert(await s.page.evaluate(() => document.activeElement?.getAttribute('type') === 'search'), 'focus starts in the catalog search');
  for (let i = 0; i < 40; i += 1) {
    await s.page.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab');
    assert(await insideCatalog(s), `focus trap: Tab #${i + 1} stays inside the catalog`);
  }
  await s.page.keyboard.press('Escape');
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  await waitFor(s, () => document.activeElement?.getAttribute('data-action') === 'open-catalog', null, 'focus returns to «+ הוספת אפליקציה» after Escape');
  await openCatalog(s);
  await catalog(s).locator('button[aria-label="סגירה"]').click();
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  // Superseded by D-123-3 (was: backdrop click closes): the catalog holds the search form.
  await openCatalog(s);
  await s.page.mouse.click(5, 5);
  await s.page.waitForTimeout(200);
  assert((await catalog(s).count()) === 1, 'D-123-3: a backdrop click does not close the catalog (form dialog)');
  await catalog(s).locator('button[aria-label="סגירה"]').click();
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await ofKind(s, 'write')).length === 0, 'open / close the catalog writes nothing');
  await closePage(s);
  return 'browser: «+ הוספת אפליקציה» opens a central RTL modal; focus in search, Tab trapped, Escape / × close, backdrop click keeps it (D-123-3), focus back to the opener; 0 writes';
}

async function checkSearchAndCategories(url) {
  const s = await openPage(url);
  await openCatalog(s);
  // AD-123-19 (was: every fixture service): the catalog lists the services the gate lets through.
  const all = LISTED.join(',');
  assert((await itemIds(s)) === all, `catalog lists every listed service (${await itemIds(s)})`);
  await search(s, 'zzz-לא-קיים');
  assert((await itemIds(s)) === '' && (await catalog(s).locator('.sm-empty').textContent()) === HE.noMatch, 'FR-15: no match → Hebrew empty message');
  await search(s, 'בנק');
  assert((await itemIds(s)) === 'svc-home-bank,svc-bank-alpha,svc-bank-beta', `FR-15: name search (${await itemIds(s)})`);
  await search(s, 'web-shop');
  assert((await itemIds(s)) === 'svc-shop', 'FR-15: domain search');
  await catalog(s).locator('input[type="search"]').fill('');
  assert((await itemIds(s)) === all, 'clearing the search shows all again');
  const chip = catalog(s).locator('[data-category="health"]');
  await chip.click();
  assert((await chip.getAttribute('aria-pressed')) === 'true', 'FR-16: category chip pressed');
  assert((await itemIds(s)) === 'svc-clinic,svc-c-nostored,svc-c-notconf', `FR-16: category filter on the shown services (${await itemIds(s)})`);
  await search(s, 'מרפאה');
  assert((await itemIds(s)) === 'svc-clinic', 'FR-15 + FR-16 combined');
  await catalog(s).locator('.sm-chip', { hasText: 'הכל' }).click();
  assert((await itemIds(s)) === 'svc-clinic', '«הכל» keeps the search, clears the category');
  assert(!(await catalog(s).locator('[data-category]').evaluateAll((els) => els.map((e) => e.getAttribute('data-category')))).includes('practice'), 'no «practice» category chip');
  assert((await ofKind(s, 'write')).length === 0, 'search / filter writes nothing');
  await closePage(s);
  return 'browser: FR-15 search (name / domain / no match in Hebrew), FR-16 category chips (aria-pressed, combined with search, «הכל»); 0 writes';
}

async function checkAddBuiltIn(url) {
  const s = await openPage(url);
  const before = await state(s);
  await openCatalog(s);
  for (const id of FIXTURE.state.selectedIds.filter((x) => LISTED.includes(x))) {
    assert((await item(s, id).getAttribute('data-catalog-state')) === 'added', `FR-17: ${id} (already added) marked`);
    assert((await item(s, id).locator('button', { hasText: HE.alreadyAdded }).isDisabled()) === true, `FR-17: ${id} shows a disabled «✓ כבר בבית הדיגיטלי»`);
    assert((await item(s, id).locator('button', { hasText: HE.add }).count()) === 0, `FR-17: ${id} has no «הוספה»`);
  }
  for (const id of AVAILABLE) assert((await item(s, id).getAttribute('data-catalog-state')) === 'available', `${id} available`);
  await item(s, 'svc-bank-alpha').locator('button', { hasText: HE.add }).click();
  await waitFor(s, () => window.__pv.state().selectedIds.includes('svc-bank-alpha'), null, 'FR-18: add saved');
  await waitFor(s, () => document.querySelector('[data-catalog-item="svc-bank-alpha"]')?.getAttribute('data-catalog-state') === 'added', null, 'FR-17: just-added app marked');
  const after = await state(s);
  assert(JSON.stringify(after.accessProfiles) === JSON.stringify(before.accessProfiles), 'FR-18: catalog add creates 0 profiles');
  assert(JSON.stringify(after.credentials) === JSON.stringify(before.credentials), 'FR-18: catalog add writes no credential');
  assert((await ofKind(s, 'write')).length === 1, 'one add → one persist');
  await s.page.keyboard.press('Escape');
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await tileCount(s, 'svc-bank-alpha')) === 1, 'FR-17: exactly one tile for the added app');
  assert((await s.page.locator('[data-service-id="svc-bank-alpha"] .app-icon-badge').count()) === 0, 'FR-18: added app has no green dot (0 profiles)');
  for (const id of FIXTURE.state.selectedIds) assert((await tileCount(s, id)) === 1, `no duplicate tile for ${id}`);
  // Persist failure → Hebrew error inside the modal, no write, app stays available (N-7).
  await s.page.evaluate(() => {
    window.__pvCtl.addFail = true;
  });
  await openCatalog(s);
  await item(s, 'svc-bank-beta').locator('button', { hasText: HE.add }).click();
  const alert = catalog(s).locator('[role="alert"]');
  await alert.waitFor({ timeout: 5000 });
  assert(/[\u0590-\u05FF]/.test(await alert.textContent()), 'N-7: add failure → Hebrew error in the modal');
  assert((await item(s, 'svc-bank-beta').getAttribute('data-catalog-state')) === 'available', 'N-7: failed add leaves the app available');
  assert((await ofKind(s, 'write')).length === 1, 'N-7: failed add writes nothing');
  await closePage(s);
  return 'browser: FR-17 added apps marked (disabled, no «הוספה»), no duplicate tiles; FR-18 add → 1 persist, 0 profiles, no dot; failure → Hebrew error in the modal, 0 writes';
}

async function fillCustomSite(s, name, host, { category = 'health' } = {}) {
  await catalog(s).locator('[data-action="add-custom-site"]').click();
  const dialog = catalog(s).locator('.modal-dialog', { hasText: 'הוספת אתר חדש' });
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  const inputs = dialog.locator('input[type="text"]');
  await inputs.nth(0).fill(name);
  await inputs.nth(1).fill(`https://${host}/`);
  if (category) await dialog.locator('select[data-field="category"]').selectOption(category);
  await dialog.locator('button[type="submit"]').click();
  return dialog;
}

async function checkCustomAdd(url) {
  const s = await openPage(url);
  await openCatalog(s);
  // created → status message.
  const dialog = await fillCustomSite(s, 'האתר החדש שלי', 'my-new-site.example.test');
  await dialog.waitFor({ state: 'detached', timeout: 5000 });
  assert((await catalog(s).locator('[role="status"]').textContent()) === '«האתר החדש שלי» נוסף לבית הדיגיטלי.', 'FR-19: created → Hebrew confirmation in the modal');
  let calls = await ofKind(s, 'onAddCustom');
  assert(calls.length === 1 && calls[0].definition.displayName === 'האתר החדש שלי' && calls[0].definition.source === 'user-created', 'FR-19: one onAddCustom call with the custom definition');
  // Escape while the add-site layer is open closes only that layer (D-123-3), never the catalog.
  const layer = catalog(s).locator('.modal-dialog', { hasText: 'הוספת אתר חדש' });
  await catalog(s).locator('[data-action="add-custom-site"]').click();
  await layer.waitFor({ state: 'visible', timeout: 5000 });
  await s.page.keyboard.press('Escape');
  await layer.waitFor({ state: 'detached', timeout: 5000 });
  assert((await catalog(s).count()) === 1, 'Escape with the add-site layer open keeps the catalog');
  // already_in_user_home → in-modal Hebrew message.
  await s.page.evaluate(() => {
    window.__pvCtl.customResult = { status: 'already_in_user_home', existingServiceId: 'svc-home-bank', displayName: 'בנק הבית' };
  });
  await fillCustomSite(s, 'בנק הבית', 'home-bank.example.test');
  const offer = catalog(s).locator('.sm-catalog-offer');
  await offer.waitFor({ timeout: 5000 });
  assert((await offer.locator('h2').textContent()) === 'בנק הבית כבר נמצא בבית הדיגיטלי שלך.', 'FR-19: already in home → Hebrew message');
  await offer.locator('button', { hasText: HE.dismiss }).click();
  // same_user_custom_duplicate → same copy.
  await s.page.evaluate(() => {
    window.__pvCtl.customResult = { status: 'same_user_custom_duplicate', existingServiceId: 'svc-c-cred', displayName: 'אתר עם פרטים' };
  });
  await fillCustomSite(s, 'אתר עם פרטים', 'custom-cred.example.test');
  await offer.waitFor({ timeout: 5000 });
  assert((await offer.locator('h2').textContent()) === 'אתר עם פרטים כבר נמצא בבית הדיגיטלי שלך.', 'FR-19: own duplicate → Hebrew message');
  await offer.locator('button', { hasText: HE.dismiss }).click();
  // catalog_service_available → offer; «הוסף לבית הדיגיטלי» adds via onAddApp (0 profiles).
  await s.page.evaluate(() => {
    window.__pvCtl.customResult = { status: 'catalog_service_available', existingServiceId: 'svc-clinic', displayName: 'מרפאה כללית' };
  });
  await fillCustomSite(s, 'מרפאה', 'clinic.example.test');
  await offer.waitFor({ timeout: 5000 });
  assert((await offer.locator('h2').textContent()) === 'מרפאה כללית כבר זמין להוספה' && (await offer.textContent()).includes(HE.availablePrompt), 'FR-19: catalog site available → Hebrew offer');
  const profilesBefore = JSON.stringify((await state(s)).accessProfiles);
  await offer.locator('button', { hasText: HE.addHome }).click();
  await waitFor(s, () => window.__pv.state().selectedIds.includes('svc-clinic'), null, 'offer → added');
  assert(JSON.stringify((await state(s)).accessProfiles) === profilesBefore, 'offer add creates 0 profiles');
  assert((await ofKind(s, 'onAddApp')).at(-1).id === 'svc-clinic', 'offer add goes through onAddApp');
  // Registry error → friendly Hebrew error inside the add-site dialog.
  await s.page.evaluate(() => {
    window.__pvCtl.customThrow = true;
  });
  const failing = await fillCustomSite(s, 'אתר תקול', 'broken.example.test');
  const err = failing.locator('[role="alert"]');
  await err.waitFor({ timeout: 5000 });
  assert(/[\u0590-\u05FF]/.test(await err.textContent()), 'FR-19: registry error → Hebrew error in the modal');
  calls = await ofKind(s, 'onAddCustom');
  assert(calls.length === 5, `FR-19: every custom add delegated once (${calls.length})`);
  assert((await ofKind(s, 'write')).length === 1, 'custom add writes nothing itself (only the offer add persisted)');
  await closePage(s);
  return 'browser: FR-19 custom add → onAddCustom (= addCustomService); created / already-in-home / own duplicate / catalog-available offer / error all shown in Hebrew inside the modal; Escape keeps the catalog under a layer';
}

async function checkCatalogError(url) {
  const s = await openPage(url);
  await s.page.evaluate(() => window.__pv.setCatalogError('registry down'));
  await openCatalog(s);
  const err = catalog(s).locator('.sm-discover-error[role="alert"]');
  await err.waitFor({ timeout: 5000 });
  assert((await err.locator('p').textContent()) === HE.loadFailed, 'catalog load error → Hebrew inline error inside the modal');
  assert((await catalog(s).locator('[data-catalog-item]').count()) === 0, 'no results while the catalog failed');
  await err.locator('button', { hasText: HE.retry }).click();
  await catalog(s).locator('[data-catalog-item]').first().waitFor({ timeout: 5000 });
  assert((await ofKind(s, 'retryCatalog')).length === 1, 'retry inside the modal calls onRetryCatalog once');
  await s.page.evaluate(() => window.__pv.setCatalogError('registry down'));
  await err.waitFor({ timeout: 5000 });
  await s.page.keyboard.press('Escape');
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  await openTile(s, 'svc-home-bank');
  assert((await panel(s).getAttribute('data-launch-kind')) !== null, 'Digital Home stays usable with a catalog error');
  await closePage(s);
  return 'browser: catalog load error → Hebrew inline error + «נסו שוב» inside the modal; retry recovers; Digital Home stays usable';
}

async function checkAppMenuAllKinds(url) {
  const s = await openPage(url);
  for (const [id, kind] of CUSTOM_KINDS) {
    await openTile(s, id);
    assert((await panel(s).getAttribute('data-launch-kind')) === kind, `fixture: ${id} launch kind = ${kind} (got ${await panel(s).getAttribute('data-launch-kind')})`);
    const profileUi = kind === 'credentials' || kind === 'missing-user-credentials';
    assert(((await panel(s).locator('[data-action="add-profile"], [data-action="add-first-profile"]').count()) > 0) === profileUi, `profile UI keeps its gating for ${kind}`);
    const menuBtn = panel(s).locator('[data-app-menu] button[aria-haspopup="menu"]');
    assert((await menuBtn.count()) === 1, `AD-123-17: app-actions menu shown for a custom app with launch kind ${kind}`);
    assert((await menuBtn.getAttribute('aria-label')) === HE.appActions, 'menu button label in Hebrew');
    await menuBtn.click();
    assert((await panel(s).locator('[role="menuitem"][data-action="remove-app"]').count()) === 1, `AD-123-11: «הסרת אפליקציה» in the menu for ${kind}`);
    const entry = panel(s).locator('[role="menuitem"][data-action="edit-site-details"]');
    const userCreated = FIXTURE.services.find((x) => x.id === id).source === 'user-created';
    if (!userCreated) {
      // Superseded by the AD-123-14 123.3 clarification (was: «עריכת פרטי האתר» for every vault
      // custom): a promoted (catalog-runtime) vault-custom id is catalog-origin — no edit entry.
      assert((await entry.count()) === 0, `AD-123-14: no «עריכת פרטי האתר» for a promoted vault-custom app (${kind})`);
      await s.page.keyboard.press('Escape');
      await panel(s).waitFor({ state: 'detached', timeout: 5000 });
      continue;
    }
    assert((await entry.textContent()) === HE.editSite, `AD-123-17: «עריכת פרטי האתר» reachable for ${kind}`);
    await entry.click();
    await panel(s).waitFor({ state: 'detached', timeout: 5000 });
    await siteModal(s).waitFor({ state: 'visible', timeout: 5000 });
    const name = FIXTURE.services.find((x) => x.id === id).name;
    assert((await siteModal(s).locator('input[type="text"]').nth(0).inputValue()) === name, `edit-site prefilled with the site name (${kind})`);
    // AD-123-14 clarification: the save path moved from the promoted not-configured app to a user-created one.
    if (kind === 'missing-user-credentials') {
      await siteModal(s).locator('input[type="text"]').nth(0).fill('אתר מעודכן');
      await siteModal(s).locator('button[type="submit"]').click();
      await siteModal(s).waitFor({ state: 'detached', timeout: 5000 });
      const saves = await ofKind(s, 'onUpdateCustom');
      assert(saves.length === 1 && saves[0].definition.id === id && saves[0].definition.displayName === 'אתר מעודכן', 'AD-123-14: save → onUpdateCustom (= updateCustomService) once, same id');
      assert((await s.page.locator(`[data-service-id="${id}"]`).textContent()).includes('אתר מעודכן'), 'edited name shown on the tile');
    } else {
      await siteModal(s).locator('button', { hasText: 'ביטול' }).click();
      await siteModal(s).waitFor({ state: 'detached', timeout: 5000 });
    }
  }
  await openTile(s, 'svc-home-bank');
  // Superseded by AD-123-11 (was: no app menu for a built-in app): the menu holds «הסרת אפליקציה» only.
  const builtInMenu = panel(s).locator('[data-app-menu] button[aria-haspopup="menu"]');
  assert((await builtInMenu.count()) === 1, 'AD-123-11: app menu shown for a built-in app («הסרת אפליקציה»)');
  await builtInMenu.click();
  assert((await panel(s).locator('[role="menuitem"]').count()) === 1 && (await panel(s).locator('[role="menuitem"][data-action="remove-app"]').count()) === 1, 'AD-123-11: built-in menu = «הסרת אפליקציה» only');
  assert(!(await panel(s).textContent()).includes(HE.editSite), 'AD-123-14: no «עריכת פרטי האתר» for a built-in app');
  assert((await ofKind(s, 'openSiteEdit')).every((e) => FIXTURE.customIds.includes(e.id)), 'edit-site requested only for custom apps');
  assert((await ofKind(s, 'write')).length === 0, 'edit-site writes nothing locally (delegated to updateCustomService)');
  await closePage(s);
  return 'browser: AD-123-17 app menu in all four launch kinds; «עריכת פרטי האתר» for user-created customs only (AD-123-14 clarification: none for promoted / built-in); opens the AddSiteModal edit flow, save → updateCustomService; «הסרת אפליקציה» everywhere (AD-123-11); profile UI gating unchanged';
}

async function checkCatalogFixedHeight(url) {
  const s = await openPage(url);
  await s.page.setViewportSize({ width: 760, height: 560 });
  await openCatalog(s);
  const dialog = s.page.locator('.dh-catalog-dialog');
  const results = dialog.locator('.app-catalog > .sm-add-results');
  const measure = () => dialog.evaluate((el) => ({
    height: Math.round(el.getBoundingClientRect().height),
    viewport: window.innerHeight,
    dialogScrolls: el.scrollHeight > el.clientHeight + 1,
  }));
  const first = await measure();
  assert(first.height <= Math.ceil(first.viewport * 0.92) + 1, `D-123-2: catalog height bounded by the viewport (${first.height} / ${first.viewport})`);
  assert(!first.dialogScrolls, 'D-123-2: the dialog itself does not scroll');
  const grid = await results.evaluate((el) => ({ overflow: getComputedStyle(el).overflowY, scrolls: el.scrollHeight > el.clientHeight + 1, client: el.clientHeight, scroll: el.scrollHeight }));
  assert(grid.overflow === 'auto' && grid.scrolls, `D-123-2: the result grid scrolls inside the dialog (${JSON.stringify(grid)})`);
  const heights = [first.height];
  await search(s, 'zzz-לא-קיים');
  heights.push((await measure()).height);
  await search(s, 'בנק');
  heights.push((await measure()).height);
  await catalog(s).locator('input[type="search"]').fill('');
  await catalog(s).locator('[data-category="health"]').click();
  heights.push((await measure()).height);
  await catalog(s).locator('.sm-chip', { hasText: 'הכל' }).click();
  heights.push((await measure()).height);
  assert(heights.every((h) => h === heights[0]), `D-123-2: catalog size does not change on search / category (${heights.join(', ')})`);
  await closePage(s);
  return `browser: D-123-2 catalog height fixed at ${heights[0]}px (viewport 760×560) across no-match / search / category / «הכל»; only the grid scrolls`;
}

/** Text-selection drag: press inside `from`, release on the backdrop corner. */
async function dragToBackdrop(s, from) {
  const box = await from.boundingBox();
  await s.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await s.page.mouse.down();
  await s.page.mouse.move(40, 40, { steps: 6 });
  await s.page.mouse.move(5, 5, { steps: 3 });
  await s.page.mouse.up();
  await s.page.waitForTimeout(150);
}

async function checkDialogBackdropRule(url) {
  const s = await openPage(url);
  await openCatalog(s);
  // Form dialog (add custom site): drag + click on the backdrop keep it and its values.
  const addSite = catalog(s).locator('.modal-dialog', { hasText: 'הוספת אתר חדש' });
  await catalog(s).locator('[data-action="add-custom-site"]').click();
  await addSite.waitFor({ state: 'visible', timeout: 5000 });
  const nameInput = addSite.locator('input[type="text"]').nth(0);
  const urlInput = addSite.locator('input[type="text"]').nth(1);
  await nameInput.fill('שם לבדיקת גרירה');
  await urlInput.fill('https://drag-check.example.test/');
  await dragToBackdrop(s, nameInput);
  assert(await addSite.isVisible(), 'D-123-3: drag from an input to the backdrop keeps the add-site dialog');
  assert((await nameInput.inputValue()) === 'שם לבדיקת גרירה' && (await urlInput.inputValue()) === 'https://drag-check.example.test/', 'D-123-3: …and its values');
  await s.page.mouse.click(5, 5);
  await s.page.waitForTimeout(150);
  assert(await addSite.isVisible(), 'D-123-3: a backdrop click never closes a form dialog');
  assert((await catalog(s).count()) === 1, 'D-123-3: the catalog under it stays');
  await addSite.locator('button', { hasText: 'ביטול' }).click();
  await addSite.waitFor({ state: 'detached', timeout: 5000 });

  // Catalog (contains the search form): drag from the search input keeps it and the query.
  const searchInput = catalog(s).locator('input[type="search"]');
  await searchInput.fill('בנק');
  await dragToBackdrop(s, searchInput);
  assert((await catalog(s).count()) === 1 && (await searchInput.inputValue()) === 'בנק', 'D-123-3: drag from the catalog search to the backdrop keeps the catalog and the query');
  await searchInput.fill('');

  // Non-form dialog (catalog offer): closes only when press AND release are on the backdrop.
  await s.page.evaluate(() => {
    window.__pvCtl.customResult = { status: 'already_in_user_home', existingServiceId: 'svc-home-bank', displayName: 'בנק הבית' };
  });
  const offer = catalog(s).locator('.sm-catalog-offer');
  await fillCustomSite(s, 'בנק הבית', 'home-bank.example.test');
  await offer.waitFor({ timeout: 5000 });
  await dragToBackdrop(s, offer.locator('h2'));
  assert(await offer.isVisible(), 'D-123-3: press inside the offer + release on the backdrop keeps it');
  await s.page.mouse.click(5, 5);
  await offer.waitFor({ state: 'detached', timeout: 5000 });
  assert((await catalog(s).count()) === 1, 'D-123-3: closing the offer on the backdrop keeps the catalog');
  await fillCustomSite(s, 'בנק הבית', 'home-bank.example.test');
  await offer.waitFor({ timeout: 5000 });
  await s.page.keyboard.press('Escape');
  await offer.waitFor({ state: 'detached', timeout: 5000 });
  assert((await catalog(s).count()) === 1, 'D-123-3: Escape closes the offer only');
  await catalog(s).locator('button[aria-label="סגירה"]').click();
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });

  // Edit-site (the AddSiteModal edit flow) from the app window.
  await openTile(s, 'svc-c-cred');
  await panel(s).locator('[data-app-menu] button[aria-haspopup="menu"]').click();
  await panel(s).locator('[role="menuitem"][data-action="edit-site-details"]').click();
  await siteModal(s).waitFor({ state: 'visible', timeout: 5000 });
  const editName = siteModal(s).locator('input[type="text"]').nth(0);
  await editName.fill('שם בעריכה');
  await dragToBackdrop(s, editName);
  await s.page.mouse.click(5, 5);
  await s.page.waitForTimeout(150);
  assert(await siteModal(s).isVisible() && (await editName.inputValue()) === 'שם בעריכה', 'D-123-3: edit-site keeps its values on drag / backdrop click');
  await s.page.keyboard.press('Escape');
  await siteModal(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await ofKind(s, 'onUpdateCustom')).length === 0 && (await ofKind(s, 'write')).length === 0, 'D-123-3: dismissing writes nothing');
  await closePage(s);
  return 'browser: D-123-3 — add-site / catalog / edit-site (form dialogs) survive drag-from-input and backdrop clicks with their values; the offer (no form) closes only on press + release on the backdrop; Escape / ביטול / × close';
}

async function checkCustomCategoryRequired(url) {
  const s = await openPage(url);
  await openCatalog(s);
  await catalog(s).locator('[data-action="add-custom-site"]').click();
  const dialog = catalog(s).locator('.modal-dialog', { hasText: 'הוספת אתר חדש' });
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  const select = dialog.locator('select[data-field="category"]');
  assert((await select.inputValue()) === '', 'D-123-4: create starts with an empty category');
  assert((await select.locator('option[value=""]').textContent()) === HE.categoryPlaceholder, 'D-123-4: Hebrew placeholder');
  await dialog.locator('input[type="text"]').nth(0).fill('אתר בלי קטגוריה');
  await dialog.locator('input[type="text"]').nth(1).fill('https://no-category.example.test/');
  await dialog.locator('button[type="submit"]').click();
  const err = dialog.locator('[role="alert"]');
  await err.waitFor({ timeout: 5000 });
  assert((await err.textContent()) === HE.categoryRequired, 'D-123-4: submit without a category → Hebrew validation');
  assert((await select.getAttribute('aria-invalid')) === 'true', 'D-123-4: category marked invalid');
  assert((await ofKind(s, 'onAddCustom')).length === 0, 'D-123-4: nothing saved without a category');
  await select.selectOption('banking');
  assert((await err.count()) === 0, 'D-123-4: choosing a category clears the error');
  await dialog.locator('button[type="submit"]').click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 });
  const calls = await ofKind(s, 'onAddCustom');
  assert(calls.length === 1 && calls[0].definition.category === 'banking', 'D-123-4: the chosen category is saved');
  await catalog(s).locator('button[aria-label="סגירה"]').click();
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  // Edit keeps the stored category.
  await openTile(s, 'svc-c-cred');
  await panel(s).locator('[data-app-menu] button[aria-haspopup="menu"]').click();
  await panel(s).locator('[role="menuitem"][data-action="edit-site-details"]').click();
  await siteModal(s).waitFor({ state: 'visible', timeout: 5000 });
  assert((await siteModal(s).locator('select[data-field="category"]').inputValue()) === 'shopping', 'D-123-4: edit shows the stored category');
  await siteModal(s).locator('button[type="submit"]').click();
  await siteModal(s).waitFor({ state: 'detached', timeout: 5000 });
  const saves = await ofKind(s, 'onUpdateCustom');
  assert(saves.length === 1 && saves[0].definition.category === 'shopping', 'D-123-4: edit saves the stored category unchanged');
  await closePage(s);
  return 'browser: D-123-4 — create starts with an empty category (Hebrew placeholder), submit blocked with «יש לבחור קטגוריה», chosen category saved; edit keeps the stored category';
}

async function checkCatalogGateListing(url) {
  const s = await openPage(url);
  await openCatalog(s);
  assert((await itemIds(s)) === LISTED.join(','), `AD-123-19: catalog shows approved / no_stored / own sites + apps already in the home only (${await itemIds(s)})`);
  for (const id of HIDDEN) assert((await item(s, id).count()) === 0, `AD-123-19: ${id} is not listed`);
  assert((await item(s, 'svc-gate-nostored').getAttribute('data-catalog-state')) === 'available', 'AD-123-19: an explicit no_stored_credentials site is listed and addable');
  // AD-123-19 (a): a non-approved site already in the home is shown as already added, no add action.
  for (const id of KEPT_IN_HOME) {
    assert((await item(s, id).getAttribute('data-catalog-state')) === 'added', `AD-123-19 (a): ${id} (not approved, in the home) is shown as already added`);
    assert((await item(s, id).locator('button', { hasText: HE.alreadyAdded }).isDisabled()) === true, `AD-123-19 (a): ${id} shows a disabled «✓ כבר בבית הדיגיטלי»`);
    assert((await item(s, id).locator('button', { hasText: HE.add }).count()) === 0, `AD-123-19 (a): ${id} has no «הוספה»`);
  }
  // AD-123-19 (b): the owner's own not-promoted custom site is listed, under «מותאם אישית».
  assert((await item(s, 'svc-own-new').getAttribute('data-catalog-state')) === 'available', 'AD-123-19 (b): the user\'s own custom site (no mapping) is listed and addable');
  const customChip = catalog(s).locator('[data-category="custom"]');
  assert((await customChip.textContent())?.includes('מותאם אישית'), 'AD-123-19 (b): «מותאם אישית» category chip');
  await customChip.click();
  assert((await itemIds(s)) === 'svc-own-new', `AD-123-19 (b): own custom site under «מותאם אישית» (${await itemIds(s)})`);
  await catalog(s).locator('.sm-chip', { hasText: 'הכל' }).click();
  await search(s, 'promoted-site');
  assert((await itemIds(s)) === '' && (await catalog(s).locator('.sm-empty').textContent()) === HE.noMatch, 'AD-123-19: a promoted-but-unmapped site cannot be found by search');
  await search(s, 'pending-site');
  assert((await itemIds(s)) === '', 'AD-123-19: a site waiting for its mapping cannot be found by search');
  await catalog(s).locator('button[aria-label="סגירה"]').click();
  await catalog(s).waitFor({ state: 'detached', timeout: 5000 });
  for (const id of KEPT_IN_HOME) {
    assert((await tileCount(s, id)) === 1, `AD-123-19: ${id} (hidden from the catalog) keeps its Digital Home tile`);
  }
  assert(JSON.stringify((await state(s)).selectedIds) === JSON.stringify(FIXTURE.state.selectedIds), 'AD-123-19: nothing is removed from the home');
  await openTile(s, 'svc-c-notconf');
  assert(await panel(s).isVisible(), 'AD-123-19: a non-approved app already in the home still opens its window');
  assert((await ofKind(s, 'write')).length === 0, 'the gate writes nothing');
  await closePage(s);
  // AD-123-19 (a): once removed from the home it is no longer listed (catalog open meanwhile).
  const r = await openPage(url);
  await openCatalog(r);
  assert((await item(r, 'svc-c-notconf').count()) === 1, 'fixture: svc-c-notconf shown before the removal');
  await r.page.evaluate(() => window.__pv.removeFromHome('svc-c-notconf'));
  await waitFor(r, () => !document.querySelector('[data-catalog-item="svc-c-notconf"]'), null, 'AD-123-19 (a): a non-approved app removed from the home is no longer listed');
  assert((await item(r, 'svc-c-nostored').getAttribute('data-catalog-state')) === 'added', 'AD-123-19 (a): the other home app is still shown');
  await closePage(r);
  return 'browser: AD-123-19 — catalog lists approved / no_stored_credentials / own sites; waiting-for-mapping and promoted-but-unmapped sites are neither listed nor searchable; (a) non-approved apps in the home are shown as «✓ כבר בבית הדיגיטלי» (no add), keep tiles + windows, and leave the list once removed from the home; (b) the owner\'s own custom site is listed under «מותאם אישית»; 0 writes';
}

// ─── Runner ───────────────────────────────────────────────────────────────────
const PURE_GROUPS = [checkCatalogHelpers, checkAddNoProfile, checkEditSiteMatrix];
const STATIC_GROUPS = [checkCatalogImports, checkAppWiring, checkMenuOutsideProfileGate, checkNoBrowserDialogsNew, checkNoSiteBranchesNew];
const BROWSER_GROUPS = [checkCatalogModalShell, checkSearchAndCategories, checkAddBuiltIn, checkCustomAdd, checkCatalogError, checkAppMenuAllKinds, checkCatalogFixedHeight, checkDialogBackdropRule, checkCustomCategoryRequired, checkCatalogGateListing];

async function runAll(overrides, log) {
  // Static first: a mutation that only a scan can see must not reach the bundler.
  for (const g of STATIC_GROUPS) {
    const what = g(overrides);
    if (log) console.log(`  ✓ ${what}`);
  }
  if (log) console.log(`  ✓ ${checkProtectedUnchanged()}`);
  const mod = await loadPure(overrides);
  for (const g of PURE_GROUPS) {
    const what = g(mod);
    if (log) console.log(`  ✓ ${what}`);
  }
  const dir = makeTempDir('pv-1232-web-');
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

const MUTATIONS = [
  ['M1 catalog add creates a profile (FR-18)', (o) => ({
    'src/serviceManagement/serviceSelection.ts': replaceOnce(read('src/serviceManagement/serviceSelection.ts'),
      '  return { ...state, selectedIds: [...nextIds] };',
      "  return { ...state, selectedIds: [...nextIds], accessProfiles: [...state.accessProfiles, { schemaVersion: 1, id: `auto-${serviceId}`, serviceId, displayName: 'ראשי', createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), isDefault: true }] };", o),
  })],
  ['M2 already-added app not marked (FR-17)', (o) => ({
    'src/digitalHome/catalogModel.ts': replaceOnce(read('src/digitalHome/catalogModel.ts'),
      '  if (selectedIds.has(serviceId)) {\n    return \'added\';\n  }\n', '', o),
  })],
  ['M3 «עריכת פרטי האתר» shown for built-in apps (AD-123-14)', (o) => ({
    'src/digitalHome/appContext.ts': replaceOnce(read('src/digitalHome/appContext.ts'), '      edit_site_details: isCustom,', '      edit_site_details: true,', o),
  })],
  ['M4 app menu gated on the profile UI / launch kind (AD-123-17)', (o) => ({
    'src/loginAssistance/LoginAssistancePanel.tsx': replaceOnce(read('src/loginAssistance/LoginAssistancePanel.tsx'),
      // AD-123-11: the anchor gained «הסרת אפליקציה» (was: `= showEditSiteDetails;`).
      'const showAppMenu = showEditSiteDetails || showRemoveApp;', 'const showAppMenu = profileUi && (showEditSiteDetails || showRemoveApp);', o),
  })],
  ['M5 catalog imports from src/admin (N-8)', (o) => ({
    'src/digitalHome/AppCatalog.tsx': replaceOnce(read('src/digitalHome/AppCatalog.tsx'),
      "import { buildCustomSiteDefinition } from './customSiteForm';",
      "import { buildCustomSiteDefinition } from './customSiteForm';\nimport type { AdminRoute } from '../admin/adminRoutes';", o),
  })],
  ['M6 catalog writes the vault directly (AD-123-4)', (o) => {
    let src = read('src/digitalHome/AppCatalog.tsx');
    src = replaceOnce(src, "import { useServiceLogos } from '../useServiceLogos';", "import { useServiceLogos } from '../useServiceLogos';\nimport { persistVault } from '../vault/vault';", o);
    src = replaceOnce(src, '    const outcome = await onAddApp(serviceId);\n', '    const outcome = await onAddApp(serviceId);\n    await persistVault({} as never).catch(() => undefined);\n', o);
    return { 'src/digitalHome/AppCatalog.tsx': src };
  }],
  ['M7 catalog height follows its content again (D-123-2)', (o) => ({
    'src/App.css': replaceOnce(read('src/App.css'), '  height: min(820px, 92vh);\n  display: flex;', '  max-height: min(820px, 92vh);\n  display: flex;', o),
  })],
  ['M8 add-site dialog treated as a non-form dialog (backdrop click closes, D-123-3)', (o) => ({
    'src/AddSiteModal.tsx': replaceOnce(read('src/AddSiteModal.tsx'),
      'useBackdropDismiss(cancelIfIdle, { containsForm: true })', 'useBackdropDismiss(cancelIfIdle, { containsForm: false })', o),
  })],
  ['M9 non-form dialog closes on release alone (drag ends on the backdrop, D-123-3)', (o) => ({
    'src/digitalHome/dialogDismiss.ts': replaceOnce(read('src/digitalHome/dialogDismiss.ts'),
      'if (!options.disabled && started && event.target === event.currentTarget) {',
      'if (!options.disabled && (started || true) && event.target === event.currentTarget) {', o),
  })],
  ['M10 catalog overlay closes on backdrop mousedown again (D-123-3)', (o) => ({
    'src/digitalHome/AppCatalogModal.tsx': replaceOnce(read('src/digitalHome/AppCatalogModal.tsx'),
      '<div className="dh-catalog-overlay" data-dialog-form="true">',
      '<div className="dh-catalog-overlay" data-dialog-form="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>', o),
  })],
  ['M11 create preselects the first category (D-123-4)', (o) => ({
    'src/AddSiteModal.tsx': replaceOnce(read('src/AddSiteModal.tsx'),
      "    mode === 'edit' ? (initialCategory ?? categoryOptions[0] ?? '') : '',",
      "    initialCategory ?? categoryOptions[0] ?? '',", o),
  })],
  ['M12 edit resets the stored category (D-123-4)', (o) => ({
    'src/AddSiteModal.tsx': replaceOnce(read('src/AddSiteModal.tsx'),
      "    mode === 'edit' ? (initialCategory ?? categoryOptions[0] ?? '') : '',",
      "    mode === 'edit' ? (categoryOptions[0] ?? '') : '',", o),
  })],
  ['M13 custom-site create awaits the catalog reload again (D-123-5)', (o) => ({
    'src/App.tsx': replaceOnce(read('src/App.tsx'),
      '    // the background instead of holding the form on «שומר…».\n    void refreshCatalogAfterCustomSave(timing);',
      '    // the background instead of holding the form on «שומר…».\n    await refreshCatalogAfterCustomSave(timing);', o),
  })],
  ['M14 catalog lists every site again (AD-123-19)', (o) => ({
    'src/digitalHome/AppCatalog.tsx': replaceOnce(read('src/digitalHome/AppCatalog.tsx'),
      '    () => services.filter((service) => isShownInUserCatalog(service, selectedIds.has(service.id))),',
      '    () => services.filter((service) => isShownInUserCatalog(service, true)),', o),
  })],
  ['M15 a promotion publishes without an approved mapping (AD-123-19)', (o) => ({
    'src/catalog/catalogVisibility.ts': replaceOnce(read('src/catalog/catalogVisibility.ts'),
      "  if (credential.status === 'no_stored_credentials') return 'no_stored_credentials';\n",
      "  if (credential.status === 'no_stored_credentials') return 'no_stored_credentials';\n  if ((entry.metadata as Record<string, unknown> | undefined)?.approvalStatus === 'approved') return 'approved';\n", o),
  })],
  ['M16 a non-approved app already in the home is not shown (AD-123-19 (a))', (o) => ({
    'src/digitalHome/AppCatalog.tsx': replaceOnce(read('src/digitalHome/AppCatalog.tsx'),
      '    () => services.filter((service) => isShownInUserCatalog(service, selectedIds.has(service.id))),',
      '    () => services.filter((service) => isShownInUserCatalog(service, false)),', o),
  })],
  ['M17 shown-in-home decided on the home at catalog open (still listed after removal, AD-123-19 (a))', (o) => {
    let src = read('src/digitalHome/AppCatalog.tsx');
    src = replaceOnce(src,
      '  const listed = useMemo(\n    () => services.filter((service) => isShownInUserCatalog(service, selectedIds.has(service.id))),\n    [services, selectedIds],',
      '  const [openedWith] = useState(selectedIds);\n  const listed = useMemo(\n    () => services.filter((service) => isShownInUserCatalog(service, openedWith.has(service.id))),\n    [services, openedWith],', o);
    return { 'src/digitalHome/AppCatalog.tsx': src };
  }],
  ['M18 the owner\'s own custom site gated like a global site (AD-123-19 (b))', (o) => ({
    'src/catalog/catalogVisibility.ts': replaceOnce(read('src/catalog/catalogVisibility.ts'),
      "  if (entry.source === 'user-created') return 'own_site';\n", '', o),
  })],
];

const selectedMutations = selectMutations(MUTATIONS, MUTATION_ARGS, (m) => m[0]);

console.log('Phase 123.2 — Catalog\n');
browser = await chromium.launch({ channel: 'msedge' });
const closeBrowser = () => browser.close();
try {
  await runAll({}, true);
  const groupCount = PURE_GROUPS.length + STATIC_GROUPS.length + 1 + BROWSER_GROUPS.length;
  if (MUTATION_ARGS.mode === 'none') {
    console.log(`\nPASS — Phase 123.2 Catalog: ${groupCount} check groups, mutation sweep skipped (--no-mutations) — ${formatElapsed(Date.now() - STARTED)}`);
  } else {
    console.log(MUTATION_ARGS.mode === 'all' ? '\nMutations (full sweep)' : `\nMutations (selected: ${[...MUTATION_ARGS.ids].join(', ')})`);
    let caughtCount = 0;
    for (const [label, makeOverrides] of selectedMutations) {
      const id = mutationId(label);
      const overrides = makeOverrides(label);
      let caught = null;
      try {
        await withTimeout(() => runAll(overrides, false), MUTATION_TIMEOUT_MS, mutationTimeoutMessage(id, MUTATION_TIMEOUT_MS));
      } catch (e) {
        if (isTimeout(e)) await failRun(`${e.message} (${label})`, closeBrowser);
        caught = e instanceof Error ? e.message.split('\n')[0] : String(e);
      }
      assert(caught, `mutation NOT caught: ${label}`);
      assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
      caughtCount += 1;
      console.log(`  ✓ mutation caught: ${id} ${label.slice(id.length + 1)} — ${caught.slice(0, 160)}`);
    }
    console.log(`  H-1: ${reclaimedContexts} browser context(s) left open by a failing check were closed by the group finally`);
    const scope = MUTATION_ARGS.mode === 'all' ? 'mutations caught' : 'selected mutations caught';
    console.log(`\nPASS — Phase 123.2 Catalog: ${groupCount} check groups, ${caughtCount} ${scope} — ${formatElapsed(Date.now() - STARTED)}`);
  }
} catch (e) {
  await failRun(e instanceof Error ? e.message : String(e), closeBrowser);
}
await withTimeout(closeBrowser, 10_000, 'browser close timed out').catch(() => undefined);
process.exit(0);
