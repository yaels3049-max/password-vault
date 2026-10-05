/**
 * Phase 123 — fix round D-123-8: an own custom site (an app in the vault `customServices`) follows
 * the registry only while that entry is approved for users; otherwise the vault copy (= the last
 * approved version, or the owner's own definition) is what the owner sees and runs.
 *
 * Layers, all on the real sources (mutations are applied in memory):
 *  - pure (Node bundle): digitalHome/ownSiteDefinition.ts, registryMapper, definitionToLegacyService,
 *    credentialSchema, credentialsGate, catalogVisibility, addCustomServiceOutcome, managedAutofill
 *    payload builder, and App.tsx `mergeCustomDefinitions` (extracted from the App source as is);
 *  - hydrate (Node bundle): the real supabase/persistence.ts `hydrateWorkspaceFromCloud` over an
 *    in-memory fake Supabase. Stubbed seams only: supabase/client, auth, vault/crypto (reversible
 *    fake cipher), dev/devMode, serviceSelection message;
 *  - static: persistence.ts differs from af881f6b only by the D-123-8 import + own-site block;
 *    App merge rule; Dashboard wiring; Owner edit («עריכת פרטי האתר») unchanged; no site branches;
 *  - browser (Edge via Playwright): the real Dashboard + LoginAssistancePanel on services resolved
 *    by the real App merge. Stubbed seams only: supabase/persistence, useServiceLogos.
 * Synthetic fixtures only; no credential value is logged.
 *
 * KI-5 (123.3 Item 0a): the resolver and the hydrate block share one predicate,
 * `ownSiteFollowsRegistry` (approved + category + icon); persistence.ts differs from the WIP commit
 * 0dfb9de7 only in that block and its import.
 *
 * H-1: every layer and every mutation run is bounded; a timeout fails the run and never counts as
 * a caught mutation.
 *
 * Usage: node scripts/verifyPhase123D8OwnSite.mjs [--no-mutations | --mutations=M1,M2]
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
const MUTATION_ARGS = parseMutationArgs();
const STARTED = Date.now();
const BASE = 'af881f6b6d891894f4109aea3bf3f27bdd670b19';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const baseSource = (rel) => git('show', `${BASE}:${rel}`).replace(/\r\n/g, '\n');
const source = (overrides, rel) => overrides[rel] ?? read(rel);
const clone = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const PERSISTENCE = 'src/supabase/persistence.ts';
const OWN_SITE = 'src/digitalHome/ownSiteDefinition.ts';
const PANEL = 'src/loginAssistance/LoginAssistancePanel.tsx';
const DASHBOARD = 'src/Dashboard.tsx';
const APP = 'src/App.tsx';
const MSG_FIELDS_UPDATED = 'שדות הכניסה לאתר עודכנו — יש להשלים את פרטי הכניסה.';
const LABEL_EDIT_PROFILE = 'עריכת פרופיל';

// ─── Fixtures (synthetic) ─────────────────────────────────────────────────────
const USER = 'user-123-d8';
const F = {
  username: { id: 'username', label: 'שם משתמש', type: 'text' },
  password: { id: 'password', label: 'סיסמה', type: 'password' },
  email: { id: 'email', label: 'דוא״ל', type: 'text' },
  pin: { id: 'pin', label: 'קוד', type: 'password' },
};
const autofill = (supportState, fieldIds, validationVersion) => ({
  supportState,
  configVersion: 1,
  loginEntryUrl: 'https://login.admin.example.test/',
  allowedOrigin: 'https://login.admin.example.test',
  fieldMappings: fieldIds.map((fieldId) => ({ fieldId, locatorType: 'css', locator: `#${fieldId}` })),
  ...(validationVersion ? { validation: { metadataVersion: validationVersion, validatedBy: 'admin' } } : {}),
});
/** The owner's vault copy as created (user-created, default username / password form). */
const vaultCopy = (id, name, host) => ({
  schemaVersion: 1,
  id,
  displayName: name,
  url: `https://${host}/`,
  loginUrl: `https://${host}/`,
  icon: '🔗',
  category: 'shopping',
  source: 'user-created',
  metadata: { faviconSiteUrl: `https://${host}/`, loginUrlSource: 'user', loginEntryType: 'primary_page' },
});
/** The owner's registry row after an admin edit (name, URL, category, login URL, fields). */
const adminRow = (id, { name, host, fields, metadata, sourceType = 'user', owner = USER }) => ({
  id,
  display_name: name,
  primary_url: `https://${host}/`,
  login_url: `https://login.${host}/`,
  login_url_status: 'valid',
  category_id: 'finance',
  icon: '🔗',
  adapter_id: null,
  login_fields: fields,
  source_type: sourceType,
  service_status: 'active',
  metadata: { loginUrlSource: 'user', credentialMode: 'credential_fields', ...metadata },
  owner_user_id: owner,
});
const NEW_FIELDS = [F.email, F.password];
const META = {
  notApproved: { autofillProfile: autofill('not_configured', ['email', 'password']) },
  approved: { autofillProfile: autofill('validated', ['email', 'password'], 1) },
  approvedSame: { autofillProfile: autofill('validated', ['username', 'password'], 1) },
  lost: { autofillProfile: autofill('unsupported', ['email', 'pin'], 1) },
};
const T0 = '2026-10-01T00:00:00.000Z';
const prof = (id, serviceId, displayName) => ({ schemaVersion: 1, id, serviceId, displayName, createdAt: T0, updatedAt: T0, isDefault: true });
const cred = (tag) => ({ username: `fixture-${tag}-user`, password: `fixture-${tag}-pass` });

// ─── Bundling ─────────────────────────────────────────────────────────────────
const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
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
function seamsPlugin(overrides, used, stubTable) {
  const stubs = new Map(Object.entries(stubTable).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  return {
    name: 'phase123-d8-seams',
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
const tsOverrides = (overrides) => Object.fromEntries(Object.entries(overrides).filter(([rel]) => /\.tsx?$/.test(rel) && rel !== APP));

/** Source of a top-level `function name(` up to its closing `}` at column 0. */
function topLevelFunction(src, name) {
  const start = src.search(new RegExp(`^(export )?(async )?function ${name}\\(`, 'm'));
  if (start < 0) return null;
  const end = src.indexOf('\n}\n', start);
  return end < 0 ? src.slice(start) : src.slice(start, end + 2);
}

// ─── Layer 1: pure ────────────────────────────────────────────────────────────
function pureEntry(overrides) {
  const app = source(overrides, APP);
  const isUser = topLevelFunction(app, 'isUserCreatedDefinition');
  const merge = topLevelFunction(app, 'mergeCustomDefinitions');
  assert(isUser && merge, 'fixture: App merge functions located');
  return `
export { resolveOwnSiteDefinition, isApprovedForUsers, ownSiteFollowsRegistry, hiddenCredentialFieldIds } from './src/digitalHome/ownSiteDefinition.ts';
export { registryRowToServiceDefinition } from './src/registry/registryMapper.ts';
export { definitionToLegacyService } from './src/catalog/definitionToLegacyService.ts';
export { resolveCredentialEntry } from './src/service/credentialSchema.ts';
export { resolveDigitalHomeLaunchKind } from './src/loginAssistance/credentialsGate.ts';
export { isListedInUserCatalog } from './src/catalog/catalogVisibility.ts';
export { classifyAddCustomService } from './src/catalog/addCustomServiceOutcome.ts';
export { buildManagedAutofillPayload, serviceIsManagedAutofillEligible } from './src/execution/managedAutofill.ts';
export { readAutofillProfileFromMetadata } from './src/autofill/validatedProfile.ts';
import { resolveOwnSiteDefinition } from './src/digitalHome/ownSiteDefinition.ts';
import type { ServiceDefinition } from './src/service/serviceModel.ts';
${isUser}
export ${merge}
`;
}

async function loadPure(overrides) {
  const dir = makeTempDir('pv-123d8-pure-');
  try {
    const used = new Set();
    const o = tsOverrides(overrides);
    await build({
      ...COMMON_BUILD,
      stdin: { contents: pureEntry(overrides), resolveDir: root, loader: 'ts', sourcefile: 'pure.ts' },
      outfile: join(dir, 'pure.mjs'),
      format: 'esm',
      platform: 'node',
      plugins: [seamsPlugin(o, used, {})],
    });
    return await import(pathToFileURL(join(dir, 'pure.mjs')).href);
  } finally {
    removeTempDir(dir);
  }
}

/** The catalog / vault situation used by the pure and browser layers. */
function scenario(mod) {
  const def = (row) => mod.registryRowToServiceDefinition(row);
  const copies = {
    np: vaultCopy('own-np', 'אתר שלי', 'np.example.test'),
    ap: vaultCopy('own-ap', 'אתר מאושר', 'ap.example.test'),
    same: vaultCopy('own-same', 'אתר ללא שינוי שדות', 'same.example.test'),
    lost: { ...vaultCopy('own-lost', 'גרסה מאושרת אחרונה', 'lost-v1.example.test'), loginFields: [F.username, F.password] },
    unknown: vaultCopy('own-unknown', 'אתר לא ידוע', 'unknown.example.test'),
    gone: vaultCopy('own-gone', 'אתר ללא שורה', 'gone.example.test'),
    promo: vaultCopy('own-promo', 'אתר שקודם', 'promo.example.test'),
  };
  const rows = {
    np: adminRow('own-np', { name: 'שם חדש מהמנהל', host: 'np-admin.example.test', fields: [F.email, F.pin], metadata: META.notApproved }),
    ap: adminRow('own-ap', { name: 'שם מאושר מהמנהל', host: 'ap-admin.example.test', fields: NEW_FIELDS, metadata: META.approved }),
    same: adminRow('own-same', { name: 'שם מאושר ללא שינוי', host: 'same-admin.example.test', fields: [F.username, F.password], metadata: META.approvedSame }),
    lost: adminRow('own-lost', { name: 'עריכה חדשה שלא אושרה', host: 'lost-v2.example.test', fields: [F.email, F.pin], metadata: META.lost }),
    promoSelf: adminRow('own-promo', { name: 'הגשה', host: 'promo.example.test', fields: null, metadata: { approvalStatus: 'approved' } }),
    promoGlobal: adminRow('glob-promo', { name: 'גלובלי חדש', host: 'promo.example.test', fields: NEW_FIELDS, metadata: META.approved, sourceType: 'admin', owner: null }),
    glob: adminRow('glob-fields', { name: 'אתר גלובלי', host: 'glob.example.test', fields: NEW_FIELDS, metadata: META.approved, sourceType: 'admin', owner: null }),
  };
  const unknownEntry = { ...def(adminRow('own-unknown', { name: 'שורה לא קריאה', host: 'unknown-admin.example.test', fields: NEW_FIELDS, metadata: META.approved })) };
  unknownEntry.metadata = new Proxy({}, { get() { throw new Error('unreadable metadata'); }, ownKeys() { throw new Error('unreadable metadata'); } });
  const catalog = [def(rows.np), def(rows.ap), def(rows.same), def(rows.lost), def(rows.promoSelf), def(rows.promoGlobal), def(rows.glob), unknownEntry];
  return { copies, rows, catalog, def };
}

function checkResolver(mod) {
  const { copies, rows, def, catalog } = scenario(mod);
  const r = (copy, entry) => mod.resolveOwnSiteDefinition(copy, entry);
  assert(same(r(copies.np, def(rows.np)).definition, copies.np) && !r(copies.np, def(rows.np)).approved, 'D-123-8: not approved → the vault copy, as stored');
  assert(same(r(copies.ap, def(rows.ap)).definition, def(rows.ap)) && r(copies.ap, def(rows.ap)).approved, 'D-123-8: approved → the registry definition');
  assert(same(r(copies.lost, def(rows.lost)).definition, copies.lost), 'D-123-8: approval lost → the vault copy (last approved version), not the newer edits');
  assert(same(r(copies.gone, null).definition, copies.gone) && !r(copies.gone, undefined).approved, 'D-123-8: no registry row → the vault copy');
  const noCategory = def({ ...rows.ap, category_id: null });
  assert(mod.isApprovedForUsers(noCategory) && same(r(copies.ap, noCategory).definition, copies.ap), 'D-123-8: an approved entry without category (not renderable) → the vault copy');
  const noIcon = def({ ...rows.ap, icon: null });
  assert(mod.isApprovedForUsers(noIcon) && same(r(copies.ap, noIcon).definition, copies.ap), 'KI-5: an approved entry without icon → the vault copy');
  const legacyOk = mod.definitionToLegacyService(r(copies.ap, noCategory).definition);
  assert(legacyOk.id === 'own-ap', 'D-123-8: the resolved definition always renders as a tile');
  const unknown = catalog.find((d) => d.id === 'own-unknown');
  assert(mod.isApprovedForUsers(unknown) === false, 'D-123-8: unreadable approval → not approved (fail-closed)');
  assert(same(r(copies.unknown, unknown).definition, copies.unknown), 'D-123-8: unknown approval → the vault copy');
  const legacy = mod.definitionToLegacyService(r(copies.np, def(rows.np)).definition);
  assert(legacy.name === copies.np.displayName && legacy.url === copies.np.url && legacy.category === 'shopping' && legacy.loginUrl === copies.np.loginUrl, 'D-123-8: not approved → window name / URL / category / login URL from the vault copy');
  return 'D-123-8 resolver: not approved / approval lost / no row / unreadable approval → vault copy; approved → registry definition';
}

function checkAppMerge(mod) {
  const { copies, catalog, rows, def } = scenario(mod);
  const vault = [copies.np, copies.ap, copies.same, copies.lost, copies.unknown, copies.promo];
  const { definitions, approvedOwnIds } = mod.mergeCustomDefinitions(vault, catalog);
  const byId = new Map(definitions.map((d) => [d.id, d]));
  for (const key of ['np', 'lost', 'unknown', 'promo']) {
    assert(byId.get(copies[key].id) === copies[key], `D-123-8 App merge: ${key} → the vault copy as a whole (no registry name / URL / login fields mixed in)`);
  }
  assert(byId.get('own-np').loginFields === undefined, 'D-123-8 App merge: no registry login fields for a non-approved own site');
  assert(same(byId.get('own-ap'), def(rows.ap)) && same(byId.get('own-same'), def(rows.same)), 'D-123-8 App merge: approved own sites → the registry definition');
  assert(same([...approvedOwnIds].sort(), ['own-ap', 'own-same']), `D-123-8 App merge: approved own ids = own-ap, own-same (got ${[...approvedOwnIds].sort().join(', ')})`);
  assert(!byId.has('glob-fields') && !byId.has('glob-promo'), 'D-123-8 App merge: global sites are not own sites (unchanged path)');
  // A registry-only own row (no vault copy yet) is still listed as before.
  const onlyRow = mod.mergeCustomDefinitions([], [def(rows.np)]).definitions;
  assert(onlyRow.length === 1 && onlyRow[0].id === 'own-np', 'D-123-8 App merge: a registry-only own row (no vault copy) is kept as before');
  return 'D-123-8 App merge (real App.tsx function): one resolved definition per own site; approved ids reported; globals untouched; registry-only rows kept';
}

function checkRuntimeInputs(mod) {
  const { copies, catalog } = scenario(mod);
  const { definitions } = mod.mergeCustomDefinitions([copies.np, copies.ap], catalog);
  const svc = (id) => mod.definitionToLegacyService(definitions.find((d) => d.id === id));
  const profiles = [prof('p-np', 'own-np', 'ראשי'), prof('p-ap', 'own-ap', 'ראשי')];
  const creds = { 'p-np': cred('np'), 'p-ap': cred('ap') };

  const np = svc('own-np');
  const npEntry = mod.resolveCredentialEntry(np);
  assert(npEntry.kind === 'form' && same(npEntry.fields.map((f) => f.id), ['username', 'password']), 'D-123-8 not approved: login form = vault copy (default username / password), not the admin fields');
  assert(mod.resolveDigitalHomeLaunchKind(np, profiles, creds) === 'credentials', 'D-123-8 not approved: launch kind from the vault copy (stored values usable)');
  assert(np.loginUrl === copies.np.loginUrl, 'D-123-8 not approved: login URL from the vault copy');
  assert(!mod.serviceIsManagedAutofillEligible(np, creds['p-np'], npEntry.fields), 'D-123-8 not approved: no managed autofill from the unapproved admin mapping');

  const ap = svc('own-ap');
  const apEntry = mod.resolveCredentialEntry(ap);
  assert(apEntry.kind === 'form' && same(apEntry.fields.map((f) => f.id), ['email', 'password']), 'D-123-8 approved: login form = registry fields');
  assert(!mod.serviceIsManagedAutofillEligible(ap, creds['p-ap'], apEntry.fields), 'D-123-8 approved with changed fields: no managed autofill until the profile has the new field (execution unchanged)');
  assert(mod.serviceIsManagedAutofillEligible(ap, { email: 'fixture-ap-email', password: 'fixture-ap-pass' }, apEntry.fields), 'D-123-8 approved: managed autofill eligible once the profile is completed');
  const profile = mod.readAutofillProfileFromMetadata(ap.metadata);
  const payload = mod.buildManagedAutofillPayload({ url: profile.loginEntryUrl, allowedOrigin: profile.allowedOrigin, fieldMappings: profile.fieldMappings, credentials: creds['p-ap'] });
  assert(same(Object.keys(payload.credentials).sort(), ['password']), 'D-123-8 approved: autofill input = same-field-id values only');
  assert(same(mod.hiddenCredentialFieldIds(creds['p-ap'], apEntry.fields.map((f) => f.id)), ['username']), 'D-123-8 approved: the other-id value is reported hidden (kept, not shown)');
  assert(same(mod.hiddenCredentialFieldIds({ username: '  ', password: 'x' }, ['password']), []), 'D-123-8: blank other-id values are not reported');
  assert(same(creds['p-ap'], cred('ap')), 'D-123-8: resolving never changes stored values');
  return 'D-123-8 runtime inputs: window / launch kind / login URL / autofill eligibility + payload all follow the one resolved definition';
}

function checkPromotionNewId(mod) {
  const { copies, catalog, rows, def } = scenario(mod);
  const { definitions, approvedOwnIds } = mod.mergeCustomDefinitions([copies.promo], catalog);
  assert(same(definitions.find((d) => d.id === 'own-promo'), copies.promo) && !approvedOwnIds.has('own-promo'), 'D-123-8 promotion (new global id): the own site stays as its vault copy');
  const globalDef = def(rows.promoGlobal);
  assert(mod.isListedInUserCatalog(globalDef), 'D-123-8 promotion: the approved global is listed in the catalog');
  const input = { normalizedUrl: 'https://promo.example.test/', selectedIds: new Set(['own-promo']), localCustomServices: [copies.promo] };
  const offered = mod.classifyAddCustomService({ ...input, definitions: [globalDef] });
  assert(offered?.status === 'catalog_service_available' && offered.existingServiceId === 'glob-promo', 'D-123-8 promotion: Phase 116 offers the global once approved (no automatic move)');
  const pending = def(adminRow('glob-promo', { name: 'גלובלי חדש', host: 'promo.example.test', fields: NEW_FIELDS, metadata: META.notApproved, sourceType: 'admin', owner: null }));
  assert(!mod.isListedInUserCatalog(pending), 'D-123-8 promotion: an unapproved global is not listed');
  const notOffered = mod.classifyAddCustomService({ ...input, definitions: [pending] });
  assert(notOffered?.status === 'already_in_user_home' && notOffered.existingServiceId === 'own-promo', 'D-123-8 promotion: before approval the own site answers «already in home»');
  return 'D-123-8 promotion under a new global id: own site untouched; the global is offered only once approved';
}

const PURE_GROUPS = [checkResolver, checkAppMerge, checkRuntimeInputs, checkPromotionNewId];

// ─── Layer 2: hydrate (real persistence.ts) ───────────────────────────────────
const HYDRATE_STUBS = {
  'src/supabase/client.ts': () => 'export function getSupabaseClient() { return globalThis.__pvD8.client; }',
  'src/auth/index.ts': () => 'export async function tryGetAuthenticatedUserId() { return globalThis.__pvD8.userId; }',
  'src/vault/crypto.ts': () =>
    'export async function encryptCredentialSet(_key, cred) { return { ciphertext: Buffer.from(JSON.stringify(cred)).toString("base64"), iv: "iv", fieldIdsPresent: Object.keys(cred) }; }\n' +
    'export async function decryptCredentialSetWithKeys(_keys, c) { try { return JSON.parse(Buffer.from(c, "base64").toString()); } catch { return null; } }',
  'src/dev/devMode.ts': () => 'export const isDevBuild = () => false;',
  'src/serviceManagement/serviceSelection.ts': () => 'export const CLOUD_REMOVE_UNAVAILABLE_MESSAGE = "cloud remove unavailable";',
};

class Query {
  constructor(db, table) {
    Object.assign(this, { db, table, filters: [] });
  }
  select() {
    return this;
  }
  eq(k, v) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  in(k, vs) {
    this.filters.push((r) => vs.includes(r[k]));
    return this;
  }
  order() {
    return this;
  }
  then(resolve, reject) {
    return Promise.resolve()
      .then(() => {
        this.db.log.push(this.table);
        return { data: clone(this.db[this.table].filter((r) => this.filters.every((f) => f(r)))), error: null };
      })
      .then(resolve, reject);
  }
}
const fakeClient = (db) => ({
  from: (table) => {
    if (!(table in db)) throw new Error(`fixture: unexpected table ${table}`);
    return new Query(db, table);
  },
  rpc: async () => ({ data: null, error: { message: 'registry presence unavailable in the fake' } }),
});

async function loadHydrate(overrides) {
  const dir = makeTempDir('pv-123d8-hydrate-');
  try {
    const used = new Set();
    const o = Object.fromEntries(Object.entries(tsOverrides(overrides)).filter(([rel]) => rel.endsWith('.ts')));
    await build({
      ...COMMON_BUILD,
      stdin: { contents: "export { hydrateWorkspaceFromCloud } from './src/supabase/persistence.ts';", resolveDir: root, loader: 'ts', sourcefile: 'hydrate.ts' },
      outfile: join(dir, 'hydrate.mjs'),
      format: 'esm',
      platform: 'node',
      plugins: [seamsPlugin(o, used, HYDRATE_STUBS)],
    });
    assert(used.size === Object.keys(o).length, `fixture: every hydrate override loaded (${used.size}/${Object.keys(o).length})`);
    return await import(pathToFileURL(join(dir, 'hydrate.mjs')).href);
  } finally {
    removeTempDir(dir);
  }
}

function makeDb(customRows, selectedIds) {
  return {
    user_services: selectedIds.map((serviceId, i) => ({ id: `us-${serviceId}`, user_id: USER, service_id: serviceId, sort_order: i })),
    access_profiles: [],
    encrypted_credentials: [],
    service_registry: clone(customRows),
    log: [],
  };
}

async function hydrate(mod, local, customRows) {
  const db = makeDb(customRows, local.selectedIds);
  globalThis.__pvD8 = { userId: USER, client: fakeClient(db) };
  const result = await mod.hydrateWorkspaceFromCloud(USER, [{ fake: 'key' }], clone(local));
  assert(db.log.includes('service_registry'), 'fixture: hydrate read the owned registry rows');
  return result;
}

async function checkHydrate(mod, pure) {
  const { copies, rows } = scenario(pure);
  const def = (row) => pure.registryRowToServiceDefinition(row);
  const profiles = [prof('p-np', 'own-np', 'ראשי'), prof('p-ap', 'own-ap', 'ראשי'), prof('p-lost', 'own-lost', 'ראשי')];
  const credentials = { 'p-np': cred('np'), 'p-ap': cred('ap'), 'p-lost': cred('lost') };
  const incompleteCopy = vaultCopy('own-incomplete', 'אתר שלם', 'incomplete.example.test');
  const local = {
    selectedIds: ['own-np', 'own-ap', 'own-lost', 'own-bad', 'own-incomplete'],
    customServices: [copies.np, copies.ap, copies.lost, vaultCopy('own-bad', 'שורה פגומה', 'bad.example.test'), incompleteCopy],
    accessProfiles: profiles,
    credentials,
  };
  const badRow = { ...adminRow('own-bad', { name: 'x', host: 'bad.example.test', fields: NEW_FIELDS, metadata: META.approved }), display_name: null };
  const newRow = adminRow('own-new', { name: 'אתר ממכשיר אחר', host: 'new.example.test', fields: null, metadata: {} });
  // KI-5: approved but incomplete (no category / no icon).
  const incompleteRow = { ...adminRow('own-incomplete', { name: 'מאושר ללא קטגוריה', host: 'incomplete-admin.example.test', fields: NEW_FIELDS, metadata: META.approved }), category_id: null };
  const noIconNewRow = { ...adminRow('own-new-noicon', { name: 'חדש ללא סמל', host: 'new-noicon.example.test', fields: NEW_FIELDS, metadata: META.approved }), icon: null };
  assert(pure.isApprovedForUsers(def(incompleteRow)) && !pure.ownSiteFollowsRegistry(def(incompleteRow)) && !pure.ownSiteFollowsRegistry(def(noIconNewRow)), 'fixture: KI-5 rows are approved but incomplete');
  const out = await hydrate(mod, local, [rows.np, rows.ap, rows.lost, badRow, newRow, incompleteRow, noIconNewRow]);
  const byId = new Map(out.customServices.map((d) => [d.id, d]));
  assert(same(byId.get('own-incomplete'), incompleteCopy), 'KI-5 hydrate: an approved but incomplete row never replaces the vault copy');
  assert(same(byId.get('own-new-noicon'), def(noIconNewRow)), 'KI-5 hydrate: a row with no local copy is still added (today)');
  assert(same(byId.get('own-np'), copies.np), 'D-123-8 hydrate: not approved after an admin edit → the vault copy stays unchanged');
  assert(same(byId.get('own-ap'), def(rows.ap)), 'D-123-8 hydrate: approved → the vault copy is refreshed from the registry');
  assert(same(byId.get('own-lost'), copies.lost), 'D-123-8 hydrate: approval lost → the vault copy (last approved) stays');
  assert(same(byId.get('own-bad'), local.customServices[3]), 'D-123-8 hydrate: unreadable row → the vault copy stays');
  assert(same(byId.get('own-new'), def(newRow)), 'D-123-8 hydrate: an own row with no local copy is still added (today)');
  assert(same(out.credentials, credentials), 'D-123-8 hydrate: stored credential values untouched (other-id values still in the vault)');
  assert(same(out.accessProfiles.map((p) => p.id).sort(), ['p-ap', 'p-lost', 'p-np']), 'D-123-8 hydrate: profiles untouched');

  // Sequence: created (v0) → approved (v1) → admin re-edit loses approval (v2) → owner keeps v1.
  const v0 = vaultCopy('own-seq', 'גרסה מקורית', 'seq-v0.example.test');
  const v1Row = adminRow('own-seq', { name: 'גרסה מאושרת', host: 'seq-v1.example.test', fields: NEW_FIELDS, metadata: META.approved });
  const v2Row = adminRow('own-seq', { name: 'עריכה שלא אושרה', host: 'seq-v2.example.test', fields: [F.email, F.pin], metadata: META.lost });
  let state = { selectedIds: ['own-seq'], customServices: [v0], accessProfiles: [prof('p-seq', 'own-seq', 'ראשי')], credentials: { 'p-seq': cred('seq') } };
  state = await hydrate(mod, state, [v1Row]);
  assert(same(state.customServices[0], def(v1Row)), 'D-123-8 sequence: approval refreshes the vault copy to v1');
  state = await hydrate(mod, state, [v2Row]);
  const kept = state.customServices[0];
  assert(kept.displayName !== 'עריכה שלא אושרה', 'D-123-8 sequence: approval lost never shows the newer unapproved edits');
  assert(kept.displayName !== 'גרסה מקורית', 'D-123-8 sequence: approval lost never flips back to the original');
  assert(same(kept, def(v1Row)), 'D-123-8 sequence: approval lost → the last approved version (v1)');
  const { definitions } = pure.mergeCustomDefinitions(state.customServices, [def(v2Row)]);
  assert(same(definitions[0], def(v1Row)), 'D-123-8 sequence: App merge shows v1 while v2 is not approved');
  assert(same(state.credentials, { 'p-seq': cred('seq') }), 'D-123-8 sequence: stored values untouched');
  return 'D-123-8 hydrate (real persistence.ts): not approved / approval lost / unreadable → copy kept; approved → refreshed; no-copy row added; credentials + profiles untouched; v0 → v1 → v2 keeps v1';
}

// ─── Layer 3: static ──────────────────────────────────────────────────────────
const D8_IMPORT = "import { ownSiteFollowsRegistry } from '../digitalHome/ownSiteDefinition';\n";
const D8_HYDRATE_BLOCK = [
  '        // D-123-8 / KI-5: the vault copy is the last version the owner may see — replaced only by',
  '        // an approved, complete row; a row with no local copy is still added.',
  '        if (customById.has(definition.id) && !ownSiteFollowsRegistry(definition)) {',
  '          continue;',
  '        }',
  '',
].join('\n');
// KI-5 (123.3 Item 0a): the block as accepted in the D-123-8 round (WIP commit 0dfb9de7). The KI-5
// change swaps only the predicate (shared helper) and the comment inside the block, and the import.
const KI5_BASE = '0dfb9de70f50933b86b3b140c13bda28c8af523a';
const D8_ACCEPTED_IMPORT = "import { isApprovedForUsers } from '../digitalHome/ownSiteDefinition';\n";
const D8_ACCEPTED_BLOCK = [
  '        // D-123-8: the vault copy is the last version the owner may see — replaced only by an',
  '        // approved row; a row with no local copy is still added.',
  '        if (customById.has(definition.id) && !isApprovedForUsers(definition)) {',
  '          continue;',
  '        }',
  '',
].join('\n');

// KI-3 (123.3 ruling): the refresh drops apps this session saw in the cloud when the cloud is
// empty. These are the only KI-3 edits in persistence.ts / sessionSyncScope.ts; undone exactly
// (each once) before the D-123-8 / KI-5 identity checks below.
const KI3_PERSISTENCE = [
  ['  markProfileSynced,\n  noteCloudServicesRead,\n', '  markProfileSynced,\n'],
  ['  rebaseSessionSyncScope,\n  servicesSeenInCloud,\n', '  rebaseSessionSyncScope,\n'],
  ["import { applyOutboxAfterHydrate, dropGoneFromVault } from '../digitalHome/cloudReconcile';", "import { applyOutboxAfterHydrate } from '../digitalHome/cloudReconcile';"],
  ['  const seenInCloud = servicesSeenInCloud(userId);\n  noteCloudServicesRead(userId, cloud.serviceIds);\n', ''],
  [[
    '    // D-109-25: an empty cloud does not empty-win over a populated local Home — except apps this',
    '    // session saw in the cloud at its last successful read: they were removed elsewhere (KI-3).',
    '    const gone = knownServices.filter((id) => seenInCloud.has(id.trim()));',
    '    if (gone.length === 0) {',
    '      return null;',
    '    }',
    '    return dropGoneFromVault(current, { goneServiceIds: gone, goneProfileIds: [] });',
  ].join('\n'), '    // D-109-25: an empty cloud does not empty-win over a populated local Home.\n    return null;'],
];
const KI3_SCOPE = [
  ["  credentialRefs: Map<string, Credential | undefined>;\n  /** KI-3 — app memberships in the cloud at this session's last successful read. */\n  cloudServiceIds: Set<string>;\n", '  credentialRefs: Map<string, Credential | undefined>;\n'],
  ['    credentialRefs: new Map(state.accessProfiles.map((p) => [p.id, state.credentials[p.id]])),\n    cloudServiceIds: new Set(),\n', '    credentialRefs: new Map(state.accessProfiles.map((p) => [p.id, state.credentials[p.id]])),\n'],
  ['  scope = {\n    userId: userId.trim(),\n    profileSnapshots,\n    credentialRefs,\n    cloudServiceIds: new Set([...cloud.serviceIds].map((id) => id.trim())),\n  };\n', '  scope = { userId: userId.trim(), profileSnapshots, credentialRefs };\n'],
  [[
    '',
    '/** KI-3 — apps this session saw in the cloud at its last successful read (login / refresh). */',
    'export function servicesSeenInCloud(userId: string): Set<string> {',
    '  return new Set(scopeFor(userId)?.cloudServiceIds ?? []);',
    '}',
    '',
    '/** KI-3 — a successful cloud read replaces what this session has seen. */',
    'export function noteCloudServicesRead(userId: string, serviceIds: Set<string>): void {',
    '  const current = scopeFor(userId);',
    '  if (!current) return;',
    '  current.cloudServiceIds = new Set([...serviceIds].map((id) => id.trim()));',
    '}',
    '',
  ].join('\n'), ''],
  ['    credentialRefs: new Map(),\n    cloudServiceIds: previous.cloudServiceIds,\n', '    credentialRefs: new Map(),\n'],
];
function withoutKi3(src, edits, rel) {
  let out = src;
  for (const [now, before] of edits) {
    assert(out.split(now).length === 2, `KI-3: ${rel} has each KI-3 edit exactly once (${now.trim().split('\n')[0].slice(0, 60)})`);
    out = out.replace(now, before);
  }
  return out;
}

function checkKi5SharedPredicate(overrides) {
  const now = withoutKi3(source(overrides, PERSISTENCE), KI3_PERSISTENCE, PERSISTENCE);
  const ki5Base = git('show', `${KI5_BASE}:${PERSISTENCE}`).replace(/\r\n/g, '\n');
  assert(now.replace(D8_IMPORT, D8_ACCEPTED_IMPORT).replace(D8_HYDRATE_BLOCK, D8_ACCEPTED_BLOCK) === ki5Base, `KI-5: persistence.ts identical to ${KI5_BASE.slice(0, 8)} apart from the own-site block predicate / comment and its import`);
  const own = source(overrides, OWN_SITE);
  const helper = own.slice(own.indexOf('export function ownSiteFollowsRegistry('), own.indexOf('export function resolveOwnSiteDefinition('));
  assert(/return Boolean\(entry\?\.category && entry\.icon\) && isApprovedForUsers\(entry\);/.test(helper), 'KI-5: ownSiteFollowsRegistry = complete (category + icon) AND approved');
  const resolver = own.slice(own.indexOf('export function resolveOwnSiteDefinition('), own.indexOf('export function hiddenCredentialFieldIds('));
  assert(/if \(registryEntry && ownSiteFollowsRegistry\(registryEntry\)\) \{/.test(resolver) && !/isApprovedForUsers|\.category|\.icon/.test(resolver), 'KI-5: the resolver decides only through the shared ownSiteFollowsRegistry');
  assert(D8_HYDRATE_BLOCK.includes('!ownSiteFollowsRegistry(definition)') && now.includes(D8_HYDRATE_BLOCK), 'KI-5: the hydrate block decides through the same shared helper');
  return `KI-5: one shared predicate (approved + category + icon) for the resolver and the hydrate block; persistence.ts vs ${KI5_BASE.slice(0, 8)} = that block + import only`;
}

function checkHydrateScope(overrides) {
  const now = withoutKi3(source(overrides, PERSISTENCE), KI3_PERSISTENCE, PERSISTENCE);
  assert(now.split(D8_IMPORT).length === 2 && now.split(D8_HYDRATE_BLOCK).length === 2, 'N-2: persistence.ts has the D-123-8 import and own-site block exactly once');
  const hydrateNow = topLevelFunction(now, 'hydrateWorkspaceFromCloud') ?? '';
  assert(hydrateNow.includes(D8_HYDRATE_BLOCK), 'N-2: the D-123-8 block sits inside hydrateWorkspaceFromCloud');
  assert(hydrateNow.indexOf(D8_HYDRATE_BLOCK) > hydrateNow.indexOf("for (const row of (customRows ?? []) as ServiceRegistryRow[])"), 'N-2: the block is in the own-site (customRows) merge');
  assert(now.replace(D8_IMPORT, '').replace(D8_HYDRATE_BLOCK, '') === baseSource(PERSISTENCE), `N-2: persistence.ts identical to ${BASE.slice(0, 8)} apart from the D-123-8 import + own-site block`);
  // Superseded by the KI-3 ruling (was: sessionSyncScope.ts unchanged): only the KI-3 edits.
  const scopeRel = 'src/supabase/sessionSyncScope.ts';
  assert(withoutKi3(source(overrides, scopeRel), KI3_SCOPE, scopeRel) === baseSource(scopeRel), `N-2: ${scopeRel} identical to ${BASE.slice(0, 8)} apart from the KI-3 seen-in-cloud set`);
  const others = ['src/vault/crypto.ts', 'src/vault/vault.ts', 'src/supabase/registryPersistence.ts', 'src/registry/registryMapper.ts', 'src/digitalHome/cloudReconcile.ts', 'supabase'];
  for (const rel of others) assert(git('diff', '--name-only', BASE, '--', rel).trim() === '' && git('ls-files', '--others', '--exclude-standard', '--', rel).trim() === '', `N-2: ${rel} unchanged vs ${BASE.slice(0, 8)}`);
  const admin = git('diff', '--name-only', BASE, '--', 'src/admin').split('\n').filter(Boolean);
  assert(admin.every((p) => p === 'src/admin/ApprovalQueue.tsx'), `N-2: src/admin unchanged apart from the D-123-6 line (${admin.join(', ')})`);
  return `N-2: persistence.ts vs ${BASE.slice(0, 8)} = D-123-8 import + own-site block (+ KI-3 refresh rule) only; sync scope = KI-3 set only; crypto / vault / registry / mapper / reconcile / supabase / src/admin unchanged`;
}

function checkAppRule(overrides) {
  const app = source(overrides, APP);
  const merge = topLevelFunction(app, 'mergeCustomDefinitions') ?? '';
  assert(/resolveOwnSiteDefinition\(vaultCopy, catalogById\.get\(vaultCopy\.id\)\)/.test(merge), 'D-123-8: App merge resolves each vault copy through resolveOwnSiteDefinition');
  assert(!/loginFields|loginUrl|metadata/.test(merge), 'D-123-8: App merge never mixes registry login fields / URL / metadata into a vault copy');
  assert(/builtinDefinitions\.filter\(\(definition\) => !customServiceIds\.has\(definition\.id\.trim\(\)\)\)/.test(app), 'D-123-8: a global promoted in place is represented by its resolved own entry (no duplicate builtin)');
  assert(/approvedOwnSiteIds=\{ownSites\.approvedOwnIds\}/.test(app), 'D-123-8: App passes the approved own ids to Dashboard');
  assert(/ownSiteApproved=\{approvedOwnSiteIds\?\.has\(assistance\.service\.id\) \?\? false\}/.test(source(overrides, DASHBOARD)), 'D-123-8: Dashboard passes ownSiteApproved for the open app');
  const fn = (s) => {
    const start = s.indexOf('  async function updateCustomService(');
    return start < 0 ? null : s.slice(start, s.indexOf('\n  }\n', start) + 4);
  };
  assert(fn(app) && fn(app) === fn(baseSource(APP)), 'D-123-8: the Owner edit («עריכת פרטי האתר», updateCustomService) is unchanged');
  return 'D-123-8 static: App merge rule; promoted-in-place dedupe; Dashboard wiring; Owner edit unchanged';
}

function checkNoBranchesNoWrites(overrides) {
  const own = source(overrides, OWN_SITE);
  assert(!/persistVault|supabase|getSupabase|indexedDB|setVaultState|\.rpc\(|credential\[[^\]]+\]\s*=|delete\s+credential/.test(own), 'D-123-8: ownSiteDefinition reads only (no writes)');
  const app = source(overrides, APP);
  const scanned = {
    [OWN_SITE]: own,
    'App mergeCustomDefinitions': topLevelFunction(app, 'mergeCustomDefinitions') ?? '',
    [PANEL]: source(overrides, PANEL),
    [DASHBOARD]: source(overrides, DASHBOARD),
  };
  for (const [name, src] of Object.entries(scanned)) {
    const code = src.replace(/^\s*(\/\/|\*).*$/gm, '').replace(/typeof [\w.]+ === '\w+'/g, '');
    assert(!/(service\.id|serviceId|\.id)\s*[!=]==?\s*['"`]|hostname\s*[!=]==?|own-(np|ap|same|lost|seq|promo)|glob-/.test(code), `N-5: no site / hostname / serviceId branch in ${name}`);
  }
  const messages = source(overrides, 'src/loginAssistance/messages.ts');
  assert(messages.includes(`export const MSG_LOGIN_FIELDS_UPDATED = '${MSG_FIELDS_UPDATED}';`), 'D-123-8: Hebrew notice copy exact');
  for (const rel of [OWN_SITE, PANEL, DASHBOARD]) {
    assert(!/window\.(confirm|alert|prompt)\s*\(|(^|[^.\w])(confirm|alert|prompt)\s*\(/m.test(source(overrides, rel)), `N-4: no browser dialog in ${rel}`);
  }
  return 'D-123-8 static: resolver reads only; no site / hostname / serviceId branches; Hebrew copy exact; no browser dialogs';
}

const STATIC_GROUPS = [checkHydrateScope, checkKi5SharedPredicate, checkAppRule, checkNoBranchesNoWrites];

// ─── Layer 4: browser ─────────────────────────────────────────────────────────
function persistenceStub() {
  const lines = ['let gen = 0;'];
  for (const m of read(PERSISTENCE).matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) {
    const n = m[1];
    const impl = { bumpDualWriteGeneration: '() => ++gen', getDualWriteGeneration: '() => gen', hasGoneRows: '() => false', setCloudGoneListener: '() => {}', setCloudConfirmedListener: '() => {}' }[n];
    lines.push(`export const ${n} = ${impl ?? 'async () => null'};`);
  }
  return lines.join('\n');
}
const BROWSER_STUBS = {
  [PERSISTENCE]: persistenceStub,
  'src/useServiceLogos.ts': () => 'export function useServiceLogos() { return {}; }\nexport default useServiceLogos;',
};

function browserFixture(mod) {
  const { copies, catalog } = scenario(mod);
  const vault = [copies.np, copies.ap, copies.same];
  const { definitions, approvedOwnIds } = mod.mergeCustomDefinitions(vault, catalog);
  const ownIds = new Set(vault.map((d) => d.id));
  const globals = catalog.filter((d) => d.id === 'glob-fields');
  const services = [...definitions.filter((d) => ownIds.has(d.id)), ...globals].map((d) => mod.definitionToLegacyService(d));
  return {
    services,
    customIds: [...ownIds],
    approvedIds: [...approvedOwnIds],
    state: {
      selectedIds: services.map((s) => s.id),
      accessProfiles: [prof('p-np', 'own-np', 'ראשי'), prof('p-ap', 'own-ap', 'ראשי'), prof('p-same', 'own-same', 'ראשי'), prof('p-g', 'glob-fields', 'ראשי')],
      credentials: { 'p-np': cred('np'), 'p-ap': cred('ap'), 'p-same': cred('same'), 'p-g': cred('g') },
    },
  };
}

const harnessEntry = (fixture) => `
import { createRoot } from 'react-dom/client';
import Dashboard from './src/Dashboard';
import './src/index.css';
import './src/App.css';
const FIX = ${JSON.stringify(fixture)};
window.__pvRequests = [];
createRoot(document.getElementById('root')).render(
  <Dashboard
    services={FIX.services}
    credentialsByProfileId={FIX.state.credentials}
    accessProfiles={FIX.state.accessProfiles}
    resolveProfile={() => ({ kind: 'unavailable' })}
    showMagicMomentHint={false}
    onDismissMagicMomentHint={() => {}}
    onAddMore={() => {}}
    customServiceIds={new Set(FIX.customIds)}
    approvedOwnSiteIds={new Set(FIX.approvedIds)}
    onOpenProfileManagement={(req) => window.__pvRequests.push(req)}
  />,
);
window.__pvReady = true;
`;
const INDEX_HTML = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="harness.css"></head><body><div id="root"></div><script src="harness.js"></script></body></html>';

async function bundleHarness(dir, overrides, fixture) {
  const used = new Set();
  const o = tsOverrides(overrides);
  await build({
    ...COMMON_BUILD,
    stdin: { contents: harnessEntry(fixture), resolveDir: root, loader: 'tsx', sourcefile: 'harness.tsx' },
    outfile: join(dir, 'harness.js'),
    format: 'iife',
    platform: 'browser',
    plugins: [seamsPlugin(o, used, BROWSER_STUBS)],
  });
  const expected = Object.keys(o).filter((rel) => rel !== PERSISTENCE);
  assert(used.size >= expected.length, `fixture: every browser override loaded (${used.size}/${expected.length})`);
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

let browser = null;
async function checkBrowser(url, fixture) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' });
  try {
    const page = await context.newPage();
    const errors = [];
    const native = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('dialog', async (d) => {
      native.push(d.type());
      await d.dismiss();
    });
    await page.goto(url);
    await page.waitForFunction(() => window.__pvReady, null, { timeout: 30000 });
    await page.waitForSelector('[data-service-tile]', { timeout: 10000 });
    assert((await page.evaluate(() => document.documentElement.dir)) === 'rtl', 'Hebrew RTL document');
    const panel = page.locator('section[data-login-assistance]');
    const name = (id) => fixture.services.find((s) => s.id === id).name;
    async function open(id) {
      await page.click(`[data-service-id="${id}"] button.app-icon`);
      await panel.waitFor({ state: 'visible', timeout: 5000 });
      assert((await panel.textContent()).includes(name(id)), `window shows the resolved name for ${id}`);
    }
    async function close() {
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'detached', timeout: 5000 });
    }
    const notice = () => panel.locator('[data-notice="login-fields-updated"]');
    const field = (id) => panel.locator(`[data-field-id="${id}"] input`);
    const fieldIds = async () => panel.locator('[data-field-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-field-id')));
    const filled = async (id) => (await field(id).inputValue()) !== '';
    const matches = async (id, expected) => (await field(id).inputValue()) === expected;

    // Not approved after an admin edit: the vault copy everywhere, stored values shown, no notice.
    await open('own-np');
    assert(same(await fieldIds(), ['username', 'password']), 'D-123-8 not approved: window fields = vault copy');
    assert((await matches('username', cred('np').username)) && (await matches('password', cred('np').password)), 'D-123-8 not approved: stored values shown');
    assert((await notice().count()) === 0, 'D-123-8 not approved: no notice');
    assert(!(await panel.textContent()).includes('שם חדש מהמנהל'), 'D-123-8 not approved: the unapproved admin name is not shown');
    await close();

    // Approved with changed fields: same-id values shown, notice + «עריכת פרופיל».
    await open('own-ap');
    assert(same(await fieldIds(), ['email', 'password']), 'D-123-8 approved: window fields = registry fields');
    assert(await matches('password', cred('ap').password), 'D-123-8 approved: the same-field-id value is shown');
    assert(!(await filled('email')), 'D-123-8 approved: a new field id shows no value (display keyed by field id, not position / label)');
    assert((await notice().count()) === 1, 'D-123-8 approved with changed fields: notice shown');
    assert((await notice().textContent()).includes(MSG_FIELDS_UPDATED), 'D-123-8: notice copy (Hebrew)');
    assert((await notice().evaluate((el) => getComputedStyle(el).direction)) === 'rtl', 'D-123-8: notice is RTL');
    assert((await panel.locator('[data-action="edit-profile"]').count()) === 1, 'D-123-8: exactly one «עריכת פרופיל» in the window');
    const edit = notice().locator('[data-action="edit-profile"]');
    assert((await edit.textContent()) === LABEL_EDIT_PROFILE, 'D-123-8: notice action «עריכת פרופיל»');
    await edit.click();
    const reqs = await page.evaluate(() => window.__pvRequests.slice());
    assert(reqs.length === 1 && reqs[0].serviceId === 'own-ap' && reqs[0].profileId === 'p-ap' && reqs[0].mode === 'edit', 'D-123-8: «עריכת פרופיל» opens the profile host on the active profile');
    await page.evaluate(() => { window.__pvRequests.length = 0; });
    if (await panel.count()) await close();

    // Approved, nothing hidden: no notice.
    await open('own-same');
    assert((await matches('username', cred('same').username)) && (await notice().count()) === 0, 'D-123-8 approved with nothing hidden: values shown, no notice');
    assert((await panel.locator('[data-action="edit-profile"]').count()) === 1, 'D-123-8: the bar keeps its «עריכת פרופיל» when no notice');
    await close();

    // Global site whose fields changed: today's behaviour, no notice.
    await open('glob-fields');
    assert(same(await fieldIds(), ['email', 'password']), 'D-123-8 global: admin fields apply immediately (today)');
    assert((await notice().count()) === 0, 'D-123-8 global: no notice');
    await close();

    assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
    assert(native.length === 0, `N-4: native browser dialog shown: ${native.join(', ')}`);
    return 'browser (Edge, real Dashboard + floating window): not approved → vault copy + stored values, no notice; approved with changed fields → same-id values + notice + «עריכת פרופיל»; nothing hidden / global → no notice; RTL; no browser dialogs';
  } finally {
    await withTimeout(() => context.close(), 10_000, checkTimeoutMessage('browser context close'));
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────
const LAYER_TIMEOUT_MS = 90_000;
const MUTATION_TIMEOUT_MS = 240_000;

async function runAll(overrides, print) {
  const results = [];
  const pure = await withTimeout(() => loadPure(overrides), LAYER_TIMEOUT_MS, checkTimeoutMessage('loadPure'));
  for (const check of PURE_GROUPS) results.push(check(pure));
  const hydrateMod = await withTimeout(() => loadHydrate(overrides), LAYER_TIMEOUT_MS, checkTimeoutMessage('loadHydrate'));
  results.push(await withTimeout(() => checkHydrate(hydrateMod, pure), LAYER_TIMEOUT_MS, checkTimeoutMessage('checkHydrate')));
  for (const check of STATIC_GROUPS) results.push(check(overrides));
  const fixture = browserFixture(pure);
  const dir = makeTempDir('pv-123d8-web-');
  let server = null;
  try {
    await withTimeout(() => bundleHarness(dir, overrides, fixture), LAYER_TIMEOUT_MS, checkTimeoutMessage('bundleHarness'));
    server = await serve(dir);
    results.push(await withTimeout(() => checkBrowser(server.url, fixture), LAYER_TIMEOUT_MS, checkTimeoutMessage('checkBrowser')));
  } finally {
    if (server) await server.close();
    removeTempDir(dir);
  }
  if (print) for (const line of results) console.log(`  ✓ ${line}`);
  return results;
}

const m = (label, rel, from, to) => [label, rel, from, to];
const MUTATIONS = [
  m('M1 registry definition used while not approved', OWN_SITE, '  return Boolean(entry?.category && entry.icon) && isApprovedForUsers(entry);', '  return Boolean(entry?.category && entry.icon);'),
  m('M17 approved entry without category used (tile render crash)', OWN_SITE, '  return Boolean(entry?.category && entry.icon) && isApprovedForUsers(entry);', '  return isApprovedForUsers(entry);'),
  m('M2 vault copy not refreshed while approved (hydrate skips approved rows)', PERSISTENCE, '        if (customById.has(definition.id) && !ownSiteFollowsRegistry(definition)) {', '        if (customById.has(definition.id)) {'),
  m('M3 registry not applied while approved', OWN_SITE, '    return { definition: registryEntry, approved: true };', '    return { definition: vaultCopy, approved: true };'),
  m('M4 approval lost shows the newer unapproved edits', OWN_SITE, "=== 'approved';", "!== 'no_mapping';"),
  m('M5 approval lost flips back to the original (approved refresh never stored)', PERSISTENCE, '        customById.set(definition.id, definition);\n      } catch {', '        customById.set(definition.id, customById.get(definition.id) ?? definition);\n      } catch {'),
  m('M6 unknown approval uses the registry', OWN_SITE, '  } catch {\n    return false;\n  }', '  } catch {\n    return true;\n  }'),
  m('M7 hydrate change outside the own-site merge', PERSISTENCE, '      selectedFromCloud.length === 0 && local.selectedIds.length > 0;', '      selectedFromCloud.length === 0 && local.selectedIds.length >= 0;'),
  m('M8 notice on a global site', PANEL, '    isCustom &&\n    ownSiteApproved &&\n', '    (isCustom ? ownSiteApproved : true) &&\n'),
  m(
    'M9 missing-id values deleted on approval',
    PERSISTENCE,
    '        customById.set(definition.id, definition);\n      } catch {',
    '        customById.set(definition.id, definition);\n' +
      '        for (const p of local.accessProfiles) { const c = credentials[p.id]; if (p.serviceId === definition.id && c) credentials[p.id] = Object.fromEntries(Object.entries(c).filter(([k]) => (definition.loginFields ?? []).some((f) => f.id === k))); }\n' +
      '      } catch {',
  ),
  m('M10 display keyed by position', PANEL, "          const value = activeCredential[field.id] ?? '';", "          const value = Object.values(activeCredential)[loginFields.indexOf(field)] ?? '';"),
  m('M11 display keyed by label', PANEL, "          const value = activeCredential[field.id] ?? '';", "          const value = activeCredential[field.label] ?? '';"),
  m('M12 notice missing after approval with changed fields', DASHBOARD, 'ownSiteApproved={approvedOwnSiteIds?.has(assistance.service.id) ?? false}', 'ownSiteApproved={false}'),
  m(
    'M13 registry login fields in the App catalog merge for a non-approved own site',
    APP,
    '    byId.set(vaultCopy.id, resolved.definition);',
    '    byId.set(vaultCopy.id, resolved.approved ? resolved.definition : { ...resolved.definition, loginFields: catalogById.get(vaultCopy.id)?.loginFields ?? resolved.definition.loginFields });',
  ),
  m('M14 App merge does not report approved own ids', APP, '      approvedOwnIds.add(vaultCopy.id);\n', ''),
  m('M15 hydrate drops a new own row that has no local copy', PERSISTENCE, '        if (customById.has(definition.id) && !ownSiteFollowsRegistry(definition)) {', '        if (!ownSiteFollowsRegistry(definition)) {'),
  m(
    'M18 KI-5 approved but incomplete row replaces the copy at hydrate',
    PERSISTENCE,
    '        if (customById.has(definition.id) && !ownSiteFollowsRegistry(definition)) {',
    "        if (customById.has(definition.id) && !ownSiteFollowsRegistry({ ...definition, category: definition.category ?? 'x', icon: definition.icon ?? 'x' })) {",
  ),
  m('M19 KI-5 resolver and hydrate use different predicates (helper not shared)', OWN_SITE, '  if (registryEntry && ownSiteFollowsRegistry(registryEntry)) {', '  if (registryEntry?.category && isApprovedForUsers(registryEntry)) {'),
  m('M20 KI-5 hydrate change outside the own-site block', PERSISTENCE, '    const credentials: Record<string, Credential> = { ...local.credentials };', '    const credentials: Record<string, Credential> = {};'),
  m('M16 promoted-in-place global listed twice', APP, 'builtinDefinitions.filter((definition) => !customServiceIds.has(definition.id.trim()))', 'builtinDefinitions.filter(() => true)'),
];

console.log('Phase 123 — fix round D-123-8 (own custom sites follow approval)\n');
browser = await chromium.launch({ channel: 'msedge' });
const closeBrowser = () => browser.close();
try {
  const results = await runAll({}, true);
  const selected = selectMutations(MUTATIONS, MUTATION_ARGS, (x) => x[0]);
  if (selected.length) console.log(MUTATION_ARGS.mode === 'all' ? '\nMutations (full sweep)' : `\nMutations (selected: ${[...MUTATION_ARGS.ids].join(', ')})`);
  let caught = 0;
  for (const [label, rel, from, to] of selected) {
    const id = mutationId(label);
    const overrides = { [rel]: replaceOnce(read(rel), from, to, label) };
    let error = null;
    try {
      await withTimeout(() => runAll(overrides, false), MUTATION_TIMEOUT_MS, mutationTimeoutMessage(id, MUTATION_TIMEOUT_MS));
    } catch (e) {
      if (isTimeout(e)) await failRun(`${e.message} (${label})`, closeBrowser);
      error = e instanceof Error ? e.message.split('\n')[0] : String(e);
    }
    assert(error, `mutation NOT caught: ${label}`);
    assert(!error.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${error})`);
    caught += 1;
    console.log(`  ✓ mutation caught: ${label} — ${error.slice(0, 160)}`);
  }
  const suffix = MUTATION_ARGS.mode === 'none' ? 'mutations skipped (--no-mutations)' : `${caught} ${MUTATION_ARGS.mode === 'ids' ? 'selected ' : ''}mutations caught`;
  console.log(`\nPASS — Phase 123 fix round D-123-8: ${results.length} check groups, ${suffix} — ${formatElapsed(Date.now() - STARTED)}`);
} catch (e) {
  await failRun(e instanceof Error ? e.message : String(e), closeBrowser);
}
await withTimeout(closeBrowser, 10_000, 'browser close timed out').catch(() => undefined);
process.exit(0);
