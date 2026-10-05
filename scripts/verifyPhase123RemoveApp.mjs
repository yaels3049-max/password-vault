/**
 * Phase 123.3 — remove app (AD-123-11, AD-123-12, AD-123-14 clarification, PQ-123-1, arch §7).
 *
 * Three layers, each run on the real sources (mutations are applied in memory):
 *  - pure: removeAppFromVault (purity, built-in + custom coverage), addToSelection leftover cleanup
 *    on re-add, the outbox after a removal (arch ruling 3), isUserCustomApp / appContextActions;
 *  - static: App commit order (AD-123-11), step 5 retry, logout / lock / re-add commit rules,
 *    no persisted pending state, N-1 / N-4 / N-5 / N-6 / N-8;
 *  - browser (Edge via Playwright): the REAL App.tsx with the real Dashboard, LoginAssistancePanel,
 *    RemoveAppConfirmDialog, UndoToast, AppCatalogModal and the real reducers / outbox. Stubbed
 *    seams only, all instrumented: cloud (supabase/persistence + the registry row writes), the
 *    vault storage (persistVault → memory + localStorage, no crypto), auth (fixture account, a
 *    login button) and the catalog / category loaders (fixture definitions). The Undo window is
 *    advanced with the Playwright clock. Synthetic fixtures only; no credential value is logged.
 *
 * Usage: node scripts/verifyPhase123RemoveApp.mjs [--no-mutations | --mutations=M1,M2]
 *        No mutation switch = full sweep (END OF ROUND only, test policy T-1).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
/** The Phase 123 base (N-1 / N-2 comparisons, as in the 123.1 / 123.2 verifies). */
const BASE = 'af881f6b';
const MUTATION_ARGS = parseMutationArgs();
const STARTED = Date.now();
const source = (overrides, rel) => overrides[rel] ?? read(rel);

const APP = 'src/App.tsx';
const SELECTION = 'src/serviceManagement/serviceSelection.ts';
const PANEL = 'src/loginAssistance/LoginAssistancePanel.tsx';
const DIALOG = 'src/digitalHome/RemoveAppConfirmDialog.tsx';
const TOAST = 'src/digitalHome/UndoToast.tsx';
const NEW_FILES = [DIALOG, TOAST];

const HE = {
  removeApp: 'הסרת אפליקציה',
  editSite: 'עריכת פרטי האתר',
  appActions: 'פעולות אפליקציה',
  confirmBody: 'כל הפרופילים ופרטי ההתחברות של האפליקציה יימחקו מכל המכשירים שלך.',
  confirmAction: 'הסרה',
  cancel: 'ביטול',
  removeFailed: 'לא הצלחנו להסיר את האתר מהחשבון. בדקו חיבור לרשת ונסו שוב.',
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
const approvedMapping = (host) => ({
  supportState: 'validated',
  configVersion: 1,
  loginEntryUrl: `https://${host}/login`,
  allowedOrigin: `https://${host}`,
  fieldMappings: FIELDS.map((f) => ({ fieldId: f.id, locatorType: 'css', locator: `#${f.id}` })),
  validation: { metadataVersion: 1, validatedBy: 'admin' },
});
const def = (id, displayName, category, host, extra = {}) => ({
  schemaVersion: 1,
  id,
  displayName,
  url: `https://${host}/`,
  category,
  icon: '🔗',
  source: 'built-in-catalog',
  loginFields: FIELDS,
  metadata: { credentialMode: 'credential_fields', autofillProfile: approvedMapping(host) },
  ...extra,
});
const withMode = (d, credentialMode) => ({ ...d, metadata: { credentialMode } });
/** Built-in apps in the four launch kinds (AD-123-17 / AD-123-11 every-launch-kind proof). */
const BUILT_IN_KINDS = [
  ['svc-cred', 'credentials'],
  ['svc-missing', 'missing-user-credentials'],
  ['svc-nostored', 'no-stored-credentials'],
  ['svc-notconf', 'not-configured'],
];
const OWN = { ...def('svc-own', 'האתר שלי', 'custom', 'own-site.example.test'), source: 'user-created', metadata: undefined };
const PROMO_VAULT_COPY = { ...def('svc-promo', 'אתר שקודם', 'health', 'promoted-site.example.test'), source: 'user-created', metadata: undefined };
const FIXTURE = {
  profile: { id: 'user-1233-test', email: 'fixture@example.test', firstName: 'בדיקה', lastName: '' },
  categories: [
    { id: 'banking', display_name: 'בנקים', sort_order: 10 },
    { id: 'health', display_name: 'בריאות', sort_order: 20 },
    { id: 'shopping', display_name: 'קניות', sort_order: 30 },
    { id: 'custom', display_name: 'מותאם אישית', sort_order: 100 },
  ],
  catalog: [
    def('svc-cred', 'בנק עם פרטים', 'banking', 'cred-bank.example.test'),
    def('svc-missing', 'בנק בלי פרטים', 'banking', 'missing-bank.example.test'),
    withMode(def('svc-nostored', 'אתר מידע', 'shopping', 'info.example.test'), 'no_stored_credentials'),
    withMode(def('svc-notconf', 'אתר לא מוגדר', 'shopping', 'notconf.example.test'), 'not_configured'),
    // A vault-custom id whose registry entry is approved: runtime source = catalog (promoted).
    def('svc-promo', 'אתר שקודם', 'health', 'promoted-site.example.test'),
    def('svc-extra', 'חנות נוספת', 'shopping', 'extra-shop.example.test'),
  ],
  vault: {
    selectedIds: ['svc-cred', 'svc-missing', 'svc-nostored', 'svc-notconf', 'svc-own', 'svc-promo'],
    customServices: [OWN, PROMO_VAULT_COPY],
    accessProfiles: [
      prof('p-cred-1', 'svc-cred', 'ראשי', true),
      prof('p-cred-2', 'svc-cred', 'שני'),
      prof('p-missing', 'svc-missing', 'ראשי', true),
      prof('p-own', 'svc-own', 'ראשי', true),
      prof('p-promo', 'svc-promo', 'ראשי', true),
    ],
    credentials: {
      'p-cred-1': { username: 'fixture-user-1', password: 'fixture-pass-1' },
      'p-cred-2': { username: 'fixture-user-2', password: 'fixture-pass-2' },
      'p-own': { username: 'fixture-own', password: 'fixture-own-pass' },
      'p-promo': { username: 'fixture-promo', password: 'fixture-promo-pass' },
    },
    syncOutbox: { serviceIds: [], profileIds: [] },
  },
};
const nameOf = (id) => (FIXTURE.catalog.find((d) => d.id === id) ?? FIXTURE.vault.customServices.find((d) => d.id === id)).displayName;

// ─── Bundling ─────────────────────────────────────────────────────────────────
const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
const exportNames = (rel) => new Set([...read(rel).matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)].map((m) => m[1]));
const LOG = 'function log(kind, fn, args) { (globalThis.__pvSeq ??= []).push({ kind, fn, args }); }';

function persistenceStub() {
  const impl = {
    bumpDualWriteGeneration: '() => { log("cloud", "bumpDualWriteGeneration", []); return ++gen; }',
    getDualWriteGeneration: '() => gen',
    removeUserServiceFromCloud: 'async (id) => { const c = globalThis.__pvCtl; c.removeCalls += 1; log("cloud", "removeUserServiceFromCloud", [id]); await Promise.resolve(); if (c.failRemoveCall === c.removeCalls) throw new Error("cloud remove failed (fixture)"); }',
    hydrateWorkspaceFromCloud: 'async (_u, _k, local) => local',
    fetchCloudSyncBaseline: 'async () => null',
    refreshWorkspaceFromCloud: 'async () => null',
    syncVaultStateToSupabase: 'async () => ({ goneServiceIds: [], goneProfileIds: [], confirmed: { serviceIds: [], profileIds: [] } })',
    syncVaultStateToSupabaseSafe: 'async () => ({ ok: true })',
    setCloudGoneListener: '() => {}',
    setCloudConfirmedListener: '() => {}',
    fetchVaultKdf: 'async () => null',
    ensureVaultKdfSeeded: 'async () => {}',
  };
  const lines = ['let gen = 0;', LOG];
  for (const n of exportNames('src/supabase/persistence.ts')) lines.push(`export const ${n} = ${impl[n] ?? `async (...args) => { log("cloud", ${JSON.stringify(n)}, args); }`};`);
  return lines.join('\n');
}

/** Vault storage without crypto: every write is recorded (ids / keys only, never values). */
const VAULT_STUB = () => `
${LOG}
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
export function shapeOf(state) {
  return {
    selectedIds: [...state.selectedIds],
    profileIds: state.accessProfiles.map((p) => p.id),
    credentialKeys: Object.keys(state.credentials).sort(),
    customIds: state.customServices.map((s) => s.id),
    outbox: state.syncOutbox ? { serviceIds: [...state.syncOutbox.serviceIds], profileIds: [...state.syncOutbox.profileIds] } : null,
  };
}
globalThis.__pvStoredShape = () => { const raw = localStorage.getItem(KEY); return raw ? shapeOf(JSON.parse(raw)) : null; };
export async function unlockVault(_password, userId) {
  unlocked = userId;
  const raw = localStorage.getItem(KEY);
  return JSON.parse(raw ?? JSON.stringify(globalThis.__pvFix.vault));
}
export async function persistVault(state, options = {}) {
  const awaitCloudSync = options.awaitCloudSync === true;
  globalThis.__pvSeq.push({ kind: 'persist', awaitCloudSync, skipCloudSync: options.skipCloudSync === true, state: shapeOf(state) });
  await Promise.resolve();
  if (globalThis.__pvCtl.persistFailCloud && awaitCloudSync) throw new Error('persist + cloud sync failed (fixture)');
  localStorage.setItem(KEY, JSON.stringify(state));
}
export async function vaultExists() { return true; }
`;

const STUBS = {
  'src/supabase/persistence.ts': persistenceStub,
  'src/vault/vault.ts': VAULT_STUB,
  'src/supabase/client.ts': () => 'export function getSupabaseClient() { return null; }\nexport function resetSupabaseClient() {}\nexport function resetSupabaseClientForTests() {}',
  'src/catalog/catalogLoader.ts': () => 'export async function loadBuiltinCatalogDefinitions() { return JSON.parse(JSON.stringify(globalThis.__pvFix.catalog)); }\nexport function getBuiltinCatalogDefinitions() { throw new Error("not used"); }',
  'src/auth/AuthEntryScreen.tsx': () => 'export default function AuthEntryScreen({ onAuthenticated }) { return <button type="button" data-pv-login="true" onClick={() => void onAuthenticated(globalThis.__pvFix.profile, "fixture-master")}>login</button>; }',
  'src/useServiceLogos.ts': () => 'export function useServiceLogos() { return {}; }\nexport default useServiceLogos;',
  'src/logoCache.ts': () => 'export async function getCachedServiceLogo() { return null; }\nexport function preloadServiceLogos() {}\nexport function peekCachedLogo() { return undefined; }\nexport function invalidateServiceLogoCache() {}',
};

/** Real module + these exports replaced (local exports shadow `export *`). */
const PARTIAL = {
  'src/auth/index.ts': () => `${LOG}
export async function countUserServices() { return 1; }
export async function restoreAccountSession() { return null; }
export async function signOutAccount() { log('auth', 'signOutAccount', []); }
export async function requireAuthenticatedUserId() { return globalThis.__pvFix.profile.id; }
export async function tryGetAuthenticatedUserId() { return globalThis.__pvFix.profile.id; }`,
  'src/registry/categoryCatalog.ts': () => 'export async function loadRegistryCategories() { return JSON.parse(JSON.stringify(globalThis.__pvFix.categories)); }',
  'src/supabase/registryPersistence.ts': () => `${LOG}
export async function deleteCustomServiceRegistryRow(id) {
  const c = globalThis.__pvCtl;
  c.deleteCalls += 1;
  log('cloud', 'deleteCustomServiceRegistryRow', [id]);
  await Promise.resolve();
  if (c.deleteFailTimes >= c.deleteCalls) throw new Error('registry delete failed (fixture)');
}
export async function upsertCustomServiceRegistryRow(definition) { log('cloud', 'upsertCustomServiceRegistryRow', [definition.id]); }
export async function ensureKnownBuiltinRegistryRow() {}`,
};

function seamsPlugin(overrides, used) {
  const stubs = new Map(Object.entries(STUBS).map(([rel, fn]) => [abs(rel), fn]));
  const partial = new Map(Object.entries(PARTIAL).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const loaderOf = (key) => (key.endsWith('.css') ? 'css' : key.endsWith('.tsx') ? 'tsx' : 'ts');
  return {
    name: 'phase1233-seams',
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

// ─── Layer 1: pure ────────────────────────────────────────────────────────────
const PURE_ENTRY = `
export { removeAppFromVault, addToSelection, removeFromSelection } from './src/serviceManagement/serviceSelection.ts';
export { recordLocalCreations, outboxOf } from './src/vault/syncOutbox.ts';
export { appContextActions, isUserCustomApp } from './src/digitalHome/appContext.ts';
`;

async function loadPure(overrides) {
  const dir = makeTempDir('pv-1233-pure-');
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function checkRemoveAppFromVault(mod) {
  const before = clone(FIXTURE.vault);
  const input = clone(FIXTURE.vault);
  const builtIn = mod.removeAppFromVault(input, 'svc-cred');
  assert(same(input, before), 'AD-123-11: removeAppFromVault does not mutate its input');
  assert(!builtIn.selectedIds.includes('svc-cred'), 'AD-123-11: built-in — the id leaves selectedIds');
  assert(!builtIn.accessProfiles.some((p) => p.serviceId === 'svc-cred'), 'AD-123-11: built-in — all profiles of the app are removed');
  assert(!('p-cred-1' in builtIn.credentials) && !('p-cred-2' in builtIn.credentials), 'AD-123-11: built-in — their credentials are removed');
  assert(same(builtIn.customServices, before.customServices), 'AD-123-11: built-in — customServices unchanged');
  assert(same(builtIn.accessProfiles, before.accessProfiles.filter((p) => p.serviceId !== 'svc-cred')), 'AD-123-11: other apps\' profiles untouched');
  assert(same(Object.keys(builtIn.credentials).sort(), ['p-own', 'p-promo']), 'AD-123-11: other apps\' credentials untouched');
  assert(same(builtIn.selectedIds, before.selectedIds.filter((id) => id !== 'svc-cred')), 'AD-123-11: other selections untouched (order kept)');

  const custom = mod.removeAppFromVault(clone(FIXTURE.vault), 'svc-own');
  assert(!custom.selectedIds.includes('svc-own') && !custom.customServices.some((s) => s.id === 'svc-own'), 'AD-123-11: custom — selection and the customServices entry removed');
  assert(!custom.accessProfiles.some((p) => p.serviceId === 'svc-own') && !('p-own' in custom.credentials), 'AD-123-11: custom — profiles and credentials removed');
  assert(custom.customServices.some((s) => s.id === 'svc-promo'), 'AD-123-11: another custom entry kept');
  const noProfiles = mod.removeAppFromVault(clone(FIXTURE.vault), 'svc-nostored');
  assert(!noProfiles.selectedIds.includes('svc-nostored') && noProfiles.accessProfiles.length === before.accessProfiles.length, 'AD-123-11: an app without profiles — selection removed, profiles untouched');
  const spaced = mod.removeAppFromVault(clone(FIXTURE.vault), ' svc-cred ');
  assert(!spaced.selectedIds.includes('svc-cred') && !('p-cred-1' in spaced.credentials), 'AD-123-11: ids compared trimmed');

  // Arch ruling 3: the removal adds nothing to the outbox and its ids leave it in the same commit.
  const latest = { ...clone(FIXTURE.vault), syncOutbox: { serviceIds: ['svc-cred', 'svc-missing'], profileIds: ['p-cred-2', 'p-missing'] } };
  const next = mod.recordLocalCreations(latest, mod.removeAppFromVault(latest, 'svc-cred'));
  assert(same(mod.outboxOf(next), { serviceIds: ['svc-missing'], profileIds: ['p-missing'] }), `arch ruling 3: the removed app / profiles leave the outbox, nothing is added (${JSON.stringify(mod.outboxOf(next))})`);
  return 'AD-123-11: removeAppFromVault is pure and removes the selection, every profile and credential of the app and (custom) its customServices entry; other apps untouched; arch ruling 3 — the removal adds nothing to the outbox and its ids leave it';
}

function checkLeftoverCleanup(mod) {
  // AC-104-16 leftovers: profiles / credentials of an app that is no longer selected.
  const leftover = { ...clone(FIXTURE.vault), selectedIds: FIXTURE.vault.selectedIds.filter((id) => id !== 'svc-cred') };
  const readded = mod.addToSelection(leftover, 'svc-cred');
  assert(readded.selectedIds.includes('svc-cred'), 'arch §7: re-add selects the app');
  assert(!readded.accessProfiles.some((p) => p.serviceId === 'svc-cred') && !('p-cred-1' in readded.credentials) && !('p-cred-2' in readded.credentials), 'arch §7: re-add drops leftover profiles / credentials of that app (0 profiles)');
  assert(readded.accessProfiles.some((p) => p.id === 'p-missing') && 'p-own' in readded.credentials, 'arch §7: other apps untouched by the cleanup');
  const leftoverCustom = { ...clone(FIXTURE.vault), selectedIds: FIXTURE.vault.selectedIds.filter((id) => id !== 'svc-own') };
  const readdedCustom = mod.addToSelection(leftoverCustom, 'svc-own');
  assert(readdedCustom.customServices.some((s) => s.id === 'svc-own'), 'arch §7: re-add keeps the customServices entry');
  const again = mod.addToSelection(clone(FIXTURE.vault), 'svc-cred');
  assert(same(again.accessProfiles, FIXTURE.vault.accessProfiles) && same(again.credentials, FIXTURE.vault.credentials), 'idempotent: adding an already-selected app keeps its profiles');
  assert(typeof mod.removeFromSelection === 'function', 'Phase 104 pin: removeFromSelection still exported');
  return 'arch §7: addToSelection of an app not selected drops its leftover profiles / credentials (customServices entry kept); already selected → unchanged; no cleanup elsewhere';
}

function checkCustomRule(mod) {
  assert(mod.isUserCustomApp({ source: 'user-created' }, true) === true, 'AD-123-14: user-created + in vault customServices → custom');
  assert(mod.isUserCustomApp({ source: 'built-in-catalog' }, true) === false, 'AD-123-14: promoted (catalog runtime) vault-custom id → catalog-origin');
  assert(mod.isUserCustomApp({ source: 'user-created' }, false) === false, 'AD-123-14: not in vault customServices → not custom');
  const actions = mod.appContextActions({ id: 'x' }, [], false);
  assert(actions.menu.remove_app === true && actions.menu.edit_site_details === false, 'AD-123-11: remove_app always, edit_site_details only for custom');
  return 'AD-123-14 clarification: custom = in vault customServices AND runtime source user-created; menu.remove_app always';
}

// ─── Layer 2: static ──────────────────────────────────────────────────────────
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

function checkCommitOrderStatic(overrides) {
  const app = source(overrides, APP);
  const change = fnBody(app, 'async function changeSelection(');
  assert(change, 'fixture: changeSelection found');
  assert(/const vaultState = vaultStateRef\.current;/.test(change), 'AD-123-11: the commit starts from the latest committed state (timer-safe)');
  assert(/mode === 'add' \? addToSelection\(vaultState, id\) : removeAppFromVault\(vaultState, id\)/.test(change), 'AD-123-11: remove = removeAppFromVault (supersedes AC-104-16)');
  const at = (re, from = 0) => {
    const m = change.slice(from).search(re);
    return m < 0 ? -1 : m + from;
  };
  const bump = at(/bumpDualWriteGeneration\(\);/);
  const remove1 = at(/await removeUserServiceFromCloud\(id\);/, bump);
  const persist = at(/await persistSelectionState\(next, \{\s*awaitCloudSync: mode === 'remove',?\s*\}\);/, remove1);
  const remove2 = at(/await removeUserServiceFromCloud\(id\);/, persist);
  const step5 = at(/await deleteOwnCustomRow\(id\);/, remove2);
  const commit = at(/setVaultState\(next\);/, step5);
  assert(bump >= 0 && remove1 > bump && persist > remove1 && remove2 > persist && step5 > remove2 && commit > step5, `AD-123-11: order bump → cloud remove → persist (awaitCloudSync) → re-verify → own row → commit (${[bump, remove1, persist, remove2, step5, commit].join(',')})`);
  assert(change.slice(0, remove1).split('persistSelectionState(').length === 1 && change.slice(0, remove1).split('persistVault(').length === 1, 'AD-123-11: nothing is written locally before the cloud membership delete');
  assert(/if \(options\?\.deleteOwnRow\) \{\s*await deleteOwnCustomRow\(id\);\s*\}/.test(change), 'AD-123-11: step 5 only when decided for the pending removal');
  const restores = change.split('await restoreLocalAfterFailedRemove(vaultState);').length - 1;
  assert(restores === 2, `AD-123-11: steps 3 / 4 failures restore local (got ${restores})`);
  const step5Fn = fnBody(app, 'async function deleteOwnCustomRow(id: string)');
  assert(step5Fn && /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/.test(step5Fn) && !/throw/.test(step5Fn), 'AD-123-11: step 5 = one retry, never throws (the app stays removed)');
  const restore = fnBody(app, 'async function restoreLocalAfterFailedRemove(previous: VaultState)');
  assert(restore && /persistVault\(previous, \{ skipCloudSync: true \}\)/.test(restore), 'AD-123-11: the restore is a local-only write');
  return 'static: changeSelection(remove) = bump → removeUserServiceFromCloud → persistSelectionState(removeAppFromVault, awaitCloudSync) → re-verify → own row (one retry, no throw) → commit; failures in 3 / 4 restore local (local-only)';
}

function checkPendingStatic(overrides) {
  const app = source(overrides, APP);
  const begin = fnBody(app, 'function beginPendingRemoval(serviceId: string)');
  const undo = fnBody(app, 'function undoPendingRemoval()');
  const request = fnBody(app, 'async function requestRemoveApp(serviceId: string)');
  const commit = fnBody(app, 'function commitPendingRemoval()');
  assert(begin && undo && request && commit, 'fixture: pending-removal functions found');
  const writes = /persistVault|saveVaultState|persistSelectionState|removeUserServiceFromCloud|deleteCustomServiceRegistryRow|localStorage|sessionStorage|indexedDB/;
  assert(!writes.test(begin) && !writes.test(undo) && !writes.test(request), 'AD-123-11 / PQ-123-1: request / begin / undo write nothing (no cloud, no vault, no storage)');
  assert(!/localStorage|sessionStorage|indexedDB/.test(app), 'PQ-123-1: App keeps no pending state in browser storage');
  for (const rel of NEW_FILES) assert(!/localStorage|sessionStorage|indexedDB|persistVault/.test(source(overrides, rel)), `PQ-123-1: ${rel} stores nothing`);
  assert(/interface PendingRemoval \{/.test(app) && /useState<PendingRemoval \| null>\(null\)/.test(app), 'PQ-123-1: the pending removal is React memory only');
  assert(/UNDO_WINDOW_MS = 5000;/.test(source(overrides, TOAST)), 'AD-123-11: 5 s Undo window');
  assert(/window\.setTimeout\(\(\) => \{\s*removalTimerRef\.current = null;\s*void commitPendingRemoval\(\);\s*\}, UNDO_WINDOW_MS\);/.test(begin), 'AD-123-11: the window ends in commitPendingRemoval');
  assert(/await changeSelection\(pending\.serviceId, 'remove', \{\s*deleteOwnRow: pending\.deleteOwnRow,\s*\}\)/.test(commit), 'AD-123-11: commit = changeSelection(remove) under the selection lock');
  assert(/deleteOwnRow: isUserCustomApp\(service, customServiceIds\.has\(serviceId\.trim\(\)\)\)/.test(begin), 'AD-123-14: step 5 decided by the single custom rule');
  const logout = fnBody(app, 'async function handleLogout()');
  assert(logout && logout.indexOf('await commitPendingRemoval();') > 0 && logout.indexOf('await commitPendingRemoval();') < logout.indexOf('clearWorkspaceMemory();'), 'AD-123-12: logout commits the pending removal before clearing the workspace');
  assert(/function handleLockVault\(\) \{\s*void handleLogout\(\);\s*\}/.test(app), 'AD-123-12: lock = the logout path');
  assert(request.indexOf('await commitPendingRemoval();') > 0 && request.indexOf('await commitPendingRemoval();') < request.indexOf('setRemoveRequestId(serviceId);'), 'AD-123-12: a second removal request commits the pending one first');
  const addApp = fnBody(app, 'async function addApp(id: string)');
  assert(addApp && addApp.indexOf('commitPendingRemoval()') > 0 && addApp.indexOf('commitPendingRemoval()') < addApp.indexOf("status: 'already_added'"), 'AD-123-12: re-adding the pending app commits the removal first');
  const custom = fnBody(app, 'async function addCustomService(definition: ServiceDefinition)');
  assert(custom && custom.indexOf('await commitPendingRemovalForUrl(normalizedUrl);') < custom.indexOf('classifyAddCustomService('), 'AD-123-12: a custom add of the pending site commits the removal first');
  const clear = fnBody(app, 'function clearWorkspaceMemory()');
  assert(clear && /clearRemovalTimer\(\);\s*setPending\(null\);/.test(clear), 'PQ-123-1: leaving the workspace drops the pending removal and its timer');
  assert(/async function removeService\(id: string\): Promise<void> \{\s*await requestRemoveApp\(id\);\s*\}/.test(app) && /onRemoveService=\{removeService\}/.test(app), 'AD-123-11: ManageServices «הסר אתר» uses the same confirm + Undo flow');
  assert(/onRemoveApp=\{\(service\) => void requestRemoveApp\(service\.id\)\}/.test(app), 'AD-123-11: Digital Home «הסרת אפליקציה» → requestRemoveApp');
  const open = fnBody(app, 'function openSiteDetailsEdit(serviceId: string)');
  assert(open && /if \(!customServiceIds\.has\(serviceId\)\) \{\s*return;/.test(open) && /isUserCustomApp\(service, true\)/.test(open), 'AD-123-14: edit-site only for user-created vault customs');
  return 'static: request / begin / undo write nothing; pending state in React memory only (no storage, PQ-123-1); 5 s timer → commit; logout / lock / second request / re-add (catalog + custom) commit first; ManageServices + Digital Home share the flow; edit-site = single custom rule';
}

function checkPanelStatic(overrides) {
  const panel = source(overrides, PANEL);
  assert(/const actions = appContextActions\(service, profiles, isUserCustomApp\(service, isCustom\)\);/.test(panel), 'AD-123-14: panel actions use the single custom rule');
  assert(/const showRemoveApp = actions\.menu\.remove_app && Boolean\(onRemoveApp\);/.test(panel), 'AD-123-11: «הסרת אפליקציה» = menu.remove_app');
  assert(/const showAppMenu = showEditSiteDetails \|\| showRemoveApp;/.test(panel), 'AD-123-11: showAppMenu = edit_site_details || remove_app');
  assert(/isCustom &&\s*ownSiteApproved &&/.test(panel), 'D-123-8: the fields-updated notice keeps the vault-custom input');
  return 'static: panel menu = edit (single custom rule) || remove; D-123-8 notice input unchanged';
}

function checkNChecks(overrides) {
  for (const rel of [...NEW_FILES, APP, 'src/Dashboard.tsx', PANEL, 'src/ManageServices.tsx']) {
    source(overrides, rel).split('\n').forEach((line, i) => {
      assert(!/window\.(confirm|alert|prompt)\s*\(|(?<![\w.$])(confirm|alert|prompt)\s*\(/.test(line.replace(/\/\/.*$/, '')), `N-4: browser dialog call in ${rel}:${i + 1}`);
    });
  }
  for (const rel of [...NEW_FILES, SELECTION, 'src/digitalHome/appContext.ts']) {
    const src = source(overrides, rel);
    assert(!/from ['"][./]*admin\//.test(src), `N-8: ${rel} imports nothing from src/admin`);
    assert(!/(service\.id|serviceId)\s*[!=]==?\s*['"`]/.test(src), `N-5: no serviceId literal branch in ${rel}`);
    assert(!/hostname|svc-/.test(src.replace(/\/\/.*$/gm, '')), `N-5: no hostname / fixture branch in ${rel}`);
  }
  const dialog = source(overrides, DIALOG);
  assert(dialog.includes(HE.confirmBody) && dialog.includes(`'${HE.confirmAction}'`) && dialog.includes(`'${HE.cancel}'`), 'N-6: confirm copy is Hebrew (deletion from all devices)');
  assert(/role="alertdialog"/.test(dialog) && /aria-modal="true"/.test(dialog) && /dir="rtl"/.test(dialog), 'AD-123-11: confirm = RTL alertdialog');
  const toast = source(overrides, TOAST);
  assert(/role="status"/.test(toast) && toast.includes(`'${HE.cancel}'`) && /dir="rtl"/.test(toast), 'AD-123-11: Undo toast = RTL status with «ביטול»');
  assert(source(overrides, 'src/loginAssistance/messages.ts').includes(`'${HE.removeApp}'`), 'N-6: «הסרת אפליקציה»');
  const adminChanged = git('diff', '--name-only', BASE, '--', 'src/admin').split('\n').filter(Boolean);
  assert(adminChanged.every((p) => p === 'src/admin/userApproval.ts' || p === 'src/admin/ApprovalQueue.tsx'), `N-1: src/admin changes only the accepted files (${adminChanged.join(', ')})`);
  assert(git('ls-files', '--others', '--exclude-standard', '--', 'src/admin').trim() === '', 'N-1: no new files under src/admin');
  return 'N-1 (src/admin = accepted files only) / N-4 (no browser dialogs) / N-5 (no site / id branches) / N-6 (Hebrew RTL copy) / N-8 (no admin imports)';
}

// ─── Layer 3: browser (real App) ──────────────────────────────────────────────
const HARNESS_ENTRY = `
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/index.css';

globalThis.__pvFix = ${JSON.stringify(FIXTURE)};
globalThis.__pvSeq = [];
globalThis.__pvCtl = { removeCalls: 0, failRemoveCall: 0, persistFailCloud: false, deleteCalls: 0, deleteFailTimes: 0 };
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
  await build({
    ...COMMON_BUILD,
    stdin: { contents: HARNESS_ENTRY, resolveDir: root, loader: 'tsx', sourcefile: 'harness.tsx' },
    outfile: join(dir, 'harness.js'),
    format: 'iife',
    platform: 'browser',
    plugins: [seamsPlugin(overrides, used)],
  });
  assert(used.size === Object.keys(overrides).length, `fixture: every override loaded (${used.size}/${Object.keys(overrides).length})`);
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
async function login(s) {
  await s.page.locator('[data-pv-login]').click();
  await s.page.waitForSelector('[data-service-tile]', { timeout: 15000 });
  await s.page.evaluate(() => { window.__pvSeq.length = 0; });
}
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
  await page.clock.install();
  await page.goto(url);
  await page.waitForFunction(() => window.__pvReady || window.__pvBootError, null, { timeout: 30000, polling: 100 });
  const bootError = await page.evaluate(() => window.__pvBootError ?? null);
  assert(!bootError, `fixture: harness boot failed: ${bootError}`);
  await page.locator('[data-pv-login]').waitFor({ timeout: 15000 });
  await login(s);
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
const ctl = (s, patch) => s.page.evaluate((p) => Object.assign(window.__pvCtl, p), patch);
const stored = (s) => s.page.evaluate(() => window.__pvStoredShape());
/** Writes as short tokens: cloud calls, local persists (with the cloud-sync flag) and sign-out. */
const writeTokens = async (s) => (await seq(s)).map((e) => {
  if (e.kind === 'persist') return e.awaitCloudSync ? 'persist:cloud' : e.skipCloudSync ? 'persist:local' : 'persist';
  if (e.fn === 'bumpDualWriteGeneration') return 'bump';
  if (e.fn === 'removeUserServiceFromCloud') return `remove:${e.args[0]}`;
  if (e.fn === 'deleteCustomServiceRegistryRow') return `deleteRow:${e.args[0]}`;
  if (e.fn === 'signOutAccount') return 'signOut';
  return `${e.kind}:${e.fn}`;
});
const lastPersist = async (s) => (await seq(s)).filter((e) => e.kind === 'persist').at(-1)?.state ?? null;
const panel = (s) => s.page.locator('section[data-login-assistance]');
const dialog = (s) => s.page.locator('[role="alertdialog"]');
const toast = (s) => s.page.locator('[data-undo-toast]');
const tileCount = (s, id) => s.page.locator(`[data-service-id="${id}"]`).count();
async function waitFor(s, fn, arg, message) {
  try {
    await s.page.waitForFunction(fn, arg, { timeout: 8000, polling: 50 });
  } catch {
    throw new Error(message);
  }
}
async function openTile(s, id) {
  await s.page.click(`[data-service-id="${id}"] button.app-icon`);
  await panel(s).waitFor({ state: 'visible', timeout: 5000 });
}
async function menuItems(s, id) {
  await openTile(s, id);
  const btn = panel(s).locator('[data-app-menu] button[aria-haspopup="menu"]');
  if ((await btn.count()) === 0) return null;
  await btn.click();
  return panel(s).locator('[role="menuitem"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-action')));
}
async function requestRemove(s, id) {
  const items = await menuItems(s, id);
  assert(items && items.includes('remove-app'), `AD-123-11: «הסרת אפליקציה» in the menu of ${id}`);
  await panel(s).locator('[role="menuitem"][data-action="remove-app"]').click();
  await dialog(s).waitFor({ state: 'visible', timeout: 5000 });
}
async function confirmRemove(s, id) {
  await requestRemove(s, id);
  await dialog(s).locator('[data-action="confirm-remove-app"]').click();
  await toast(s).waitFor({ state: 'visible', timeout: 5000 });
}
/** Waits until the log holds `count` cloud remove calls for `id` (the commit ran its cloud steps). */
async function waitRemoves(s, id, count, message) {
  await waitFor(s, ([i, n]) => window.__pvSeq.filter((e) => e.fn === 'removeUserServiceFromCloud' && e.args[0] === i).length >= n, [id, count], message);
}
async function settle(s) {
  await s.page.waitForTimeout(150);
}
const COMMIT = (id) => ['bump', `remove:${id}`, 'persist:cloud', `remove:${id}`];

async function checkMenuAllKinds(url) {
  const s = await openPage(url);
  for (const [id, kind] of BUILT_IN_KINDS) {
    const items = await menuItems(s, id);
    assert((await panel(s).getAttribute('data-launch-kind')) === kind, `fixture: ${id} launch kind = ${kind} (got ${await panel(s).getAttribute('data-launch-kind')})`);
    assert(items !== null, `AD-123-11: app menu shown on a built-in app with launch kind ${kind}`);
    assert(same(items, ['remove-app']), `AD-123-11 / AD-123-14: built-in (${kind}) menu = «הסרת אפליקציה» only (got ${items})`);
    assert((await panel(s).locator('[data-action="remove-app"]').textContent()) === HE.removeApp, 'N-6: «הסרת אפליקציה»');
    await s.page.keyboard.press('Escape');
    await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  }
  assert(same(await menuItems(s, 'svc-own'), ['edit-site-details', 'remove-app']), 'AD-123-14: user-created vault custom → «עריכת פרטי האתר» + «הסרת אפליקציה»');
  await s.page.keyboard.press('Escape');
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  assert(same(await menuItems(s, 'svc-promo'), ['remove-app']), 'AD-123-14: promoted vault-custom id (catalog runtime) → no edit entry, «הסרת אפליקציה» only');
  await s.page.keyboard.press('Escape');
  assert((await writeTokens(s)).length === 0, 'opening menus writes nothing');
  await closePage(s);
  return 'browser (real App): «הסרת אפליקציה» on built-in apps in all four launch kinds (credentials / missing / no-stored / not-configured); user-created custom also «עריכת פרטי האתר»; promoted vault-custom id remove only';
}

async function checkDialogAndToast(url) {
  const s = await openPage(url);
  await requestRemove(s, 'svc-cred');
  assert(await panel(s).count() === 0, 'the floating window closes when the confirm opens');
  const d = dialog(s);
  assert((await d.getAttribute('aria-modal')) === 'true' && (await d.getAttribute('dir')) === 'rtl', 'AD-123-11: alertdialog, aria-modal, RTL');
  const title = await s.page.locator(`#${await d.getAttribute('aria-labelledby')}`).textContent();
  const body = await s.page.locator(`#${await d.getAttribute('aria-describedby')}`).textContent();
  assert(title.includes(nameOf('svc-cred')), `AD-123-11: confirm names the app (${title})`);
  assert(body === HE.confirmBody, 'AD-123-11: copy — all profiles and login details deleted from all devices');
  const active = () => s.page.evaluate(() => document.activeElement?.getAttribute('data-action'));
  assert((await active()) === 'cancel-remove-app', 'focus starts on «ביטול» (safe default)');
  await s.page.keyboard.press('Tab');
  assert((await active()) === 'confirm-remove-app', 'Tab moves inside the dialog');
  await s.page.keyboard.press('Tab');
  assert((await active()) === 'cancel-remove-app', 'focus trap: Tab wraps inside the dialog');
  await s.page.keyboard.press('Shift+Tab');
  assert((await active()) === 'confirm-remove-app', 'focus trap: Shift+Tab wraps inside the dialog');
  await s.page.keyboard.press('Escape');
  await d.waitFor({ state: 'detached', timeout: 5000 });
  assert((await tileCount(s, 'svc-cred')) === 1 && (await toast(s).count()) === 0, 'Escape = cancel: tile stays, no Undo window');
  await requestRemove(s, 'svc-cred');
  await d.locator('[data-action="cancel-remove-app"]').click();
  await d.waitFor({ state: 'detached', timeout: 5000 });
  assert((await tileCount(s, 'svc-cred')) === 1, '«ביטול» = cancel');
  assert((await writeTokens(s)).length === 0, 'AD-123-11: confirm / cancel / Escape write nothing');

  const keysBefore = await s.page.evaluate(() => [Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]);
  const storedBefore = await stored(s);
  await confirmRemove(s, 'svc-cred');
  assert((await tileCount(s, 'svc-cred')) === 0, 'AD-123-11: the tile is hidden during the Undo window');
  const t = toast(s);
  assert((await t.getAttribute('role')) === 'status' && (await t.getAttribute('dir')) === 'rtl', 'AD-123-11: Undo toast role="status", RTL');
  assert((await t.locator('[data-undo-seconds]').getAttribute('data-undo-seconds')) === '5', 'AD-123-11: 5 s countdown');
  await s.page.clock.fastForward(2000);
  await waitFor(s, () => document.querySelector('[data-undo-seconds]')?.getAttribute('data-undo-seconds') === '3', null, 'AD-123-11: the countdown runs (3 s left after 2 s)');
  assert((await writeTokens(s)).length === 0, 'AD-123-11: nothing written during the window');
  assert(same(await s.page.evaluate(() => [Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]), keysBefore) && same(await stored(s), storedBefore), 'PQ-123-1: no pending state in browser storage');
  assert((await s.page.evaluate(() => document.activeElement?.getAttribute('data-action'))) === 'undo-remove-app', 'AD-123-11: «ביטול» is focused (keyboard-reachable)');
  assert((await t.locator('button').textContent()) === HE.cancel, 'N-6: «ביטול»');
  await s.page.keyboard.press('Enter');
  await t.waitFor({ state: 'detached', timeout: 5000 });
  assert((await tileCount(s, 'svc-cred')) === 1, 'AD-123-11: Undo brings the tile back');
  await s.page.clock.fastForward(6000);
  await settle(s);
  assert((await writeTokens(s)).length === 0, 'AD-123-11: Undo = zero writes (also after the window)');
  await openTile(s, 'svc-cred');
  assert((await panel(s).locator('.la-profile-chip').count()) === 2, 'Undo keeps the app\'s profiles');
  await closePage(s);
  return 'browser: confirm = RTL alertdialog (labelled + described, Hebrew all-devices copy), focus trap, Escape / «ביטול» cancel; Undo toast role="status", 5 s countdown, «ביטול» keyboard-reachable; window and Undo write nothing, storage untouched';
}

async function checkCommitOrder(url) {
  const s = await openPage(url);
  await confirmRemove(s, 'svc-cred');
  await s.page.clock.fastForward(5000);
  await waitRemoves(s, 'svc-cred', 2, 'AD-123-11: the window commits the removal');
  await settle(s);
  assert(same(await writeTokens(s), COMMIT('svc-cred')), `AD-123-11: built-in commit order (got ${(await writeTokens(s)).join(' → ')})`);
  const persisted = await lastPersist(s);
  assert(!persisted.selectedIds.includes('svc-cred') && !persisted.profileIds.some((id) => id.startsWith('p-cred')) && !persisted.credentialKeys.some((k) => k.startsWith('p-cred')), 'AD-123-11: the persisted vault has no selection / profile / credential of the app');
  assert(same(persisted.customIds, ['svc-own', 'svc-promo']) && persisted.profileIds.includes('p-missing'), 'AD-123-11: other apps untouched');
  assert(!persisted.outbox.serviceIds.includes('svc-cred') && persisted.outbox.profileIds.length === 0, 'arch ruling 3: the removal puts nothing in the outbox');
  assert(same(await stored(s), persisted), 'the stored vault = the committed state');
  assert((await tileCount(s, 'svc-cred')) === 0 && (await toast(s).count()) === 0 && (await s.page.locator('[data-remove-error]').count()) === 0, 'removed: no tile, no toast, no error');

  await s.page.evaluate(() => { window.__pvSeq.length = 0; });
  await confirmRemove(s, 'svc-own');
  await s.page.clock.fastForward(5000);
  await waitFor(s, () => window.__pvSeq.some((e) => e.fn === 'deleteCustomServiceRegistryRow'), null, 'AD-123-11: step 5 for a user-created custom app');
  await settle(s);
  assert(same(await writeTokens(s), [...COMMIT('svc-own'), 'deleteRow:svc-own']), `AD-123-11: custom commit order incl. the own registry row last (got ${(await writeTokens(s)).join(' → ')})`);
  const custom = await lastPersist(s);
  assert(!custom.customIds.includes('svc-own') && !custom.credentialKeys.includes('p-own'), 'AD-123-11: custom — customServices entry and credentials gone');
  assert((await tileCount(s, 'svc-own')) === 0, 'custom app removed');

  await s.page.evaluate(() => { window.__pvSeq.length = 0; });
  await confirmRemove(s, 'svc-promo');
  await s.page.clock.fastForward(5000);
  await waitRemoves(s, 'svc-promo', 2, 'promoted removal commits');
  await settle(s);
  assert(same(await writeTokens(s), COMMIT('svc-promo')), `AD-123-14: promoted vault-custom id → membership only, no registry row delete (got ${(await writeTokens(s)).join(' → ')})`);
  await closePage(s);
  return 'browser: commit after the window = bump → cloud remove → persist (awaitCloudSync) → re-verify (+ own registry row last for user-created customs; never for promoted / built-in); persisted vault without the app / profiles / credentials / custom entry; outbox untouched';
}

async function checkCommitFailures(url) {
  const cases = [
    ['step 2 (cloud remove)', { failRemoveCall: 1 }, ['bump', 'remove:svc-cred']],
    ['step 3 (persist + cloud sync)', { persistFailCloud: true }, ['bump', 'remove:svc-cred', 'persist:cloud', 'persist:local']],
    ['step 4 (re-verify)', { failRemoveCall: 2 }, ['bump', 'remove:svc-cred', 'persist:cloud', 'remove:svc-cred', 'persist:local']],
  ];
  const lines = [];
  for (const [label, patch, expected] of cases) {
    const s = await openPage(url);
    const before = await stored(s);
    await ctl(s, { removeCalls: 0, ...patch });
    await confirmRemove(s, 'svc-cred');
    await s.page.clock.fastForward(5000);
    await s.page.locator('[data-remove-error]').waitFor({ state: 'visible', timeout: 8000 }).catch(() => undefined);
    await settle(s);
    const err = s.page.locator('[data-remove-error][role="alert"]');
    assert((await err.count()) === 1 && (await err.textContent()).includes(HE.removeFailed), `AD-123-11: ${label} failure → Hebrew error (role="alert")`);
    assert((await tileCount(s, 'svc-cred')) === 1, `AD-123-11: ${label} failure → the tile reappears`);
    assert(same(await writeTokens(s), expected), `AD-123-11: ${label} failure stops there (got ${(await writeTokens(s)).join(' → ')})`);
    assert(same(await stored(s), before), `AD-123-11: ${label} failure → local unchanged`);
    await openTile(s, 'svc-cred');
    assert((await panel(s).locator('.la-profile-chip').count()) === 2, `${label}: profiles still there`);
    lines.push(label);
    await closePage(s);
  }
  return `browser: failures in ${lines.join(' / ')} → tile back, Hebrew error, writes stop at the failing step, stored vault unchanged`;
}

async function checkStep5(url) {
  for (const [failTimes, expectedCalls] of [[1, 2], [2, 2]]) {
    const s = await openPage(url);
    await ctl(s, { deleteCalls: 0, deleteFailTimes: failTimes });
    await confirmRemove(s, 'svc-own');
    await s.page.clock.fastForward(5000);
    await waitFor(s, (n) => window.__pvSeq.filter((e) => e.fn === 'deleteCustomServiceRegistryRow').length >= n, expectedCalls, `AD-123-11: step 5 retried once (fail ${failTimes}×)`);
    await settle(s);
    const tokens = await writeTokens(s);
    assert(tokens.filter((t) => t === 'deleteRow:svc-own').length === expectedCalls, `AD-123-11: step 5 = one retry (got ${tokens.join(' → ')})`);
    assert((await tileCount(s, 'svc-own')) === 0 && (await s.page.locator('[data-remove-error]').count()) === 0, `AD-123-11: step 5 failing ${failTimes}× → the app counts as removed, no user error`);
    assert(!(await stored(s)).selectedIds.includes('svc-own'), 'step 5 failure: local removal kept');
    await closePage(s);
  }
  return 'browser: own registry row delete fails once → retried, removed; fails twice → removed anyway (dev warning only), no user error, no revert';
}

async function checkEdgeRules(url) {
  // A second removal request commits the pending one first.
  let s = await openPage(url);
  await confirmRemove(s, 'svc-cred');
  await requestRemove(s, 'svc-missing');
  assert(same(await writeTokens(s), COMMIT('svc-cred')), `AD-123-12: a second removal request commits the pending one before its confirm (got ${(await writeTokens(s)).join(' → ')})`);
  assert((await s.page.locator('#dh-remove-app-title').textContent()).includes(nameOf('svc-missing')), 'AD-123-12: then the confirm for the second app opens');
  await dialog(s).locator('[data-action="cancel-remove-app"]').click();
  assert((await tileCount(s, 'svc-cred')) === 0 && (await tileCount(s, 'svc-missing')) === 1, 'AD-123-12: first removed, second kept after cancel');
  await closePage(s);

  // Logout / lock (one path) commits the pending removal before the workspace is cleared.
  s = await openPage(url);
  await confirmRemove(s, 'svc-cred');
  await s.page.click('.vault-state-badge-lock');
  await s.page.locator('[data-pv-login]').waitFor({ timeout: 8000 });
  const tokens = await writeTokens(s);
  assert(same(tokens.slice(0, 4), COMMIT('svc-cred')) && tokens.indexOf('signOut') > 3, `AD-123-12: lock / logout commits the pending removal before signing out (got ${tokens.join(' → ')})`);
  await login(s);
  assert((await tileCount(s, 'svc-cred')) === 0, 'AD-123-12: the removal stayed after the next login');
  await closePage(s);

  // Re-add from the catalog during the window: commit first, then a fresh add with 0 profiles.
  s = await openPage(url);
  await confirmRemove(s, 'svc-cred');
  await s.page.click('[data-action="open-catalog"]');
  const item = s.page.locator('[data-catalog-modal] [data-catalog-item="svc-cred"]');
  await item.waitFor({ timeout: 5000 });
  assert((await item.getAttribute('data-catalog-state')) !== 'added', 'AD-123-12: while pending, the catalog shows the app as not added');
  await item.locator('button.sm-action--primary').click();
  await waitFor(s, () => window.__pvSeq.filter((e) => e.kind === 'persist').length >= 2, null, 'AD-123-12: re-add commits and then adds');
  await settle(s);
  const readd = await writeTokens(s);
  assert(same(readd, [...COMMIT('svc-cred'), 'persist']), `AD-123-12: commit first, then the add (got ${readd.join(' → ')})`);
  const after = await lastPersist(s);
  assert(after.selectedIds.includes('svc-cred') && !after.profileIds.some((id) => id.startsWith('p-cred')) && !after.credentialKeys.some((k) => k.startsWith('p-cred')), 'AD-123-12: the app is added fresh with 0 profiles / credentials');
  await s.page.keyboard.press('Escape');
  await s.page.locator('[data-catalog-modal]').waitFor({ state: 'detached', timeout: 5000 });
  assert((await tileCount(s, 'svc-cred')) === 1 && (await toast(s).count()) === 0, 'AD-123-12: the tile is back, no Undo window left');
  await closePage(s);

  // PQ-123-1: reload during the window commits nothing.
  s = await openPage(url);
  await confirmRemove(s, 'svc-cred');
  await s.page.reload();
  await s.page.waitForFunction(() => window.__pvReady || window.__pvBootError, null, { timeout: 30000, polling: 100 });
  await s.page.locator('[data-pv-login]').waitFor({ timeout: 15000 });
  await login(s);
  assert((await tileCount(s, 'svc-cred')) === 1 && (await toast(s).count()) === 0, 'PQ-123-1: after a reload the app is still there and no Undo window is restored');
  await openTile(s, 'svc-cred');
  assert((await panel(s).locator('.la-profile-chip').count()) === 2, 'PQ-123-1: profiles intact after a reload in the window');
  assert((await stored(s)).selectedIds.includes('svc-cred'), 'PQ-123-1: nothing committed to the vault');
  await closePage(s);
  return 'browser: AD-123-12 — a second removal request and lock / logout commit the pending removal first; re-add from the catalog during the window commits, then adds fresh (0 profiles); PQ-123-1 — reload in the window commits nothing, no pending state restored';
}

// ─── Runner ───────────────────────────────────────────────────────────────────
const PURE_GROUPS = [checkRemoveAppFromVault, checkLeftoverCleanup, checkCustomRule];
const STATIC_GROUPS = [checkCommitOrderStatic, checkPendingStatic, checkPanelStatic, checkNChecks];
const BROWSER_GROUPS = [checkMenuAllKinds, checkDialogAndToast, checkCommitOrder, checkCommitFailures, checkStep5, checkEdgeRules];

async function runAll(overrides, log) {
  for (const g of STATIC_GROUPS) {
    const what = g(overrides);
    if (log) console.log(`  ✓ ${what}`);
  }
  const mod = await loadPure(overrides);
  for (const g of PURE_GROUPS) {
    const what = g(mod);
    if (log) console.log(`  ✓ ${what}`);
  }
  const dir = makeTempDir('pv-1233-web-');
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

const edit = (rel, from, to) => (o) => ({ [rel]: replaceOnce(read(rel), from, to, o) });
const MUTATIONS = [
  ['M1 step order swapped: local written before the cloud membership delete', edit(APP,
    '        bumpDualWriteGeneration();\n        try {\n          await removeUserServiceFromCloud(id);',
    '        await persistSelectionState(next, { awaitCloudSync: true });\n        bumpDualWriteGeneration();\n        try {\n          await removeUserServiceFromCloud(id);')],
  ['M2 Undo writes', edit(APP,
    '    clearRemovalTimer();\n    setPending(null);\n  }',
    '    clearRemovalTimer();\n    setPending(null);\n    void persistVault(vaultStateRef.current);\n  }')],
  ['M3 a failed commit keeps the tile hidden', edit(APP,
    '        setPending(null);\n        removalCommitRef.current = null;',
    '        if (!pendingRemovalRef.current?.committing) setPending(null);\n        removalCommitRef.current = null;')],
  ['M4 a step-5 failure reverts the user removal', edit(APP,
    '        if (attempt === 2 && import.meta.env.DEV) {',
    '        if (attempt === 2) {\n          throw error;\n        }\n        if (import.meta.env.DEV) {')],
  ['M5 pending removal persisted to storage', edit(APP,
    '    clearRemovalTimer();\n    removalTimerRef.current = window.setTimeout(() => {',
    "    window.sessionStorage.setItem('pv-pending-removal', serviceId);\n    clearRemovalTimer();\n    removalTimerRef.current = window.setTimeout(() => {")],
  ['M6 re-add during the window keeps the old profiles (pending undone instead of committed)', edit(APP,
    "    if (pendingRemovalRef.current?.serviceId === id && (await commitPendingRemoval()) === 'failed') {",
    "    if (pendingRemovalRef.current?.serviceId === id && (undoPendingRemoval(), false)) {")],
  ['M7 removeAppFromVault keeps credentials', edit(SELECTION,
    '    if (!removed.has(key) && key !== target) {',
    '    if (removed.size >= 0) {')],
  ['M8 confirm uses window.confirm', edit(APP,
    '    setRemoveError(null);\n    setRemoveRequestId(serviceId);',
    "    setRemoveError(null);\n    if (window.confirm('להסיר?')) beginPendingRemoval(serviceId);")],
  ['M9 app menu hidden for one launch kind', edit(PANEL,
    'const showAppMenu = showEditSiteDetails || showRemoveApp;',
    "const showAppMenu = (showEditSiteDetails || showRemoveApp) && launchKind !== 'not-configured';")],
  ['M10 edit entry shown for a promoted vault-custom id', edit(PANEL,
    'const actions = appContextActions(service, profiles, isUserCustomApp(service, isCustom));',
    'const actions = appContextActions(service, profiles, isCustom);')],
  ['M11 re-add keeps leftover profiles (arch §7)', edit(SELECTION,
    '    state = removeAppProfiles(state, serviceId);',
    '    state = { ...state };')],
  ['M12 logout clears the workspace without committing the pending removal', edit(APP,
    '    if (pendingRemovalRef.current) {\n      await commitPendingRemoval();\n    }\n    clearWorkspaceMemory();',
    '    clearWorkspaceMemory();')],
  ['M13 a second removal request does not commit the pending one', edit(APP,
    '    if (pending) {\n      await commitPendingRemoval();\n    }',
    '    if (pending) {\n      undoPendingRemoval();\n    }')],
  ['M14 step 5 runs for promoted / built-in apps too', edit(APP,
    '      deleteOwnRow: isUserCustomApp(service, customServiceIds.has(serviceId.trim())),',
    '      deleteOwnRow: true,')],
  ['M15 re-verify (step 4) dropped', edit(APP,
    "        // Final guard: a raced upsert must not leave membership behind.\n        try {\n          await removeUserServiceFromCloud(id);",
    "        // Final guard: a raced upsert must not leave membership behind.\n        try {\n          await Promise.resolve(id);")],
  ['M16 step 5 without the retry', edit(APP,
    '    for (let attempt = 1; attempt <= 2; attempt += 1) {',
    '    for (let attempt = 2; attempt <= 2; attempt += 1) {')],
  ['M17 Escape does not cancel the confirm', edit(DIALOG,
    "      if (event.key === 'Escape') {",
    "      if (event.key === 'Escape-disabled') {")],
  ['M18 Undo toast loses role="status"', edit(TOAST,
    '<div className="dh-undo-toast" role="status" aria-live="polite"',
    '<div className="dh-undo-toast" aria-live="polite"')],
  ['M19 failed step 3 / 4 leaves the local write in place', edit(APP,
    '    try {\n      await persistVault(previous, { skipCloudSync: true });\n    } catch (error) {',
    '    try {\n      void previous;\n    } catch (error) {')],
  ['M20 the tile stays visible during the Undo window', edit(APP,
    '  const hiddenRemovalId = pendingRemoval?.serviceId ?? null;',
    '  const hiddenRemovalId = pendingRemoval?.committing ? pendingRemoval.serviceId : null;')],
];

const selectedMutations = selectMutations(MUTATIONS, MUTATION_ARGS, (m) => m[0]);

console.log('Phase 123.3 — remove app\n');
browser = await chromium.launch({ channel: 'msedge' });
const closeBrowser = () => browser.close();
try {
  await runAll({}, true);
  const groupCount = PURE_GROUPS.length + STATIC_GROUPS.length + BROWSER_GROUPS.length;
  if (MUTATION_ARGS.mode === 'none') {
    console.log(`\nPASS — Phase 123.3 remove app: ${groupCount} check groups, mutation sweep skipped (--no-mutations) — ${formatElapsed(Date.now() - STARTED)}`);
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
      } finally {
        await closeOpenContexts();
      }
      assert(caught, `mutation NOT caught: ${label}`);
      assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
      caughtCount += 1;
      console.log(`  ✓ mutation caught: ${id} ${label.slice(id.length + 1)} — ${caught.slice(0, 160)}`);
    }
    console.log(`  H-1: ${reclaimedContexts} browser context(s) left open by a failing check were closed by the group finally`);
    const scope = MUTATION_ARGS.mode === 'all' ? 'mutations caught' : 'selected mutations caught';
    console.log(`\nPASS — Phase 123.3 remove app: ${groupCount} check groups, ${caughtCount} ${scope} — ${formatElapsed(Date.now() - STARTED)}`);
  }
} catch (e) {
  await failRun(e instanceof Error ? e.message : String(e), closeBrowser);
}
await withTimeout(closeBrowser, 10_000, 'browser close timed out').catch(() => undefined);
process.exit(0);
