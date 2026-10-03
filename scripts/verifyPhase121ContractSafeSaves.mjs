/**
 * Phase 121.1 D-121-33 (arch-phase121.md §4.14) — contract-safe saves.
 * Runs the REAL adminRegistryApi update paths (updateGlobalRegistryRow / updateUserOwnedRegistryRow,
 * incl. the unchanged mergeLoginContractMetadata guard) against an in-memory Supabase fake.
 * Stored states: (a) bag {draft, active:null}, no activation; (b) live SPECIAL; (c) SPECIAL_INVALID
 * (version mismatch, corrupt activation); (d) no contract keys. For each: row save (global +
 * user-owned) and grid non-intent save succeed; draft save succeeds for a / b / d, and for c is
 * refused by the unchanged consistency check (forbiddenMixedState, nothing written; recoverable via
 * the grid SPECIAL_TO_STANDARD path). Activation and loginFlowPlan.active are byte-identical
 * afterwards. Negative: direct non-intent SPECIAL activation / active write is still
 * rejected with the same message. ACTIVATE SPECIAL and grid SPECIAL_TO_STANDARD still work.
 * Usage: node scripts/verifyPhase121ContractSafeSaves.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const assertIncludes = (hay, needle, message) => assert(hay.includes(needle), message);
const assertNotIncludes = (hay, needle, message) => assert(!hay.includes(needle), message);

// ─── In-memory Supabase fake (service_registry only) ─────────────────────────
const db = { rows: new Map(), writes: [] };
globalThis.__pvFakeDb = db;
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
      return { data: null, error: rows.length ? null : { message: 'no row matched' } };
    }
    if (this.op === 'insert') {
      db.rows.set(this.payload.id, clone(this.payload));
      return { data: null, error: null };
    }
    return { data: clone(rows), error: null };
  }
  maybeSingle() { const r = this.exec(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); }
  single() { return this.maybeSingle(); }
  then(res, rej) { return Promise.resolve(this.exec()).then(res, rej); }
}
const fakeClient = { from: (t) => new FakeQuery(t), rpc: async () => ({ data: null, error: null }) };
globalThis.__pvFakeClient = fakeClient;

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

const loadModule = (entry, name, plugins = []) =>
  withTempDir(`pv-121css-${name}-`, (outdir) => loadModuleIn(outdir, entry, name, plugins));

async function loadModuleIn(outdir, entry, name, plugins) {
  const outfile = join(outdir, `${name}.mjs`);
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

console.log('Phase 121.1 D-121-33 — contract-safe saves verification\n');

const api = await loadModule('src/admin/adminRegistryApi.ts', 'api', [stubPlugin]);
const C = await loadModule('src/loginContract/index.ts', 'contract');
const bar = await loadModule('src/admin/specialActionBar.ts', 'bar');
const safe = await loadModule('src/admin/contractSafeMetadata.ts', 'safe');

const ACT = C.LOGIN_CONTRACT_ACTIVATION_META_KEY;
const BAG = C.LOGIN_FLOW_PLAN_META_KEY;
const INTENT = C.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY;
const BYPASS_MESSAGE = C.LOGIN_CONTRACT_MERGE_ERROR.activateRequiresIntent;

function completeDraft(planVersion = 1) {
  return {
    planVersion,
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
        readiness: { kind: 'exact_one_eligible_css', locatorType: 'css', locator: '#user', timeoutMs: 5000 },
      },
    ],
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: [
          { fieldId: 'username', locatorType: 'css', locator: '#user' },
          { fieldId: 'password', locatorType: 'css', locator: '#pass' },
        ],
      },
    ],
  };
}
const loginFields = [
  { id: 'username', label: 'User', type: 'text', required: true },
  { id: 'password', label: 'Pass', type: 'password', required: true },
];
const profilePayload = {
  fieldMappings: [
    { fieldId: 'username', locatorType: 'css', locator: '#user' },
    { fieldId: 'password', locatorType: 'css', locator: '#pass' },
  ],
  loginEntryUrl: 'https://example.test/login',
  allowedOrigin: 'https://example.test',
  fieldAuthoring: [],
};

const draft = completeDraft(1);
assert(C.parseLoginFlowPlanDocument(draft) && C.validateSpecialPlanComplete(draft).ok, 'fixture: complete draft parses and validates');
const STATES = {
  'a: bag {draft, active:null}, no activation': () => ({ other: 'keep', [BAG]: C.serializeLoginFlowPlanBag({ draft, active: null }) }),
  'b: live SPECIAL': () => ({ other: 'keep', [ACT]: { mode: 'SPECIAL', activePlanVersion: 1 }, [BAG]: C.serializeLoginFlowPlanBag({ draft, active: draft }) }),
  'c1: SPECIAL_INVALID (version mismatch)': () => ({ other: 'keep', [ACT]: { mode: 'SPECIAL', activePlanVersion: 99 }, [BAG]: C.serializeLoginFlowPlanBag({ draft, active: draft }) }),
  'c2: SPECIAL_INVALID (corrupt activation)': () => ({ other: 'keep', [ACT]: { mode: 'SPECIAL', activePlanVersion: 0 }, [BAG]: C.serializeLoginFlowPlanBag({ draft, active: draft }) }),
  'd: no contract keys': () => ({ other: 'keep' }),
};
const EXPECTED_MODE = { a: 'STANDARD', b: 'SPECIAL', c1: 'SPECIAL_INVALID', c2: 'SPECIAL_INVALID', d: 'STANDARD' };

function seedRow(id, metadata, ownerUserId = null) {
  db.rows.set(id, {
    id,
    display_name: 'Service',
    primary_url: 'https://example.test',
    login_url: 'https://example.test/login',
    login_url_status: 'valid',
    category_id: null,
    icon: '🔗',
    adapter_id: null,
    login_fields: clone(loginFields),
    source_type: ownerUserId ? 'user' : 'admin',
    service_status: 'active',
    metadata: clone(metadata),
    metadata_version: 1,
    owner_user_id: ownerUserId,
  });
}
const rowOf = (id) => clone(db.rows.get(id));
const snapshot = (meta) => ({
  activation: JSON.stringify(meta?.[ACT] ?? null),
  hasActivation: Object.prototype.hasOwnProperty.call(meta ?? {}, ACT),
  active: JSON.stringify(C.readLoginFlowPlanFromMetadata(meta)?.active ?? null),
  mode: C.resolveActiveLoginContract(meta).mode,
});
async function expectReject(fn, message, label) {
  let err = null;
  try { await fn(); } catch (e) { err = e; }
  assert(err && err.message === message, `${label}: rejected with «${message}» (got ${err ? err.message : 'success'})`);
}

// Writer payloads, exactly as the fixed writers build them.
const rowSaveGlobal = (row) =>
  api.updateGlobalRegistryRow(row.id, {
    display_name: row.display_name,
    primary_url: row.primary_url,
    login_url: row.login_url,
    category_id: row.category_id,
    icon: row.icon,
    adapter_id: row.adapter_id,
    source_type: row.source_type,
    service_status: row.service_status,
    login_url_status: 'valid',
    metadata: { ...safe.withoutLoginContractKeys(row.metadata), loginEntryType: 'direct_url', loginUrlSource: 'admin' },
  });
const rowSaveUserOwned = (row) =>
  api.updateUserOwnedRegistryRow(row.id, {
    display_name: row.display_name,
    primary_url: row.primary_url,
    login_url: row.login_url,
    category_id: row.category_id,
    service_status: row.service_status,
    metadata: { ...safe.withoutLoginContractKeys(row.metadata), loginEntryType: 'direct_url', loginUrlSource: 'user' },
  });
const gridSave = (row) =>
  api.updateGlobalRegistryRow(row.id, {
    metadata: bar.buildGridProfileMetadataPatch({
      metadata: row.metadata,
      action: 'save',
      profilePayload,
      liveValidationApproved: false,
      managedReadinessProbePassed: false,
      specialToStandard: null,
    }),
  });
const draftSave = (row, nextDraft) =>
  api.updateGlobalRegistryRow(row.id, {
    metadata: { ...safe.withoutLoginContractKeys(row.metadata), [BAG]: { draft: nextDraft } },
  });

// ─── 1. Helper ────────────────────────────────────────────────────────────
{
  const meta = { a: 1, [ACT]: { mode: 'SPECIAL', activePlanVersion: 1 }, [BAG]: { draft: null, active: null }, [INTENT]: { transition: 'SPECIAL_TO_STANDARD' } };
  const out = safe.withoutLoginContractKeys(meta);
  assert(JSON.stringify(out) === JSON.stringify({ a: 1 }), 'helper removes exactly the three contract keys');
  assert(meta[ACT] && meta[BAG] && meta[INTENT], 'helper is pure (input unchanged)');
  assert(JSON.stringify(safe.withoutLoginContractKeys(null)) === '{}', 'helper accepts null');
  assert(JSON.stringify([...safe.LOGIN_CONTRACT_OWNED_KEYS].sort()) === JSON.stringify([ACT, BAG, INTENT].sort()), 'owned keys list');
}
console.log('  ✓ 1. withoutLoginContractKeys removes loginContractActivation / loginFlowPlan / loginContractActivateIntent only');

// ─── 2. Root cause reproduced: old writers (whole row metadata) are rejected ─────
{
  for (const [name, make] of Object.entries(STATES)) {
    const id = `old-${name.split(':')[0]}`;
    seedRow(id, make());
    const row = rowOf(id);
    const oldRowSave = () =>
      api.updateGlobalRegistryRow(id, { display_name: row.display_name, primary_url: row.primary_url, login_url: row.login_url, source_type: row.source_type, service_status: row.service_status, metadata: { ...row.metadata, loginEntryType: 'direct_url', loginUrlSource: 'admin' } });
    if (name.startsWith('d')) {
      await oldRowSave();
    } else {
      await expectReject(oldRowSave, BYPASS_MESSAGE, `old row save, state ${name}`);
    }
  }
}
console.log('  ✓ 2. root cause reproduced: re-sending the stored contract keys is rejected (states a, b, c1, c2); d unaffected');

// ─── 3. Fixed writers: every state, every writer succeeds; contract bytes unchanged ─
for (const [name, make] of Object.entries(STATES)) {
  const tag = name.split(':')[0];
  const gid = `g-${tag}`;
  const uid = `u-${tag}`;
  seedRow(gid, make());
  seedRow(uid, make(), 'owner-1');
  const before = snapshot(rowOf(gid).metadata);
  assert(before.mode === EXPECTED_MODE[tag], `fixture ${name}: resolves ${EXPECTED_MODE[tag]}`);
  const beforeUser = snapshot(rowOf(uid).metadata);

  await rowSaveGlobal(rowOf(gid));
  let after = snapshot(rowOf(gid).metadata);
  assert(JSON.stringify(after) === JSON.stringify(before), `${name}: global row save keeps activation + active byte-identical`);
  assert(rowOf(gid).metadata.other === 'keep' && rowOf(gid).metadata.loginEntryType === 'direct_url', `${name}: global row save writes its own fields`);

  await rowSaveUserOwned(rowOf(uid));
  const afterUser = snapshot(rowOf(uid).metadata);
  assert(JSON.stringify(afterUser) === JSON.stringify(beforeUser), `${name}: user-owned row save keeps activation + active byte-identical`);
  assert(rowOf(uid).metadata.loginUrlSource === 'user', `${name}: user-owned row save writes its own fields`);
  // User-owned API strips even if a caller forgets (no contract merge exists on that path).
  await api.updateUserOwnedRegistryRow(uid, { display_name: 'x', primary_url: 'https://example.test', login_url: 'https://example.test/login', category_id: null, service_status: 'active', metadata: { ...rowOf(uid).metadata, [ACT]: { mode: 'SPECIAL', activePlanVersion: 7 }, [BAG]: { draft: null, active: null } } });
  assert(JSON.stringify(snapshot(rowOf(uid).metadata)) === JSON.stringify(beforeUser), `${name}: user-owned API ignores contract keys in the patch`);

  await gridSave(rowOf(gid));
  after = snapshot(rowOf(gid).metadata);
  assert(JSON.stringify(after) === JSON.stringify(before), `${name}: grid non-intent save keeps activation + active byte-identical`);
  assert(rowOf(gid).metadata.autofillProfile && rowOf(gid).metadata.autofillProfile.fieldMappings.length === 2, `${name}: grid save stored the profile`);

  const nextDraft = { ...completeDraft(1), steps: [{ stepId: 'step-1', fieldMappings: [{ fieldId: 'username', locatorType: 'css', locator: '#user' }, { fieldId: 'password', locatorType: 'css', locator: '#pass2' }] }] };
  assert(C.parseLoginFlowPlanDocument(nextDraft), 'fixture: next draft parses');
  if (tag.startsWith('c')) {
    // SPECIAL_INVALID: the draft save reaches the unchanged merge, whose consistency check refuses any
    // write while the stored contract is mixed (fail closed). Not the bypass message; nothing written.
    const storedBefore = JSON.stringify(rowOf(gid).metadata);
    await expectReject(() => draftSave(rowOf(gid), nextDraft), C.LOGIN_CONTRACT_MERGE_ERROR.forbiddenMixedState, `${name}: draft save`);
    assert(JSON.stringify(rowOf(gid).metadata) === storedBefore, `${name}: refused draft save wrote nothing`);
    // Recovery = grid SPECIAL_TO_STANDARD (D-121-30 A3), then draft save works.
    const rr = rowOf(gid);
    const ret = bar.buildGridProfileMetadataPatch({ metadata: rr.metadata, action: 'activate_validated', profilePayload, liveValidationApproved: true, managedReadinessProbePassed: true, specialToStandard: { previous: null, loginFields, loginUrl: rr.login_url } });
    const recovered = C.mergeLoginContractMetadata({ existingMetadata: rr.metadata, patchMetadata: ret });
    assert(recovered.ok && C.resolveActiveLoginContract(recovered.metadata).mode === 'STANDARD', `${name}: grid SPECIAL_TO_STANDARD recovers the row (unchanged planner)`);
    const afterRecovery = C.mergeLoginContractMetadata({ existingMetadata: recovered.metadata, patchMetadata: { ...safe.withoutLoginContractKeys(recovered.metadata), [BAG]: { draft: nextDraft } } });
    assert(afterRecovery.ok, `${name}: draft save succeeds after recovery`);
    await rowSaveGlobal(rowOf(gid));
    assert(JSON.stringify(snapshot(rowOf(gid).metadata)) === JSON.stringify(before), `${name}: row save still safe`);
    continue;
  }
  await draftSave(rowOf(gid), nextDraft);
  after = snapshot(rowOf(gid).metadata);
  assert(after.activation === before.activation && after.hasActivation === before.hasActivation, `${name}: draft save keeps activation byte-identical`);
  assert(after.active === before.active, `${name}: draft save keeps loginFlowPlan.active byte-identical`);
  assert(after.mode === before.mode, `${name}: draft save keeps live mode`);
  assert(C.readLoginFlowPlanFromMetadata(rowOf(gid).metadata).draft.steps[0].fieldMappings[1].locator === '#pass2', `${name}: draft save stored the new draft`);

  // Row save again after grid + draft saves (metadata now carries autofillProfile + bag).
  await rowSaveGlobal(rowOf(gid));
  assert(JSON.stringify(snapshot(rowOf(gid).metadata)) === JSON.stringify(after), `${name}: second row save still safe`);
  assert(C.readLoginFlowPlanFromMetadata(rowOf(gid).metadata).draft.steps[0].fieldMappings[1].locator === '#pass2', `${name}: row save keeps the saved draft`);
}
console.log('  ✓ 3. states a / b / d: all four writers succeed; c1 / c2: row + grid saves succeed, draft save refused by the unchanged consistency check (nothing written, recoverable via grid); activation + active byte-identical');

// ─── 4. Guard unchanged: direct non-intent contract writes still rejected ─────────
{
  seedRow('neg', STATES['a: bag {draft, active:null}, no activation']());
  await expectReject(() => api.updateGlobalRegistryRow('neg', { metadata: { [ACT]: { mode: 'SPECIAL', activePlanVersion: 1 } } }), BYPASS_MESSAGE, 'direct SPECIAL activation');
  await expectReject(() => api.updateGlobalRegistryRow('neg', { metadata: { [BAG]: { draft, active: draft } } }), BYPASS_MESSAGE, 'direct loginFlowPlan.active write');
  await expectReject(() => api.updateGlobalRegistryRow('neg', { metadata: { [BAG]: { draft, active: null } } }), BYPASS_MESSAGE, 'direct loginFlowPlan.active:null write');
  assert(snapshot(rowOf('neg').metadata).mode === 'STANDARD', 'rejected writes changed nothing');
  const mergeSrc = read('src/loginContract/merge.ts');
  assertIncludes(mergeSrc, "if (isRecord(planRaw) && Object.prototype.hasOwnProperty.call(planRaw, 'active')) {", 'merge guard (active key) unchanged');
  assertIncludes(mergeSrc, "if (parsedAct === 'CORRUPT_SPECIAL' || (parsedAct !== null && parsedAct.mode === 'SPECIAL')) {", 'merge guard (SPECIAL activation) unchanged');
  for (const f of ['merge.ts', 'planActivate.ts', 'resolve.ts', 'validateSpecialPlan.ts']) {
    assertNotIncludes(read(`src/loginContract/${f}`), 'withoutLoginContractKeys', `${f} does not use the writer helper`);
  }
}
console.log('  ✓ 4. negative: direct non-intent SPECIAL activation / loginFlowPlan.active writes rejected with the same message');

// ─── 5. ACTIVATE paths unchanged and working ──────────────────────────────
{
  // ACTIVATE SPECIAL (editor payload: whole row metadata + draft + intent) from state (a).
  seedRow('act', STATES['a: bag {draft, active:null}, no activation']());
  const row = rowOf('act');
  await api.updateGlobalRegistryRow('act', {
    metadata: { ...(row.metadata ?? {}), [BAG]: { draft }, [INTENT]: { transition: 'STANDARD_TO_SPECIAL', draft } },
  });
  const live = C.resolveActiveLoginContract(rowOf('act').metadata);
  assert(live.mode === 'SPECIAL', 'ACTIVATE SPECIAL still activates');
  assert(!Object.prototype.hasOwnProperty.call(rowOf('act').metadata, INTENT), 'intent key not persisted');
  // Row save on the now-live SPECIAL row keeps it live.
  const liveBefore = snapshot(rowOf('act').metadata);
  await rowSaveGlobal(rowOf('act'));
  assert(JSON.stringify(snapshot(rowOf('act').metadata)) === JSON.stringify(liveBefore), 'row save after ACTIVATE keeps SPECIAL live');
  // Grid return path (SPECIAL_TO_STANDARD intent, unchanged builder path).
  const r2 = rowOf('act');
  const patch = bar.buildGridProfileMetadataPatch({
    metadata: r2.metadata,
    action: 'activate_validated',
    profilePayload,
    liveValidationApproved: true,
    managedReadinessProbePassed: true,
    specialToStandard: { previous: null, loginFields, loginUrl: r2.login_url },
  });
  assert(patch[INTENT]?.transition === 'SPECIAL_TO_STANDARD', 'grid return path still sends its intent');
  assert(Object.prototype.hasOwnProperty.call(patch, BAG) && Object.prototype.hasOwnProperty.call(patch, ACT), 'intent path payload unchanged (row metadata not stripped)');
  const mergedReturn = C.mergeLoginContractMetadata({ existingMetadata: r2.metadata, patchMetadata: patch });
  assert(mergedReturn.ok && C.resolveActiveLoginContract(mergedReturn.metadata).mode === 'STANDARD', 'grid SPECIAL_TO_STANDARD still returns the service to STANDARD (unchanged merge / planner)');
  // Non-intent grid patch has no contract keys; Phase 120 keys unchanged.
  const nonIntent = bar.buildGridProfileMetadataPatch({ metadata: r2.metadata, action: 'activate_validated', profilePayload, liveValidationApproved: true, managedReadinessProbePassed: true, specialToStandard: null });
  for (const k of [ACT, BAG, INTENT]) assert(!Object.prototype.hasOwnProperty.call(nonIntent, k), `grid non-intent patch omits ${k}`);
  assert(JSON.stringify(Object.keys(nonIntent).slice(-4)) === JSON.stringify(['autofillProfile', 'autofillProfileAction', 'autofillLiveValidationApproved', 'autofillManagedReadinessProbePassed']), 'grid Phase 120 keys and order unchanged');
}
console.log('  ✓ 5. ACTIVATE SPECIAL and grid SPECIAL_TO_STANDARD still work; intent path payload unchanged');

// ─── 6. Writer wiring + sweep ─────────────────────────────────────────────
{
  const registryAdmin = read('src/admin/RegistryAdmin.tsx');
  assertIncludes(registryAdmin, '...withoutLoginContractKeys(form.metadata),', 'RegistryAdmin row save (create / user-owned / global share this metadata)');
  const special = read('src/admin/SpecialLoginDraftEditor.tsx');
  const saveFn = special.slice(special.indexOf('async function saveDraft'), special.indexOf('function requestActivateSpecial'));
  assertIncludes(saveFn, '...withoutLoginContractKeys(row.metadata),', 'saveDraft strips stored contract keys');
  assertIncludes(saveFn, '[LOGIN_FLOW_PLAN_META_KEY]: {\n            draft: normalizeLegacyDraftReadiness(draft),', 'saveDraft sends loginFlowPlan: { draft } only (normalized, D-121-46)');
  assertNotIncludes(saveFn, 'active:', 'saveDraft sends no active key');
  const activateFn = special.slice(special.indexOf('async function activateSpecial'), special.indexOf('function validateSnapshot'));
  assertIncludes(activateFn, '...(row.metadata ?? {}),', 'ACTIVATE SPECIAL payload unchanged');
  assertIncludes(activateFn, '[LOGIN_CONTRACT_ACTIVATE_INTENT_KEY]: {', 'ACTIVATE SPECIAL keeps its intent');
  const grid = read('src/admin/AdminFillTestGrid.tsx');
  assertIncludes(grid, '...withoutLoginContractKeys(row.metadata),\n            autofillProfile: {', 'fill-test grid Admin-Test stamp save strips');
  const barSrc = read('src/admin/specialActionBar.ts');
  assertIncludes(barSrc, '...(intentWrite ? (input.metadata ?? {}) : withoutLoginContractKeys(input.metadata)),', 'grid persist: non-intent strips, intent path unchanged');
  const apiSrc = read('src/admin/adminRegistryApi.ts');
  for (const [fn, end] of [
    ['export async function updateIconMetadata', 'export async function uploadAdminIconFile'],
    ['export async function adminRefreshLoginIntelligence', 'export async function adminOverrideLoginIntelligence'],
    ['export async function adminOverrideLoginIntelligence', '\n}\n'],
    ['export async function updateUserOwnedRegistryRow', 'export async function disableGlobalRegistryRow'],
  ]) {
    const at = apiSrc.indexOf(fn);
    const body = apiSrc.slice(at, apiSrc.indexOf(end, at + fn.length));
    assertIncludes(body, 'withoutLoginContractKeys(', `${fn.replace('export async function ', '')} strips contract keys`);
  }
  // Whole-row direct writers must NOT strip (it would delete the stored contract).
  const markInvalid = apiSrc.slice(apiSrc.indexOf('export async function markGlobalLoginUrlInvalid'), apiSrc.indexOf('export async function updateIconMetadata'));
  assertNotIncludes(markInvalid, 'withoutLoginContractKeys', 'direct whole-metadata update keeps stored keys (not stripped)');

  // Sweep: every admin write through the merging update paths that spreads row / form metadata uses the helper
  // (contract writers — ACTIVATE SPECIAL and the grid intent path — are the only exceptions).
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(name)) files.push(rel);
    }
  };
  walk('src');
  const offenders = [];
  for (const rel of files) {
    const src = read(rel);
    // D-121-64: the SPECIAL editor builds its patch first (`const patch = { metadata: withoutAutofillProfile({ ...`).
    for (const m of src.matchAll(/(?:(?:updateGlobalRegistryRow|updateUserOwnedRegistryRow)\([^)]*?\{|const patch = \{)[\s\S]{0,200}?metadata: (?:withoutAutofillProfile\()?\{\s*\.\.\.\((row|form)\.metadata \?\? \{\}\)/g)) {
      offenders.push(`${rel}@${m.index}`);
    }
  }
  const allowed = offenders.filter((o) => o.startsWith('src/admin/SpecialLoginDraftEditor.tsx'));
  assert(offenders.length === allowed.length && allowed.length === 1, `only ACTIVATE SPECIAL re-sends row metadata (found: ${offenders.join(', ')})`);
  for (const needle of ['hostname', 'serviceId ===', 'mizrahi', '.co.il', 'final_submit']) {
    assertNotIncludes(read('src/admin/contractSafeMetadata.ts').toLowerCase(), needle, `helper has no ${needle}`);
  }
}
console.log('  ✓ 6. writer wiring: RegistryAdmin, saveDraft, grid (non-intent + Admin-Test stamp), icon / notes / LI writers, user-owned API; ACTIVATE unchanged; sweep');

console.log('\nPASS — Phase 121.1 D-121-33 contract-safe saves (§4.14)');
