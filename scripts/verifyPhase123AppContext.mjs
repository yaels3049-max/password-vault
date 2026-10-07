/**
 * Phase 123.1 — Digital Home app context (AD-123-2, -3, -5, -6, -7, -13).
 *
 * Three layers, each run on the real sources (mutations are applied in memory):
 *  - pure: appContext helpers + profileManagement reducers (Node bundle);
 *  - static: AD-123-5 / AD-123-3 / panel / dot scans, no browser dialogs, N-1 / N-2 (git vs HEAD),
 *    no new write call sites in Digital Home components, no site branches;
 *  - browser (Edge via Playwright): the real Dashboard, LoginAssistancePanel, single profile host
 *    and ServiceProfileManagementModal, with the real vault.ts (IndexedDB + WebCrypto) for
 *    persistVault and lock / unlock. Stubbed seams only: supabase/persistence (cloud, recorded)
 *    and useServiceLogos (no logos). Synthetic fixtures only; no credential value is logged.
 *
 * Fix round: AD-123-18 persistence.ts scope + allowed wiring imports, the reconcile signal closes the
 * window with the Hebrew notice, D-123-3 backdrop rule (static scan of every user dialog overlay +
 * drag-to-backdrop in the profile dialog). Sync behavior itself: verifyPhase123Sync.mjs.
 *
 * Usage: node scripts/verifyPhase123AppContext.mjs [--no-mutations | --mutations=M1,M2]
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
import { revertPhase126PartAManifest, withoutPhase126PartA } from './lib/phase126PartA.mjs';
import { formatElapsed, mutationId, parseMutationArgs, selectMutations } from './lib/mutationArgs.mjs';
import { assertSecureContext, registerHarnessDir, routeHarness } from './lib/routeHarness.mjs';
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
  noProfiles: 'עדיין אין פרופיל לאתר זה.',
  addFirst: 'הוסף פרופיל',
  addProfile: 'הוספת פרופיל',
  editProfile: 'עריכת פרופיל',
  deleteProfile: 'מחיקת פרופיל',
  saveProfile: 'שמירת פרופיל',
  cancel: 'ביטול',
  discard: 'יציאה ללא שמירה',
  cloudFailed: 'לא הצלחנו למחוק את הפרופיל מהחשבון. בדקו חיבור לרשת ונסו שוב.',
  // O-123-16 (G-3): was «האפליקציה או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.».
  removedElsewhere: 'האתר או הפרופיל נמחקו בחלון אחר, ולכן החלון נסגר.',
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
const builtIn = (id, name) => ({
  id,
  name,
  icon: '🔗',
  url: `https://${id}.example.test/`,
  category: 'general',
  source: 'built-in-catalog',
  loginFields: FIELDS,
  metadata: { credentialMode: 'credential_fields' },
});
const FIXTURE = {
  userId: 'user-123-test',
  password: 'fixture-master-password',
  customIds: ['svc-custom'],
  services: [
    builtIn('svc-zero', 'אפליקציה ריקה'),
    builtIn('svc-one', 'אפליקציה אחת'),
    builtIn('svc-two', 'אפליקציה שתיים'),
    builtIn('svc-three', 'אפליקציה שלוש'),
    { id: 'svc-custom', name: 'אתר שלי', icon: '🔗', url: 'https://custom.example.test/', category: 'general', source: 'user-created' },
  ],
  state: {
    selectedIds: ['svc-zero', 'svc-one', 'svc-two', 'svc-three', 'svc-custom'],
    customServices: [],
    accessProfiles: [
      prof('p-one-a', 'svc-one', 'אישי', true),
      prof('p-two-a', 'svc-two', 'אלף'),
      prof('p-two-b', 'svc-two', 'בית', true),
      prof('p-three-g', 'svc-three', 'גימל', true),
      prof('p-three-d', 'svc-three', 'דלת'),
      prof('p-three-h', 'svc-three', 'הא'),
    ],
    credentials: { 'p-two-a': { username: 'fixture-user-a', password: 'fixture-pass-a' } },
  },
};

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
    syncVaultStateToSupabaseSafe:
      'async () => { log("syncVaultStateToSupabaseSafe", []); return { ok: true, result: { goneProfileIds: [], goneServiceIds: [], confirmed: { serviceIds: [], profileIds: [] } } }; }',
    hasGoneRows: '() => false',
    setCloudGoneListener: '() => {}',
    setCloudConfirmedListener: '() => {}',
    fetchCloudWorkspaceIds: 'async () => null',
    fetchCloudSyncBaseline: 'async () => null',
    refreshWorkspaceFromCloud: 'async () => null',
    deleteAccessProfileFromCloud:
      'async (id) => { log("deleteAccessProfileFromCloud", [id]); if (globalThis.__pvCloudFail) throw new Error("offline"); }',
    deleteCloudEncryptedCredentialByLocalProfileId: 'async (id) => { log("deleteCloudEncryptedCredentialByLocalProfileId", [id]); }',
  };
  const lines = [
    'let gen = 0;',
    'function log(fn, args) { (globalThis.__pvSeq ??= []).push({ kind: "cloud", fn, args }); }',
  ];
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
    name: 'phase123-seams',
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

/** Overrides that the browser bundle does not load (e.g. App.tsx) are checked by the static layer. */
const BROWSER_BUNDLED = (rel) => !['src/App.tsx', 'src/ManageServices.tsx'].includes(rel);

// ─── Layer 1: pure ────────────────────────────────────────────────────────────
const PURE_ENTRY = `
export * from './src/digitalHome/appContext.ts';
export { addAccessProfile, deleteAccessProfile, ProfileManagementError } from './src/vault/profileManagement.ts';
export { normalizeExactlyOneDefaultPerService, validateExactlyOneDefaultPerService } from './src/profile/profileValidation.ts';
`;

async function loadPure(overrides) {
  const dir = makeTempDir('pv-123-pure-');
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
const vault = (profiles, credentials = {}) => ({ selectedIds: [], customServices: [], accessProfiles: profiles, credentials });
const forService = (state, id) => state.accessProfiles.filter((p) => p.serviceId === id);
const defaults = (state, id) => forService(state, id).filter((p) => p.isDefault === true);
function throwsProfileError(mod, fn) {
  try {
    fn();
  } catch (e) {
    return e instanceof mod.ProfileManagementError;
  }
  return false;
}

function checkHelpers(mod) {
  const a = prof('a', 's', 'אלף');
  const b = prof('b', 's', 'בית', true);
  const c = prof('c', 's', 'גימל');
  // appHasProfile — 0 / 1 / 2 profiles, with and without credentials (AD-123-6, FR-21/22).
  assert(mod.appHasProfile(vault([]), 's') === false, 'appHasProfile: 0 profiles → false');
  assert(mod.appHasProfile(vault([a]), 's') === true, 'appHasProfile: 1 profile without credentials → true');
  assert(mod.appHasProfile(vault([a, b], { a: { username: 'x' } }), 's') === true, 'appHasProfile: 2 profiles with credentials → true');
  assert(mod.appHasProfile(vault([prof('z', ' s ', 'ז')]), 's') === true, 'appHasProfile: trimmed service id');
  assert(mod.appHasProfile(vault([prof('o', 'other', 'ע')], { o: { username: 'x' } }), 's') === false, 'appHasProfile: other app only → false');
  // initialActiveProfile (AD-123-7).
  assert(mod.initialActiveProfile([]) === null, 'initialActiveProfile: 0 → null');
  assert(mod.initialActiveProfile([a, b, c]) === 'b', 'initialActiveProfile: the default (not the first in order)');
  assert(mod.initialActiveProfile([c, prof('a', 's', 'אלף')]) === 'a', 'initialActiveProfile: legacy no default → first in display order');
  // appContextActions matrix: profiles 0 / 1 / 2 × custom / built-in (AD-123-2).
  for (const [profiles, n] of [[[], 0], [[b], 1], [[a, b], 2]]) {
    for (const isCustom of [true, false]) {
      const x = mod.appContextActions({ id: 's' }, profiles, isCustom);
      const want = { switcher: n >= 2, edit_profile: n >= 1, add_profile: true, empty_state: n === 0, menu: { remove_app: true, edit_site_details: isCustom } };
      assert(JSON.stringify(x) === JSON.stringify(want), `appContextActions(${n} profiles, custom=${isCustom}) = ${JSON.stringify(x)}`);
    }
  }
  // deleteProfilePlan (AD-123-13).
  assert(mod.deleteProfilePlan([a, b, c], 'a') === 'simple', 'deleteProfilePlan: non-default → simple');
  assert(mod.deleteProfilePlan([a, b], 'b') === 'auto_default', 'deleteProfilePlan: default, 1 remaining → auto_default');
  assert(mod.deleteProfilePlan([a, b, c], 'b') === 'choose_default', 'deleteProfilePlan: default, ≥ 2 remaining → choose_default');
  assert(mod.deleteProfilePlan([b], 'b') === 'simple', 'deleteProfilePlan: last profile → simple');
  return 'pure helpers: appHasProfile / initialActiveProfile / appContextActions matrix / deleteProfilePlan (3 outcomes + last)';
}

function checkDeleteReducer(mod) {
  // Last profile allowed → 0 profiles, credential removed (FR-10/11/12).
  const one = vault([prof('only', 's', 'יחיד', true), prof('x', 'other', 'אחר', true)], { only: { username: 'u' }, x: { username: 'v' } });
  const afterLast = mod.deleteAccessProfile(one, 'only');
  assert(forService(afterLast, 's').length === 0, 'delete last profile → 0 profiles');
  assert(!('only' in afterLast.credentials) && afterLast.credentials.x, 'delete last profile → its credential removed, others kept');
  assert(defaults(afterLast, 'other').length === 1, 'other apps untouched');
  // Default with 1 remaining → that one becomes the default.
  const two = vault([prof('a', 's', 'אלף'), prof('b', 's', 'בית', true)]);
  const auto = mod.deleteAccessProfile(two, 'b');
  assert(defaults(auto, 's').map((p) => p.id).join() === 'a', 'delete default with 1 remaining → auto default');
  // Default with ≥ 2 remaining: replacement required and validated (fail-closed, state unchanged).
  const three = vault([prof('a', 's', 'אלף'), prof('b', 's', 'בית', true), prof('c', 's', 'גימל'), prof('o', 'other', 'אחר', true)], { b: { username: 'u' } });
  const snapshot = JSON.stringify(three);
  for (const [label, replacement] of [['no replacement', undefined], ['unknown id', 'nope'], ['other-app id', 'o'], ['the deleted id', 'b']]) {
    assert(throwsProfileError(mod, () => mod.deleteAccessProfile(three, 'b', replacement)), `delete default with ≥ 2 remaining, ${label} → throws ProfileManagementError`);
    assert(JSON.stringify(three) === snapshot, `delete default with ≥ 2 remaining, ${label} → state unchanged`);
  }
  const chosen = mod.deleteAccessProfile(three, 'b', 'c');
  assert(defaults(chosen, 's').map((p) => p.id).join() === 'c', 'delete default with valid replacement → that id is the only default');
  assert(forService(chosen, 's').length === 2 && !('b' in chosen.credentials), 'delete default with valid replacement → target and its credential gone');
  // Non-default delete keeps the default; replacement ignored.
  const nonDefault = mod.deleteAccessProfile(three, 'a', 'c');
  assert(defaults(nonDefault, 's').map((p) => p.id).join() === 'b', 'non-default delete keeps the existing default (replacement ignored)');
  assert(throwsProfileError(mod, () => mod.deleteAccessProfile(three, 'missing')), 'unknown profile → throws');
  return 'deleteAccessProfile: last allowed; default + 1 → auto; default + ≥ 2 → replacement required (missing / unknown / other app / deleted → throws, state unchanged; valid → only default); non-default keeps default';
}

function checkFirstProfileDefault(mod) {
  // MC-2 / FR-04 — the first profile added to a 0-profile app becomes the default.
  const empty = vault([prof('o', 'other', 'אחר', true)]);
  const first = mod.addProfileWithCredential(empty, 's', 'עבודה', null);
  assert(forService(first.state, 's').length === 1, 'add mode: exactly one profile created');
  assert(forService(first.state, 's')[0].isDefault === true, 'FR-04: the first profile of a 0-profile app is the default');
  assert(!(first.profileId in first.state.credentials), 'FR-21: a profile without credentials is valid (no credential written)');
  const withCred = mod.addProfileWithCredential(first.state, 's', 'בית', { username: 'u', password: 'p' });
  assert(forService(withCred.state, 's').length === 2, 'second add: one more profile');
  assert(defaults(withCred.state, 's').map((p) => p.id).join() === first.profileId, 'second add keeps the first as the only default');
  assert(withCred.state.credentials[withCred.profileId]?.username === 'u', 'add with credential: saved for the new profile');
  return 'add mode (MC-2): first profile of a 0-profile app = default; one profile per save; credential optional';
}

function checkValidationAcceptsZero(mod) {
  assert(mod.validateExactlyOneDefaultPerService([]).valid, 'validate: 0 profiles valid');
  assert(mod.validateExactlyOneDefaultPerService([prof('a', 's', 'א', true)]).valid, 'validate: single default valid');
  const single = [prof('a', 's', 'א')];
  assert(mod.normalizeExactlyOneDefaultPerService(single) === single, 'normalize: single profile left as is');
  assert(mod.normalizeExactlyOneDefaultPerService([]).length === 0, 'normalize: 0 profiles');
  return 'validation / normalize accept 0-profile apps and a single default (no validation change needed)';
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
const userSrc = () => srcFiles().filter((rel) => !rel.startsWith('src/admin/'));
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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

function checkNoAutoCreate(overrides) {
  const allowed = new Set(['src/vault/profileManagement.ts', 'src/vault/vaultMigration.ts']);
  const hits = srcFiles().filter((rel) => !allowed.has(rel) && /ensureDefaultProfileForService\s*\(/.test(source(overrides, rel)));
  assert(hits.length === 0, `AD-123-5: ensureDefaultProfileForService( called outside the definition / vaultMigration: ${hits.join(', ')}`);
  assert(/export function ensureDefaultProfileForService\(/.test(source(overrides, 'src/vault/profileManagement.ts')), 'AD-123-5: export kept');
  const host = source(overrides, 'src/loginAssistance/DigitalHomeCredentialModal.tsx');
  assert(!host.includes('Cannot delete the last profile'), 'dead last-profile error mapping removed from the host');
  return 'AD-123-5: no ensureDefaultProfileForService( call in src/ outside profileManagement.ts (definition) / vaultMigration.ts; export kept';
}

function checkSingleHost(overrides) {
  const renders = [];
  for (const rel of userSrc()) {
    const n = (source(overrides, rel).match(/<ServiceProfileManagementModal\b/g) ?? []).length;
    for (let i = 0; i < n; i += 1) renders.push(rel);
  }
  assert(renders.length === 1 && renders[0] === 'src/loginAssistance/DigitalHomeCredentialModal.tsx', `AD-123-3: exactly one <ServiceProfileManagementModal render site outside admin (got ${renders.join(', ') || 'none'})`);
  const hosts = userSrc().flatMap((rel) => (source(overrides, rel).match(/<DigitalHomeCredentialModal\b/g) ?? []).map(() => rel));
  assert(hosts.length === 1 && hosts[0] === 'src/App.tsx', `AD-123-3: one host element, in App.tsx (got ${hosts.join(', ')})`);
  const app = source(overrides, 'src/App.tsx');
  assert(/function openProfileManagement\(request: ProfileManagementRequest\)/.test(app), 'AD-123-3: App openProfileManagement({ serviceId, profileId?, mode })');
  assert(/useState<ProfileManagementRequest \| null>/.test(app), 'AD-123-3: App host state { serviceId, profileId?, mode } | null');
  // Superseded by AD-123-1 / AD-123-9 (Phase 123.4): ManageServices is deleted; Digital Home is the only opener.
  assert(!existsSync(join(root, 'src/ManageServices.tsx')), 'AD-123-1: ManageServices deleted (no second opener)');
  assert(/onOpenProfileManagement\(\{ serviceId: service\.id, profileId, mode: 'edit' \}\)/.test(source(overrides, 'src/Dashboard.tsx')), 'AD-123-3: Digital Home edit routes to the App host');
  return 'AD-123-3: one <ServiceProfileManagementModal render site (the host), one host element in App, Digital Home routed via callback (ManageServices deleted, AD-123-1)';
}

function checkPanelStatic(overrides) {
  const panel = source(overrides, 'src/loginAssistance/LoginAssistancePanel.tsx');
  const chips = panel.match(/const showProfileChips = ([^;]+);/);
  assert(chips, 'panel: showProfileChips definition');
  assert(!/launchKind === 'credentials'|showCredentialUi/.test(chips[1]), `AD-123-2: switcher condition does not depend on credentials (${chips[1].trim()})`);
  assert(/actions\.switcher/.test(chips[1]), 'AD-123-2: switcher = appContextActions(...).switcher');
  assert(!/preselectedProfileId|localStorage|sessionStorage/.test(panel), 'AD-123-7: panel reads no persisted / last-used profile');
  // Superseded by AD-123-11 (was: no remove-app menu entry before 123.3): the entry is
  // appContextActions(...).menu.remove_app; its flow is checked by verifyPhase123RemoveApp.
  assert(/const showRemoveApp = actions\.menu\.remove_app && Boolean\(onRemoveApp\);/.test(panel), 'AD-123-11: «הסרת אפליקציה» = menu.remove_app');
  return 'panel: switcher independent of credentials; no persisted active profile; «הסרת אפליקציה» = menu.remove_app (AD-123-11)';
}

function checkDashboardDot(overrides) {
  const dash = source(overrides, 'src/Dashboard.tsx');
  // O-123-25 (G-3): the tile dot = profile exists AND the existing management state is 'added' (was: appHasProfile(...) only).
  assert(dash.includes(DASH_DOT), 'O-123-25: Dashboard tile input = appHasProfile(...) && deriveServiceManagementState(...) === \'added\'');
  assert(!/hasCompleteCredentials/.test(dash), 'AD-123-6: Dashboard no longer reads hasCompleteCredentials');
  // O-123-35 (G-3): the only Tile.tsx change allowed is the optional `justAdded` highlight (class +
  // data attribute; no count / text).
  const withoutO35 = (src) => src
    .replace("${justAdded ? ' app-icon-wrap--just-added' : ''}", '')
    .split('\n')
    .filter((line) => !/justAdded|O-123-35/.test(line))
    .join('\n');
  assert(withoutO35(source(overrides, 'src/Tile.tsx')) === headSource('src/Tile.tsx'), 'N-6: Tile.tsx markup unchanged (apart from the O-123-35 highlight)');
  return 'O-123-25: tile dot = appHasProfile && management state "added" (no second completeness rule in Dashboard); Tile.tsx unchanged (no count / text)';
}

function checkNoBrowserDialogs(overrides) {
  const hits = [];
  for (const rel of userSrc()) {
    const lines = source(overrides, rel).split('\n');
    lines.forEach((line, i) => {
      if (/window\.(confirm|alert|prompt)\s*\(|(?<![\w.$])(confirm|alert|prompt)\s*\(/.test(line.replace(/\/\/.*$/, ''))) hits.push(`${rel}:${i + 1}`);
    });
  }
  assert(hits.length === 0, `N-4: browser dialog call in user src: ${hits.join(', ')}`);
  return 'N-4: no window.confirm / alert / prompt (or bare calls) in src/ outside admin';
}

function checkProtectedUnchanged() {
  const tracked = git('ls-files').split('\n').filter(Boolean);
  const manifests = tracked.filter((p) => /(^|\/)manifest[^/]*$/.test(p) && !p.startsWith('node_modules/'));
  // AD-123-18 (Owner approved): src/supabase/persistence.ts may change for the sync rule only —
  // checked by checkPersistenceScope instead of byte-identity. Amendment A: crypto.ts / vault.ts
  // gain the outbox payload field only — checked by checkVaultPayloadShapeOnly.
  const protectedPaths = [
    'src/vault/db.ts',
    'src/vault/vaultMigration.ts',
    'src/supabase/registryPersistence.ts',
    'src/execution',
    'extension',
    ...manifests,
  ];
  assert(manifests.length >= 1, 'N-2: at least one tracked manifest file found');
  // Phase 126 Part A (G-3, KI-126-1 ruling): exactly the three Part A extension paths are excluded here;
  // the manifest is pinned below to BASE apart from the Part A lines.
  for (const p of protectedPaths) {
    assert(existsSync(join(root, p)), `N-2: protected path exists (${p})`);
    assert(withoutPhase126PartA(git('diff', '--name-only', BASE, '--', p).split('\n')).length === 0, `N-2: ${p} unchanged vs HEAD`);
    assert(withoutPhase126PartA(git('ls-files', '--others', '--exclude-standard', '--', p).split('\n')).length === 0, `N-2: no new files under ${p}`);
  }
  assert(revertPhase126PartAManifest(readFileSync(join(root, 'extension/manifest.json'), 'utf8')) === git('show', `${BASE}:extension/manifest.json`).replace(/\r\n/g, '\n'), `Phase 126 Part A (G-3): extension/manifest.json identical to ${BASE} apart from the Part A lines (key, default_locale, __MSG_ name / description)`);
  // AD-123-19 (was: src/admin diff empty): src/admin/userApproval.ts becomes a re-export of the
  // shared helper — content checked by verifyPhase123CatalogGate. D-123-6 (N-1 copy exception):
  // ApprovalQueue.tsx success line — content checked by verifyPhase123FixD6D8.
  const adminChanged = git('diff', '--name-only', BASE, '--', 'src/admin').split('\n').filter(Boolean);
  // O-123-23 (G-3, Owner admin exception): AdminGate.tsx need_login branch + the unused admin-gate-home-link CSS —
  // pinned hunk by hunk against e91b5b12 by verifyPhase123OwnerFixes checkAdminLoginScreen.
  const adminAllowed = ['src/admin/userApproval.ts', 'src/admin/ApprovalQueue.tsx', 'src/admin/AdminGate.tsx', 'src/admin/admin.css'];
  // O-123-29…32 (G-3, Owner admin exception): admin shell / RegistryAdmin / fill-test grid — pinned by verifyPhase123OwnerFixes.
  adminAllowed.push('src/admin/AdminApp.tsx', 'src/admin/RegistryAdmin.tsx', 'src/admin/AdminFillTestGrid.tsx');
  assert(adminChanged.every((p) => adminAllowed.includes(p)), `N-1: only the AD-123-19 re-export, the D-123-6 copy line and the O-123-23 admin login change under src/admin (${adminChanged.join(', ')})`);
  assert(git('ls-files', '--others', '--exclude-standard', '--', 'src/admin').trim() === '', 'N-1: no new files under src/admin');
  return `N-1 / N-2: src/admin (apart from the AD-123-19 re-export) and ${protectedPaths.length} protected paths unchanged vs HEAD (${protectedPaths.join(', ')})`;
}

/** Source of a top-level `function name(` up to its closing `}` at column 0. */
function topLevelFunction(src, name) {
  const text = src.replace(/\r\n/g, '\n');
  const start = text.search(new RegExp(`^(export )?(async )?function ${name}\\(`, 'm'));
  if (start < 0) return null;
  const end = text.indexOf('\n}\n', start);
  return end < 0 ? text.slice(start) : text.slice(start, end + 2);
}

/** AD-123-18 — persistence.ts changes are limited to the sync rule; crypto / hydrate / deletes untouched. */
function checkPersistenceScope(overrides) {
  const rel = 'src/supabase/persistence.ts';
  const now = source(overrides, rel);
  const head = headSource(rel);
  // D-123-8 (N-2 exception, Architect 2026-10-05): hydrate may differ from BASE only by the own-site
  // merge block below — content / behaviour checked by verifyPhase123D8OwnSite. KI-5 (123.3 Item 0a):
  // the block's predicate is the shared ownSiteFollowsRegistry (approved + complete).
  const D8_HYDRATE_BLOCK = [
    '        // D-123-8 / KI-5: the vault copy is the last version the owner may see — replaced only by',
    '        // an approved, complete row; a row with no local copy is still added.',
    '        if (customById.has(definition.id) && !ownSiteFollowsRegistry(definition)) {',
    '          continue;',
    '        }',
    '',
  ].join('\n');
  const hydrateNow = topLevelFunction(now, 'hydrateWorkspaceFromCloud') ?? '';
  assert(hydrateNow.split(D8_HYDRATE_BLOCK).length === 2, 'D-123-8: hydrate contains the own-site merge block exactly once');
  assert(hydrateNow.replace(D8_HYDRATE_BLOCK, '') === topLevelFunction(head, 'hydrateWorkspaceFromCloud'), 'D-123-8: hydrateWorkspaceFromCloud unchanged vs HEAD apart from the own-site merge block');
  const untouched = [
    'upsertAccessProfile',
    'upsertUserService',
    'upsertEncryptedCredential',
    'deleteCloudEncryptedCredentialByLocalProfileId',
    'removeUserServiceFromCloud',
    'fetchVaultKdf',
    'ensureVaultKdfSeeded',
    'ensureUserRow',
  ];
  for (const name of untouched) {
    const a = topLevelFunction(now, name);
    assert(a && a === topLevelFunction(head, name), `AD-123-18: ${name} unchanged vs HEAD`);
  }
  const cryptoImport = (s) => (s.match(/import \{[^}]*\} from '\.\.\/vault\/crypto';/) ?? [''])[0];
  assert(cryptoImport(now) === cryptoImport(head) && cryptoImport(now) !== '', 'AD-123-18: crypto imports unchanged');
  const n = (s, re) => (s.match(re) ?? []).length;
  for (const re of [/\.rpc\s*\(/g, /service_role/gi, /alter table|create policy/gi, /\.from\('vault_kdf|\.from\('users'/g]) {
    assert(n(now, re) <= n(head, re), `AD-123-18: no new ${re} usage in persistence.ts`);
  }
  const deleteFn = topLevelFunction(now, 'deleteAccessProfileFromCloud');
  assert(/forgetProfile\(userId, trimmed\);\n\}/.test(deleteFn ?? ''), 'AD-123-18: deleteAccessProfileFromCloud only adds forgetProfile after success');
  return `AD-123-18: persistence.ts — ${untouched.length} functions byte-identical to HEAD (upserts, remove-service, credential delete, KDF); hydrate identical apart from the D-123-8 own-site block; crypto imports unchanged; no RPC / RLS / schema text added`;
}

/**
 * AD-123-18 amendment A, N-2 limit (Manager, Architect-confirmed): crypto.ts / vault.ts may only
 * declare the outbox field, default it to empty on decode, and copy it in the persist mapping.
 * The check: removing exactly these added lines (each once) gives HEAD byte for byte, and no
 * HEAD line is removed — so encryption / decryption, KDF, keys, unlock and persistVault are
 * unchanged.
 */
const PAYLOAD_SHAPE_ALLOWED = {
  'src/vault/crypto.ts': [
    "import { normalizeSyncOutbox, type SyncOutbox } from './syncOutbox';", // declaration (type) + decode default (function)
    '  syncOutbox?: SyncOutbox;', // field declaration (VaultPayload)
    '    syncOutbox: normalizeSyncOutbox(raw.syncOutbox),', // empty default on decode
  ],
  'src/vault/vault.ts': [
    "import type { SyncOutbox } from './syncOutbox';", // declaration (type)
    '  syncOutbox?: SyncOutbox;', // field declaration (VaultState)
    '    syncOutbox: state.syncOutbox,', // persist mapping
  ],
};
function checkVaultPayloadShapeOnly(overrides) {
  const lines = (s) => s.replace(/\r\n/g, '\n').split('\n');
  for (const [rel, allowed] of Object.entries(PAYLOAD_SHAPE_ALLOWED)) {
    const head = headSource(rel);
    assert(head !== '', `fixture: ${rel} exists at HEAD`);
    const rest = lines(source(overrides, rel));
    for (const line of allowed) {
      const at = rest.indexOf(line);
      assert(at >= 0, `amendment A: ${rel} carries the allowed outbox line «${line.trim()}»`);
      rest.splice(at, 1);
    }
    assert(rest.join('\n') === lines(head).join('\n'), `N-2 / amendment A: ${rel} differs from HEAD by more than the outbox field`);
  }
  return 'N-2 / amendment A: crypto.ts and vault.ts = HEAD + exactly 3 outbox lines each (field declaration, empty default on decode, persist mapping); encryption, KDF, keys, unlock, persistVault unchanged';
}

/** D-123-3 — every user dialog overlay: form dialogs have no backdrop handler; others use useBackdropDismiss. */
function checkDialogBackdropRule(overrides) {
  const overlays = [];
  for (const rel of srcFiles().filter((f) => f.endsWith('.tsx') && !f.startsWith('src/admin/'))) {
    const src = source(overrides, rel);
    for (const m of src.matchAll(/<div\s+className="[^"]*\b(modal-overlay|dh-catalog-overlay)\b[^"]*"[^>]*>/g)) {
      const tag = m[0];
      overlays.push(rel);
      assert(!/onClick|onMouseDown|onMouseUp|onPointer/.test(tag), `D-123-3: overlay in ${rel} has its own backdrop handler`);
      const isForm = /data-dialog-form="true"/.test(tag);
      const usesHook = /\{\.\.\.\w*[bB]ackdrop\}/.test(tag);
      assert(isForm || usesHook, `D-123-3: overlay in ${rel} is neither a form dialog nor uses useBackdropDismiss`);
      if (usesHook) {
        const spread = tag.match(/\{\.\.\.(\w+)\}/)[1];
        const decl = src.match(new RegExp(`const ${spread} = useBackdropDismiss\\([^;]*containsForm: (true|false)`));
        assert(decl && (decl[1] === 'true') === isForm, `D-123-3: ${rel} backdrop hook containsForm matches the dialog (${spread})`);
      }
    }
  }
  assert(overlays.length >= 6, `fixture: dialog overlays found (${overlays.length})`);
  return `D-123-3: ${overlays.length} user dialog overlays (${[...new Set(overlays)].map((f) => f.replace(/^src\//, '')).join(', ')}) — no own backdrop handlers; form dialogs never close on the backdrop, others via press + release hook`;
}

const DH_FILES = [
  'src/Dashboard.tsx',
  'src/Tile.tsx',
  'src/loginAssistance/LoginAssistancePanel.tsx',
  'src/loginAssistance/DigitalHomeCredentialModal.tsx',
  'src/loginAssistance/credentialsGate.ts',
  'src/loginAssistance/messages.ts',
  'src/ServiceProfileManagementModal.tsx',
  'src/digitalHome/appContext.ts',
  'src/digitalHome/catalogModel.ts',
  'src/digitalHome/customSiteForm.ts',
  'src/digitalHome/AppCatalog.tsx',
  'src/digitalHome/AppCatalogModal.tsx',
  'src/digitalHome/EditSiteDetailsModal.tsx',
];
const EXTRACTED_FROM_MANAGE = ['src/digitalHome/AppCatalog.tsx', 'src/digitalHome/EditSiteDetailsModal.tsx', 'src/digitalHome/customSiteForm.ts'];
/** AD-123-18 — the only Supabase imports the fix round may add (sync rule wiring). */
const AD_123_18_IMPORTS = {
  // O-123-17 (Phase 123.5): the error code of a cloud profile delete that removed no row.
  'src/loginAssistance/DigitalHomeCredentialModal.tsx': ['bumpDualWriteGeneration', 'PROFILE_DELETE_UNCONFIRMED'],
  'src/App.tsx': [
    'refreshWorkspaceFromCloud',
    'setCloudGoneListener',
    'setCloudConfirmedListener',
    'fetchCloudSyncBaseline',
    'clearSessionSyncScope',
    'resetSessionSyncBaseline',
    'resetSessionSyncBaselineFromCloud',
  ],
};
/**
 * AD-123-18 — added App.tsx persistVault calls, all skipCloudSync: login drop of gone rows,
 * reconcile commit, and (amendment A) the outbox clear after a confirmed insert.
 */
const AD_123_18_APP_PERSIST_CALLS = 3;
/** AD-123-11 — remove-app step 3 / 4 failure restores the previous vault (local-only, skipCloudSync). */
const AD_123_11_APP_PERSIST_CALLS = 1;
function supabaseImports(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][./]+supabase\/[^'"]+['"]/g)) {
    for (const n of m[1].split(',').map((s) => s.trim().replace(/^type\s+/, '')).filter(Boolean)) names.add(n);
  }
  return names;
}
function checkNoNewWriteSites(overrides) {
  for (const rel of DH_FILES) {
    const src = source(overrides, rel);
    assert(!/indexedDB|putVault\s*\(|persistVault\s*\(|getSupabase|supabase\.from|\.rpc\s*\(/.test(src), `N-3: no direct IndexedDB / Supabase / persistVault call in ${rel}`);
    // AD-123-8: catalog / edit-site code extracted from ManageServices keeps its HEAD import set as the baseline.
    const head = supabaseImports(headSource(rel) || (EXTRACTED_FROM_MANAGE.includes(rel) ? headSource('src/ManageServices.tsx') : ''));
    const allowed = new Set(AD_123_18_IMPORTS[rel] ?? []);
    const added = [...supabaseImports(src)].filter((n) => !head.has(n) && !allowed.has(n));
    assert(added.length === 0, `N-3: new Supabase import(s) in ${rel}: ${added.join(', ')}`);
  }
  const app = source(overrides, 'src/App.tsx');
  const count = (s) => (s.match(/persistVault\s*\(/g) ?? []).length;
  assert(
    count(app) <= count(headSource('src/App.tsx')) + AD_123_18_APP_PERSIST_CALLS + AD_123_11_APP_PERSIST_CALLS,
    'N-3: no new persistVault call site in App.tsx beyond the AD-123-18 reconcile commits and the AD-123-11 local restore',
  );
  const cloudWriting = (s) => (s.match(/persistVault\s*\((?![^)]*skipCloudSync: true)/g) ?? []).length;
  assert(
    cloudWriting(app) <= cloudWriting(headSource('src/App.tsx')),
    'AD-123-18: every added App.tsx persistVault call is local-only (skipCloudSync: true)',
  );
  const appHead = supabaseImports(headSource('src/App.tsx'));
  const appAllowed = new Set(AD_123_18_IMPORTS['src/App.tsx']);
  assert([...supabaseImports(app)].every((n) => appHead.has(n) || appAllowed.has(n)), 'N-3: no new Supabase import in App.tsx beyond AD-123-18');
  for (const rel of [...DH_FILES, 'src/App.tsx']) {
    assert(!/from\s+['"][./]+admin\//.test(source(overrides, rel)) || rel === 'src/App.tsx', `N-8: ${rel} imports nothing from src/admin`);
  }
  return 'N-3: no new IndexedDB / Supabase / persistVault call sites in Digital Home components (imports ⊆ HEAD); N-8: no src/admin imports';
}

function checkNoSiteBranches(overrides) {
  for (const rel of DH_FILES) {
    const src = source(overrides, rel);
    assert(!/(service\.id|serviceId)\s*[!=]==?\s*['"`]/.test(src), `N-5: no serviceId literal branch in ${rel}`);
    assert(!/hostname|svc-(zero|one|two|three|custom)/.test(src.replace(/\/\/.*$/gm, '')), `N-5: no hostname / fixture branch in ${rel}`);
  }
  const messages = source(overrides, 'src/loginAssistance/messages.ts');
  for (const label of [HE.noProfiles, HE.addFirst, HE.addProfile, HE.editProfile]) {
    assert(messages.includes(`'${label}'`), `N-6: Hebrew copy present (${label})`);
  }
  return 'N-5: no site / hostname / serviceId / fixture branches; N-6: new copy is Hebrew';
}

// ─── Layer 3: browser ─────────────────────────────────────────────────────────
const HARNESS_ENTRY = `
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './src/Dashboard';
import DigitalHomeCredentialModal from './src/loginAssistance/DigitalHomeCredentialModal';
import { offersCredentialManagementPanel } from './src/service/credentialSchema';
import { lockVault, persistVault, unlockVault } from './src/vault/vault';
import './src/index.css';
import './src/App.css';

const FIX = ${JSON.stringify(FIXTURE)};
const clone = (v) => JSON.parse(JSON.stringify(v));
const services = FIX.services;
const customIds = new Set(FIX.customIds);
window.__pvSeq = [];

function Harness({ initial }) {
  const [state, setState] = useState(initial);
  const [request, setRequest] = useState(null);
  const [reconcile, setReconcile] = useState(null);
  const ref = useRef(state);
  ref.current = state;
  window.__pv.state = () => clone(ref.current);
  window.__pv.setLocal = (next) => { ref.current = next; setState(next); };
  // Mirrors App.closeSurfacesAfterReconcile: cloud-dropped rows → state + reconcile signal.
  window.__pv.reconcile = (next, affected, closedOtherSurface) => {
    ref.current = next;
    setState(next);
    setReconcile((prev) => ({ seq: (prev?.seq ?? 0) + 1, affectedServiceIds: affected, closedOtherSurface }));
  };
  async function onVaultStateChange(next) {
    window.__pvSeq.push({ kind: 'write', state: clone(next) });
    ref.current = next;
    setState(next);
    await persistVault(next);
  }
  function openProfileManagement(req) {
    const service = services.find((s) => s.id === req.serviceId);
    if (!service || !offersCredentialManagementPanel(service)) return;
    setRequest(req);
  }
  const selected = services.filter((s) => state.selectedIds.includes(s.id));
  const hostService = request ? services.find((s) => s.id === request.serviceId) : null;
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
        onOpenProfileManagement={openProfileManagement}
        cloudReconcile={reconcile}
      />
      {request && hostService ? (
        <DigitalHomeCredentialModal
          service={hostService}
          request={{ profileId: request.profileId, mode: request.mode }}
          vaultState={state}
          onVaultStateChange={onVaultStateChange}
          onClose={() => setRequest(null)}
        />
      ) : null}
    </>
  );
}

window.__pv = {
  async lockUnlock() {
    lockVault();
    return clone(await unlockVault(FIX.password, FIX.userId));
  },
};
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
    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      registerHarnessDir(url, dir);
      resolve({ url, close: () => closeServer(server) });
    });
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
  await routeHarness(context, url);
  const page = await context.newPage();
  const s = { page, context, errors: [], native: [] };
  page.on('pageerror', (e) => s.errors.push(String(e)));
  page.on('dialog', async (d) => {
    s.native.push(d.type());
    await d.dismiss();
  });
  await page.goto(url);
  await assertSecureContext(page);
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
const writes = async (s) => (await seq(s)).filter((e) => e.kind === 'write');
const state = (s) => s.page.evaluate(() => window.__pv.state());
const panel = (s) => s.page.locator('section[data-login-assistance]');
const modal = (s) => s.page.locator('.cd-dialog');
async function openTile(s, id) {
  await s.page.click(`[data-service-id="${id}"] button.app-icon`);
  await panel(s).waitFor({ state: 'visible', timeout: 5000 });
}
async function closePanel(s) {
  await s.page.keyboard.press('Escape');
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
}
async function activeChip(s) {
  return (await s.page.locator('.la-profile-chip[aria-selected="true"]').allTextContents()).join('|');
}
const modalButton = (s, text) => modal(s).locator('button', { hasText: text });
async function waitFor(s, fn, arg, message) {
  try {
    await s.page.waitForFunction(fn, arg, { timeout: 5000 });
  } catch {
    throw new Error(message);
  }
}
const profilesIn = (st, id) => st.accessProfiles.filter((p) => p.serviceId === id);

async function checkGreenDotUi(url) {
  const s = await openPage(url);
  const badge = (id) => s.page.locator(`[data-service-id="${id}"] .app-icon-badge`);
  // O-123-25 (G-3): a profile without complete default credentials no longer counts (was: FR-21/22 dot on every app with ≥ 1 profile).
  // svc-two: only the non-default «אלף» has credentials, so the default is incomplete → no dot.
  for (const [id, want] of [['svc-zero', 0], ['svc-custom', 0], ['svc-one', 0], ['svc-two', 0], ['svc-three', 0]]) {
    assert((await badge(id).count()) === want, `O-123-25: ${id} dot ${want ? 'shown' : 'hidden'} (dot only when ready to use)`);
  }
  await closePage(s);
  return 'browser: no dot for 0 profiles or for profiles without complete default credentials (O-123-25); FR-23 no-text check after the first complete profile';
}

async function checkZeroProfileAndAdd(url) {
  const s = await openPage(url);
  await openTile(s, 'svc-zero');
  const empty = panel(s).locator('[data-app-context="empty-state"]');
  assert((await empty.textContent()).includes(HE.noProfiles), 'FR-12: 0-profile empty state text');
  assert((await panel(s).locator('[data-action="add-first-profile"]').textContent()) === HE.addFirst, '0-profile empty state: «הוסף פרופיל»');
  assert((await panel(s).locator('.la-profile-chip, .la-field, [data-action="edit-profile"]').count()) === 0, '0-profile: no chips, no credential fields, no «עריכת פרופיל»');
  await panel(s).locator('[data-action="add-first-profile"]').click();
  await modal(s).locator('[data-mode="add-profile"]').waitFor({ state: 'visible', timeout: 5000 });
  assert((await panel(s).count()) === 0, 'window closes when the modal opens');
  assert((await writes(s)).length === 0, 'AD-123-5: opening add mode writes nothing (no auto-created profile)');
  assert(profilesIn(await state(s), 'svc-zero').length === 0, 'AD-123-5: still 0 profiles after open');
  await modalButton(s, HE.cancel).click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await writes(s)).length === 0, 'FR-09: cancel in add mode = zero writes');
  // Close with typed values → discard prompt → zero writes.
  await openTile(s, 'svc-zero');
  await panel(s).locator('[data-action="add-first-profile"]').click();
  // Superseded by O-123-6 (Phase 123.5): the first profile has no name field, so a typed credential value makes the form dirty.
  await modal(s).locator('[data-mode="add-profile"] input.cd-field-input').first().fill('טיוטה');
  await s.page.keyboard.press('Escape');
  await modal(s).locator('[role="alertdialog"]').waitFor({ state: 'visible', timeout: 5000 });
  await modalButton(s, HE.discard).click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await writes(s)).length === 0, 'FR-09: closing add mode without saving = zero writes');
  // Save with credentials → exactly one profile, one write, default (FR-04 / FR-09 / MC-2).
  await openTile(s, 'svc-zero');
  await panel(s).locator('[data-action="add-first-profile"]').click();
  const form = modal(s).locator('[data-mode="add-profile"]');
  const inputs = form.locator('input.cd-field-input');
  // Superseded by O-123-6 (Phase 123.5): no name field for the first profile (stored as «ראשי»), and no chip / name at 1 profile.
  assert((await form.locator('input[aria-label="שם פרופיל חדש"]').count()) === 0, 'O-123-6: no name field for the first profile');
  await inputs.nth(0).fill('fixture-user-new');
  await inputs.nth(1).focus();
  await inputs.nth(1).fill('fixture-pass-new');
  await modalButton(s, HE.saveProfile).click();
  await waitFor(s, () => window.__pv.state().accessProfiles.some((p) => p.serviceId === 'svc-zero'), null, 'add: profile saved');
  await form.waitFor({ state: 'detached', timeout: 5000 });
  assert((await modal(s).locator('.cd-chip').count()) === 0, 'O-123-6: 1 profile → no profile chip / name');
  let st = await state(s);
  const created = profilesIn(st, 'svc-zero');
  assert(created.length === 1, 'FR-09: one save → exactly one profile');
  assert(created[0].displayName === 'ראשי', 'O-123-6: the first profile is stored as «ראשי»');
  assert(created[0].isDefault === true, 'FR-04 / MC-2: first profile of a 0-profile app is the default');
  assert(st.credentials[created[0].id]?.username === 'fixture-user-new', 'add: credential saved with the profile');
  assert((await writes(s)).length === 1, 'add: one persist per save');
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await s.page.locator('[data-service-id="svc-zero"] .app-icon-badge').count()) === 1, 'FR-21 / O-123-25: dot appears after the first profile with complete credentials');
  // O-123-25 (G-3): FR-23 moved here (svc-one no longer has a dot).
  assert((await s.page.locator('[data-service-id="svc-zero"] .app-icon-badge').textContent()) === '', 'FR-23: dot has no count / text');
  // Add a profile without credentials from a 1-profile app (FR-21).
  await openTile(s, 'svc-one');
  assert((await panel(s).locator('[data-action="edit-profile"]').count()) === 1, '1 profile: «עריכת פרופיל» shown');
  assert((await panel(s).locator('.la-profile-chip').count()) === 0, '1 profile: no switcher');
  await panel(s).locator('[data-action="add-profile"]').click();
  await modal(s).locator('[data-mode="add-profile"] input.cd-field-input').nth(0).fill('נוסף');
  await modalButton(s, HE.saveProfile).click();
  await waitFor(s, () => window.__pv.state().accessProfiles.filter((p) => p.serviceId === 'svc-one').length === 2, null, 'add without credentials: saved');
  st = await state(s);
  const added = profilesIn(st, 'svc-one').find((p) => p.id !== 'p-one-a');
  assert(!added.isDefault && profilesIn(st, 'svc-one').find((p) => p.id === 'p-one-a').isDefault, 'second profile is not the default');
  assert(!(added.id in st.credentials), 'FR-21: profile without credentials is valid');
  assert((await writes(s)).length === 2, 'two saves → two persists');
  await closePage(s);
  return 'browser: 0-profile empty state + «הוסף פרופיל»; open / cancel / close add mode = 0 writes; save = 1 profile (default) + credential in 1 persist; profile without credentials valid';
}

async function checkSwitcher(url) {
  const s = await openPage(url);
  await openTile(s, 'svc-two');
  assert((await panel(s).locator('.la-profile-chip').count()) === 2, 'FR-03: switcher for 2 profiles');
  assert((await activeChip(s)) === 'בית', `FR-05: window opens on the default (got ${await activeChip(s)})`);
  await panel(s).locator('.la-profile-chip', { hasText: 'אלף' }).click();
  assert((await activeChip(s)) === 'אלף', 'switching changes the active profile');
  assert((await writes(s)).length === 0, 'FR-05/06: switching writes nothing');
  assert((await state(s)).accessProfiles.find((p) => p.id === 'p-two-b').isDefault === true, 'FR-06: stored default unchanged');
  await closePanel(s);
  await openTile(s, 'svc-two');
  assert((await activeChip(s)) === 'בית', `FR-05: reopen → default, not the last switched profile (got ${await activeChip(s)})`);
  // While open: an accessProfiles update keeps the active profile while it exists.
  await panel(s).locator('.la-profile-chip', { hasText: 'אלף' }).click();
  await s.page.evaluate(() => {
    const st = window.__pv.state();
    st.accessProfiles = st.accessProfiles.map((p) => (p.id === 'p-two-b' ? { ...p, displayName: 'בית שני' } : p));
    window.__pv.setLocal(st);
  });
  await panel(s).locator('.la-profile-chip', { hasText: 'בית שני' }).waitFor({ timeout: 5000 });
  assert((await activeChip(s)) === 'אלף', 'while open: active profile kept on an unrelated update');
  await s.page.evaluate(() => {
    const st = window.__pv.state();
    st.accessProfiles = st.accessProfiles.filter((p) => p.id !== 'p-two-a');
    st.accessProfiles.push({ schemaVersion: 1, id: 'p-two-c', serviceId: 'svc-two', displayName: 'גג', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' });
    window.__pv.setLocal(st);
  });
  await panel(s).locator('.la-profile-chip', { hasText: 'גג' }).waitFor({ timeout: 5000 });
  assert((await activeChip(s)) === 'בית שני', `while open: active profile deleted → falls back to the default (got ${await activeChip(s)})`);
  await closePanel(s);
  // ≥ 2 profiles without any credentials: switcher still shown (AD-123-2).
  await openTile(s, 'svc-three');
  assert((await panel(s).getAttribute('data-launch-kind')) === 'missing-user-credentials', 'fixture: svc-three has no credentials');
  assert((await panel(s).locator('.la-profile-chip').count()) === 3, 'AD-123-2: switcher for ≥ 2 profiles regardless of credentials');
  assert((await activeChip(s)) === 'גימל', 'opens on the default');
  assert((await writes(s)).length === 0, 'switcher session: zero writes');
  await closePage(s);
  return 'browser: switcher for ≥ 2 profiles (also without credentials); opens / reopens on the default; switching is session-only (0 writes); active kept while it exists';
}

async function checkEditFocus(url) {
  const s = await openPage(url);
  await openTile(s, 'svc-two');
  await panel(s).locator('.la-profile-chip', { hasText: 'אלף' }).click();
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  const selected = await modal(s).locator('.cd-chip[aria-selected="true"]').allTextContents();
  assert(selected.length === 1 && selected[0].startsWith('אלף'), `FR-07/08: «עריכת פרופיל» opens the modal on the active profile (got ${selected.join('|')})`);
  assert((await writes(s)).length === 0, 'opening edit writes nothing');
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  await openTile(s, 'svc-two');
  await panel(s).locator('[data-action="edit-profile"]').click();
  const again = await modal(s).locator('.cd-chip[aria-selected="true"]').allTextContents();
  assert(again.length === 1 && again[0].startsWith('בית'), 'edit without switching opens on the default');
  await closePage(s);
  return 'browser: tile → window → «עריכת פרופיל» (2 actions) opens the modal on the active profile';
}

async function deleteSelectedProfile(s) {
  await modalButton(s, HE.deleteProfile).click();
  await modal(s).locator('[role="alertdialog"]').waitFor({ state: 'visible', timeout: 5000 });
}

async function checkDeleteFlows(url) {
  const s = await openPage(url);
  // choose_default: svc-three default «גימל», 2 remaining (FR-13).
  await openTile(s, 'svc-three');
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await deleteSelectedProfile(s);
  const step = modal(s).locator('[data-step="choose-new-default"]');
  assert((await step.locator('input[type="radio"]').count()) === 2, 'FR-13: in-modal step lists the 2 remaining profiles');
  assert(await modal(s).locator('.cd-delete-confirm').isDisabled(), 'FR-13: delete disabled until a new default is chosen');
  assert((await seq(s)).length === 0, 'nothing written / no cloud call before choosing');
  await step.locator('label', { hasText: 'הא' }).click();
  await modal(s).locator('.cd-delete-confirm').click();
  await waitFor(s, () => window.__pv.state().accessProfiles.filter((p) => p.serviceId === 'svc-three').length === 2, null, 'choose_default delete: saved');
  let st = await state(s);
  assert(profilesIn(st, 'svc-three').filter((p) => p.isDefault).map((p) => p.id).join() === 'p-three-h', 'FR-13: the chosen profile is the only default');
  let events = await seq(s);
  const cloudIdx = events.findIndex((e) => e.kind === 'cloud' && e.fn === 'deleteAccessProfileFromCloud' && e.args[0] === 'p-three-g');
  const writeIdx = events.findIndex((e) => e.kind === 'write');
  assert(cloudIdx >= 0 && writeIdx > cloudIdx, 'AD-123-13: cloud delete before the local write (cloud-first order unchanged)');
  await modal(s).locator('button[aria-label="סגירה"]').click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  // auto_default: svc-two default «בית», 1 remaining.
  await openTile(s, 'svc-two');
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await deleteSelectedProfile(s);
  assert((await modal(s).locator('[data-step="choose-new-default"]').count()) === 0, 'FR-13: no choice step with 1 remaining');
  await modal(s).locator('.cd-delete-confirm').click();
  await waitFor(s, () => window.__pv.state().accessProfiles.filter((p) => p.serviceId === 'svc-two').length === 1, null, 'auto_default delete: saved');
  st = await state(s);
  assert(profilesIn(st, 'svc-two')[0].id === 'p-two-a' && profilesIn(st, 'svc-two')[0].isDefault === true, 'FR-13: the remaining profile becomes the default');
  // Last profile (FR-10/11/12).
  // Superseded by O-123-6 (Phase 123.5): the lone remaining profile keeps its name, but no chip / name is shown.
  await modal(s).locator('.cd-chip').first().waitFor({ state: 'detached', timeout: 5000 });
  assert(profilesIn(await state(s), 'svc-two')[0].displayName === 'אלף', 'O-123-6: the remaining profile keeps its name (no migration)');
  await deleteSelectedProfile(s);
  await modal(s).locator('.cd-delete-confirm').click();
  await waitFor(s, () => window.__pv.state().accessProfiles.every((p) => p.serviceId !== 'svc-two'), null, 'FR-11: last profile delete allowed');
  st = await state(s);
  assert(!('p-two-a' in st.credentials), 'last profile delete removes its credential');
  await modal(s).locator('[data-mode="add-profile"]').waitFor({ state: 'visible', timeout: 5000 });
  const writesBefore = (await writes(s)).length;
  await modalButton(s, HE.cancel).click();
  await modal(s).waitFor({ state: 'detached', timeout: 5000 });
  assert((await writes(s)).length === writesBefore, 'after delete-last, the add form cancels with zero writes');
  assert((await s.page.locator('[data-service-id="svc-two"] .app-icon-badge').count()) === 0, 'FR-12: no dot after the last profile is deleted');
  await openTile(s, 'svc-two');
  assert((await panel(s).locator('[data-app-context="empty-state"]').count()) === 1, 'FR-12: empty state after the last profile is deleted');
  await closePanel(s);
  // Unlock check: persisted → lock → unlock → still 0 profiles, no auto-created «ראשי».
  const unlocked = await s.page.evaluate(() => window.__pv.lockUnlock());
  assert(profilesIn(unlocked, 'svc-two').length === 0, 'unlock after delete-last: still 0 profiles');
  assert(!unlocked.accessProfiles.some((p) => p.displayName === 'ראשי'), 'unlock after delete-last: no auto-created «ראשי»');
  assert(profilesIn(unlocked, 'svc-three').filter((p) => p.isDefault).map((p) => p.id).join() === 'p-three-h', 'unlock: persisted chosen default');
  events = await seq(s);
  assert(events.filter((e) => e.kind === 'write').length === 3, 'three deletes → three persists');
  await closePage(s);
  return 'browser: delete default with ≥ 2 → in-modal choose step (no browser dialog), cloud-first; with 1 → auto default; last profile → 0 profiles, no dot, empty state; lock / unlock keeps 0 profiles (no «ראשי»)';
}

async function checkCloudFailClosed(url) {
  const s = await openPage(url);
  await s.page.evaluate(() => {
    window.__pvCloudFail = true;
  });
  await openTile(s, 'svc-three');
  await panel(s).locator('.la-profile-chip', { hasText: 'דלת' }).click();
  await panel(s).locator('[data-action="edit-profile"]').click();
  await modal(s).waitFor({ state: 'visible', timeout: 5000 });
  await deleteSelectedProfile(s);
  await modal(s).locator('.cd-delete-confirm').click();
  await modal(s).locator('[role="alert"]', { hasText: HE.cloudFailed }).waitFor({ timeout: 5000 });
  assert((await writes(s)).length === 0, 'N-7: cloud failure → no local write');
  assert(profilesIn(await state(s), 'svc-three').length === 3, 'N-7: cloud failure → profile stays');
  await closePage(s);
  return 'browser: profile delete with a cloud error → Hebrew error, local state unchanged (fail-closed)';
}

async function checkProfileDialogBackdrop(url) {
  const s = await openPage(url);
  await openTile(s, 'svc-zero');
  await panel(s).locator('[data-action="add-first-profile"]').click();
  // Superseded by O-123-6 (Phase 123.5): a 0-profile add form has no name field; the drag starts from its first credential input.
  const name = modal(s).locator('[data-mode="add-profile"] input.cd-field-input').first();
  await name.waitFor({ state: 'visible', timeout: 5000 });
  await name.fill('טיוטה בגרירה');
  const box = await name.boundingBox();
  await s.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await s.page.mouse.down();
  await s.page.mouse.move(40, 40, { steps: 6 });
  await s.page.mouse.move(5, 5, { steps: 3 });
  await s.page.mouse.up();
  await s.page.mouse.click(5, 5);
  await s.page.waitForTimeout(200);
  assert(await modal(s).isVisible(), 'D-123-3: drag from an input / backdrop click keeps the profile dialog');
  assert((await name.inputValue()) === 'טיוטה בגרירה', 'D-123-3: …with its values');
  assert((await modal(s).locator('[role="alertdialog"]').count()) === 0, 'D-123-3: a backdrop click is not a close request (no discard prompt)');
  assert((await writes(s)).length === 0, 'D-123-3: nothing written');
  await closePage(s);
  return 'browser: D-123-3 — profile dialog (form) survives a drag from its input to the backdrop and a backdrop click, values kept, no close request';
}

async function checkRemovedElsewhereCloses(url) {
  const s = await openPage(url);
  const notice = s.page.locator('[role="status"]', { hasText: HE.removedElsewhere });
  await openTile(s, 'svc-two');
  await s.page.evaluate(() => {
    const st = window.__pv.state();
    st.accessProfiles = st.accessProfiles.filter((p) => p.id !== 'p-two-a');
    delete st.credentials['p-two-a'];
    window.__pv.reconcile(st, ['svc-two'], false);
  });
  await panel(s).waitFor({ state: 'detached', timeout: 5000 });
  await notice.waitFor({ state: 'visible', timeout: 5000 });
  assert((await writes(s)).length === 0, 'AD-123-18: closing on reconcile writes nothing');
  await s.page.reload();
  await s.page.waitForFunction(() => window.__pvReady, null, { timeout: 30000 });
  await openTile(s, 'svc-one');
  await s.page.evaluate(() => window.__pv.reconcile(window.__pv.state(), ['svc-three'], false));
  await s.page.waitForTimeout(300);
  assert(await panel(s).isVisible(), 'AD-123-18: a window on an unaffected app stays open');
  assert((await notice.count()) === 0, 'AD-123-18: no notice when nothing visible closed');
  await s.page.evaluate(() => window.__pv.reconcile(window.__pv.state(), ['svc-three'], true));
  await notice.waitFor({ state: 'visible', timeout: 5000 });
  await closePage(s);
  return 'browser: AD-123-18 — open window on an app that lost a row elsewhere closes with the Hebrew notice; unaffected window stays; closed modal elsewhere → notice; 0 writes';
}

// ─── Runner ───────────────────────────────────────────────────────────────────
const PURE_GROUPS = [checkHelpers, checkDeleteReducer, checkFirstProfileDefault, checkValidationAcceptsZero];
const STATIC_GROUPS = [checkNoAutoCreate, checkSingleHost, checkPanelStatic, checkDashboardDot, checkNoBrowserDialogs, checkNoNewWriteSites, checkNoSiteBranches, checkPersistenceScope, checkVaultPayloadShapeOnly, checkDialogBackdropRule];
const BROWSER_GROUPS = [checkGreenDotUi, checkZeroProfileAndAdd, checkSwitcher, checkEditFocus, checkDeleteFlows, checkCloudFailClosed, checkRemovedElsewhereCloses, checkProfileDialogBackdrop];

async function runAll(overrides, log) {
  const mod = await loadPure(overrides);
  for (const g of PURE_GROUPS) {
    const what = g(mod);
    if (log) console.log(`  ✓ ${what}`);
  }
  for (const g of STATIC_GROUPS) {
    const what = g(overrides);
    if (log) console.log(`  ✓ ${what}`);
  }
  if (log) console.log(`  ✓ ${checkProtectedUnchanged()}`);
  const dir = makeTempDir('pv-123-web-');
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

// O-123-25 (G-3): the dot expression (was: 'hasCredentials={appHasProfile({ accessProfiles }, service.id)}'); M4 keeps targeting it.
const DASH_DOT = "hasCredentials={\n          appHasProfile({ accessProfiles }, service.id) &&\n          deriveServiceManagementState(service, { selectedIds: homeIds, accessProfiles, credentials: credentialsByProfileId }) === 'added'\n        }";
const MUTATIONS = [
  ['M1 last-profile guard restored (AD-123-13)', (o) => ({
    'src/vault/profileManagement.ts': replaceOnce(read('src/vault/profileManagement.ts'),
      '  const serviceId = target.serviceId.trim();\n  const remaining = getProfilesForService(state, serviceId).filter(',
      "  const serviceId = target.serviceId.trim();\n  if (getProfilesForService(state, serviceId).length <= 1) {\n    throw new ProfileManagementError('Cannot delete the last profile for a service');\n  }\n  const remaining = getProfilesForService(state, serviceId).filter(", o),
  })],
  ['M2 choose_default auto-promotes instead of requiring replacementDefaultId (AD-123-13)', (o) => ({
    'src/vault/profileManagement.ts': replaceOnce(read('src/vault/profileManagement.ts'),
      'const replacement = remaining.find((profile) => profile.id === replacementDefaultId);',
      'const replacement = remaining.find((profile) => profile.id === replacementDefaultId) ?? remaining[0];', o),
  })],
  ['M3 ensureDefaultProfileForService re-added on open (AD-123-5)', (o) => {
    let src = read('src/loginAssistance/DigitalHomeCredentialModal.tsx');
    src = replaceOnce(src, "import { useState } from 'react';", "import { useEffect, useState } from 'react';", o);
    src = replaceOnce(src, '  deleteCredentialForProfile,\n  getProfilesForService,', '  deleteCredentialForProfile,\n  ensureDefaultProfileForService,\n  getProfilesForService,', o);
    src = replaceOnce(src, '  const [profileError, setProfileError] = useState<string | null>(null);\n',
      '  const [profileError, setProfileError] = useState<string | null>(null);\n  useEffect(() => {\n    const ensured = ensureDefaultProfileForService(vaultState, service.id);\n    if (ensured !== vaultState) void onVaultStateChange(ensured);\n  }, [service.id]);\n', o);
    return { 'src/loginAssistance/DigitalHomeCredentialModal.tsx': src };
  }],
  ['M4 dot back to complete credentials (AD-123-6)', (o) => ({
    'src/Dashboard.tsx': replaceOnce(read('src/Dashboard.tsx'), DASH_DOT,
      'hasCredentials={accessProfiles.some((p) => p.serviceId === service.id && Object.values(credentialsByProfileId[p.id] ?? {}).some(Boolean))}', o),
  })],
  ['M5 switcher gated on credentials (AD-123-2)', (o) => ({
    'src/loginAssistance/LoginAssistancePanel.tsx': replaceOnce(read('src/loginAssistance/LoginAssistancePanel.tsx'),
      'const showProfileChips = profileUi && actions.switcher;', 'const showProfileChips = showCredentialUi && actions.switcher;', o),
  })],
  ['M6 window reopens on the last switched profile instead of the default (AD-123-7)', (o) => {
    let src = read('src/loginAssistance/LoginAssistancePanel.tsx');
    src = replaceOnce(src, 'const STATUS_MS = 8000;', 'const STATUS_MS = 8000;\nconst lastActiveByService = new Map<string, string>();', o);
    src = replaceOnce(src, 'useState<string | null>(() =>\n    initialActiveProfile(profiles),\n  );', 'useState<string | null>(() =>\n    lastActiveByService.get(service.id) ?? initialActiveProfile(profiles),\n  );', o);
    src = replaceOnce(src, '    setActiveProfileId(initialActiveProfile(profilesForService(accessProfiles, service.id)));',
      '    setActiveProfileId(lastActiveByService.get(service.id) ?? initialActiveProfile(profilesForService(accessProfiles, service.id)));', o);
    src = replaceOnce(src, '  function selectProfile(profileId: string) {\n    setActiveProfileId(profileId);',
      '  function selectProfile(profileId: string) {\n    lastActiveByService.set(service.id, profileId);\n    setActiveProfileId(profileId);', o);
    return { 'src/loginAssistance/LoginAssistancePanel.tsx': src };
  }],
  ['M7 add mode writes on cancel (AD-123-3 / FR-09)', (o) => ({
    'src/ServiceProfileManagementModal.tsx': replaceOnce(read('src/ServiceProfileManagementModal.tsx'),
      "    if (adding === 'entry' || sortedProfiles.length === 0) {\n      onClose();",
      "    if (adding === 'entry' || sortedProfiles.length === 0) {\n      void onCreateProfile('ראשי', null);\n      onClose();", o),
  })],
  ['M8 second modal render site (AD-123-3)', (o) => {
    // Re-anchored on Dashboard.tsx (AD-123-1: ManageServices deleted in 123.4).
    let src = read('src/Dashboard.tsx');
    src = replaceOnce(src, "import { useEffect, useRef, useState } from 'react';", "import { useEffect, useRef, useState } from 'react';\nimport ServiceProfileManagementModal from './ServiceProfileManagementModal';", o);
    src = replaceOnce(src, '    return (\n      <Tile\n', '    if (Math.random() > 2) return <ServiceProfileManagementModal {...({} as never)} />;\n    return (\n      <Tile\n', o);
    return { 'src/Dashboard.tsx': src };
  }],
  ['M9 first added profile left non-default (MC-2 / FR-04)', (o) => ({
    'src/vault/profileManagement.ts': replaceOnce(read('src/vault/profileManagement.ts'),
      '    isDefault: existingForService.length === 0,', '    isDefault: false,', o),
  })],
  ['M10 Dashboard ignores the reconcile signal — window on a removed row stays open (AD-123-18)', (o) => ({
    'src/Dashboard.tsx': replaceOnce(read('src/Dashboard.tsx'),
      'assistance !== null && cloudReconcile.affectedServiceIds.includes(assistance.service.id);',
      'false && assistance !== null && cloudReconcile.affectedServiceIds.includes(assistance.service.id);', o),
  })],
  ['M11 profile dialog closes on a backdrop click again (D-123-3)', (o) => ({
    'src/ServiceProfileManagementModal.tsx': replaceOnce(read('src/ServiceProfileManagementModal.tsx'),
      '<div className="modal-overlay cd-overlay" data-dialog-form="true">',
      '<div className="modal-overlay cd-overlay" data-dialog-form="true" onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}>', o),
  })],
  ['M12 profile chooser closes on a backdrop click again (D-123-3)', (o) => ({
    'src/profile/ProfileChooserModal.tsx': replaceOnce(read('src/profile/ProfileChooserModal.tsx'),
      '<div className="modal-overlay" data-dialog-form="true">',
      '<div className="modal-overlay" data-dialog-form="true" onClick={onCancel}>', o),
  })],
  ['M13 persistVault semantics changed next to the outbox field (amendment A scope)', (o) => ({
    'src/vault/vault.ts': replaceOnce(read('src/vault/vault.ts'),
      '  if (!options?.skipCloudSync) {', '  if (!options?.skipCloudSync || options?.awaitCloudSync) {', o),
  })],
  ['M14 vault crypto changed next to the outbox field (amendment A scope)', (o) => ({
    'src/vault/crypto.ts': replaceOnce(read('src/vault/crypto.ts'),
      '  const encoded = new TextEncoder().encode(JSON.stringify(payload));',
      '  const encoded = new TextEncoder().encode(JSON.stringify({ ...payload, format: 2 }));', o),
  })],
  ['M15 outbox not normalized on unlock (amendment A)', (o) => ({
    'src/vault/crypto.ts': replaceOnce(read('src/vault/crypto.ts'),
      '    syncOutbox: normalizeSyncOutbox(raw.syncOutbox),\n', '', o),
  })],
];

const selectedMutations = selectMutations(MUTATIONS, MUTATION_ARGS, (m) => m[0]);

console.log('Phase 123.1 — App context\n');
browser = await chromium.launch({ channel: 'msedge' });
const closeBrowser = () => browser.close();
try {
  await runAll({}, true);
  const groupCount = PURE_GROUPS.length + STATIC_GROUPS.length + 1 + BROWSER_GROUPS.length;
  if (MUTATION_ARGS.mode === 'none') {
    console.log(`\nPASS — Phase 123.1 App context: ${groupCount} check groups, mutation sweep skipped (--no-mutations) — ${formatElapsed(Date.now() - STARTED)}`);
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
    console.log(`\nPASS — Phase 123.1 App context: ${groupCount} check groups, ${caughtCount} ${scope} — ${formatElapsed(Date.now() - STARTED)}`);
  }
} catch (e) {
  await failRun(e instanceof Error ? e.message : String(e), closeBrowser);
}
await withTimeout(closeBrowser, 10_000, 'browser close timed out').catch(() => undefined);
process.exit(0);
