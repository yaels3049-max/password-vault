/**
 * Phase 121 D-121-65 (arch-phase121.md "Maccabi M3" / "D-121-65") — a service-details save never
 * re-writes the STANDARD mapping.
 * Runs the real service-form save code (sliced from RegistryAdmin.tsx handleSave and transpiled)
 * against the real adminRegistryApi (create / global update / user-owned update, incl. the
 * unchanged autofill merge) on an in-memory Supabase fake.
 * - Global edit of a service with a saved STANDARD profile: add a required «סיסמה» → saved;
 *   autofillProfile byte-identical; no autofill control keys persisted; metadata_version bumped;
 *   name / URLs / entry type / status saved. Users fail closed (required field unmapped).
 * - User-owned edit keeps the stored profile even when the form holds a stale copy.
 * - Create unchanged (receives the full builder metadata).
 * - STANDARD grid save with an unmapped required field is still refused.
 * Usage: node scripts/verifyPhase121ServiceFormSave.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, transform } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const assertIncludes = (hay, needle, message) => assert(hay.includes(needle), message);
function replaceOnce(src, from, to, id) {
  const at = src.indexOf(from);
  if (at < 0 || src.indexOf(from, at + from.length) >= 0) {
    throw new Error(`fixture: mutation anchor not found exactly once: ${id}`);
  }
  return src.slice(0, at) + to + src.slice(at + from.length);
}

// ─── In-memory Supabase fake (service_registry only) ─────────────────────────
const db = { rows: new Map(), writes: [] };
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
class FakeQuery {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.op = 'select';
    this.payload = null;
  }
  select() { return this; }
  order() { return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  eq(k, v) { this.filters.push([k, v]); return this; }
  is(k, v) { this.filters.push([k, v]); return this; }
  matches(r) { return this.filters.every(([k, v]) => (r[k] ?? null) === v); }
  exec() {
    const rows = [...db.rows.values()].filter((r) => this.matches(r));
    if (this.op === 'update') {
      for (const r of rows) Object.assign(r, clone(this.payload));
      db.writes.push({ ids: rows.map((r) => r.id), payload: clone(this.payload) });
      return { data: rows.map((r) => ({ id: r.id })), error: rows.length ? null : { message: 'no row matched' } };
    }
    if (this.op === 'insert') {
      db.rows.set(this.payload.id, { owner_user_id: null, metadata_version: 1, ...clone(this.payload) });
      return { data: null, error: null };
    }
    return { data: clone(rows), error: null };
  }
  maybeSingle() { const r = this.exec(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); }
  single() { return this.maybeSingle(); }
  then(res, rej) { return Promise.resolve(this.exec()).then(res, rej); }
}
globalThis.__pvFakeClient = { from: (t) => new FakeQuery(t), rpc: async () => ({ data: null, error: null }) };

const STUBS = {
  'supabase/client': 'export const getSupabaseClient = () => globalThis.__pvFakeClient;',
  'supabase/env': 'export const isSupabaseConfigured = () => true;',
  auth: "export const requireAuthenticatedUserId = async () => 'admin-user';",
  'catalog/customServiceDiscovery': 'export async function discoverLoginForRegistryService() { return { outcome: { status: "failure" }, discovery: null }; }',
  'registry/bulkLoginUrlRefresh': 'export const BULK_REFRESH_CONCURRENCY = 1; export const BULK_REFRESH_INTER_BATCH_DELAY_MS = 0; export async function bulkRefreshLoginUrls() { return {}; }',
  'registry/registryLoader': 'export function clearRegistryCatalogCache() {}',
};
const stubPlugin = {
  name: 'pv-stubs',
  setup(b) {
    b.onResolve({ filter: /^\.\.?\// }, (args) => {
      if (!args.importer.replace(/\\/g, '/').endsWith('src/admin/adminRegistryApi.ts')) return undefined;
      for (const key of Object.keys(STUBS)) {
        if (args.path === `../${key}` || args.path.endsWith(`/${key}`)) return { path: key, namespace: 'pv-stub' };
      }
      return undefined;
    });
    b.onLoad({ filter: /.*/, namespace: 'pv-stub' }, (args) => ({ contents: STUBS[args.path], loader: 'js' }));
  },
};
const overridePlugin = (overrides) => ({
  name: 'pv-override',
  setup(b) {
    b.onLoad({ filter: /\.tsx?$/ }, (args) => {
      const rel = args.path.slice(root.length + 1).replace(/\\/g, '/');
      if (!Object.prototype.hasOwnProperty.call(overrides, rel)) return undefined;
      return { contents: overrides[rel], loader: 'ts' };
    });
  },
});

let buildSeq = 0;
const loadModule = (entry, name, plugins = []) => withTempDir(`pv-121sf-${name}-`, (outdir) => loadModuleIn(outdir, entry, name, plugins));
async function loadModuleIn(outdir, entry, name, plugins) {
  const outfile = join(outdir, `${name}-${(buildSeq += 1)}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: true,
    packages: 'external',
    define: { 'import.meta.env': '{"DEV":false}' },
    logLevel: 'silent',
    plugins,
  });
  return import(pathToFileURL(outfile).href);
}

console.log('Phase 121 D-121-65 — service-details save never re-writes the STANDARD mapping\n');

const FORM_FILE = 'src/admin/RegistryAdmin.tsx';
const SAFE_FILE = 'src/admin/contractSafeMetadata.ts';
const API_FILE = 'src/admin/adminRegistryApi.ts';
const PROFILE_FILE = 'src/autofill/validatedProfile.ts';
const V = await loadModule(PROFILE_FILE, 'profile');
const bar = await loadModule('src/admin/specialActionBar.ts', 'bar');

// ─── Real service-form save code ─────────────────────────────────────────────
async function formSaveFn(formSrc) {
  const start = formSrc.indexOf('    const metadata: Record<string, unknown> = {');
  const endNeedle = '    } finally {\n      setSaving(false);\n    }\n';
  const end = formSrc.indexOf(endNeedle, start);
  assert(start >= 0 && end > start, 'fixture: RegistryAdmin save segment found');
  const segment = formSrc.slice(start, end + endNeedle.length);
  const names = [
    'form', 'entry', 'isCreating', 'selectedRow', 'selectedId', 'publishConfiguration', 'configurationTouched',
    'credentialMode', 'storedFields', 'withoutLoginContractKeys', 'withoutAutofillProfile', 'setSaving', 'setError',
    'setSuccess', 'setIsCreating', 'setSelectedId', 'reload', 'createGlobalRegistryRow', 'updateGlobalRegistryRow',
    'updateUserOwnedRegistryRow',
  ];
  const { code } = await transform(`async function __formSave(__ctx) {\n  const { ${names.join(', ')} } = __ctx;\n${segment}}\n`, { loader: 'ts' });
  return new Function(`${code}\nreturn __formSave;`)();
}

async function makeContext({ formSrc = read(FORM_FILE), safeSrc = read(SAFE_FILE), apiSrc = read(API_FILE), profileSrc = read(PROFILE_FILE) } = {}) {
  const overrides = {};
  if (safeSrc !== read(SAFE_FILE)) overrides[SAFE_FILE] = safeSrc;
  if (apiSrc !== read(API_FILE)) overrides[API_FILE] = apiSrc;
  if (profileSrc !== read(PROFILE_FILE)) overrides[PROFILE_FILE] = profileSrc;
  const api = await loadModule(API_FILE, 'api', [stubPlugin, overridePlugin(overrides)]);
  const safe = await loadModule(SAFE_FILE, 'safe', [overridePlugin(overrides)]);
  return { api, safe, save: await formSaveFn(formSrc), formSrc, safeSrc };
}

// ─── Fixtures (generic host) ─────────────────────────────────────────────────
const ORIGIN = 'https://clinic.example';
const LOGIN_URL = `${ORIGIN}/login`;
const idField = { id: 'idNumber', label: 'ID', type: 'text', required: true };
const passwordField = { id: 'password', label: 'סיסמה', type: 'password', required: true };
function storedProfile() {
  return V.serializeAutofillProfile({
    supportState: 'validated',
    configVersion: 2,
    loginEntryUrl: LOGIN_URL,
    allowedOrigin: ORIGIN,
    fieldMappings: [{ fieldId: 'idNumber', locatorType: 'css', locator: '#idNumber' }],
    validation: { metadataVersion: 2, validatedAt: '2026-09-01T00:00:00.000Z', validatedBy: 'admin', resultSummary: 'managed_readiness_ok' },
  });
}
function seedRow(id, { ownerUserId = null, metadata } = {}) {
  db.rows.set(id, {
    id,
    display_name: 'Clinic',
    primary_url: ORIGIN,
    login_url: LOGIN_URL,
    login_url_status: 'valid',
    category_id: null,
    icon: '🔗',
    adapter_id: null,
    login_fields: [clone(idField)],
    source_type: ownerUserId ? 'user' : 'admin',
    service_status: 'active',
    metadata: clone(metadata ?? { credentialMode: 'credential_fields', loginEntryType: 'direct_url', loginUrlSource: 'admin', autofillProfile: storedProfile() }),
    metadata_version: 1,
    owner_user_id: ownerUserId,
  });
}
const rowOf = (id) => clone(db.rows.get(id));
const bytes = (v) => JSON.stringify(v ?? null);

function formContext(c, row, over = {}) {
  const calls = { error: [], success: [], create: [] };
  const form = {
    id: row?.id,
    display_name: 'Clinic Renamed',
    primary_url: 'https://clinic.example/home',
    login_url: 'https://clinic.example/signin',
    category_id: null,
    icon: '🏥',
    adapter_id: '',
    source_type: row?.source_type ?? 'admin',
    service_status: 'disabled',
    metadata: clone(row?.metadata ?? {}),
    ...(over.form ?? {}),
  };
  const ctx = {
    form,
    entry: { loginEntryType: 'direct_url', loginUrl: form.login_url },
    isCreating: false,
    selectedRow: row,
    selectedId: row?.id ?? null,
    publishConfiguration: true,
    configurationTouched: true,
    credentialMode: 'credential_fields',
    storedFields: [clone(idField), clone(passwordField)],
    withoutLoginContractKeys: c.safe.withoutLoginContractKeys,
    withoutAutofillProfile: c.safe.withoutAutofillProfile,
    setSaving: () => {},
    setError: (m) => calls.error.push(m),
    setSuccess: (m) => calls.success.push(m),
    setIsCreating: () => {},
    setSelectedId: () => {},
    reload: async () => {},
    createGlobalRegistryRow: async (input) => {
      calls.create.push(clone(input));
      return c.api.createGlobalRegistryRow(input);
    },
    updateGlobalRegistryRow: c.api.updateGlobalRegistryRow,
    updateUserOwnedRegistryRow: c.api.updateUserOwnedRegistryRow,
    ...(over.ctx ?? {}),
  };
  return { ctx, calls };
}

// ─── Check groups ────────────────────────────────────────────────────────────
async function checkGlobalAddRequiredField(c) {
  const id = 'global';
  seedRow(id);
  const before = rowOf(id);
  const credentials = { idNumber: '000000018', password: 'x' };
  assert(V.isManagedAutofillEligible({ metadata: before.metadata, loginFields: before.login_fields, credential: credentials }), 'fixture: managed STANDARD autofill eligible before the change');
  // The form may hold autofill control keys (never persisted) next to the profile.
  const { ctx, calls } = formContext(c, before, {
    form: { metadata: { ...clone(before.metadata), autofillProfileAction: 'save', autofillLiveValidationApproved: true, autofillManagedReadinessProbePassed: true } },
  });
  await c.save(ctx);
  const after = rowOf(id);
  assert(calls.error.length === 0 && calls.success[0] === 'האתר עודכן.', `add required «סיסמה» → service save succeeds (errors: ${JSON.stringify(calls.error)})`);
  assert(bytes(after.metadata.autofillProfile) === bytes(before.metadata.autofillProfile), 'autofillProfile byte-identical');
  for (const k of ['autofillProfileAction', 'autofillLiveValidationApproved', 'autofillManagedReadinessProbePassed']) {
    assert(!Object.prototype.hasOwnProperty.call(after.metadata, k), `autofill control key ${k} not persisted`);
  }
  assert(after.metadata_version === 2, `metadata_version bumped (got ${after.metadata_version})`);
  assert(JSON.stringify(after.login_fields.map((f) => f.id)) === JSON.stringify(['idNumber', 'password']), 'login fields saved (ID + «סיסמה»)');
  assert(after.display_name === 'Clinic Renamed' && after.primary_url === 'https://clinic.example/home' && after.login_url === 'https://clinic.example/signin' && after.service_status === 'disabled' && after.icon === '🏥', 'name / URLs / status / icon saved');
  assert(after.metadata.loginEntryType === 'direct_url' && after.metadata.credentialMode === 'credential_fields', 'entry type + credential mode saved');
  // Phase 120 behavior, unchanged: the profile compares its own versions, so it still reads
  // version-matched; users fail closed because the required «סיסמה» has no STANDARD mapping.
  const profile = V.readAutofillProfileFromMetadata(after.metadata);
  assert(V.isVersionMatchedValidated(profile) === true, 'profile self-versions unchanged (isVersionMatchedValidated reads configVersion, not metadata_version)');
  assert(V.mappingsCoverRequiredSchema(profile, after.login_fields) === false, 'required «סיסמה» not covered by the STANDARD mapping');
  assert(V.isManagedAutofillEligible({ metadata: after.metadata, loginFields: after.login_fields, credential: credentials }) === false, 'managed STANDARD autofill fails closed after the change');
  return 'global edit: add required «סיסמה» → saved; profile byte-identical; no control keys; metadata_version 1→2; other fields saved; users fail closed';
}

async function checkUserOwned(c) {
  const id = 'user-owned';
  seedRow(id, { ownerUserId: 'user-1' });
  const before = rowOf(id);
  const stale = clone(before.metadata);
  stale.autofillProfile.fieldMappings[0].locator = '#stale';
  const { ctx, calls } = formContext(c, before, { form: { metadata: stale } });
  await c.save(ctx);
  const after = rowOf(id);
  assert(calls.error.length === 0 && calls.success[0] === 'הגשת המשתמש עודכנה.', `user-owned edit saved (errors: ${JSON.stringify(calls.error)})`);
  assert(bytes(after.metadata.autofillProfile) === bytes(before.metadata.autofillProfile), 'user-owned edit keeps the stored profile (stale form copy not written)');
  assert(after.display_name === 'Clinic Renamed' && after.service_status === 'disabled', 'user-owned edit saves the form fields');
  return 'user-owned edit: stored profile kept byte-identical; form fields saved';
}

async function checkCreateUnchanged(c) {
  const { ctx, calls } = formContext(c, null, {
    form: { id: 'created', metadata: { sentinel: 'keep', autofillProfile: storedProfile() }, service_status: 'active' },
    ctx: { isCreating: true, selectedRow: null, selectedId: null, storedFields: [clone(idField)] },
  });
  await c.save(ctx);
  assert(calls.error.length === 0 && calls.success[0] === 'האתר נוצר.', `create saved (errors: ${JSON.stringify(calls.error)})`);
  const sent = calls.create[0]?.metadata ?? {};
  assert(sent.sentinel === 'keep' && bytes(sent.autofillProfile) === bytes(storedProfile()), 'create receives the full builder metadata (unchanged)');
  assert(sent.loginEntryType === 'direct_url' && sent.credentialMode === 'credential_fields', 'create builder keys unchanged');
  assert(rowOf('created')?.display_name === 'Clinic Renamed', 'row created');
  return 'create unchanged: full builder metadata sent; row created';
}

async function checkGridStillValidates(c) {
  const id = 'grid';
  seedRow(id);
  db.rows.get(id).login_fields = [clone(idField), clone(passwordField)];
  const patch = bar.buildGridProfileMetadataPatch({
    metadata: rowOf(id).metadata,
    action: 'save',
    profilePayload: { fieldMappings: [{ fieldId: 'idNumber', locatorType: 'css', locator: '#idNumber' }], loginEntryUrl: LOGIN_URL, allowedOrigin: ORIGIN, fieldAuthoring: [] },
    liveValidationApproved: false,
    managedReadinessProbePassed: false,
    specialToStandard: null,
  });
  let err = null;
  try {
    await c.api.updateGlobalRegistryRow(id, { metadata: patch });
  } catch (e) {
    err = e;
  }
  assert(err && err.message === V.AUTOFILL_PROFILE_ERROR.missingRequiredMapping, `STANDARD grid save with an unmapped required field still refused (got ${err ? err.message : 'success'})`);
  const full = bar.buildGridProfileMetadataPatch({
    metadata: rowOf(id).metadata,
    action: 'save',
    profilePayload: { fieldMappings: [{ fieldId: 'idNumber', locatorType: 'css', locator: '#idNumber' }, { fieldId: 'password', locatorType: 'css', locator: '#password' }], loginEntryUrl: LOGIN_URL, allowedOrigin: ORIGIN, fieldAuthoring: [] },
    liveValidationApproved: false,
    managedReadinessProbePassed: false,
    specialToStandard: null,
  });
  await c.api.updateGlobalRegistryRow(id, { metadata: full });
  const saved = V.readAutofillProfileFromMetadata(rowOf(id).metadata);
  assert(saved.fieldMappings.length === 2 && saved.supportState === 'unsupported', 're-mapping in the grid saves and demotes the approved profile (Phase 120, unchanged)');
  return 'STANDARD grid: unmapped required field refused; full re-mapping saves (validated → unsupported)';
}

async function checkPassthroughEvidence(c) {
  const id = 'evidence';
  seedRow(id);
  const row = rowOf(id);
  let err = null;
  try {
    await c.api.updateGlobalRegistryRow(id, {
      metadata: { ...c.safe.withoutLoginContractKeys(row.metadata), loginEntryType: 'direct_url' },
      login_fields: [clone(idField), clone(passwordField)],
      credential_mode: 'credential_fields',
    });
  } catch (e) {
    err = e;
  }
  assert(err && err.message === V.AUTOFILL_PROFILE_ERROR.missingRequiredMapping, `fixture: the old passthrough save is refused (Owner M3) (got ${err ? err.message : 'success'})`);
  return 'evidence: the old passthrough patch reproduces Owner M3 («יש למפות בורר CSS לכל שדה כניסה נדרש.»)';
}

function checkStatic(c) {
  const f = c.formSrc.slice(c.formSrc.indexOf('    const metadata: Record<string, unknown> = {'));
  assertIncludes(f, '      ...withoutLoginContractKeys(form.metadata),', 'builder still strips contract keys');
  assertIncludes(f, '    const editMetadata = withoutAutofillProfile(metadata);', 'edit metadata omits the autofill keys');
  const createCall = f.slice(f.indexOf('await createGlobalRegistryRow({'), f.indexOf('setIsCreating(false);'));
  assertIncludes(createCall, '          metadata,\n', 'create sends the full builder metadata');
  const userCall = f.slice(f.indexOf('await updateUserOwnedRegistryRow(selectedId, {'), f.indexOf("setSuccess('הגשת המשתמש עודכנה.');"));
  assertIncludes(userCall, 'metadata: editMetadata,', 'user-owned edit sends editMetadata');
  const globalCall = f.slice(f.indexOf('await updateGlobalRegistryRow(selectedId, {'), f.indexOf("setSuccess('האתר עודכן.');"));
  assertIncludes(globalCall, 'metadata: editMetadata,', 'global edit sends editMetadata');
  for (const k of ['AUTOFILL_PROFILE_META_KEY', 'AUTOFILL_PROFILE_ACTION_KEY', 'AUTOFILL_LIVE_VALIDATION_APPROVED_KEY', 'AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY']) {
    assertIncludes(c.safeSrc, `  ${k},\n`, `withoutAutofillProfile covers ${k}`);
  }
  for (const needle of ['hostname', 'serviceId ===', '.co.il', 'final_submit']) {
    assert(!c.safeSrc.toLowerCase().includes(needle), `helper has no ${needle}`);
  }
  return 'static: create sends full metadata; both edits send editMetadata; helper covers profile + 3 control keys';
}

const GROUPS = [checkGlobalAddRequiredField, checkUserOwned, checkCreateUnchanged, checkGridStillValidates, checkPassthroughEvidence, checkStatic];

async function runGroups(c, log) {
  db.rows.clear();
  db.writes.length = 0;
  for (const g of GROUPS) {
    const label = await g(c);
    if (log) console.log(`  ✓ ${label}`);
  }
}

await runGroups(await makeContext(), true);

// ─── Mutations ───────────────────────────────────────────────────────────────
const F = read(FORM_FILE);
const S = read(SAFE_FILE);
const A = read(API_FILE);
const P = read(PROFILE_FILE);
const MUTATIONS = [
  { id: 'MR1 global edit re-sends the profile', formSrc: replaceOnce(F, "            login_url_status: 'valid',\n            metadata: editMetadata,", "            login_url_status: 'valid',\n            metadata,", 'MR1') },
  { id: 'MR2 user-owned edit re-sends the profile', formSrc: replaceOnce(F, '            service_status: form.service_status,\n            metadata: editMetadata,\n          });\n          setSuccess(\'הגשת המשתמש עודכנה.\');', "            service_status: form.service_status,\n            metadata,\n          });\n          setSuccess('הגשת המשתמש עודכנה.');", 'MR2') },
  { id: 'MR3 create omits the profile too', formSrc: replaceOnce(F, '          credential_mode: credentialMode,\n          metadata,\n        });', '          credential_mode: credentialMode,\n          metadata: editMetadata,\n        });', 'MR3') },
  { id: 'MK1 helper keeps the autofill control keys', safeSrc: replaceOnce(S, '  AUTOFILL_PROFILE_ACTION_KEY,\n  AUTOFILL_LIVE_VALIDATION_APPROVED_KEY,\n  AUTOFILL_MANAGED_READINESS_PROBE_PASSED_KEY,\n] as const;', '] as const;', 'MK1') },
  { id: 'MK2 helper keeps autofillProfile', safeSrc: replaceOnce(S, 'export const AUTOFILL_OWNED_KEYS = [\n  AUTOFILL_PROFILE_META_KEY,\n', 'export const AUTOFILL_OWNED_KEYS = [\n', 'MK2') },
  { id: 'MV1 metadata_version bump removed', apiSrc: replaceOnce(A, '      payload.metadata_version = (existing?.metadata_version ?? 1) + 1;', '      void 0;', 'MV1') },
  { id: 'MG1 grid missingRequiredMapping check removed', profileSrc: replaceOnce(P, "    if (!mapping || !mapping.locator.trim()) {\n      issues.push({\n        code: 'missingRequiredMapping',", "    if (false) {\n      issues.push({\n        code: 'missingRequiredMapping',", 'MG1') },
];

console.log('\nMutations');
let caught = 0;
for (const mu of MUTATIONS) {
  const { id, ...opts } = mu;
  let failure = null;
  try {
    await runGroups(await makeContext(opts), false);
  } catch (err) {
    failure = err;
  }
  assert(failure, `mutation NOT caught: ${id}`);
  assert(!String(failure.message).startsWith('fixture:'), `mutation ${id} failed on fixture setup: ${failure.message}`);
  caught += 1;
  console.log(`  ✓ mutation caught: ${id}  [${failure.message}]`);
}

console.log(`\nPASS — Phase 121 D-121-65 service-form save (${GROUPS.length} check groups, ${caught} mutations caught)`);
process.exit(0);
