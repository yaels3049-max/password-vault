/**
 * Phase 121 D-121-64 (arch-phase121.md "Maccabi M2" / "D-121-64") — the SPECIAL save guard checks
 * what the save writes.
 * Runs the editor's real saveDraft / activateSpecial write code (sliced from
 * SpecialLoginDraftEditor.tsx), the real guard, and the real adminRegistryApi.updateGlobalRegistryRow
 * (incl. the unchanged autofill merge and the strict login-contract merge guard) against an
 * in-memory Supabase fake.
 * - A SPECIAL save whose saved STANDARD profile shares fieldId + locator with a SPECIAL step is
 *   saved; autofillProfile is byte-identical before / after (save and approve), also when a
 *   required login field has no STANDARD mapping.
 * - A SPECIAL write patch that alters / adds / removes autofillProfile (or writes a frame key)
 *   is refused with the existing message, and nothing is written.
 * - The frame rule for autofillProfile mappings still rejects; a STANDARD grid save never
 *   persists a frame key.
 * Usage: node scripts/verifyPhase121SpecialSaveGuard.mjs
 */
import { readFileSync } from 'node:fs';
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
      db.rows.set(this.payload.id, clone(this.payload));
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
/** Serve a mutated source for one file (path relative to the repo). */
const overridePlugin = (overrides) => ({
  name: 'pv-override',
  setup(b) {
    b.onLoad({ filter: /\.ts$/ }, (args) => {
      const rel = args.path.slice(root.length + 1).replace(/\\/g, '/');
      if (!Object.prototype.hasOwnProperty.call(overrides, rel)) return undefined;
      return { contents: overrides[rel], loader: 'ts' };
    });
  },
});

let buildSeq = 0;
const loadModule = (entry, name, plugins = []) => withTempDir(`pv-121sg-${name}-`, (outdir) => loadModuleIn(outdir, entry, name, plugins));
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

console.log('Phase 121 D-121-64 — SPECIAL save guard checks what the save writes\n');

const GUARD_FILE = 'src/loginContract/specialDraftAuthoring.ts';
const EDITOR_FILE = 'src/admin/SpecialLoginDraftEditor.tsx';
const api = await loadModule('src/admin/adminRegistryApi.ts', 'api', [stubPlugin]);
const realC = await loadModule('src/loginContract/index.ts', 'contract');
const bar = await loadModule('src/admin/specialActionBar.ts', 'bar');
const safe = await loadModule('src/admin/contractSafeMetadata.ts', 'safe');
const V = await loadModule('src/autofill/validatedProfile.ts', 'profile');

const BAG = realC.LOGIN_FLOW_PLAN_META_KEY;
const INTENT = realC.LOGIN_CONTRACT_ACTIVATE_INTENT_KEY;
const MESSAGE = 'אסור לכתוב מיפויי SPECIAL לתוך autofillProfile.fieldMappings.';

// ─── Fixtures (generic hosts; a two-screen ID + password site) ───────────────
const ORIGIN = 'https://clinic.example';
const LOGIN_URL = `${ORIGIN}/login`;
const idOnlyFields = [{ id: 'idNumber', label: 'ID', type: 'text', required: true }];
const idAndPasswordFields = [...idOnlyFields, { id: 'password', label: 'Password', type: 'password', required: true }];
const readiness = (locator) => ({ kind: 'exact_one_eligible_css', locatorType: 'css', locator, timeoutMs: 5000 });
function multiStepDraft() {
  return {
    planVersion: 1,
    pattern: 'MULTI_STEP',
    preambleActions: [],
    steps: [
      {
        stepId: 'step-1',
        fieldMappings: [{ fieldId: 'idNumber', locatorType: 'css', locator: '#idNumber' }],
        exitTransition: {
          actionId: 'next-1',
          kind: 'intermediate_transition',
          label: 'Continue',
          locatorType: 'css',
          locator: '#next',
          approvedForAuthoringContinuation: true,
          approvedForRuntime: true,
          readiness: readiness('#idNumber2'),
        },
      },
      {
        stepId: 'step-2',
        fieldMappings: [
          { fieldId: 'idNumber', locatorType: 'css', locator: '#idNumber2' },
          { fieldId: 'password', locatorType: 'css', locator: '#password' },
        ],
      },
    ],
  };
}
/** Stored (serialized) STANDARD profile: validated, maps the ID field to the SPECIAL step-1 element. */
function storedStandardProfile() {
  return V.serializeAutofillProfile({
    supportState: 'validated',
    configVersion: 2,
    loginEntryUrl: LOGIN_URL,
    allowedOrigin: ORIGIN,
    fieldMappings: [{ fieldId: 'idNumber', locatorType: 'css', locator: '#idNumber' }],
    validation: { metadataVersion: 2, validatedAt: '2026-09-01T00:00:00.000Z', validatedBy: 'admin', resultSummary: 'managed_readiness_ok' },
  });
}
function seedRow(id, metadata, loginFields) {
  db.rows.set(id, {
    id,
    display_name: 'Clinic',
    primary_url: ORIGIN,
    login_url: LOGIN_URL,
    login_url_status: 'valid',
    category_id: null,
    icon: '🔗',
    adapter_id: null,
    login_fields: clone(loginFields),
    source_type: 'admin',
    service_status: 'active',
    metadata: clone(metadata),
    metadata_version: 1,
    owner_user_id: null,
  });
}
const rowOf = (id) => clone(db.rows.get(id));
const profileBytes = (meta) => JSON.stringify(meta?.autofillProfile ?? null);

// ─── Editor write code, sliced from the real editor ──────────────────────────
function editorSegments(editorSrc) {
  const saveFn = editorSrc.slice(editorSrc.indexOf('async function saveDraft'), editorSrc.indexOf('function requestActivateSpecial'));
  const activateFn = editorSrc.slice(editorSrc.indexOf('async function activateSpecial'), editorSrc.indexOf('function validateSnapshot'));
  const cut = (fn, endNeedle, label) => {
    const start = fn.indexOf('const patch = {');
    const end = fn.indexOf(endNeedle);
    assert(start >= 0 && end > start, `fixture: editor ${label} write segment found`);
    return fn.slice(start, end + endNeedle.length);
  };
  return {
    saveFn,
    activateFn,
    save: cut(saveFn, 'await updateGlobalRegistryRow(row.id, patch);', 'saveDraft'),
    activate: cut(activateFn, 'const write = await updateGlobalRegistryRow(row.id, patch);', 'activateSpecial'),
  };
}
const AsyncFunction = (async () => {}).constructor;
async function runSegment(segment, ctx) {
  const names = Object.keys(ctx);
  const fn = new AsyncFunction(...names, `${segment}\n;return typeof write === 'undefined' ? undefined : write;`);
  return fn(...names.map((n) => ctx[n]));
}
function editorContext(c, row, extra = {}) {
  const calls = { error: [], approveFailure: [], writes: 0 };
  const ctx = {
    row,
    withoutAutofillProfile: safe.withoutAutofillProfile,
    withoutLoginContractKeys: safe.withoutLoginContractKeys,
    assertSpecialWriteKeepsAutofillProfile: c.C.assertSpecialWriteKeepsAutofillProfile,
    normalizeLegacyDraftReadiness: c.C.normalizeLegacyDraftReadiness,
    LOGIN_FLOW_PLAN_META_KEY: BAG,
    LOGIN_CONTRACT_ACTIVATE_INTENT_KEY: INTENT,
    setError: (m) => calls.error.push(m),
    setApproveFailure: (m) => calls.approveFailure.push(m),
    updateGlobalRegistryRow: async (id, patch) => {
      calls.writes += 1;
      return api.updateGlobalRegistryRow(id, patch);
    },
    ...extra,
  };
  return { ctx, calls };
}

// ─── Check groups ────────────────────────────────────────────────────────────
async function checkSaveShared(c) {
  // Owner M2-b: STANDARD maps ID → #idNumber; SPECIAL step 1 maps the same fieldId + locator.
  const draft = multiStepDraft();
  assert(c.C.validateSpecialPlanComplete(draft).ok, 'fixture: MULTI_STEP draft complete');
  const std = storedStandardProfile();
  assert(std.fieldMappings.some((m) => draft.steps[0].fieldMappings.some((s) => s.fieldId === m.fieldId && s.locator === m.locator)), 'fixture: STANDARD and SPECIAL share fieldId + locator');
  for (const [label, fields] of [['ID-only login fields', idOnlyFields], ['«סיסמה» added (required, no STANDARD mapping)', idAndPasswordFields]]) {
    const id = `save-${fields.length}`;
    seedRow(id, { other: 'keep', autofillProfile: std }, fields);
    const before = rowOf(id);
    const { ctx, calls } = editorContext(c, before, { draft });
    await runSegment(c.seg.save, ctx);
    const after = rowOf(id);
    assert(calls.error.length === 0 && calls.writes === 1, `${label}: SPECIAL save with a shared STANDARD locator is saved (errors: ${JSON.stringify(calls.error)})`);
    assert(profileBytes(after.metadata) === profileBytes(before.metadata), `${label}: autofillProfile byte-identical after the SPECIAL save`);
    assert(JSON.stringify(c.C.readLoginFlowPlanFromMetadata(after.metadata)?.draft) === JSON.stringify(c.C.normalizeLegacyDraftReadiness(draft)), `${label}: loginFlowPlan.draft written`);
    assert(after.metadata.other === 'keep', `${label}: other metadata kept`);
    const sent = db.writes.at(-1).payload.metadata;
    assert(profileBytes(sent) === profileBytes(before.metadata), `${label}: the written row carries the stored autofillProfile verbatim`);
  }
  return 'SPECIAL save with STANDARD sharing fieldId + locator → saved; autofillProfile byte-identical (also after «סיסמה» is added)';
}

async function checkApprove(c) {
  const id = 'approve';
  const draft = multiStepDraft();
  seedRow(id, { other: 'keep', autofillProfile: storedStandardProfile() }, idAndPasswordFields);
  {
    const { ctx } = editorContext(c, rowOf(id), { draft });
    await runSegment(c.seg.save, ctx);
  }
  const before = rowOf(id);
  const normalized = c.C.readLoginFlowPlanFromMetadata(before.metadata).draft;
  const { ctx, calls } = editorContext(c, before, { normalized, transition: 'STANDARD_TO_SPECIAL' });
  const write = await runSegment(c.seg.activate, ctx);
  const after = rowOf(id);
  assert(calls.approveFailure.length === 0 && calls.writes === 1 && write?.updatedRows === 1, `approve write sent (failures: ${JSON.stringify(calls.approveFailure)})`);
  assert(c.C.resolveActiveLoginContract(after.metadata).mode === 'SPECIAL', 'approve activates SPECIAL');
  assert(!Object.prototype.hasOwnProperty.call(after.metadata, INTENT), 'intent not persisted');
  assert(profileBytes(after.metadata) === profileBytes(before.metadata), 'autofillProfile byte-identical after approve');
  return 'approve (activateSpecial) with a shared STANDARD locator → SPECIAL live; autofillProfile byte-identical';
}

async function checkGuardRules(c) {
  const g = c.C.assertSpecialWriteKeepsAutofillProfile;
  const std = storedStandardProfile();
  const row = { autofillProfile: std, other: 1 };
  const draftPatch = { [BAG]: { draft: multiStepDraft() } };
  const refused = (r, label) => assert(r.ok === false && r.code === 'dualWriteForbidden' && r.message === MESSAGE, `${label} → refused with the existing message`);
  assert(g({ rowMetadata: row, patchMetadata: { ...draftPatch } }).ok, 'omitted autofillProfile (kept by the merge) → allowed');
  assert(g({ rowMetadata: row, patchMetadata: { ...row, ...draftPatch } }).ok, 'reference passthrough → allowed');
  const reordered = Object.fromEntries(Object.entries(clone(std)).reverse());
  assert(g({ rowMetadata: row, patchMetadata: { autofillProfile: reordered, ...draftPatch } }).ok, 'deep-equal passthrough (other key order) → allowed');
  const changed = clone(std);
  changed.fieldMappings[0].locator = '#other';
  refused(g({ rowMetadata: row, patchMetadata: { autofillProfile: changed, ...draftPatch } }), 'changed mapping');
  const added = clone(std);
  added.fieldMappings.push({ fieldId: 'password', locatorType: 'css', locator: '#password' });
  refused(g({ rowMetadata: row, patchMetadata: { autofillProfile: added, ...draftPatch } }), 'added mapping');
  refused(g({ rowMetadata: row, patchMetadata: { autofillProfile: { ...clone(std), supportState: 'unsupported' }, ...draftPatch } }), 'changed supportState');
  refused(g({ rowMetadata: { other: 1 }, patchMetadata: { autofillProfile: clone(std), ...draftPatch } }), 'profile added to a row without one');
  refused(g({ rowMetadata: { other: 1 }, patchMetadata: { autofillProfile: undefined, ...draftPatch } }), 'autofillProfile key (undefined) sent for a row without one');
  refused(g({ rowMetadata: row, patchMetadata: { autofillProfile: null, ...draftPatch } }), 'profile removed (null)');
  refused(g({ rowMetadata: row, patchMetadata: { autofillProfile: undefined, ...draftPatch } }), 'profile removed (undefined)');
  const framed = clone(std);
  framed.fieldMappings[0].frame = { frameLocator: 'iframe#login', frameOrigin: ORIGIN };
  refused(g({ rowMetadata: row, patchMetadata: { autofillProfile: framed, ...draftPatch } }), 'frame key written into autofillProfile');
  refused(g({ rowMetadata: { autofillProfile: framed }, patchMetadata: { autofillProfile: framed, ...draftPatch } }), 'frame key passed through (still written)');
  assert(g({ rowMetadata: { autofillProfile: framed }, patchMetadata: { ...draftPatch } }).ok, 'stored frame not re-sent → nothing written → allowed');
  return 'guard: omitted / passthrough allowed; changed / added / removed / frame → refused (existing message)';
}

async function checkEditorRefuses(c) {
  // The editor refuses before writing when its patch would touch autofillProfile.
  const tamper = (m) => ({ ...safe.withoutAutofillProfile(m), autofillProfile: { supportState: 'not_configured' } });
  const id = 'tamper';
  seedRow(id, { other: 'keep', autofillProfile: storedStandardProfile() }, idAndPasswordFields);
  const before = rowOf(id);
  const writesBefore = db.writes.length;
  {
    const { ctx, calls } = editorContext(c, before, { draft: multiStepDraft(), withoutAutofillProfile: tamper });
    await runSegment(c.seg.save, ctx);
    assert(calls.error.length === 1 && calls.error[0] === MESSAGE && calls.writes === 0, `saveDraft refuses a patch that alters autofillProfile (errors ${JSON.stringify(calls.error)}, writes ${calls.writes})`);
  }
  {
    const { ctx, calls } = editorContext(c, before, { normalized: multiStepDraft(), transition: 'STANDARD_TO_SPECIAL', withoutAutofillProfile: tamper });
    await runSegment(c.seg.activate, ctx);
    assert(calls.approveFailure.length === 1 && calls.approveFailure[0] === MESSAGE && calls.writes === 0, 'activateSpecial refuses a patch that alters autofillProfile');
  }
  assert(db.writes.length === writesBefore && JSON.stringify(rowOf(id)) === JSON.stringify(before), 'refused writes changed nothing');
  return 'editor saveDraft / activateSpecial refuse a patch that touches autofillProfile; nothing written';
}

async function checkFrameRule(c) {
  const framedMapping = { fieldId: 'idNumber', locatorType: 'css', locator: '#idNumber', frame: { frameLocator: 'iframe#login', frameOrigin: ORIGIN } };
  const r = c.C.assertNoFrameInAutofillMappings([framedMapping]);
  assert(r.ok === false && r.message === MESSAGE, "frame rule: 'frame' in an autofillProfile mapping → rejected (existing message)");
  assert(c.C.assertNoFrameInAutofillMappings([{ fieldId: 'idNumber', locatorType: 'css', locator: '#idNumber' }]).ok, 'frame rule: plain mapping allowed');
  assert(c.C.assertNoFrameInAutofillMappings(null).ok, 'frame rule: no mappings allowed');
  // STANDARD grid save (unchanged path): a frame key is never persisted into autofillProfile.
  const id = 'grid';
  seedRow(id, { other: 'keep' }, idOnlyFields);
  const patch = bar.buildGridProfileMetadataPatch({
    metadata: rowOf(id).metadata,
    action: 'save',
    profilePayload: { fieldMappings: [framedMapping], loginEntryUrl: LOGIN_URL, allowedOrigin: ORIGIN, fieldAuthoring: [] },
    liveValidationApproved: false,
    managedReadinessProbePassed: false,
    specialToStandard: null,
  });
  await api.updateGlobalRegistryRow(id, { metadata: patch });
  const stored = rowOf(id).metadata.autofillProfile;
  assert(stored && stored.fieldMappings.length === 1 && !Object.prototype.hasOwnProperty.call(stored.fieldMappings[0], 'frame'), 'STANDARD grid save never persists a frame key');
  return "frame rule still rejects 'frame' in autofillProfile mappings; STANDARD grid save persists no frame";
}

async function checkPassthroughEvidence(c) {
  // Why the SPECIAL writers omit autofillProfile: a passthrough is re-planned by the unchanged
  // autofill merge against the current login fields, and fails once a required field has no
  // STANDARD mapping (Owner M2-a: «סיסמה» added).
  const id = 'passthrough';
  seedRow(id, { other: 'keep', autofillProfile: storedStandardProfile() }, idAndPasswordFields);
  const row = rowOf(id);
  let err = null;
  try {
    await api.updateGlobalRegistryRow(id, { metadata: { ...safe.withoutLoginContractKeys(row.metadata), [BAG]: { draft: multiStepDraft() } } });
  } catch (e) {
    err = e;
  }
  assert(err && err.message === V.AUTOFILL_PROFILE_ERROR.missingRequiredMapping, `fixture: a passthrough patch is re-planned and refused (got ${err ? err.message : 'success'})`);
  return 'evidence: a passthrough autofillProfile is re-planned by the autofill merge (fails after «סיסמה» is added) → writers omit it';
}

function checkStatic(c) {
  const guardSrc = c.guardSrc;
  assertNotIncludes(guardSrc, '::${row.locator}', 'fieldId + locator overlap rule removed');
  for (const f of ['src/admin/SpecialLoginDraftEditor.tsx', 'src/loginContract/index.ts', 'src/loginContract/specialDraftAuthoring.ts']) {
    assertNotIncludes(read(f), 'assertNoSpecialDualWriteToAutofill', `${f}: old overlap guard gone`);
  }
  const s = c.seg;
  for (const [label, fn, seg] of [['saveDraft', s.saveFn, s.save], ['activateSpecial', s.activateFn, s.activate]]) {
    assertIncludes(seg, 'metadata: withoutAutofillProfile({', `${label} omits autofillProfile`);
    assertIncludes(seg, 'assertSpecialWriteKeepsAutofillProfile({\n        rowMetadata: row.metadata,\n        patchMetadata: patch.metadata,', `${label} guards the patch it sends against the row`);
    assert(fn.indexOf('assertSpecialWriteKeepsAutofillProfile(') < fn.indexOf('updateGlobalRegistryRow(row.id, patch)'), `${label}: guard before the write`);
    assertNotIncludes(fn, 'readAutofillProfileFromMetadata', `${label}: no read of the saved STANDARD profile`);
  }
  // Unchanged surfaces.
  assertIncludes(read('src/admin/specialActionBar.ts'), '    autofillProfile: input.profilePayload,', 'grid patch still writes autofillProfile');
  assertIncludes(read('src/loginContract/merge.ts'), "if (isRecord(planRaw) && Object.prototype.hasOwnProperty.call(planRaw, 'active')) {", 'merge guard unchanged');
  for (const f of ['src/admin/AutofillProfileEditor.tsx', 'src/autofill/validatedProfile.ts', 'src/admin/adminRegistryApi.ts', 'extension/background.js']) {
    assertNotIncludes(read(f), 'assertSpecialWriteKeepsAutofillProfile', `${f} not touched by the SPECIAL guard`);
  }
  return 'static: overlap rule and old guard gone; both editor writers omit + guard before writing; STANDARD / merge surfaces unchanged';
}

const GROUPS = [checkSaveShared, checkApprove, checkGuardRules, checkEditorRefuses, checkFrameRule, checkPassthroughEvidence, checkStatic];

async function makeContext({ guardSrc = read(GUARD_FILE), editorSrc = read(EDITOR_FILE) } = {}) {
  const C = guardSrc === read(GUARD_FILE)
    ? realC
    : await loadModule('src/loginContract/index.ts', 'contract-mut', [overridePlugin({ [GUARD_FILE]: guardSrc })]);
  return { C, guardSrc, seg: editorSegments(editorSrc) };
}

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
const G = read(GUARD_FILE);
const E = read(EDITOR_FILE);
const MUTATIONS = [
  { id: 'MG1 guard skips the deep-equal (any present profile accepted)', guard: ['    !sameJsonValue(row[AUTOFILL_PROFILE_META_KEY], next)\n', '    false\n'] },
  { id: 'MG2 guard allows a profile key on a row without one', guard: ['    !Object.prototype.hasOwnProperty.call(row, AUTOFILL_PROFILE_META_KEY) ||\n', ''] },
  { id: 'MG3 guard drops the frame check', guard: ['  return assertNoFrameInAutofillMappings(\n    isPlainRecord(next) && Array.isArray(next.fieldMappings) ? next.fieldMappings : [],\n  );', '  return { ok: true };'] },
  { id: 'MG4 guard compares by serialized key order', guard: ['    !sameJsonValue(row[AUTOFILL_PROFILE_META_KEY], next)\n', '    JSON.stringify(row[AUTOFILL_PROFILE_META_KEY]) !== JSON.stringify(next)\n'] },
  {
    id: 'MG5 fieldId + locator overlap rule restored',
    guard: [
      '  if (!Object.prototype.hasOwnProperty.call(patch, AUTOFILL_PROFILE_META_KEY)) {\n    return { ok: true };\n  }',
      '  { const std = (isPlainRecord(row[AUTOFILL_PROFILE_META_KEY]) && Array.isArray((row[AUTOFILL_PROFILE_META_KEY] as any).fieldMappings)) ? (row[AUTOFILL_PROFILE_META_KEY] as any).fieldMappings : [];\n    const d = (patch as any).loginFlowPlan?.draft;\n    const keys = new Set<string>((d?.steps ?? []).flatMap((s: any) => s.fieldMappings.map((m: any) => `${m.fieldId}|${m.locator}`)));\n    if (std.some((m: any) => keys.has(`${m.fieldId}|${m.locator}`))) return AUTOFILL_WRITE_FORBIDDEN; }\n  if (!Object.prototype.hasOwnProperty.call(patch, AUTOFILL_PROFILE_META_KEY)) {\n    return { ok: true };\n  }',
    ],
  },
  { id: 'MF1 frame rule removed', guard: ["  if (rows.some((m) => isPlainRecord(m) && Object.prototype.hasOwnProperty.call(m, 'frame'))) {", '  if (false) {'] },
  { id: 'ME1 saveDraft passes autofillProfile through', editor: ['        metadata: withoutAutofillProfile({\n          ...withoutLoginContractKeys(row.metadata),', '        metadata: ({\n          ...withoutLoginContractKeys(row.metadata),'] },
  { id: 'ME2 saveDraft ignores the guard', editor: ['      if (!keepsAutofill.ok) {\n        setError(keepsAutofill.message);', '      if (false) {\n        setError(keepsAutofill.message);'] },
  { id: 'ME3 activateSpecial passes autofillProfile through', editor: ['        metadata: withoutAutofillProfile({\n          ...(row.metadata ?? {}),', '        metadata: ({\n          ...(row.metadata ?? {}),'] },
  { id: 'ME4 activateSpecial ignores the guard', editor: ['      if (!keepsAutofill.ok) {\n        setApproveFailure(keepsAutofill.message);', '      if (false) {\n        setApproveFailure(keepsAutofill.message);'] },
];

console.log('\nMutations');
let caught = 0;
for (const mu of MUTATIONS) {
  const opts = {};
  if (mu.guard) opts.guardSrc = replaceOnce(G, mu.guard[0], mu.guard[1], mu.id);
  if (mu.editor) opts.editorSrc = replaceOnce(E, mu.editor[0], mu.editor[1], mu.id);
  let failure = null;
  try {
    await runGroups(await makeContext(opts), false);
  } catch (err) {
    failure = err;
  }
  assert(failure, `mutation NOT caught: ${mu.id}`);
  assert(!String(failure.message).startsWith('fixture:'), `mutation ${mu.id} failed on fixture setup: ${failure.message}`);
  caught += 1;
  console.log(`  ✓ mutation caught: ${mu.id}  [${failure.message}]`);
}

console.log(`\nPASS — Phase 121 D-121-64 SPECIAL save guard (${GROUPS.length} check groups, ${caught} mutations caught)`);
process.exit(0);
