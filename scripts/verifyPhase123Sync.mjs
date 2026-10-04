/**
 * Phase 123 fix round — D-123-1 / AD-123-18 with amendment A (persisted outbox: INSERT only for
 * ids created locally and not yet confirmed; update-only + gone for every other row; login /
 * focus re-hydrate keep-or-drop by the outbox; generation bump before the cloud profile delete)
 * and the D-123-5 write cost.
 *
 * Two layers, both on the real sources (mutations are applied in memory):
 *  - sync (Node bundle): the real supabase/persistence.ts + sessionSyncScope.ts +
 *    vault/syncOutbox.ts + registryPresence.ts + digitalHome/cloudReconcile.ts, loaded as
 *    independent module instances = browser sessions / page loads of one user, sharing one
 *    in-memory fake Supabase (user_services / access_profiles / encrypted_credentials with FK
 *    cascades, users, registry). A "reload" = a new module instance whose local vault is the
 *    JSON copy of the persisted state (the outbox travels inside the vault payload).
 *    Stubbed seams only: supabase/client (fake), auth (fixed user), vault/crypto (reversible
 *    fake cipher), dev/devMode, registryMapper, serviceSelection message. Synthetic fixtures only;
 *    no credential value is logged.
 *  - vault (Node bundle): the real vault/vault.ts + vault/crypto.ts (argon2id + AES-GCM) with an
 *    in-memory IndexedDB stub: an old vault (no outbox field) unlocks; lock-unlock keeps the outbox.
 *  - static: App wiring (login: hydrate → cloud baseline read → outbox keep-or-drop → baseline from
 *    the cloud as read → repair of differing rows only (Known Issue 5) → drop gone + clear confirmed; local creations recorded on every local save; confirmed-insert
 *    listener persists the clear locally; gone listener; throttled focus / visibility refresh;
 *    logout clears the scope) and the host bumps the dual-write generation right before
 *    deleteAccessProfileFromCloud.
 *
 * H-1: every scenario and every mutation run is bounded (scripts/lib/withTimeout.mjs); a timeout
 * fails the run and is never counted as a caught mutation.
 *
 * Usage: node scripts/verifyPhase123Sync.mjs [--no-mutations | --mutations=M1,M2]
 *        No mutation switch = full sweep (END OF ROUND only, test policy T-1).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { makeTempDir, removeTempDir } from './lib/tempDir.mjs';
import { formatElapsed, mutationId, parseMutationArgs, selectMutations } from './lib/mutationArgs.mjs';
import { checkTimeoutMessage, failRun, isTimeout, mutationTimeoutMessage, withTimeout } from './lib/withTimeout.mjs';

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
const source = (overrides, rel) => overrides[rel] ?? read(rel);
const SCENARIO_TIMEOUT_MS = 30_000;
const MUTATION_TIMEOUT_MS = 120_000;

// ─── Fake Supabase (shared by all sessions) ───────────────────────────────────
const USER = 'user-123-sync';
/** Cloud credential key; VAULT_KEY = the local vault key of the legacy dual-write era. */
const KEY = { fake: 'crypto-key' };
const VAULT_KEY = { fake: 'vault-key' };

function makeDb() {
  return {
    users: [],
    user_services: [],
    access_profiles: [],
    encrypted_credentials: [],
    service_registry: [],
    nextId: 1,
    fail: new Set(),
    log: [],
  };
}

function cascadeDelete(db, table, removed) {
  if (table === 'user_services') {
    const ids = new Set(removed.map((r) => r.id));
    const profiles = db.access_profiles.filter((p) => ids.has(p.user_service_id));
    db.access_profiles = db.access_profiles.filter((p) => !ids.has(p.user_service_id));
    cascadeDelete(db, 'access_profiles', profiles);
  } else if (table === 'access_profiles') {
    const ids = new Set(removed.map((r) => r.id));
    db.encrypted_credentials = db.encrypted_credentials.filter((c) => !ids.has(c.access_profile_id));
  }
}

class Query {
  constructor(db, session, table) {
    Object.assign(this, { db, session, table, op: null, payload: null, conflict: null, filters: [], one: null });
  }
  select() {
    if (!this.op) this.op = 'select';
    return this;
  }
  insert(payload) {
    return Object.assign(this, { op: 'insert', payload });
  }
  upsert(payload, opts) {
    return Object.assign(this, { op: 'upsert', payload, conflict: (opts?.onConflict ?? 'id').split(',') });
  }
  update(payload) {
    return Object.assign(this, { op: 'update', payload });
  }
  delete() {
    return Object.assign(this, { op: 'delete' });
  }
  eq(k, v) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  is(k, v) {
    this.filters.push((r) => (r[k] ?? null) === v);
    return this;
  }
  in(k, vs) {
    this.filters.push((r) => vs.includes(r[k]));
    return this;
  }
  order(k) {
    this.orderKey = k;
    return this;
  }
  single() {
    this.one = 'single';
    return this;
  }
  maybeSingle() {
    this.one = 'maybe';
    return this;
  }
  then(resolve, reject) {
    return Promise.resolve().then(() => this.run()).then(resolve, reject);
  }
  run() {
    const { db, table } = this;
    db.log.push({ session: this.session, table, op: this.op });
    if (db.fail.has(`${table}:${this.op}`)) return { data: null, error: { message: `fake ${table}:${this.op} failure` } };
    const rows = db[table];
    const match = (r) => this.filters.every((f) => f(r));
    let data = [];
    if (this.op === 'select') {
      data = rows.filter(match);
      if (this.orderKey) data = [...data].sort((a, b) => (a[this.orderKey] ?? 1e9) - (b[this.orderKey] ?? 1e9));
    } else if (this.op === 'update') {
      data = rows.filter(match);
      for (const r of data) Object.assign(r, this.payload);
    } else if (this.op === 'upsert' || this.op === 'insert') {
      const row = this.payload;
      const existing = this.conflict ? rows.find((r) => this.conflict.every((k) => r[k] === row[k])) : null;
      if (existing) Object.assign(existing, row);
      else rows.push({ id: `${table}-${db.nextId++}`, ...row });
      data = [existing ?? rows[rows.length - 1]];
    } else if (this.op === 'delete') {
      const removed = rows.filter(match);
      db[table] = rows.filter((r) => !match(r));
      cascadeDelete(db, table, removed);
      data = removed;
    }
    const copy = data.map((r) => ({ ...r }));
    if (this.one) return { data: copy[0] ?? null, error: null };
    return { data: copy, error: null };
  }
}

function makeClient(db, session) {
  return {
    from: (table) => new Query(db, session, table),
    rpc: async () => ({ data: null, error: { message: 'registry presence unavailable in the fake' } }),
  };
}

/** Writes a vault state straight into the fake cloud (the starting account). */
function seedCloud(db, state) {
  db.users.push({ id: USER });
  state.selectedIds.forEach((serviceId, index) => {
    db.user_services.push({ id: `us-${serviceId}`, user_id: USER, service_id: serviceId, sort_order: index });
  });
  for (const p of state.accessProfiles) {
    const cloudId = `ap-${p.id}`;
    db.access_profiles.push({
      id: cloudId,
      user_id: USER,
      user_service_id: `us-${p.serviceId}`,
      local_profile_id: p.id,
      display_name: p.displayName,
      is_default: p.isDefault === true,
      schema_version: 1,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    });
    const cred = state.credentials[p.id];
    if (cred) db.encrypted_credentials.push({ id: `ec-${p.id}`, access_profile_id: cloudId, ciphertext: fakeCipher(cred), iv: 'iv' });
  }
}
const fakeCipher = (cred) => Buffer.from(JSON.stringify(cred)).toString('base64');

const cloudServiceIds = (db) => db.user_services.filter((r) => r.user_id === USER).map((r) => r.service_id).sort();
const cloudProfileIds = (db) => db.access_profiles.filter((r) => r.user_id === USER).map((r) => r.local_profile_id).sort();
const cloudProfile = (db, id) => db.access_profiles.find((r) => r.local_profile_id === id) ?? null;
const cloudCredentialFor = (db, id) => {
  const p = cloudProfile(db, id);
  return p ? db.encrypted_credentials.find((c) => c.access_profile_id === p.id) ?? null : null;
};
const writesBy = (db, session) => db.log.filter((e) => e.session === session && e.op !== 'select').length;
const requestsBy = (db, session) => db.log.filter((e) => e.session === session).length;

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
/** Mirrors the D-123-1 account: «יעל 2» on paypal, plus an app whose only profile gets deleted. */
const ACCOUNT = {
  selectedIds: ['svc-pay', 'svc-solo', 'svc-gone'],
  customServices: [],
  accessProfiles: [
    prof('p-pay-main', 'svc-pay', 'ראשי', true),
    prof('p-pay-yael2', 'svc-pay', 'יעל 2'),
    prof('p-solo', 'svc-solo', 'יחיד', true),
    prof('p-gone', 'svc-gone', 'אפליקציה שתימחק', true),
  ],
  credentials: {
    'p-pay-main': { username: 'fixture-main' },
    'p-pay-yael2': { username: 'fixture-yael2' },
  },
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const EMPTY_LOCAL = { selectedIds: [], customServices: [], accessProfiles: [], credentials: {}, syncOutbox: { serviceIds: [], profileIds: [] } };

// ─── Bundle (one file, one module instance per session / page load) ───────────
const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
const STUBS = {
  'src/supabase/client.ts': () =>
    'const SESSION = new URL(import.meta.url).searchParams.get("s");\n' +
    'export function getSupabaseClient() { return globalThis.__pvSync.clientFor(SESSION); }',
  'src/auth/index.ts': () => 'export async function tryGetAuthenticatedUserId() { return globalThis.__pvSync.userId; }',
  'src/vault/crypto.ts': () =>
    'export async function encryptCredentialSet(_key, cred) { return { ciphertext: Buffer.from(JSON.stringify(cred)).toString("base64"), iv: "iv", fieldIdsPresent: Object.keys(cred) }; }\n' +
    // "vk:" = legacy ciphertext written under the vault key: only that key reads it.
    'export async function decryptCredentialSetWithKeys(keys, c) { if (c.startsWith("vk:")) { if (!keys.some((k) => k && k.fake === "vault-key")) return null; c = c.slice(3); } try { return JSON.parse(Buffer.from(c, "base64").toString()); } catch { return null; } }',
  'src/dev/devMode.ts': () => 'export const isDevBuild = () => false;',
  'src/registry/registryMapper.ts': () => 'export function registryRowToServiceDefinition() { throw new Error("no customs in the fake"); }',
  'src/serviceManagement/serviceSelection.ts': () => 'export const CLOUD_REMOVE_UNAVAILABLE_MESSAGE = "cloud remove unavailable";',
};

/**
 * Real vault.ts + crypto.ts (argon2id + AES-GCM, as in the app): only IndexedDB and the cloud
 * seams are stubbed, so "an old vault opens" runs the real unlock path.
 */
const VAULT_STUBS = {
  'src/vault/db.ts': () =>
    'const store = () => (globalThis.__pvVaultDb ??= new Map());\n' +
    'export function vaultStorageIdForUser(u) { return "user:" + u.trim(); }\n' +
    'export async function getVault(u) { const r = store().get("user:" + u.trim()); return r ? JSON.parse(JSON.stringify(r)) : null; }\n' +
    'export async function putVault(r) { store().set(r.id, JSON.parse(JSON.stringify(r))); }',
  'src/supabase/persistence.ts': () =>
    'let gen = 0;\n' +
    'export async function fetchVaultKdf() { return null; }\n' +
    'export async function ensureVaultKdfSeeded() {}\n' +
    'export async function ensureUserRow() { throw new Error("no cloud in the vault layer"); }\n' +
    'export async function syncVaultStateToSupabaseSafe() { return { ok: true }; }\n' +
    'export function bumpDualWriteGeneration() { return ++gen; }',
  'src/dev/devMode.ts': () => 'export const isDevBuild = () => false;',
};
const VAULT_ENTRY = `
export { unlockVault, persistVault, lockVault, WrongPasswordError } from './src/vault/vault.ts';
export { createCryptoKey, encryptPayload, generateSalt, saltFromBase64, saltToBase64 } from './src/vault/crypto.ts';
`;

function seamsPlugin(overrides, used, stubTable = STUBS) {
  const stubs = new Map(Object.entries(stubTable).map(([rel, fn]) => [abs(rel), fn]));
  const overridden = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  return {
    name: 'phase123-sync-seams',
    setup(b) {
      b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
        const key = args.path.replace(/\\/g, '/').toLowerCase();
        const loader = key.endsWith('.tsx') ? 'tsx' : 'ts';
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

const ENTRY = `
export * from './src/supabase/persistence.ts';
export * as scope from './src/supabase/sessionSyncScope.ts';
export * as outbox from './src/vault/syncOutbox.ts';
export { applyOutboxAfterHydrate, dropGoneFromVault, reconcileChanges } from './src/digitalHome/cloudReconcile.ts';
`;

const pendingDirs = [];
let bundleSeq = 0;
async function loadSessions(overrides) {
  const dir = makeTempDir('pv-123-sync-');
  pendingDirs.push(dir);
  const used = new Set();
  const nodeOverrides = Object.fromEntries(Object.entries(overrides).filter(([rel]) => rel.endsWith('.ts')));
  await build({
    bundle: true,
    write: true,
    logLevel: 'silent',
    stdin: { contents: ENTRY, resolveDir: root, loader: 'ts', sourcefile: 'sync.ts' },
    outfile: join(dir, 'sync.mjs'),
    format: 'esm',
    platform: 'node',
    define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production' }) },
    plugins: [seamsPlugin(nodeOverrides, used)],
  });
  await build({
    bundle: true,
    write: true,
    logLevel: 'silent',
    stdin: { contents: VAULT_ENTRY, resolveDir: root, loader: 'ts', sourcefile: 'vault.ts' },
    outfile: join(dir, 'vault.mjs'),
    format: 'esm',
    platform: 'node',
    define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production' }) },
    plugins: [seamsPlugin(nodeOverrides, used, VAULT_STUBS)],
  });
  assert(used.size === Object.keys(nodeOverrides).length, `fixture: every override loaded (${used.size}/${Object.keys(nodeOverrides).length})`);
  const href = pathToFileURL(join(dir, 'sync.mjs')).href;
  const vaultHref = pathToFileURL(join(dir, 'vault.mjs')).href;
  const n = (bundleSeq += 1);
  // A fresh pair of module instances per call: separate module state (scope, generation, outbox guards).
  const sessions = async () => {
    const k = (bundleSeq += 1);
    const A = await import(`${href}?s=A&n=${n}-${k}`);
    const B = await import(`${href}?s=B&n=${n}-${k}`);
    return { A, B };
  };
  sessions.vault = async () => import(`${vaultHref}?n=${n}-${(bundleSeq += 1)}`);
  return sessions;
}

function setup(db) {
  globalThis.__pvSync = { userId: USER, clientFor: (session) => makeClient(db, session) };
}

const sync = (mod, state, options) => mod.syncVaultStateToSupabase(KEY, state, options);
const outboxOf = (state) => state.syncOutbox ?? { serviceIds: [], profileIds: [] };

/** App `commitReconciledState` + confirmed-insert listener: drop gone rows, clear confirmed ids. */
function settle(mod, state, result) {
  const dropped = mod.dropGoneFromVault(state, result);
  const changes = mod.reconcileChanges(state, dropped);
  mod.outbox.noteDroppedRows(changes.removedServiceIds, changes.removedProfileIds);
  return mod.outbox.clearConfirmedInserts(dropped, result.confirmed);
}

/**
 * App `handleAuthenticated`: hydrate → cloud baseline read → outbox keep-or-drop → baseline from
 * the cloud as read → repair (only rows that differ from the cloud) → settle.
 */
async function login(mod, local = EMPTY_LOCAL) {
  const loaded = clone(local);
  let hydrated = await mod.hydrateWorkspaceFromCloud(USER, [KEY, VAULT_KEY], loaded);
  const cloud = await mod.fetchCloudSyncBaseline(USER, KEY);
  hydrated = mod.applyOutboxAfterHydrate(loaded, hydrated, cloud);
  if (cloud) mod.scope.resetSessionSyncBaselineFromCloud(USER, hydrated, cloud);
  else mod.scope.resetSessionSyncBaseline(USER, hydrated);
  try {
    const repair = await sync(mod, hydrated);
    hydrated = mod.outbox.clearConfirmedInserts(mod.dropGoneFromVault(hydrated, repair), repair.confirmed);
  } catch {
    // App: the repair failure is logged only; local state stays.
  }
  return hydrated;
}

/** A local save in App: new rows enter the outbox (`recordLocalCreations(latest, next)`). */
const local = (mod, latest, change) => mod.outbox.recordLocalCreations(latest, change(latest));
const rename = (id, displayName) => (state) => ({
  ...state,
  accessProfiles: state.accessProfiles.map((p) => (p.id === id ? { ...p, displayName } : p)),
});
const withCredential = (id, cred) => (state) => ({ ...state, credentials: { ...state.credentials, [id]: cred } });
const addProfile = (p, cred) => (state) => ({
  ...state,
  accessProfiles: [...state.accessProfiles, p],
  credentials: cred ? { ...state.credentials, [p.id]: cred } : state.credentials,
});
const addService = (id) => (state) => ({ ...state, selectedIds: [...state.selectedIds, id] });
const pipe = (...fns) => (state) => fns.reduce((s, fn) => fn(s), state);

// ─── Scenarios ────────────────────────────────────────────────────────────────
async function checkOutboxHelpers(sessions) {
  const { A } = await sessions();
  const o = A.outbox;
  assert(JSON.stringify(o.normalizeSyncOutbox(undefined)) === '{"serviceIds":[],"profileIds":[]}', 'amendment A: an existing vault without the field gets an empty outbox');
  assert(JSON.stringify(o.normalizeSyncOutbox({ serviceIds: [' a ', 'a', 3, ''], profileIds: 'x' })) === '{"serviceIds":["a"],"profileIds":[]}', 'amendment A: the outbox is normalized (strings, trimmed, unique)');

  const base = { ...clone(ACCOUNT), syncOutbox: { serviceIds: [], profileIds: [] } };
  const created = local(A, base, pipe(addService('svc-x'), addProfile(prof('p-x', 'svc-x', 'x', true))));
  assert(outboxOf(created).serviceIds.join() === 'svc-x' && outboxOf(created).profileIds.join() === 'p-x', 'amendment A: a local creation enters the outbox');
  assert(outboxOf(local(A, created, rename('p-pay-main', 'r'))).profileIds.join() === 'p-x', 'amendment A: an edit of an existing row does not enter the outbox');
  const removed = A.outbox.recordLocalCreations(created, { ...created, accessProfiles: created.accessProfiles.filter((p) => p.id !== 'p-x') });
  assert(!outboxOf(removed).profileIds.includes('p-x'), 'amendment A: a row removed locally leaves the outbox');

  // The latest state's outbox is the base: a screen built on an older state cannot bring a cleared id back.
  const confirmed = o.clearConfirmedInserts(created, { serviceIds: ['svc-x'], profileIds: ['p-x'] });
  assert(outboxOf(confirmed).serviceIds.length === 0 && outboxOf(confirmed).profileIds.length === 0, 'amendment A: confirmed ids leave the outbox');
  const fromOld = o.recordLocalCreations(confirmed, rename('p-x', 'y')(created));
  assert(outboxOf(fromOld).profileIds.length === 0 && outboxOf(fromOld).serviceIds.length === 0, 'amendment A: a save built on an older state does not restore a confirmed id');

  // Early confirmation (a save that awaits its sync): applied once the state is committed.
  o.rememberEarlyConfirmations(base, { serviceIds: ['svc-x'], profileIds: [] });
  const early = o.takeEarlyConfirmations(created);
  assert(early.serviceIds.join() === 'svc-x', 'amendment A: a confirmation that arrived before the commit is applied after it');
  assert(o.takeEarlyConfirmations(created).serviceIds.length === 0, 'amendment A: an early confirmation is consumed once');
  return 'amendment A outbox: missing field → empty; local creations enter, edits do not, local removals leave; confirmed ids leave and an older screen cannot restore them; early confirmations applied once';
}

async function checkStaleProfileNotRecreated(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A, B } = await sessions();
  await login(A, ACCOUNT);
  let b = await login(B, ACCOUNT);
  assert(b.accessProfiles.some((p) => p.id === 'p-pay-yael2'), 'fixture: B starts with «יעל 2»');
  assert(outboxOf(b).profileIds.length === 0 && outboxOf(b).serviceIds.length === 0, 'amendment A: rows that came from the cloud are not in the outbox');

  A.bumpDualWriteGeneration();
  await A.deleteAccessProfileFromCloud('p-pay-yael2');
  assert(!cloudProfileIds(db).includes('p-pay-yael2'), 'fixture: A deleted «יעל 2» in the cloud');

  // D-123-1 trigger: the stale session saves an unrelated change.
  b = local(B, b, rename('p-pay-main', 'ראשי חדש'));
  let result = await sync(B, b);
  assert(!cloudProfileIds(db).includes('p-pay-yael2'), 'D-123-1: a stale session save does not recreate a profile deleted elsewhere');
  assert(cloudProfile(db, 'p-pay-main')?.display_name === 'ראשי חדש', 'AD-123-18: the real edit still reaches the cloud');
  assert(result.goneProfileIds.length === 0, 'AD-123-18: an untouched stale row is not written (nothing to report)');

  // Editing the stale row itself: update-only finds it gone → reported, never upserted.
  const edited = local(B, b, pipe(rename('p-pay-yael2', 'יעל 2 ערוך'), withCredential('p-pay-yael2', { username: 'fixture-yael2-edit' })));
  result = await sync(B, edited);
  assert(!cloudProfileIds(db).includes('p-pay-yael2'), 'D-123-1: editing a profile deleted elsewhere does not recreate it');
  assert(result.goneProfileIds.join() === 'p-pay-yael2', 'AD-123-18 (2): the gone profile is reported');
  assert(db.encrypted_credentials.every((c) => db.access_profiles.some((p) => p.id === c.access_profile_id)), 'no orphan ciphertext written');

  const dropped = settle(B, edited, result);
  assert(!dropped.accessProfiles.some((p) => p.id === 'p-pay-yael2'), 'AD-123-18 (2): the stale session drops the profile locally');
  assert(!('p-pay-yael2' in dropped.credentials), 'AD-123-18 (2): …and its credential');
  assert(dropped.accessProfiles.filter((p) => p.serviceId === 'svc-pay' && p.isDefault).length === 1, 'one default kept');

  // A stale screen hands the pre-drop state back: the dropped row is not a local creation.
  const stale = B.outbox.recordLocalCreations(dropped, edited);
  assert(!outboxOf(stale).profileIds.includes('p-pay-yael2'), 'amendment A: a row dropped as deleted elsewhere does not enter the outbox from a stale screen');
  await sync(B, stale);
  await sync(B, stale, { writeAll: true });
  assert(!cloudProfileIds(db).includes('p-pay-yael2'), 'amendment A: the stale screen save and the writeAll repair do not recreate it');
  return 'D-123-1: stale session B — unrelated save, edit of the deleted profile, a stale screen save and the writeAll repair never recreate «יעל 2»; gone reported; dropped locally with its credential';
}

async function checkStaleAppNotRecreated(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A, B } = await sessions();
  await login(A, ACCOUNT);
  let b = await login(B, ACCOUNT);
  await A.removeUserServiceFromCloud('svc-gone');
  assert(!cloudServiceIds(db).includes('svc-gone') && !cloudProfileIds(db).includes('p-gone'), 'fixture: A removed the app (cascade)');

  b = local(B, b, rename('p-gone', 'עריכה ישנה'));
  const result = await sync(B, b);
  assert(!cloudServiceIds(db).includes('svc-gone'), 'D-123-1: a stale session does not recreate an app removed elsewhere');
  assert(!cloudProfileIds(db).includes('p-gone'), 'D-123-1: …nor its profile');
  assert(result.goneServiceIds.join() === 'svc-gone', 'AD-123-18 (2): the gone app is reported');

  const repair = await sync(B, b, { writeAll: true });
  assert(!cloudServiceIds(db).includes('svc-gone'), 'AD-123-18: writeAll repair does not recreate the app');
  assert(repair.goneServiceIds.join() === 'svc-gone', 'AD-123-18: writeAll repair reports it gone');
  const dropped = settle(B, b, repair);
  assert(!dropped.selectedIds.includes('svc-gone') && !dropped.accessProfiles.some((p) => p.serviceId === 'svc-gone'), 'AD-123-18 (2): app + profiles dropped locally');
  const changes = B.reconcileChanges(b, dropped);
  assert(changes.affectedServiceIds.has('svc-gone') && changes.removedServiceIds.has('svc-gone'), 'reconcileChanges names the affected app (window close)');

  const stale = B.outbox.recordLocalCreations(dropped, b);
  assert(!outboxOf(stale).serviceIds.includes('svc-gone'), 'amendment A: a stale screen does not put a dropped app in the outbox');
  await sync(B, stale);
  assert(!cloudServiceIds(db).includes('svc-gone'), 'amendment A: the stale screen save does not recreate the app');

  // A deliberate re-add of the same app is a new local creation.
  B.outbox.noteDeliberateAdd('svc-gone');
  const readded = local(B, dropped, addService('svc-gone'));
  const again = await sync(B, readded);
  assert(cloudServiceIds(db).includes('svc-gone'), 'AD-123-18: the user can add a dropped app again (inserted)');
  assert(again.confirmed.serviceIds.includes('svc-gone'), 'amendment A: the re-added app is confirmed');
  return 'D-123-1: app removed in A — B edit, writeAll repair and a stale screen never recreate membership or profile; gone reported; dropped locally; affected app named; a deliberate re-add inserts and is confirmed';
}

async function checkOwnCreationsInserted(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A } = await sessions();
  let a = await login(A, ACCOUNT);
  a = local(A, a, addProfile(prof('p-pay-new', 'svc-pay', 'חדש'), { username: 'fixture-new' }));
  a = local(A, a, addService('svc-new'));
  a = local(A, a, addProfile(prof('p-new-app', 'svc-new', 'ראשי', true)));
  assert(outboxOf(a).serviceIds.join() === 'svc-new' && outboxOf(a).profileIds.join() === 'p-pay-new,p-new-app', 'amendment A: own creations are in the outbox');
  const before = requestsBy(db, 'A');
  const result = await sync(A, a);
  assert(cloudProfileIds(db).includes('p-pay-new'), 'AD-123-18 (1): own new profile inserted');
  assert(cloudCredentialFor(db, 'p-pay-new'), 'AD-123-18 (1): own new profile credential inserted');
  assert(cloudServiceIds(db).includes('svc-new') && cloudProfileIds(db).includes('p-new-app'), 'AD-123-18 (1): own new app + profile inserted');
  assert(result.goneProfileIds.length === 0 && result.goneServiceIds.length === 0, 'nothing reported gone');
  assert(result.confirmed.serviceIds.join() === 'svc-new' && [...result.confirmed.profileIds].sort().join() === 'p-new-app,p-pay-new', 'amendment A: every inserted outbox row is confirmed');
  a = settle(A, a, result);
  assert(outboxOf(a).serviceIds.length === 0 && outboxOf(a).profileIds.length === 0, 'amendment A: confirmed rows leave the outbox');
  const createRequests = requestsBy(db, 'A') - before;

  // D-123-5: an unchanged state writes nothing; a rename updates one row (no inserts).
  const idle = requestsBy(db, 'A');
  await sync(A, a);
  assert(requestsBy(db, 'A') === idle, 'D-123-5: unchanged state → 0 requests');
  const rows = db.access_profiles.length;
  a = local(A, a, rename('p-pay-new', 'חדש 2'));
  const renameStart = writesBy(db, 'A');
  await sync(A, a);
  assert(cloudProfile(db, 'p-pay-new')?.display_name === 'חדש 2' && db.access_profiles.length === rows, 'a confirmed own row is now update-only');
  const renameWrites = writesBy(db, 'A') - renameStart;
  assert(renameWrites <= 2, `D-123-5: a rename writes ≤ 2 rows (users + profile), got ${renameWrites}`);
  return `AD-123-18 (1) + amendment A: own new profile (+credential) and app inserted from the outbox (${createRequests} requests) and confirmed → outbox empty; D-123-5: idle save 0 requests, rename ${renameWrites} writes`;
}

async function checkNeverSyncedSurvivesReload(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A } = await sessions();
  let a = await login(A, ACCOUNT);
  a = local(A, a, addService('svc-offline'));
  a = local(A, a, addProfile(prof('p-offline', 'svc-offline', 'לא מסונכרן', true), { username: 'fixture-offline' }));
  a = local(A, a, addProfile(prof('p-offline-pay', 'svc-pay', 'לא מסונכרן 2'), { username: 'fixture-offline-2' }));

  db.fail.add('user_services:select');
  const heard = [];
  A.setCloudConfirmedListener((c) => heard.push(c));
  const safe = await A.syncVaultStateToSupabaseSafe(KEY, a);
  A.setCloudConfirmedListener(null);
  assert(!safe.ok && heard.length === 0, 'amendment A: a failed sync confirms nothing');
  assert(!cloudServiceIds(db).includes('svc-offline') && !cloudProfileIds(db).includes('p-offline'), 'fixture: nothing reached the cloud while offline');

  // Reload while still offline: hydrate and the existence read fail → everything kept.
  let persisted = clone(a);
  const { A: offline } = await sessions();
  let r = await login(offline, persisted);
  const keeps = (s) =>
    s.selectedIds.includes('svc-offline') &&
    ['p-offline', 'p-offline-pay'].every((id) => s.accessProfiles.some((p) => p.id === id) && s.credentials[id]);
  assert(keeps(r), 'amendment A: a never-synced app / profile (with credential) survives a reload while offline');
  assert(outboxOf(r).profileIds.includes('p-offline') && outboxOf(r).serviceIds.includes('svc-offline'), 'amendment A: …and stays in the outbox');

  // Reload online: absent from the cloud but in the outbox → kept and inserted by the login repair.
  db.fail.clear();
  persisted = clone(r);
  const { A: online } = await sessions();
  r = await login(online, persisted);
  assert(keeps(r), 'amendment A: a never-synced row absent from the cloud is kept at login (hydrate alone would drop it)');
  assert(cloudServiceIds(db).includes('svc-offline') && cloudProfileIds(db).includes('p-offline') && cloudProfileIds(db).includes('p-offline-pay'), 'amendment A: …and inserted later');
  assert(cloudCredentialFor(db, 'p-offline') && cloudCredentialFor(db, 'p-offline-pay'), 'amendment A: …with its credential');
  assert(outboxOf(r).serviceIds.length === 0 && outboxOf(r).profileIds.length === 0, 'amendment A: confirmed at login → outbox empty');
  return 'amendment A: a never-synced app + profiles (with credentials) survive a failed sync and an offline reload (still in the outbox); the next online login keeps them, inserts them and clears the outbox';
}

async function checkDeletedElsewhereRemovedAtLogin(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A, B } = await sessions();
  await login(A, ACCOUNT);
  const persistedB = clone(await login(B, ACCOUNT));
  await A.deleteAccessProfileFromCloud('p-pay-yael2');
  await A.deleteAccessProfileFromCloud('p-solo'); // last profile of svc-solo (hydrate alone keeps it)
  await A.removeUserServiceFromCloud('svc-gone');
  const cloudBefore = JSON.stringify([cloudServiceIds(db), cloudProfileIds(db)]);

  const legacy = clone(persistedB);
  delete legacy.syncOutbox;
  for (const [label, vault] of [['outbox vault', persistedB], ['legacy vault (no outbox field)', legacy]]) {
    // The keep-or-drop step alone removes them (the repair's gone report is a second path).
    const { B: step } = await sessions();
    const loaded = clone(vault);
    const hydrated = await step.hydrateWorkspaceFromCloud(USER, [KEY, VAULT_KEY], loaded);
    const kept = step.applyOutboxAfterHydrate(loaded, hydrated, await step.fetchCloudSyncBaseline(USER, KEY));
    const keptIds = kept.accessProfiles.map((p) => p.id);
    assert(
      !keptIds.includes('p-pay-yael2') && !keptIds.includes('p-solo') && !('p-solo' in kept.credentials) && !kept.selectedIds.includes('svc-gone'),
      `amendment A (${label}): the login keep-or-drop step removes rows absent from the cloud and not in the outbox (before any sync)`,
    );
    const { B: again } = await sessions();
    const r = await login(again, vault);
    const ids = r.accessProfiles.map((p) => p.id);
    assert(!ids.includes('p-pay-yael2') && !('p-pay-yael2' in r.credentials), `amendment A (${label}): a profile deleted elsewhere is removed with its credential`);
    assert(!ids.includes('p-solo'), `amendment A (${label}): a deleted last profile is removed (hydrate alone keeps it)`);
    assert(!r.selectedIds.includes('svc-gone') && !ids.includes('p-gone'), `amendment A (${label}): an app removed elsewhere is removed`);
    assert(r.selectedIds.includes('svc-solo') && ids.includes('p-pay-main') && r.credentials['p-pay-main'], `amendment A (${label}): rows the cloud has are kept`);
    assert(JSON.stringify([cloudServiceIds(db), cloudProfileIds(db)]) === cloudBefore, `amendment A (${label}): the login recreates nothing`);
  }

  // An outbox id the cloud already has (inserted, clear not persisted) is confirmed at login.
  const { B: confirmLogin } = await sessions();
  const r = await login(confirmLogin, { ...clone(persistedB), syncOutbox: { serviceIds: ['svc-pay'], profileIds: ['p-pay-main'] } });
  assert(outboxOf(r).serviceIds.length === 0 && outboxOf(r).profileIds.length === 0, 'amendment A: outbox ids the cloud already has leave the outbox at login');
  return 'amendment A: at login, rows deleted elsewhere (profile, last profile, app) are removed with credentials — for outbox and legacy vaults; nothing recreated; outbox ids already in the cloud are confirmed';
}

async function checkOutboxClearedOnlyOnConfirm(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A, B } = await sessions();
  await login(A, ACCOUNT);
  let b = await login(B, ACCOUNT);
  await A.removeUserServiceFromCloud('svc-gone');
  b = local(B, b, addProfile(prof('p-b-pay', 'svc-pay', 'של B'), { username: 'fixture-b' }));
  b = local(B, b, addProfile(prof('p-b-gone', 'svc-gone', 'על אפליקציה שנמחקה')));

  const heard = [];
  B.setCloudConfirmedListener((c) => heard.push(c));
  db.fail.add('encrypted_credentials:upsert');
  let safe = await B.syncVaultStateToSupabaseSafe(KEY, b);
  assert(!safe.ok && heard.length === 0, 'amendment A: an insert that did not complete (credential write failed) is not confirmed');
  db.fail.clear();

  safe = await B.syncVaultStateToSupabaseSafe(KEY, b);
  assert(safe.ok && heard.length === 1, 'amendment A: a successful insert is reported to the confirmed listener');
  assert(heard[0].profileIds.join() === 'p-b-pay', `amendment A: only the inserted row is confirmed (got ${heard[0].profileIds.join()})`);
  assert(cloudCredentialFor(db, 'p-b-pay'), 'amendment A: the retried insert completed with its credential');
  const cleared = B.outbox.clearConfirmedInserts(b, heard[0]);
  assert(outboxOf(cleared).profileIds.join() === 'p-b-gone', 'amendment A: an unconfirmed row stays in the outbox');
  B.setCloudConfirmedListener(null);

  // An outbox membership the cloud already has (inserted earlier, clear not persisted) is confirmed.
  const pending = { ...cleared, syncOutbox: { serviceIds: ['svc-pay'], profileIds: [] } };
  const result = await sync(B, pending);
  assert(result.confirmed.serviceIds.join() === 'svc-pay', 'amendment A: an outbox membership already in the cloud is confirmed');
  return 'amendment A: a failed insert confirms nothing; on success only inserted rows are confirmed and leave the outbox (an unconfirmed row stays); a membership already in the cloud is confirmed';
}

async function checkFocusRefresh(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A, B } = await sessions();
  await login(A, ACCOUNT);
  let b = await login(B, ACCOUNT);
  await A.deleteAccessProfileFromCloud('p-pay-yael2');
  await A.deleteAccessProfileFromCloud('p-solo');
  await A.removeUserServiceFromCloud('svc-gone');

  // B: own unsynced creations, an unsynced edit of a row A deleted, an unsynced edit of a live row.
  b = local(B, b, addProfile(prof('p-b-own', 'svc-pay', 'של B'), { username: 'fixture-b' }));
  b = local(B, b, addService('svc-b-new'));
  b = local(B, b, rename('p-pay-yael2', 'עריכה שלא נשמרה'));
  b = local(B, b, rename('p-pay-main', 'עריכה מקומית'));
  const refreshed = await B.refreshWorkspaceFromCloud(USER, KEY, b);
  assert(refreshed, 'AD-123-18 (3): refresh returned a new state');
  const ids = refreshed.accessProfiles.map((p) => p.id);
  assert(!ids.includes('p-pay-yael2'), 'AD-123-18 (3): a profile deleted elsewhere is dropped (also with an unsynced local edit)');
  assert(!ids.includes('p-solo'), 'AD-123-18 (3): a deleted last profile is dropped (hydrate alone would keep it)');
  assert(!refreshed.selectedIds.includes('svc-gone') && !ids.includes('p-gone'), 'AD-123-18 (3): an app removed elsewhere is dropped');
  assert(ids.includes('p-b-own') && refreshed.credentials['p-b-own'], 'AD-123-18 (3): own unsynced profile kept with its credential');
  assert(refreshed.selectedIds.includes('svc-b-new'), 'AD-123-18 (3): own unsynced app kept');
  assert(outboxOf(refreshed).profileIds.includes('p-b-own') && outboxOf(refreshed).serviceIds.includes('svc-b-new'), 'amendment A: the refresh keeps the outbox');
  assert(refreshed.accessProfiles.find((p) => p.id === 'p-pay-main')?.displayName === 'עריכה מקומית', 'AD-123-18 (3): an unsynced edit of a live row is kept');
  assert(refreshed.selectedIds.includes('svc-solo'), 'the app stays (0 profiles), only the profile left');
  assert(!('p-pay-yael2' in refreshed.credentials), 'dropped profile credential removed');

  // The App discards a refresh when local changed meanwhile; the stale state is then saved.
  await sync(B, b);
  assert(!cloudProfileIds(db).includes('p-pay-yael2') && !cloudProfileIds(db).includes('p-solo'), 'AD-123-18 (3): a discarded refresh + stale save recreates nothing');
  assert(!cloudServiceIds(db).includes('svc-gone'), 'AD-123-18 (3): a discarded refresh + stale save does not recreate the removed app');

  await sync(B, refreshed);
  assert(cloudProfileIds(db).includes('p-b-own') && cloudServiceIds(db).includes('svc-b-new'), 'AD-123-18 (3): own creations still inserted after the refresh');
  assert(cloudProfile(db, 'p-pay-main')?.display_name === 'עריכה מקומית', 'AD-123-18 (3): the kept edit reaches the cloud');
  assert(!cloudProfileIds(db).includes('p-pay-yael2') && !cloudProfileIds(db).includes('p-solo'), 'refresh + sync recreate nothing');
  assert(!cloudServiceIds(db).includes('svc-gone'), 'refresh + sync do not recreate the removed app');

  // `refreshed` was synced without settling: its outbox still lists rows the cloud now has.
  const same = await B.refreshWorkspaceFromCloud(USER, KEY, refreshed);
  assert(same && JSON.stringify(same.accessProfiles.map((p) => p.id).sort()) === JSON.stringify([...ids].sort()), 'a second refresh is stable');
  assert(outboxOf(same).profileIds.length === 0 && outboxOf(same).serviceIds.length === 0, 'amendment A: a re-hydrate confirms outbox rows the cloud already has');
  return 'AD-123-18 (3): focus refresh drops deleted profiles (incl. last profile and an unsynced edit) and removed apps; keeps own unsynced profile + credential, app, outbox and a live-row edit; the following sync inserts only outbox rows';
}

async function checkFailClosed(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A, B } = await sessions();
  await login(A, ACCOUNT);
  let b = await login(B, ACCOUNT);
  await A.deleteAccessProfileFromCloud('p-pay-yael2');
  b = local(B, b, pipe(rename('p-pay-yael2', 'x'), addProfile(prof('p-b-own', 'svc-pay', 'של B'))));

  const heard = [];
  B.setCloudGoneListener((gone) => heard.push(gone));
  db.fail.add('user_services:select');
  const safe = await B.syncVaultStateToSupabaseSafe(KEY, b);
  assert(safe.ok === false, 'fail-closed: membership read failure → sync reports failure');
  assert(!cloudProfileIds(db).includes('p-b-own') && !cloudProfileIds(db).includes('p-pay-yael2'), 'fail-closed: nothing inserted');
  assert(heard.length === 0, 'fail-closed: nothing reported gone');
  assert((await B.refreshWorkspaceFromCloud(USER, KEY, b)) === null, 'fail-closed: refresh changes nothing when existence cannot be read');
  db.fail.clear();
  db.fail.add('access_profiles:select');
  assert((await B.refreshWorkspaceFromCloud(USER, KEY, b)) === null, 'fail-closed: refresh changes nothing when profiles cannot be read');
  db.fail.clear();

  const ok = await B.syncVaultStateToSupabaseSafe(KEY, b);
  assert(ok.ok && heard.length === 1 && heard[0].goneProfileIds.join() === 'p-pay-yael2', 'AD-123-18 (2): background sync emits the gone row to the listener');
  B.setCloudGoneListener(null);

  // Empty cloud membership cannot prove a deletion (D-109-25 spirit); rows outside the outbox are not inserted.
  const empty = makeDb();
  setup(empty);
  empty.users.push({ id: USER });
  const known = { ...b, syncOutbox: { serviceIds: [], profileIds: [] } };
  const r = await sync(B, local(B, known, rename('p-pay-main', 'y')));
  assert(r.goneProfileIds.length === 0 && r.goneServiceIds.length === 0, 'empty cloud → nothing reported gone');
  assert(empty.user_services.length === 0 && empty.access_profiles.length === 0, 'empty cloud → rows outside the outbox are not inserted');
  return 'fail-closed: membership / profile read errors → no insert, no gone, refresh null; background gone → listener; empty cloud never reports gone nor inserts rows outside the outbox';
}

async function checkNoOutboxNoInsertAndGeneration(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A } = await sessions();
  const before = addProfile(prof('p-before-login', 'svc-pay', 'לפני'))(clone(ACCOUNT));
  await sync(A, before);
  assert(!cloudProfileIds(db).includes('p-before-login'), 'amendment A: a row outside the outbox is never inserted (sync without a baseline)');
  const queued = { ...before, syncOutbox: { serviceIds: [], profileIds: ['p-before-login'] } };
  const result = await sync(A, queued);
  assert(cloudProfileIds(db).includes('p-before-login') && result.confirmed.profileIds.join() === 'p-before-login', 'amendment A: an outbox row is inserted and confirmed by a sync without a baseline too');

  let a = await login(A, queued);
  assert(outboxOf(a).profileIds.length === 0, 'amendment A: login confirms it (outbox empty)');
  a = local(A, a, rename('p-pay-main', 'דור'));
  const generation = A.getDualWriteGeneration();
  A.bumpDualWriteGeneration();
  const writes = writesBy(db, 'A');
  await sync(A, a, { generation });
  assert(writesBy(db, 'A') === writes, 'AD-123-18 (4): a bumped generation aborts an in-flight write (0 writes)');
  return 'amendment A: rows outside the outbox never inserted (also before the baseline); an outbox row is inserted and confirmed; (4) bumped generation aborts the in-flight write';
}

const ROW_TABLES = ['user_services', 'access_profiles', 'encrypted_credentials'];
/** Writes since log index `from`, per table (users excluded: it is not a profile / membership row). */
function rowWritesSince(db, from) {
  const counts = Object.fromEntries(ROW_TABLES.map((t) => [t, 0]));
  for (const e of db.log.slice(from)) if (e.op !== 'select' && e.table in counts) counts[e.table] += 1;
  return counts;
}
const describeWrites = (c) => ROW_TABLES.map((t) => `${t}=${c[t]}`).join(', ');

async function checkLoginWritesOnlyDiffs(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A } = await sessions();
  const first = await login(A, ACCOUNT);

  // Idle login (fresh page load, local == cloud): no profile / membership / credential writes.
  let from = db.log.length;
  const { A: idlePage } = await sessions();
  const idle = await login(idlePage, clone(first));
  const idleWrites = rowWritesSince(db, from);
  assert(ROW_TABLES.every((t) => idleWrites[t] === 0), `Known Issue 5: an idle login writes no rows (got ${describeWrites(idleWrites)})`);
  assert(idle.accessProfiles.length === ACCOUNT.accessProfiles.length, 'fixture: idle login keeps every profile');

  // Legacy vault-key ciphertext (pre cloud-key era): only the vault key reads it → re-keyed for Edge.
  const legacyRow = cloudCredentialFor(db, 'p-pay-main');
  legacyRow.ciphertext = `vk:${fakeCipher(ACCOUNT.credentials['p-pay-main'])}`;
  // A local credential the cloud does not hold at all → uploaded.
  db.encrypted_credentials = db.encrypted_credentials.filter((c) => c !== cloudCredentialFor(db, 'p-pay-yael2'));
  from = db.log.length;
  const { A: repairPage } = await sessions();
  await login(repairPage, clone(first));
  const repairWrites = rowWritesSince(db, from);
  assert(cloudCredentialFor(db, 'p-pay-main')?.ciphertext === fakeCipher(ACCOUNT.credentials['p-pay-main']), 'Known Issue 5: a legacy vault-key credential is still re-keyed at login');
  assert(cloudCredentialFor(db, 'p-pay-yael2'), 'Known Issue 5: a local credential missing in the cloud is uploaded at login');
  assert(repairWrites.user_services === 0, `Known Issue 5: the repair writes no membership rows (got ${describeWrites(repairWrites)})`);
  assert(repairWrites.encrypted_credentials === 2, `Known Issue 5: exactly the 2 differing credentials are written (got ${describeWrites(repairWrites)})`);

  from = db.log.length;
  const { A: againPage } = await sessions();
  await login(againPage, clone(first));
  const againWrites = rowWritesSince(db, from);
  assert(ROW_TABLES.every((t) => againWrites[t] === 0), `Known Issue 5: after a repair the next login is idle again (got ${describeWrites(againWrites)})`);
  return `Known Issue 5: idle login writes 0 rows (${describeWrites(idleWrites)}); legacy vault-key credential re-keyed + missing credential uploaded (${describeWrites(repairWrites)}); the next login is idle again`;
}

async function checkFailedInsertKeepsId(sessions) {
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A } = await sessions();
  let a = await login(A, ACCOUNT);
  a = local(A, a, addService('svc-fail'));
  a = local(A, a, addProfile(prof('p-fail', 'svc-fail', 'נכשל', true), { username: 'fixture-fail' }));

  const heard = [];
  A.setCloudConfirmedListener((c) => heard.push(c));
  db.fail.add('access_profiles:upsert');
  db.fail.add('access_profiles:insert');
  const safe = await A.syncVaultStateToSupabaseSafe(KEY, a);
  A.setCloudConfirmedListener(null);
  assert(!safe.ok && heard.length === 0, 'amendment A: a failed profile insert confirms nothing');
  assert(!cloudProfileIds(db).includes('p-fail'), 'fixture: the profile insert failed');
  assert(outboxOf(a).profileIds.includes('p-fail'), 'amendment A: a failed insert keeps its id in the outbox');

  // Reload while the insert still fails: the id stays in the outbox and the row stays local.
  const { A: retryPage } = await sessions();
  let r = await login(retryPage, clone(a));
  assert(outboxOf(r).profileIds.includes('p-fail'), 'amendment A: a failed insert keeps its id across a reload');
  assert(r.accessProfiles.some((p) => p.id === 'p-fail') && r.credentials['p-fail'], 'amendment A: …and the row with its credential');

  db.fail.clear();
  const { A: okPage } = await sessions();
  r = await login(okPage, clone(r));
  assert(cloudProfileIds(db).includes('p-fail') && cloudCredentialFor(db, 'p-fail'), 'amendment A: the kept id is inserted once the cloud accepts it');
  assert(outboxOf(r).profileIds.length === 0 && outboxOf(r).serviceIds.length === 0, 'amendment A: a confirmed insert removes it from the outbox');
  return 'amendment A: a failed profile insert confirms nothing and keeps its id (also across a reload, row + credential kept); once accepted it is inserted and the confirmed id leaves the outbox';
}

/** Real vault.ts + crypto.ts: an old vault (HEAD payload, no `syncOutbox`) unlocks; lock-unlock keeps the outbox. */
async function checkOldVaultUnlocks(sessions) {
  const V = await sessions.vault();
  globalThis.__pvVaultDb = new Map();
  const user = 'user-123-old-vault';
  const password = 'fixture-master-password';
  const kdf = { algorithm: 'argon2id', salt: V.saltToBase64(V.generateSalt()), iterations: 1, memorySize: 1024, parallelism: 1 };
  const key = await V.createCryptoKey(password, V.saltFromBase64(kdf.salt), kdf);
  const headPayload = {
    credentials: clone(ACCOUNT.credentials),
    selectedIds: [...ACCOUNT.selectedIds],
    accessProfiles: clone(ACCOUNT.accessProfiles),
    customServices: [],
  };
  assert(!('syncOutbox' in headPayload), 'fixture: the old payload has no outbox field');
  const { ciphertext, iv } = await V.encryptPayload(key, headPayload);
  globalThis.__pvVaultDb.set(`user:${user}`, { id: `user:${user}`, kdf, ciphertext, iv });

  const opened = await V.unlockVault(password, user);
  assert(JSON.stringify(opened.syncOutbox) === '{"serviceIds":[],"profileIds":[]}', 'amendment A: an old vault without the field decodes with an empty outbox');
  assert(JSON.stringify(opened.accessProfiles.map((p) => p.id).sort()) === JSON.stringify(ACCOUNT.accessProfiles.map((p) => p.id).sort()), 'amendment A: the old vault keeps its profiles');
  assert(opened.credentials['p-pay-main']?.username === 'fixture-main' && opened.credentials['p-pay-yael2']?.username === 'fixture-yael2', 'amendment A: the old vault keeps its credentials');
  assert(JSON.stringify([...opened.selectedIds].sort()) === JSON.stringify([...ACCOUNT.selectedIds].sort()), 'amendment A: the old vault keeps its apps');

  V.lockVault();
  let rejected = false;
  try {
    await V.unlockVault('not-the-password', user);
  } catch (e) {
    rejected = e instanceof V.WrongPasswordError;
  }
  assert(rejected, 'unlock unchanged: a wrong password is still rejected');

  // A creation not yet synced survives lock → unlock (persisted inside the encrypted payload).
  const unlocked = await V.unlockVault(password, user);
  const created = {
    ...unlocked,
    selectedIds: [...unlocked.selectedIds, 'svc-lock'],
    accessProfiles: [...unlocked.accessProfiles, prof('p-lock', 'svc-lock', 'לפני נעילה', true)],
    credentials: { ...unlocked.credentials, 'p-lock': { username: 'fixture-lock' } },
    syncOutbox: { serviceIds: ['svc-lock'], profileIds: ['p-lock'] },
  };
  await V.persistVault(created, { skipCloudSync: true });
  V.lockVault();
  const reopened = await V.unlockVault(password, user);
  assert(outboxOf(reopened).serviceIds.join() === 'svc-lock' && outboxOf(reopened).profileIds.join() === 'p-lock', 'amendment A: an unsynced creation stays in the outbox across lock-unlock');
  assert(reopened.accessProfiles.some((p) => p.id === 'p-lock') && reopened.credentials['p-lock']?.username === 'fixture-lock', 'amendment A: …with its row and credential');

  // …and is inserted by the next login.
  const db = makeDb();
  setup(db);
  seedCloud(db, ACCOUNT);
  const { A } = await sessions();
  const after = await login(A, reopened);
  assert(cloudServiceIds(db).includes('svc-lock') && cloudProfileIds(db).includes('p-lock') && cloudCredentialFor(db, 'p-lock'), 'amendment A: the creation kept across lock-unlock is inserted later');
  assert(outboxOf(after).serviceIds.length === 0 && outboxOf(after).profileIds.length === 0, 'amendment A: …and confirmed (outbox empty)');
  V.lockVault();
  return 'amendment A (real vault.ts + crypto.ts, argon2id + AES-GCM): an old vault without the field unlocks with an empty outbox, profiles / credentials / apps intact; a wrong password is still rejected; an unsynced creation survives lock-unlock and is inserted at the next login';
}

// ─── Static: App + host wiring ────────────────────────────────────────────────
function checkWiring(overrides) {
  const app = source(overrides, 'src/App.tsx');
  const at = app.indexOf('hydrateWorkspaceFromCloud(\n');
  const login = app.slice(at, at + 2200);
  assert(/const cloud = await fetchCloudSyncBaseline\(profile\.id, cloudCredKey\);\s*hydrated = applyOutboxAfterHydrate\(loaded, hydrated, cloud\);/.test(login), 'login: outbox keep-or-drop on the cloud baseline read');
  assert(/if \(cloud\) \{\s*resetSessionSyncBaselineFromCloud\(profile\.id, hydrated, cloud\);\s*\} else \{\s*resetSessionSyncBaseline\(profile\.id, hydrated\);\s*\}/.test(login), 'Known Issue 5: login baseline = the cloud as read (fallback: hydrated state)');
  assert(!/writeAll/.test(login), 'Known Issue 5: the login repair writes only rows that differ from the cloud (no writeAll)');
  assert(/clearConfirmedInserts\(dropGoneFromVault\(hydrated, repair\), repair\.confirmed\)/.test(login), 'login: repair drops gone rows and clears confirmed ids');
  const loginFlow = app.slice(app.indexOf("startSaveTiming('login')"), app.indexOf("startSaveTiming('login')") + 2600);
  assert(app.includes("const timing = startSaveTiming('login');") && /timing\.mark\('repairSync'\);\s*timing\.done\(\);/.test(loginFlow), 'Known Issue 5: dev-only [timing] line for login');
  assert(!/syncVaultStateToSupabase\(cloudCredKey, loaded/.test(app), 'Known Issue 5: no pre-hydrate full re-key write at login');
  assert(/async function handleVaultStateChange\(state: VaultState\) \{\s*const next = recordLocalCreations\(vaultStateRef\.current, state\);/.test(app), 'amendment A: profile saves record local creations');
  assert(/const next = recordLocalCreations\(\s*vaultState,\s*mode === 'add' \? addToSelection/.test(app), 'amendment A: app add / remove records the outbox');
  assert(/noteDeliberateAdd\(definition\.id\);\s*const nextState = recordLocalCreations\(persistBase, \{/.test(app), 'amendment A: custom-site add records the outbox');
  assert(/function commitConfirmedInserts[\s\S]{0,400}clearConfirmedInserts\(before, confirmed\)[\s\S]{0,300}persistVault\(next, \{ skipCloudSync: true \}\)/.test(app), 'amendment A: a confirmed insert clears the outbox (local persist only)');
  assert(/rememberEarlyConfirmations\(before, confirmed\);/.test(app) && /takeEarlyConfirmations\(vaultState\)/.test(app), 'amendment A: early confirmations are handed over');
  assert(/setCloudConfirmedListener\(commitConfirmedInserts\);\s*return \(\) => setCloudConfirmedListener\(null\);/.test(app), 'amendment A: confirmed listener registered and cleared');
  assert(/setCloudGoneListener\(\(gone: GoneRows\) =>/.test(app) && /return \(\) => setCloudGoneListener\(null\)/.test(app), 'gone listener registered and cleared');
  const refresh = app.slice(app.indexOf('refreshWorkspaceFromCloud(userId'), app.indexOf('refreshWorkspaceFromCloud(userId') + 200);
  assert(/vaultStateRef\.current !== before\) return;/.test(refresh), 'refresh result discarded when local changed meanwhile');
  assert(/addEventListener\('visibilitychange', onReturn\)/.test(app) && /addEventListener\('focus', onReturn\)/.test(app), 'refresh on visibility + focus');
  assert(/Date\.now\(\) - lastRun < CLOUD_REFRESH_MIN_INTERVAL_MS\) return;/.test(app), 'refresh throttled');
  assert(/async function commitReconciledState[\s\S]{0,200}persistVault\(next, \{ skipCloudSync: true \}\)/.test(app), 'reconcile persist is local-only');
  assert(/async function commitReconciledState[\s\S]{0,400}noteDroppedRows\(changes\.removedServiceIds, changes\.removedProfileIds\);/.test(app), 'amendment A: rows dropped by a reconcile cannot re-enter the outbox from a stale screen');
  assert(/clearSessionSyncScope\(\);\s*clearDroppedRows\(\);/.test(app), 'logout clears the scope and the outbox guards');
  const vault = source(overrides, 'src/vault/vault.ts');
  assert(/syncOutbox: state\.syncOutbox,/.test(vault), 'amendment A: the outbox is persisted inside the encrypted vault payload');
  const host = source(overrides, 'src/loginAssistance/DigitalHomeCredentialModal.tsx');
  assert(/bumpDualWriteGeneration\(\);\s*\n\s*await deleteAccessProfileFromCloud\(profileId\);/.test(host), 'AD-123-18 (4): bump right before the cloud profile delete');
  return 'static: login outbox keep-or-drop + baseline from the cloud as read + diff-only repair (drop gone, clear confirmed) + [timing] login, no pre-hydrate re-key, local creations recorded on every local save, confirmed listener (local-only clear, early hand-off), gone listener, throttled refresh (stale result discarded), reconcile guards, logout clears, outbox in the vault payload, bump before profile delete';
}

// ─── Runner ───────────────────────────────────────────────────────────────────
const SCENARIOS = [
  checkOutboxHelpers,
  checkStaleProfileNotRecreated,
  checkStaleAppNotRecreated,
  checkOwnCreationsInserted,
  checkNeverSyncedSurvivesReload,
  checkDeletedElsewhereRemovedAtLogin,
  checkOutboxClearedOnlyOnConfirm,
  checkFocusRefresh,
  checkFailClosed,
  checkNoOutboxNoInsertAndGeneration,
  checkLoginWritesOnlyDiffs,
  checkFailedInsertKeepsId,
  checkOldVaultUnlocks,
];

async function runAll(overrides, log) {
  const what = checkWiring(overrides);
  if (log) console.log(`  ✓ ${what}`);
  try {
    const sessions = await loadSessions(overrides);
    for (const scenario of SCENARIOS) {
      const line = await withTimeout(() => scenario(sessions), SCENARIO_TIMEOUT_MS, checkTimeoutMessage(scenario.name));
      if (log) console.log(`  ✓ ${line}`);
    }
  } finally {
    while (pendingDirs.length) removeTempDir(pendingDirs.pop());
  }
}

const PERSISTENCE = 'src/supabase/persistence.ts';
const RECONCILE = 'src/digitalHome/cloudReconcile.ts';
const OUTBOX = 'src/vault/syncOutbox.ts';
const APP = 'src/App.tsx';
const SCOPE = 'src/supabase/sessionSyncScope.ts';
const MUTATIONS = [
  ['M1 update-only path upserts again (pre-AD-123-18 behavior, reproduces D-123-1)', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '      cloudProfileId = await updateAccessProfileIfExists(userId, userServiceId, profile);',
      '      cloudProfileId = await upsertAccessProfile(userId, userServiceId, profile);', o),
  })],
  ['M2 every profile counts as an outbox row', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '  const isOwnProfile = (profileId: string) => outboxProfiles.has(profileId);',
      '  const isOwnProfile = (_profileId: string) => true;', o),
  })],
  ['M3 missing membership inserted for apps outside the outbox', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '    } else if (isOwnService(serviceId)) {',
      '    } else if (isOwnService(serviceId) || true) {', o),
  })],
  ['M4 full-state sync restored (every row written every save — D-123-5 cost)', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '  const writeAll = options?.writeAll === true || !scoped;',
      '  const writeAll = true;', o),
  })],
  ['M5 gone rows not reported', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE), '        result.goneProfileIds.push(profile.id);', '', o),
  })],
  ['M6 login / refresh keep rows absent from the cloud that are not in the outbox', (o) => ({
    [RECONCILE]: replaceOnce(read(RECONCILE),
      '    (p) => !canDrop || cloud.profileIds.has(p.id) || pendingProfiles.has(p.id),',
      '    (p) => Boolean(p),', o),
  })],
  ['M7 outbox profiles not restored after the hydrate (never-synced profile lost)', (o) => ({
    [RECONCILE]: replaceOnce(read(RECONCILE),
      '    if (!pendingProfiles.has(profile.id) || !selected.has(profile.serviceId.trim())) continue;',
      '    if (true) continue;', o),
  })],
  ['M8 outbox apps not restored after the hydrate (never-synced app lost)', (o) => ({
    [RECONCILE]: replaceOnce(read(RECONCILE),
      '    if (pendingServices.has(id.trim()) && !selectedIds.some((s) => s.trim() === id.trim())) {',
      '    if (false) {', o),
  })],
  ['M9 membership read failure ignored (not fail-closed)', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '  if (membershipError) {\n    throw membershipError;\n  }',
      '  if (membershipError) {\n    // ignored\n  }', o),
  })],
  ['M10 empty cloud may report gone', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '  const canReportGone = existingMembership.size > 0;', '  const canReportGone = true;', o),
  })],
  ['M11 outbox entries cleared without their confirmation', (o) => ({
    [OUTBOX]: replaceOnce(read(OUTBOX),
      '  const profileIds = outbox.profileIds.filter((id) => !profiles.has(id));\n  if (serviceIds.length',
      '  const profileIds = outbox.profileIds.filter(() => profiles.size === 0);\n  if (serviceIds.length', o),
  })],
  ['M12 an outbox membership already in the cloud is never confirmed', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '      if (isOwnService(serviceId)) result.confirmed.serviceIds.push(serviceId);\n', '', o),
  })],
  ['M13 generation bump removed before the cloud profile delete (AD-123-18 (4))', (o) => ({
    'src/loginAssistance/DigitalHomeCredentialModal.tsx': replaceOnce(read('src/loginAssistance/DigitalHomeCredentialModal.tsx'),
      '          bumpDualWriteGeneration();\n          await deleteAccessProfileFromCloud(profileId);',
      '          await deleteAccessProfileFromCloud(profileId);', o),
  })],
  ['M14 focus refresh not throttled', (o) => ({
    [APP]: replaceOnce(read(APP),
      'Date.now() - lastRun < CLOUD_REFRESH_MIN_INTERVAL_MS) return;', 'Date.now() - lastRun < 0) return;', o),
  })],
  ['M15 stale refresh result committed over a newer local state', (o) => ({
    [APP]: replaceOnce(read(APP),
      'if (!refreshed || vaultStateRef.current !== before) return;', 'if (!refreshed) return;', o),
  })],
  ['M16 a stale screen puts a dropped profile back into the outbox', (o) => ({
    [OUTBOX]: replaceOnce(read(OUTBOX),
      '    if (!latestProfiles.has(id) && !droppedProfileIds.has(id) && !profileIds.includes(id)) {',
      '    if (!latestProfiles.has(id) && !profileIds.includes(id)) {', o),
  })],
  ['M17 App reconcile commit does not guard dropped rows', (o) => ({
    [APP]: replaceOnce(read(APP), '    noteDroppedRows(changes.removedServiceIds, changes.removedProfileIds);\n', '', o),
  })],
  ['M18 profile saves do not record local creations (outbox never filled)', (o) => ({
    [APP]: replaceOnce(read(APP),
      '    const next = recordLocalCreations(vaultStateRef.current, state);', '    const next = state;', o),
  })],
  ['M19 outbox not written with the vault payload', (o) => ({
    'src/vault/vault.ts': replaceOnce(read('src/vault/vault.ts'),
      '    syncOutbox: state.syncOutbox,\n', '', o),
  })],
  ['M20 outbox ids already in the cloud kept on login / re-hydrate (not confirmed)', (o) => ({
    [RECONCILE]: replaceOnce(read(RECONCILE),
      '  const pendingServices = new Set(outbox.serviceIds.filter((id) => !cloud?.serviceIds.has(id)));\n  const pendingProfiles = new Set(outbox.profileIds.filter((id) => !cloud?.profileIds.has(id)));',
      '  const pendingServices = new Set(outbox.serviceIds);\n  const pendingProfiles = new Set(outbox.profileIds);', o),
  })],
  ['M21 an older screen restores a confirmed id (outbox base taken from the incoming state)', (o) => ({
    [OUTBOX]: replaceOnce(read(OUTBOX), '  const base = outboxOf(latest);', '  const base = outboxOf(next);', o),
  })],
  ['M22 early confirmations dropped (an awaited save keeps a confirmed id)', (o) => ({
    [OUTBOX]: replaceOnce(read(OUTBOX),
      '    if (!outbox.serviceIds.includes(id.trim())) earlyServiceIds.add(id.trim());\n', '', o),
  })],
  ['M23 confirmed profile reported even when its insert did not complete', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '    const created = isOwnProfile(profile.id);\n',
      '    const created = isOwnProfile(profile.id);\n    if (created) { result.confirmed.profileIds.push(profile.id); cloudConfirmedListener?.(result.confirmed); }\n', o),
  })],
  ['M24 old vault without the field no longer opens (missing outbox not defaulted)', (o) => ({
    [OUTBOX]: replaceOnce(read(OUTBOX),
      "  if (typeof raw !== 'object' || raw === null) return emptySyncOutbox();",
      '  if (raw === null) return emptySyncOutbox();', o),
  })],
  ['M25 login baseline treats every local credential as already in the cloud (legacy re-key lost)', (o) => ({
    [SCOPE]: replaceOnce(read(SCOPE),
      '      local === undefined || sameCredential(local, cloud.credentials.get(profile.id)) ? local : NOT_IN_CLOUD,',
      '      local,', o),
  })],
  ['M26 login baseline empty (idle login rewrites every row)', (o) => ({
    [SCOPE]: replaceOnce(read(SCOPE), '    if (snapshot === undefined) continue;', '    continue;', o),
  })],
  ['M27 login repair writes every row again (writeAll)', (o) => ({
    [APP]: replaceOnce(read(APP),
      '        const repair = await syncVaultStateToSupabase(cloudCredKey, hydrated, {\n          expectedUserId: profile.id,\n        });',
      '        const repair = await syncVaultStateToSupabase(cloudCredKey, hydrated, {\n          expectedUserId: profile.id,\n          writeAll: true,\n        });', o),
  })],
  ['M28 login baseline taken from the hydrated state (differences hidden)', (o) => ({
    [APP]: replaceOnce(read(APP),
      '        resetSessionSyncBaselineFromCloud(profile.id, hydrated, cloud);',
      '        resetSessionSyncBaseline(profile.id, hydrated);', o),
  })],
  ['M29 login [timing] line not logged', (o) => ({
    [APP]: replaceOnce(read(APP), "      timing.mark('repairSync');\n      timing.done();\n", "      timing.mark('repairSync');\n", o),
  })],
  ['M30 a failed sync confirms the whole outbox (failed insert loses its id)', (o) => ({
    [PERSISTENCE]: replaceOnce(read(PERSISTENCE),
      '    return { ok: false, error };\n',
      '    if (state.syncOutbox) cloudConfirmedListener?.(state.syncOutbox);\n    return { ok: false, error };\n', o),
  })],
];

const selectedMutations = selectMutations(MUTATIONS, MUTATION_ARGS, (m) => m[0]);

console.log('Phase 123 fix round — sync (D-123-1 / AD-123-18 + amendment A, D-123-5)\n');
try {
  await runAll({}, true);
  const groupCount = SCENARIOS.length + 1;
  if (MUTATION_ARGS.mode === 'none') {
    console.log(`\nPASS — Phase 123 sync: ${groupCount} check groups, mutation sweep skipped (--no-mutations) — ${formatElapsed(Date.now() - STARTED)}`);
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
        if (isTimeout(e)) await failRun(`${e.message} (${label})`);
        caught = e instanceof Error ? e.message.split('\n')[0] : String(e);
      }
      assert(caught, `mutation NOT caught: ${label}`);
      assert(!caught.startsWith('fixture:'), `mutation broke a fixture instead of a check: ${label} (${caught})`);
      caughtCount += 1;
      console.log(`  ✓ mutation caught: ${id} ${label.slice(id.length + 1)} — ${caught.slice(0, 160)}`);
    }
    const scope = MUTATION_ARGS.mode === 'all' ? 'mutations caught' : 'selected mutations caught';
    console.log(`\nPASS — Phase 123 sync: ${groupCount} check groups, ${caughtCount} ${scope} — ${formatElapsed(Date.now() - STARTED)}`);
  }
} catch (e) {
  await failRun(e instanceof Error ? e.message : String(e));
}
process.exit(0);
