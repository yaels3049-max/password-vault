/**
 * Phase 121 D-121-51 — Admin «מחיקת אתר» (full removal, all users).
 *  A. SQL: the REAL migration runs on PGlite (real Postgres) with Supabase-like roles / default
 *     privileges and the REAL Phase 101 schema, Phase 111 service_assets table and Phase 109
 *     is_admin(): admin-only, typed confirm, one transaction deleting user_services → profiles →
 *     ciphertext, assets and the registry row, audit row, counts, presence RPC.
 *  B. Client: the REAL persistence.ts (sync + hydrate) against an in-memory Supabase fake:
 *     a service missing from the registry is dropped locally and never re-upserted; re-seeded
 *     built-ins and private customs are kept; unknown presence changes nothing.
 *  C. UI / Admin API: the REAL DeleteServiceDialog (minimal hooks runtime) and adminDeleteService
 *     (stubbed client): typed-confirm gating, impact / built-in copy, result, Storage best-effort.
 * Synthetic fixtures only. Mutations must be caught.
 * Usage: node scripts/verifyPhase121DeleteService.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { withTempDir } from './lib/tempDir.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = 'supabase/migrations/20260929120000_phase121_admin_delete_service.sql';
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}
/** Replace once inside `create or replace function public.<fn>(` … `$$;`. */
function replaceInFunction(src, fn, from, to) {
  const start = src.indexOf(`create or replace function public.${fn}(`);
  if (start < 0) throw new Error(`fixture: function ${fn} not found`);
  const end = src.indexOf('$$;', src.indexOf('as $$', start) + 5);
  const body = src.slice(start, end);
  return src.slice(0, start) + replaceOnce(body, from, to, `${fn}: ${from.slice(0, 40)}`) + src.slice(end);
}
// ═══ A. SQL ══════════════════════════════════════════════════════════════════
const ADMIN = '00000000-0000-4000-8000-00000000000a';
const DISABLED_ADMIN = '00000000-0000-4000-8000-00000000000d';
const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const U3 = '00000000-0000-4000-8000-000000000003';
const PAGI = 'pagi-test';
const PAGI_NAME = 'פאגי בדיקה';

function isAdminSql() {
  const src = read('supabase/migrations/20260712200000_phase109_user_profile_auth.sql');
  const m = src.match(/create or replace function public\.is_admin\(\)[\s\S]*?\$\$;\n/);
  if (!m) throw new Error('fixture: Phase 109 is_admin() not found');
  return m[0];
}
function serviceAssetsTableSql() {
  const src = read('supabase/migrations/20260714120000_phase111_service_assets.sql');
  const end = src.indexOf('alter table public.service_assets enable row level security');
  if (end < 0) throw new Error('fixture: Phase 111 table block not found');
  return src.slice(0, end);
}

const SEED = `
insert into auth.users (id) values ('${ADMIN}'), ('${DISABLED_ADMIN}'), ('${U1}'), ('${U2}'), ('${U3}');
insert into public.users (id, is_admin, role, status) values
  ('${ADMIN}', true, 'admin', 'active'),
  ('${DISABLED_ADMIN}', true, 'admin', 'disabled'),
  ('${U1}', false, 'user', 'active'), ('${U2}', false, 'user', 'active'), ('${U3}', false, 'user', 'active');
insert into public.service_registry (id, display_name, primary_url, source_type, service_status, owner_user_id) values
  ('${PAGI}', '${PAGI_NAME}', 'https://pagi.example.test', 'admin', 'active', null),
  ('other-site', 'אתר אחר', 'https://other.example.test', 'admin', 'active', null),
  ('mizrahi', 'מזרחי', 'https://mizrahi.example.test', 'built_in', 'active', null),
  ('disabled-site', 'מושבת', 'https://disabled.example.test', 'admin', 'disabled', null),
  ('atomic-site', 'אטומי', 'https://atomic.example.test', 'admin', 'active', null),
  ('custom-u1', 'פרטי', 'https://private.example.test', 'user', 'active', '${U1}');
insert into public.user_services (id, user_id, service_id) values
  ('10000000-0000-4000-8000-000000000001', '${U1}', '${PAGI}'),
  ('10000000-0000-4000-8000-000000000002', '${U2}', '${PAGI}'),
  ('10000000-0000-4000-8000-000000000003', '${U1}', 'other-site'),
  ('10000000-0000-4000-8000-000000000004', '${U3}', 'other-site'),
  ('10000000-0000-4000-8000-000000000005', '${U1}', 'mizrahi'),
  ('10000000-0000-4000-8000-000000000006', '${U2}', 'atomic-site');
insert into public.access_profiles (id, user_id, user_service_id, local_profile_id, display_name) values
  ('20000000-0000-4000-8000-000000000001', '${U1}', '10000000-0000-4000-8000-000000000001', 'profile-p1', 'P1'),
  ('20000000-0000-4000-8000-000000000002', '${U1}', '10000000-0000-4000-8000-000000000001', 'profile-p2', 'P2'),
  ('20000000-0000-4000-8000-000000000003', '${U2}', '10000000-0000-4000-8000-000000000002', 'profile-p3', 'P3'),
  ('20000000-0000-4000-8000-000000000004', '${U1}', '10000000-0000-4000-8000-000000000003', 'profile-o1', 'O1'),
  ('20000000-0000-4000-8000-000000000005', '${U2}', '10000000-0000-4000-8000-000000000006', 'profile-a1', 'A1');
insert into public.encrypted_credentials (access_profile_id, ciphertext, iv) values
  ('20000000-0000-4000-8000-000000000001', 'c1', 'i1'),
  ('20000000-0000-4000-8000-000000000002', 'c2', 'i2'),
  ('20000000-0000-4000-8000-000000000003', 'c3', 'i3'),
  ('20000000-0000-4000-8000-000000000004', 'c4', 'i4'),
  ('20000000-0000-4000-8000-000000000005', 'c5', 'i5');
insert into public.service_assets (service_id, storage_path, checksum) values
  ('${PAGI}', 'global/${PAGI}/aaa/128.png', 'aaa'),
  ('${PAGI}', 'global/${PAGI}/bbb/128.png', 'bbb'),
  ('other-site', 'global/other-site/ccc/128.png', 'ccc');
create function public.block_atomic() returns trigger language plpgsql as $f$
begin
  if old.id = 'atomic-site' then raise exception 'blocked for atomicity test'; end if;
  return old;
end $f$;
create trigger block_atomic before delete on public.service_registry
  for each row execute function public.block_atomic();
`;

async function bootDb(migrationSql) {
  const db = new PGlite();
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
  await db.exec(`
    alter table public.users add column is_admin boolean not null default false,
      add column role text not null default 'user', add column status text not null default 'active';
    alter table public.service_registry add column owner_user_id uuid null references auth.users(id) on delete cascade,
      add column login_url_status text null;
  `);
  await db.exec(serviceAssetsTableSql());
  await db.exec(isAdminSql());
  await db.exec(migrationSql);
  await db.exec(SEED);
  return db;
}

async function as(db, who, sql, params = []) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${who === 'anon' || who === null ? '' : who}', false)`);
  await db.exec(who === 'anon' ? 'set role anon' : 'set role authenticated');
  try {
    return await db.query(sql, params);
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
const one = async (db, sql) => Number((await db.query(sql)).rows[0].n);
const counts = async (db, sid) => ({
  us: await one(db, `select count(*) n from public.user_services where service_id = '${sid}'`),
  ap: await one(db, `select count(*) n from public.access_profiles ap join public.user_services us on us.id = ap.user_service_id where us.service_id = '${sid}'`),
  ec: await one(db, `select count(*) n from public.encrypted_credentials ec join public.access_profiles ap on ap.id = ec.access_profile_id join public.user_services us on us.id = ap.user_service_id where us.service_id = '${sid}'`),
  sa: await one(db, `select count(*) n from public.service_assets where service_id = '${sid}'`),
  reg: await one(db, `select count(*) n from public.service_registry where id = '${sid}'`),
});
const DELETE_SQL = 'select public.admin_delete_service($1, $2) as r';
const IMPACT_SQL = 'select public.admin_service_delete_impact($1) as r';
const PRESENCE_SQL = 'select public.registry_service_ids_existing($1::text[]) as r';

async function sqlGroups(db) {
  // A1 privileges: anon cannot execute; non-admins / disabled admins rejected; nothing deleted.
  await expectError(as(db, 'anon', DELETE_SQL, [PAGI, PAGI_NAME]), /permission denied/, 'anon delete');
  await expectError(as(db, 'anon', IMPACT_SQL, [PAGI]), /permission denied/, 'anon impact');
  await expectError(as(db, 'anon', PRESENCE_SQL, [[PAGI]]), /permission denied/, 'anon presence');
  for (const who of [U1, DISABLED_ADMIN]) {
    await expectError(as(db, who, DELETE_SQL, [PAGI, PAGI_NAME]), /Admin access required/, `non-admin ${who} delete`);
    await expectError(as(db, who, IMPACT_SQL, [PAGI]), /Admin access required/, `non-admin ${who} impact`);
  }
  const before = await counts(db, PAGI);
  assert(before.us === 2 && before.ap === 3 && before.ec === 3 && before.sa === 2 && before.reg === 1, 'non-admin calls deleted nothing');

  // A2 impact.
  const impact = (await as(db, ADMIN, IMPACT_SQL, [PAGI])).rows[0].r;
  assert(impact.users_count === 2 && impact.profiles_count === 3 && impact.is_builtin === false, `impact counts (got ${JSON.stringify(impact)})`);
  const builtin = (await as(db, ADMIN, IMPACT_SQL, ['mizrahi'])).rows[0].r;
  assert(builtin.is_builtin === true && builtin.users_count === 1, `built-in impact (got ${JSON.stringify(builtin)})`);
  assert((await as(db, ADMIN, IMPACT_SQL, [PAGI])).rows[0].r.users_count === 2, 'impact writes nothing');

  // A3 confirm name + scope.
  await expectError(as(db, ADMIN, DELETE_SQL, [PAGI, 'פאגי']), /confirmation name does not match/, 'wrong confirm name');
  await expectError(as(db, ADMIN, DELETE_SQL, [PAGI, null]), /confirmation name does not match/, 'null confirm name');
  await expectError(as(db, ADMIN, DELETE_SQL, ['custom-u1', 'פרטי']), /global service not found/, 'user-owned row not deletable');
  await expectError(as(db, ADMIN, DELETE_SQL, ['no-such', 'x']), /global service not found/, 'missing row');
  const afterRejects = await counts(db, PAGI);
  assert(JSON.stringify(afterRejects) === JSON.stringify(before), 'rejected deletes changed nothing');
  assert((await one(db, `select count(*) n from public.service_registry where id = 'custom-u1'`)) === 1, 'user-owned row kept');

  // A4 atomicity: a failure after user_services were deleted rolls everything back.
  await expectError(as(db, ADMIN, DELETE_SQL, ['atomic-site', 'אטומי']), /blocked for atomicity test/, 'atomic failure');
  const atomic = await counts(db, 'atomic-site');
  assert(atomic.us === 1 && atomic.ap === 1 && atomic.ec === 1 && atomic.reg === 1, 'failed delete rolled back (single transaction)');
  assert((await one(db, `select count(*) n from public.admin_audit_log where service_id = 'atomic-site'`)) === 0, 'no audit row for a rolled-back delete');

  // A5 success: every row gone, other sites untouched, counts, asset paths.
  const otherBefore = await counts(db, 'other-site');
  const result = (await as(db, ADMIN, DELETE_SQL, [PAGI, `  ${PAGI_NAME} `])).rows[0].r;
  assert(result.users_count === 2 && result.profiles_count === 3 && result.credentials_count === 3 && result.assets_count === 2 && result.is_builtin === false,
    `delete counts (got ${JSON.stringify(result)})`);
  assert(Array.isArray(result.asset_paths) && result.asset_paths.length === 2 && result.asset_paths.every((p) => p.startsWith(`global/${PAGI}/`)), 'asset paths returned');
  const after = await counts(db, PAGI);
  assert(after.us === 0 && after.ap === 0 && after.ec === 0 && after.sa === 0 && after.reg === 0, `all rows of the site deleted (got ${JSON.stringify(after)})`);
  assert((await one(db, `select count(*) n from public.access_profiles where local_profile_id in ('profile-p1','profile-p2','profile-p3')`)) === 0, 'profiles cascaded');
  assert((await one(db, `select count(*) n from public.encrypted_credentials where ciphertext in ('c1','c2','c3')`)) === 0, 'ciphertext cascaded');
  assert(JSON.stringify(await counts(db, 'other-site')) === JSON.stringify(otherBefore), 'other sites untouched');
  assert((await one(db, `select count(*) n from public.user_services where user_id = '${U1}'`)) === 2, 'U1 keeps the other memberships');

  // A6 audit row.
  const audit = (await db.query(`select actor_user_id, action, service_id, details, created_at from public.admin_audit_log where service_id = '${PAGI}'`)).rows;
  assert(audit.length === 1, 'exactly one audit row');
  const a = audit[0];
  assert(a.actor_user_id === ADMIN && a.action === 'delete_service' && a.created_at, 'audit actor / action / timestamp');
  assert(a.details.users_count === 2 && a.details.profiles_count === 3 && a.details.credentials_count === 3 && a.details.assets_count === 2 && a.details.display_name === PAGI_NAME,
    `audit counts (got ${JSON.stringify(a.details)})`);
  assert((await as(db, U1, 'select count(*) n from public.admin_audit_log')).rows[0].n == 0, 'non-admin cannot read audit');
  assert((await as(db, ADMIN, 'select count(*) n from public.admin_audit_log')).rows[0].n == 1, 'admin reads audit');
  await expectError(as(db, ADMIN, `insert into public.admin_audit_log (action) values ('forged')`), /permission denied|row-level security/, 'audit not client-writable');

  // A7 presence RPC (Hub reconciliation).
  const ids = [PAGI, 'other-site', 'mizrahi', 'disabled-site', 'custom-u1'];
  const p1 = (await as(db, U1, PRESENCE_SQL, [ids])).rows[0].r;
  const set1 = new Set(p1.existing);
  assert(!set1.has(PAGI) && set1.has('other-site') && set1.has('mizrahi'), `presence: deleted missing, others present (got ${JSON.stringify(p1)})`);
  assert(set1.has('disabled-site'), 'presence: a disabled site is not a deleted site');
  assert(set1.has('custom-u1'), 'presence: own private row present');
  assert(p1.registry_rows > 0, 'presence: registry_rows reported');
  const p2 = (await as(db, U2, PRESENCE_SQL, [ids])).rows[0].r;
  assert(!p2.existing.includes('custom-u1'), 'presence: another user\'s private row not revealed');
  await expectError(as(db, null, PRESENCE_SQL, [ids]), /Not authenticated/, 'presence without session');
  await db.exec('begin');
  await db.exec('alter table public.service_registry disable trigger block_atomic');
  await db.exec('delete from public.service_registry where owner_user_id is null');
  const empty = (await as(db, U1, PRESENCE_SQL, [ids])).rows[0].r;
  await db.exec('rollback');
  assert(empty.registry_rows === 0, 'presence: empty registry reports registry_rows 0 (clients treat as unknown)');
}

function sqlStatic(src) {
  for (const fn of ['admin_delete_service', 'admin_service_delete_impact']) {
    const start = src.indexOf(`create or replace function public.${fn}(`);
    const body = src.slice(start, src.indexOf('$$;', start));
    assert(/security definer/.test(body) && /set search_path = public/.test(body), `${fn}: security definer + search_path`);
    assert(/if not public\.is_admin\(\) then/.test(body), `${fn}: reuses public.is_admin()`);
  }
  for (const sig of ['admin_delete_service(text, text)', 'admin_service_delete_impact(text)', 'registry_service_ids_existing(text[])']) {
    assert(src.includes(`revoke all on function public.${sig} from public;`), `${sig}: revoked from public`);
    assert(src.includes(`revoke all on function public.${sig} from anon;`), `${sig}: revoked from anon`);
    assert(src.includes(`grant execute on function public.${sig} to authenticated;`), `${sig}: granted to authenticated`);
  }
  assert(!/storage\.objects/.test(src), 'SQL does not touch storage.objects (client removes Storage objects)');
  const listOf = (text) => [...text.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort().join(',');
  const ensure = read('supabase/migrations/20260712150000_phase108_adapter_id_compliance.sql');
  const ensureList = ensure.slice(ensure.indexOf('if p_id not in ('), ensure.indexOf(') then', ensure.indexOf('if p_id not in (')));
  const ours = src.slice(src.indexOf('any (array['), src.indexOf(']::text[])'));
  assert(listOf(ensureList) === listOf(ours), 'is_known_builtin_service_id = ensure_known_builtin_registry_row allowlist');
}

// ═══ Bundling helpers (B + C) ════════════════════════════════════════════════
const MINI_REACT = `
let cur = null;
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
function slot() { return cur.i++; }
export function useState(init) {
  const h = cur, i = slot();
  if (!(i in h.s)) h.s[i] = typeof init === 'function' ? init() : init;
  return [h.s[i], (v) => { const next = typeof v === 'function' ? v(h.s[i]) : v; if (!Object.is(next, h.s[i])) { h.s[i] = next; h.dirty = true; } }];
}
export function useRef(init) { const h = cur, i = slot(); if (!(i in h.s)) h.s[i] = { current: init }; return h.s[i]; }
export function useMemo(fn, deps) { const h = cur, i = slot(); const p = h.s[i]; if (p && same(p.deps, deps)) return p.v; const v = fn(); h.s[i] = { deps, v }; return v; }
export function useCallback(fn, deps) { return useMemo(() => fn, deps); }
export function useEffect(fn, deps) {
  const h = cur, i = slot(); const p = h.s[i];
  if (p && deps && same(p.deps, deps)) return;
  h.fx.push(() => { if (p && typeof p.cleanup === 'function') p.cleanup(); h.s[i] = { deps, cleanup: fn() }; });
}
export const Fragment = Symbol('Fragment');
export function jsx(type, props, key) { return { type, props: props ?? {}, key }; }
export const jsxs = jsx;
export function mount(Component, props) {
  const h = { s: {}, fx: [], dirty: false, i: 0, tree: null, props };
  const render = () => {
    for (let n = 0; n < 50; n += 1) {
      h.dirty = false; h.i = 0; cur = h;
      h.tree = Component(h.props);
      cur = null;
      const fx = h.fx.splice(0);
      fx.forEach((f) => f());
      if (!h.dirty) return h.tree;
    }
    throw new Error('render loop');
  };
  render();
  return { get tree() { return h.tree; }, rerender() { render(); } };
}
export default { useState, useRef, useMemo, useCallback, useEffect, Fragment };
`;

function authStub() {
  const names = new Set();
  const src = read('src/auth/index.ts');
  for (const block of src.matchAll(/export \{([^}]*)\}/g)) {
    for (const part of block[1].split(',')) {
      const name = part.trim();
      if (name && !name.startsWith('type ')) names.add(name);
    }
  }
  const lines = [...names]
    .filter((n) => n !== 'tryGetAuthenticatedUserId' && n !== 'requireAuthenticatedUserId')
    .map((n) => `export function ${n}() { throw new Error('stubbed in verify: ${n}'); }`);
  lines.push('export async function tryGetAuthenticatedUserId() { return globalThis.__uid ?? null; }');
  lines.push("export async function requireAuthenticatedUserId() { if (!globalThis.__uid) throw new Error('no session'); return globalThis.__uid; }");
  return lines.join('\n');
}
const STUBS = {
  'src/auth/index.ts': authStub,
  'src/supabase/client.ts': () =>
    'export function getSupabaseClient() { return globalThis.__sb ?? null; }\nexport function resetSupabaseClient() {}\nexport function resetSupabaseClientForTests() {}',
  'src/supabase/env.ts': () =>
    "export function getSupabaseConfig() { return { url: 'https://svc.example.test', anonKey: 'k' }; }\nexport function getSupabaseRemoteUrl() { return 'https://svc.example.test'; }\nexport function toBrowserAccessibleStorageUrl(u) { return u; }\nexport function isSupabaseConfigured() { return true; }",
  'src/vault/crypto.ts': () =>
    "export async function encryptCredentialSet(_k, cred) { return { ciphertext: JSON.stringify(cred), iv: 'iv', fieldIdsPresent: Object.keys(cred) }; }\nexport async function decryptCredentialSetWithKeys(_k, c) { try { return JSON.parse(c); } catch { return null; } }",
  'src/logoCache.ts': () => 'export function invalidateServiceLogoCache(id) { (globalThis.__logoInvalidated ??= []).push(id); }',
};

function bundle(entries, overrides = {}, opts = {}) {
  return withTempDir('pv-12151-', (outdir) => bundleIn(outdir, entries, overrides, opts));
}
async function bundleIn(outdir, entries, overrides, { mini = false }) {
  const reactPath = join(outdir, 'mini-react.mjs');
  writeFileSync(reactPath, MINI_REACT);
  const abs = (rel) => resolvePath(root, rel).replace(/\\/g, '/').toLowerCase();
  const stubs = new Map(Object.entries(STUBS).map(([rel, make]) => [abs(rel), make]));
  const over = new Map(Object.entries(overrides).map(([rel, src]) => [abs(rel), src]));
  const outfile = join(outdir, 'bundle.mjs');
  await build({
    stdin: { contents: entries, resolveDir: root, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    write: true,
    logLevel: 'silent',
    outfile,
    nodePaths: [join(root, 'node_modules')],
    define: { 'import.meta.env': '{"DEV":false}', 'process.env.NODE_ENV': '"production"' },
    splitting: false,
    plugins: [
      {
        name: 'verify-seams',
        setup(b) {
          if (mini) b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, () => ({ path: reactPath }));
          b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
            const key = args.path.replace(/\\/g, '/').toLowerCase();
            if (over.has(key)) return { contents: over.get(key), loader: key.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
            if (stubs.has(key)) return { contents: stubs.get(key)(), loader: 'js' };
            return undefined;
          });
        },
      },
    ],
  });
  return import(pathToFileURL(outfile).href);
}

// ═══ B. Client reconciliation ════════════════════════════════════════════════
function fakeSupabase(tables, presence) {
  const log = [];
  const rpcCalls = [];
  function run(q) {
    const rows = (tables[q.table] ??= []);
    if (q.op === 'upsert') {
      const keys = (q.onConflict ?? 'id').split(',');
      let row = rows.find((r) => keys.every((k) => r[k] === q.payload[k]));
      if (row) Object.assign(row, q.payload);
      else {
        row = { id: `${q.table}-${rows.length + 1}`, ...q.payload };
        rows.push(row);
      }
      log.push({ table: q.table, payload: { ...q.payload } });
      return { data: q.single || q.maybe ? row : [row], error: null };
    }
    const found = rows.filter((r) => q.filters.every((f) => f(r)));
    if (q.op === 'delete') {
      tables[q.table] = rows.filter((r) => !found.includes(r));
      return { data: null, error: null };
    }
    if (q.op === 'update') {
      found.forEach((r) => Object.assign(r, q.payload));
      return { data: null, error: null };
    }
    return { data: q.single || q.maybe ? found[0] ?? null : found, error: null };
  }
  function from(table) {
    const q = { table, op: 'select', filters: [], payload: null, onConflict: null, single: false, maybe: false };
    const api = {
      select() { return api; },
      upsert(payload, opts) { q.op = 'upsert'; q.payload = payload; q.onConflict = opts?.onConflict ?? null; return api; },
      update(payload) { q.op = 'update'; q.payload = payload; return api; },
      delete() { q.op = 'delete'; return api; },
      eq(k, v) { q.filters.push((r) => r[k] === v); return api; },
      is(k, v) { q.filters.push((r) => (r[k] ?? null) === v); return api; },
      in(k, arr) { q.filters.push((r) => arr.includes(r[k])); return api; },
      order() { return api; },
      single() { q.single = true; return api; },
      maybeSingle() { q.maybe = true; return api; },
      then(res, rej) { return Promise.resolve(run(q)).then(res, rej); },
    };
    return api;
  }
  async function rpc(fn, args) {
    rpcCalls.push({ fn, args });
    if (fn !== 'registry_service_ids_existing') return { data: null, error: { message: `unknown rpc ${fn}` } };
    if (presence.mode === 'error') return { data: null, error: { message: 'function does not exist' } };
    const existing = args.p_service_ids.filter((id) => presence.ids.has(id));
    return { data: { existing, registry_rows: presence.rows ?? 20 }, error: null };
  }
  return { from, rpc, log, rpcCalls };
}

const USER = '00000000-0000-4000-8000-000000000011';
const profile = (id, serviceId) => ({ schemaVersion: 1, id, serviceId, displayName: id, createdAt: 't', updatedAt: 't', isDefault: true });
function localState() {
  return {
    selectedIds: ['kept', 'deleted-site', 'custom-x', 'mizrahi'],
    customServices: [{ id: 'custom-x', displayName: 'Custom', url: 'https://custom.example.test', category: 'custom' }],
    accessProfiles: [profile('profile-kept', 'kept'), profile('profile-del', 'deleted-site'), profile('profile-custom', 'custom-x'), profile('profile-miz', 'mizrahi')],
    credentials: { 'profile-kept': { user: 'k' }, 'profile-del': { user: 'd' }, 'profile-custom': { user: 'c' }, 'profile-miz': { user: 'm' } },
  };
}
const PRESENT = () => ({ ids: new Set(['kept', 'mizrahi']), rows: 20 });
const upsertedServices = (sb) => sb.log.filter((e) => e.table === 'user_services').map((e) => e.payload.service_id);
const upsertedProfiles = (sb) => sb.log.filter((e) => e.table === 'access_profiles').map((e) => e.payload.local_profile_id);

async function clientGroups(m) {
  globalThis.__uid = USER;
  // B1 sync never re-upserts a deleted service; re-seeded built-in and private custom kept.
  let sb = fakeSupabase({}, PRESENT());
  globalThis.__sb = sb;
  await m.syncVaultStateToSupabase({}, localState(), {});
  assert(JSON.stringify(upsertedServices(sb).sort()) === JSON.stringify(['custom-x', 'kept', 'mizrahi']), `sync upserts only registry-present + custom (got ${upsertedServices(sb)})`);
  assert(!upsertedProfiles(sb).includes('profile-del'), 'sync does not upsert the deleted service\'s profile');
  const asked = sb.rpcCalls.find((c) => c.fn === 'registry_service_ids_existing');
  assert(asked && !asked.args.p_service_ids.includes('custom-x'), 'private customs are never sent for judgment');

  // B2 unknown presence → today's behavior (nothing filtered).
  for (const presence of [{ mode: 'error', ids: new Set() }, { ids: new Set(['kept']), rows: 0 }]) {
    sb = fakeSupabase({}, presence);
    globalThis.__sb = sb;
    await m.syncVaultStateToSupabase({}, localState(), {});
    assert(upsertedServices(sb).length === 4, `unknown presence (${presence.mode ?? 'empty registry'}) keeps today's upserts`);
  }

  // B3 hydrate, empty cloud (keep-local branch): deleted service dropped with profiles + credentials.
  sb = fakeSupabase({ user_services: [], access_profiles: [], encrypted_credentials: [], service_registry: [] }, PRESENT());
  globalThis.__sb = sb;
  const h1 = await m.hydrateWorkspaceFromCloud(USER, [{}], localState());
  assert(!h1.selectedIds.includes('deleted-site'), 'hydrate (empty cloud) drops the deleted selection');
  assert(!h1.accessProfiles.some((p) => p.serviceId === 'deleted-site'), 'hydrate (empty cloud) drops its profiles');
  assert(!('profile-del' in h1.credentials), 'hydrate (empty cloud) drops its credentials');
  for (const id of ['kept', 'custom-x', 'mizrahi']) assert(h1.selectedIds.includes(id), `hydrate keeps ${id}`);
  assert(h1.credentials['profile-miz'] && h1.credentials['profile-custom'] && h1.credentials['profile-kept'], 'hydrate keeps other credentials');

  // B4 hydrate, stale cloud membership still listing the deleted id.
  sb = fakeSupabase({
    user_services: [
      { id: 'us-1', user_id: USER, service_id: 'kept', sort_order: 0 },
      { id: 'us-2', user_id: USER, service_id: 'deleted-site', sort_order: 1 },
      { id: 'us-3', user_id: USER, service_id: 'mizrahi', sort_order: 2 },
    ],
    access_profiles: [
      { id: 'ap-1', user_id: USER, user_service_id: 'us-1', local_profile_id: 'profile-kept', display_name: 'K', is_default: true },
      { id: 'ap-2', user_id: USER, user_service_id: 'us-2', local_profile_id: 'profile-del', display_name: 'D', is_default: true },
    ],
    encrypted_credentials: [
      { access_profile_id: 'ap-1', ciphertext: JSON.stringify({ user: 'k' }), iv: 'iv' },
      { access_profile_id: 'ap-2', ciphertext: JSON.stringify({ user: 'd' }), iv: 'iv' },
    ],
    service_registry: [],
  }, PRESENT());
  globalThis.__sb = sb;
  const h2 = await m.hydrateWorkspaceFromCloud(USER, [{}], localState());
  assert(JSON.stringify(h2.selectedIds) === JSON.stringify(['kept', 'mizrahi']), `hydrate (cloud) drops deleted id, keeps re-seeded built-in (got ${h2.selectedIds})`);
  assert(!h2.accessProfiles.some((p) => p.id === 'profile-del') && !('profile-del' in h2.credentials), 'hydrate (cloud) drops deleted profile + credential');

  // B5 the hydrated state is not re-upserted.
  sb = fakeSupabase({}, PRESENT());
  globalThis.__sb = sb;
  await m.syncVaultStateToSupabase({}, h1, {});
  assert(!upsertedServices(sb).includes('deleted-site') && upsertedServices(sb).includes('mizrahi'), 'post-hydrate sync: deleted not re-upserted, built-in upserted');

  // B6 unknown presence in hydrate drops nothing.
  sb = fakeSupabase({ user_services: [], access_profiles: [], encrypted_credentials: [], service_registry: [] }, { mode: 'error', ids: new Set() });
  globalThis.__sb = sb;
  const h3 = await m.hydrateWorkspaceFromCloud(USER, [{}], localState());
  assert(h3.selectedIds.includes('deleted-site') && 'profile-del' in h3.credentials, 'unknown presence: hydrate drops nothing');

  // B7 pure helper.
  const { state, droppedIds } = m.dropServicesMissingFromRegistry(localState(), new Set(['kept', 'mizrahi']));
  assert(JSON.stringify(droppedIds) === JSON.stringify(['deleted-site']), 'helper drops exactly the missing id');
  assert(state.customServices.length === 1 && state.selectedIds.includes('custom-x'), 'helper never drops private customs');
}

function clientStatic() {
  const src = read('src/supabase/registryPresence.ts') + read('src/supabase/persistence.ts');
  assert(!/hostname|\.co\.il|'mizrahi'|'shufersal'|isKnownBuiltinServiceId/.test(src), 'reconciliation has no site / built-in branches');
}

// ═══ C. UI + Admin API ═══════════════════════════════════════════════════════
function kids(n) {
  const c = n?.props?.children;
  return c == null ? [] : Array.isArray(c) ? c.flat(Infinity) : [c];
}
function walk(n, fn) {
  if (n == null || typeof n !== 'object') return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, fn));
  fn(n);
  kids(n).forEach((x) => walk(x, fn));
}
function findAll(n, pred) {
  const out = [];
  walk(n, (x) => pred(x) && out.push(x));
  return out;
}
function text(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n !== 'object') return String(n);
  if (Array.isArray(n)) return n.map(text).join('');
  return kids(n).map(text).join('');
}
const byAttr = (tree, attr, value) => findAll(tree, (x) => x.props?.[attr] === value)[0] ?? null;
const flush = () => new Promise((r) => setTimeout(r, 0));

const COPY = {
  impact3: 'האתר קיים אצל 3 משתמשים — הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.',
  builtin: 'אתר מובנה: יימחק לגמרי, גם אצל המשתמשים. הוא יחזור רק אם יוסף מחדש, במצב ההתחלתי וללא מיפוי.',
  builtinOld: 'יחזור למצב ההתחלתי',
  noUsers: 'האתר לא נמצא אצל אף משתמש.',
  button: 'מחיקת אתר',
};
/** D-121-51 C2: impact / built-in lines use the existing amber notice style; `admin-error` only for failures. */
const NOTICE_CLASS = 'admin-gate-login-banner';
const classOf = (node) => String(node?.props?.className ?? '');
const assertNotice = (node, where) => {
  assert(node, `${where}: line shown`);
  assert(!/\badmin-error\b/.test(classOf(node)), `${where}: not styled as an error (got class "${classOf(node)}")`);
  assert(classOf(node).split(/\s+/).includes(NOTICE_CLASS), `${where}: existing notice style ${NOTICE_CLASS} (got class "${classOf(node)}")`);
};
const assertErrorStyle = (node, where) => {
  assert(node && /\badmin-error\b/.test(classOf(node)), `${where}: failure stays admin-error (got class "${classOf(node)}")`);
};
const RESULT = { usersCount: 3, profilesCount: 4, credentialsCount: 4, assetsCount: 2, isBuiltin: false, storageRemoved: 5, storageFailure: null };

async function openDialog(m, { impact, impactError, impactPending, deleteImpl } = {}) {
  const calls = { deleted: [], onDeleted: [] };
  const h = m.mount(m.Dialog, {
    service: { id: PAGI, displayName: PAGI_NAME },
    loadImpact: async () => {
      if (impactPending) return new Promise(() => {});
      if (impactError) throw new Error(impactError);
      return impact;
    },
    deleteService: async (id, name) => {
      calls.deleted.push([id, name]);
      return deleteImpl ? deleteImpl() : RESULT;
    },
    onDeleted: (r) => calls.onDeleted.push(r),
    onClose: () => {},
  });
  return { h, calls };
}
const confirmBtn = (tree) => byAttr(tree, 'data-action', 'delete-service-confirm');
const nameInput = (tree) => byAttr(tree, 'data-action', 'delete-service-confirm-name');

async function uiGroups(m) {
  // C1 before impact: confirm disabled even with the exact name.
  const early = await openDialog(m, { impactPending: true });
  nameInput(early.h.tree).props.onChange({ target: { value: PAGI_NAME } });
  early.h.rerender();
  assert(byAttr(early.h.tree, 'data-status', 'delete-service-impact-loading'), 'impact loading shown first');
  assert(confirmBtn(early.h.tree).props.disabled === true, 'confirm disabled until the impact is known');

  // C2 impact copy + typed-confirm gating.
  const { h, calls } = await openDialog(m, { impact: { usersCount: 3, profilesCount: 4, isBuiltin: false } });
  await flush();
  h.rerender();
  const impactNode = byAttr(h.tree, 'data-status', 'delete-service-impact');
  assert(impactNode && text(impactNode).includes(COPY.impact3), `impact copy (got "${text(impactNode)}")`);
  assert(!byAttr(h.tree, 'data-status', 'delete-service-builtin'), 'no built-in line for an Admin-created site');
  assertNotice(byAttr(impactNode, 'data-part', 'impact-users'), 'C2 impact line (3 users)');
  for (const [typed, enabled] of [['', false], ['פאגי', false], ['פאגי בדיקה!', false], ['פאגי  בדיקה', false], [PAGI_NAME, true], [`  ${PAGI_NAME} `, true]]) {
    nameInput(h.tree).props.onChange({ target: { value: typed } });
    h.rerender();
    assert(confirmBtn(h.tree).props.disabled === !enabled, `typed "${typed}": confirm ${enabled ? 'enabled' : 'disabled'}`);
  }
  nameInput(h.tree).props.onChange({ target: { value: 'פאגי' } });
  h.rerender();
  confirmBtn(h.tree).props.onClick();
  await flush();
  assert(calls.deleted.length === 0, 'a mismatched name never calls delete (even if clicked)');

  // C3 confirm → delete with the typed name, result counts, onDeleted.
  nameInput(h.tree).props.onChange({ target: { value: ` ${PAGI_NAME}` } });
  h.rerender();
  confirmBtn(h.tree).props.onClick();
  await flush();
  h.rerender();
  assert(calls.deleted.length === 1 && calls.deleted[0][0] === PAGI && calls.deleted[0][1] === PAGI_NAME, 'delete called once with id + trimmed typed name');
  assert(calls.onDeleted.length === 1, 'onDeleted (parent reloads the list) called once');
  const done = byAttr(h.tree, 'data-status', 'delete-service-done');
  assert(done && text(done).includes('האתר נמחק.') && text(done).includes('הוסר אצל 3 משתמשים') && text(done).includes('4 פרטי כניסה שמורים') && text(done).includes('2 נכסי אייקון'), `result counts shown (got "${text(done)}")`);
  assert(!byAttr(h.tree, 'data-status', 'delete-service-storage-failed'), 'no storage failure line when cleanup succeeded');

  // C4 built-in + zero users.
  const b = await openDialog(m, { impact: { usersCount: 0, profilesCount: 0, isBuiltin: true } });
  await flush();
  b.h.rerender();
  const builtinNode = byAttr(b.h.tree, 'data-status', 'delete-service-builtin');
  assert(text(builtinNode).trim() === COPY.builtin, `C2 built-in copy (got "${text(builtinNode)}")`);
  assert(!text(b.h.tree).includes(COPY.builtinOld), 'C2 old «יחזור למצב ההתחלתי» copy absent');
  assertNotice(builtinNode, 'C2 built-in line');
  const zeroNode = byAttr(b.h.tree, 'data-part', 'impact-users');
  assert(text(zeroNode).trim() === COPY.noUsers, `zero-users copy (got "${text(zeroNode)}")`);
  assertNotice(zeroNode, 'C2 impact line (zero users)');
  const b3 = await openDialog(m, { impact: { usersCount: 3, profilesCount: 3, isBuiltin: true } });
  await flush();
  b3.h.rerender();
  assert(text(byAttr(b3.h.tree, 'data-part', 'impact-users')).trim() === COPY.impact3, 'C2 built-in site: same impact line as every site');
  assert(text(byAttr(b3.h.tree, 'data-status', 'delete-service-builtin')).trim() === COPY.builtin, 'C2 built-in site with users: built-in line');
  assert(findAll(byAttr(b3.h.tree, 'data-status', 'delete-service-impact'), (x) => /\badmin-error\b/.test(classOf(x))).length === 0, 'C2 no admin-error inside the impact block');

  // C5 storage failure reported; delete error shown without onDeleted; impact error blocks confirm.
  const s = await openDialog(m, { impact: { usersCount: 1, profilesCount: 1, isBuiltin: false }, deleteImpl: () => ({ ...RESULT, storageFailure: 'denied' }) });
  await flush();
  s.h.rerender();
  nameInput(s.h.tree).props.onChange({ target: { value: PAGI_NAME } });
  s.h.rerender();
  confirmBtn(s.h.tree).props.onClick();
  await flush();
  s.h.rerender();
  assert(text(byAttr(s.h.tree, 'data-status', 'delete-service-storage-failed')).includes('denied'), 'storage failure reported');
  assertErrorStyle(byAttr(s.h.tree, 'data-status', 'delete-service-storage-failed'), 'storage failure');
  const e = await openDialog(m, { impact: { usersCount: 1, profilesCount: 1, isBuiltin: false }, deleteImpl: () => { throw new Error('confirmation name does not match the site name'); } });
  await flush();
  e.h.rerender();
  nameInput(e.h.tree).props.onChange({ target: { value: PAGI_NAME } });
  e.h.rerender();
  confirmBtn(e.h.tree).props.onClick();
  await flush();
  e.h.rerender();
  assert(byAttr(e.h.tree, 'data-status', 'delete-service-error') && e.calls.onDeleted.length === 0, 'delete error shown, list not reloaded as success');
  const ie = await openDialog(m, { impactError: 'Admin access required' });
  await flush();
  ie.h.rerender();
  nameInput(ie.h.tree).props.onChange({ target: { value: PAGI_NAME } });
  ie.h.rerender();
  assert(byAttr(ie.h.tree, 'data-status', 'delete-service-impact-error') && confirmBtn(ie.h.tree).props.disabled === true, 'impact error blocks confirm');

  // D-121-51 C1: plain-Hebrew errors; raw text only under a collapsed «פרטים טכניים».
  assert(!byAttr(h.tree, 'data-status', 'delete-service-disabled-reason'), 'no disabled-reason line when the impact loaded');
  assert(!byAttr(early.h.tree, 'data-status', 'delete-service-disabled-reason'), 'no disabled-reason line while the impact loads');
  const checkErrorBlock = (tree, status, raw, want, where) => {
    const block = byAttr(tree, 'data-status', status);
    assert(block, `${where}: error block shown`);
    const msg = findAll(block, (x) => x.props?.['data-part'] === 'message')[0];
    assert(msg && text(msg).trim() === want, `${where}: main message «${want}» (got "${msg ? text(msg) : ''}")`);
    assertErrorStyle(msg, where);
    assert(!text(msg).includes(raw), `${where}: raw text not in the main message`);
    const tech = findAll(block, (x) => x.type === 'details' && x.props?.['data-part'] === 'technical')[0];
    assert(tech && !tech.props.open, `${where}: «פרטים טכניים» present and collapsed`);
    assert(text(findAll(tech, (x) => x.type === 'summary')[0]).trim() === C1_COPY.technical, `${where}: «פרטים טכניים» summary`);
    assert(text(tech).includes(raw), `${where}: raw text kept under «פרטים טכניים»`);
  };
  for (const [kind, raw, want] of C1_CASES) {
    const i1 = await openDialog(m, { impactError: raw });
    await flush();
    i1.h.rerender();
    checkErrorBlock(i1.h.tree, 'delete-service-impact-error', raw, want, `impact ${kind}`);
    const reason = byAttr(i1.h.tree, 'data-status', 'delete-service-disabled-reason');
    assert(reason && text(reason).trim() === C1_COPY.impactFailedReason, `impact ${kind}: disabled-reason line under the name input`);
    const labelIdx = JSON.stringify(i1.h.tree).indexOf('delete-service-confirm-name');
    assert(labelIdx >= 0 && JSON.stringify(i1.h.tree).indexOf('delete-service-disabled-reason') > labelIdx, `impact ${kind}: reason line placed after the name input`);
    nameInput(i1.h.tree).props.onChange({ target: { value: PAGI_NAME } });
    i1.h.rerender();
    assert(confirmBtn(i1.h.tree).props.disabled === true, `impact ${kind}: confirm stays disabled (fail-closed)`);

    const d1 = await openDialog(m, { impact: { usersCount: 1, profilesCount: 1, isBuiltin: false }, deleteImpl: () => { throw new Error(raw); } });
    await flush();
    d1.h.rerender();
    nameInput(d1.h.tree).props.onChange({ target: { value: PAGI_NAME } });
    d1.h.rerender();
    confirmBtn(d1.h.tree).props.onClick();
    await flush();
    d1.h.rerender();
    checkErrorBlock(d1.h.tree, 'delete-service-error', raw, want, `delete ${kind}`);
    assert(d1.calls.onDeleted.length === 0 && !byAttr(d1.h.tree, 'data-status', 'delete-service-done'), `delete ${kind}: no success shown`);
  }
}

const C1_COPY = {
  missing: 'מחיקת אתרים עוד לא הופעלה במסד הנתונים (חסר עדכון מסד נתונים). לא נמחק דבר.',
  notAdmin: 'אין הרשאת מנהל למחיקה.',
  mismatch: 'השם שהוקלד לא תואם לשם האתר.',
  generic: 'המחיקה נכשלה. לא נמחק דבר.',
  impactFailedReason: 'אי אפשר למחוק כרגע — הבדיקה של השפעת המחיקה נכשלה.',
  technical: 'פרטים טכניים',
};
const PGRST202_TEXT = 'Could not find the function public.admin_delete_service(p_confirm_display_name, p_service_id) in the schema cache';
const C1_CASES = [
  ['function missing (message)', `${PGRST202_TEXT} — Perhaps you meant to call the function public.admin_disable_service — PGRST202`, C1_COPY.missing],
  ['function missing (code only)', 'PGRST202', C1_COPY.missing],
  ['not admin', 'Admin access required', C1_COPY.notAdmin],
  ['name mismatch', 'confirmation name does not match the site name — P0001', C1_COPY.mismatch],
  ['anything else', 'TypeError: Failed to fetch', C1_COPY.generic],
];

function storageFake({ removeError = null } = {}) {
  const removed = [];
  const tree = {
    [`global/${PAGI}`]: [{ name: 'aaa', id: null }, { name: 'bbb', id: null }],
    [`global/${PAGI}/aaa`]: [{ name: '32.png', id: 'f1' }, { name: '128.png', id: 'f2' }],
    [`global/${PAGI}/bbb`]: [{ name: '128.png', id: 'f3' }],
  };
  return {
    removed,
    storage: {
      from: () => ({
        list: async (path) => ({ data: tree[path] ?? [], error: null }),
        remove: async (paths) => {
          removed.push(...paths);
          return { data: null, error: removeError };
        },
      }),
    },
  };
}

async function apiGroups(m) {
  globalThis.__uid = ADMIN;
  // C6 adminDeleteService: RPC, then Storage cleanup of the whole prefix + row paths; failure reported, not thrown.
  const fake = storageFake();
  const rpcCalls = [];
  globalThis.__sb = {
    ...fake,
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      return { data: { users_count: 2, profiles_count: 3, credentials_count: 3, assets_count: 2, is_builtin: false, asset_paths: [`global/${PAGI}/zzz/128.png`] }, error: null };
    },
  };
  const r = await m.adminDeleteService(PAGI, PAGI_NAME);
  assert(rpcCalls[0]?.fn === 'admin_delete_service' && rpcCalls[0].args.p_confirm_display_name === PAGI_NAME, 'adminDeleteService calls the RPC with the confirm name');
  const want = [`global/${PAGI}/aaa/32.png`, `global/${PAGI}/aaa/128.png`, `global/${PAGI}/bbb/128.png`, `global/${PAGI}/zzz/128.png`].sort();
  assert(JSON.stringify([...fake.removed].sort()) === JSON.stringify(want), `Storage: every object under global/<id>/ + row paths removed (got ${fake.removed})`);
  assert(r.usersCount === 2 && r.credentialsCount === 3 && r.assetsCount === 2 && r.storageRemoved === 4 && r.storageFailure === null, 'result counts');

  const failing = storageFake({ removeError: { message: 'denied' } });
  globalThis.__sb = { ...failing, rpc: async () => ({ data: { users_count: 0, profiles_count: 0, credentials_count: 0, assets_count: 0, is_builtin: true, asset_paths: [] }, error: null }) };
  const f = await m.adminDeleteService(PAGI, PAGI_NAME);
  assert(f.storageFailure === 'denied' && f.isBuiltin === true, 'Storage failure reported (DB delete not undone, no throw)');

  globalThis.__sb = { ...storageFake(), rpc: async () => ({ data: null, error: { message: 'confirmation name does not match the site name' } }) };
  let threw = false;
  try {
    await m.adminDeleteService(PAGI, 'x');
  } catch {
    threw = true;
  }
  assert(threw, 'RPC rejection throws (dialog shows the error)');

  // C1: both RPC calls keep the raw PostgREST text (code included) for the dialog mapping.
  const pgrst = { code: 'PGRST202', message: PGRST202_TEXT, details: null, hint: null };
  for (const call of [() => m.fetchServiceDeleteImpact(PAGI), () => m.adminDeleteService(PAGI, PAGI_NAME)]) {
    globalThis.__sb = { ...storageFake(), rpc: async () => ({ data: null, error: pgrst }) };
    let raw = '';
    try {
      await call();
    } catch (err) {
      raw = err.message;
    }
    assert(raw.includes('PGRST202') && raw.includes('Could not find the function'), `RPC error keeps the raw PostgREST text (got "${raw}")`);
  }

  const bad = await m.removeServiceAssetObjects(storageFake(), 'a/../b', []);
  assert(bad.failure && bad.removed === 0, 'Storage cleanup refuses an id with a path separator');

  globalThis.__sb = { ...storageFake(), rpc: async () => ({ data: { users_count: 5, profiles_count: 7, is_builtin: true }, error: null }) };
  const imp = await m.fetchServiceDeleteImpact(PAGI);
  assert(imp.usersCount === 5 && imp.profilesCount === 7 && imp.isBuiltin === true, 'fetchServiceDeleteImpact maps the RPC');
}

function uiStatic() {
  const reg = read('src/admin/RegistryAdmin.tsx');
  assert(/\{!isUserOwnedRow && selectedRow\?\.id === selectedId && \(\s*<button[\s\S]*?data-action="delete-service"/.test(reg), '«מחיקת אתר» only for global rows');
  assert(/loadImpact=\{fetchServiceDeleteImpact\}/.test(reg) && /deleteService=\{adminDeleteService\}/.test(reg), 'dialog wired to the Admin API');
  assert(/onDeleted=\{\(\) => \{\s*cancelEdit\(\);\s*void reload\(\);/.test(reg), 'after success: edit closed + list reloaded');
  const dialog = read('src/admin/DeleteServiceDialog.tsx');
  assert(dialog.includes(`button: '${COPY.button}'`), 'button copy «מחיקת אתר»');
  assert(!dialog.includes(COPY.builtinOld), 'C2 old built-in copy removed from the dialog source');
  assert(/^\.admin-gate-login-banner \{/m.test(read('src/admin/admin.css')), 'C2 notice style is an existing top-level admin.css rule');
  assert(!/hostname|\.co\.il|serviceId ===|service\.id ===/.test(dialog + read('src/serviceAssets/removeServiceAssetObjects.ts')), 'no site branches in UI / Storage cleanup');
}

// ═══ Runner ══════════════════════════════════════════════════════════════════
const PERSIST_ENTRY = `export { syncVaultStateToSupabase, hydrateWorkspaceFromCloud } from './src/supabase/persistence.ts';
export { dropServicesMissingFromRegistry } from './src/supabase/registryPresence.ts';`;
const UI_ENTRY = `export { mount } from 'react';
export { default as Dialog } from './src/admin/DeleteServiceDialog.tsx';`;
const API_ENTRY = `export { adminDeleteService, fetchServiceDeleteImpact } from './src/admin/adminRegistryApi.ts';
export { removeServiceAssetObjects } from './src/serviceAssets/removeServiceAssetObjects.ts';`;

async function runSql(migrationSql) {
  const db = await bootDb(migrationSql);
  try {
    await sqlGroups(db);
  } finally {
    await db.close();
  }
}
const runClient = async (overrides = {}) => clientGroups(await bundle(PERSIST_ENTRY, overrides));
const runUi = async (overrides = {}) => uiGroups(await bundle(UI_ENTRY, overrides, { mini: true }));
const runApi = async (overrides = {}) => apiGroups(await bundle(API_ENTRY, overrides));

const migration = read(MIGRATION);
sqlStatic(migration);
await runSql(migration);
console.log('  ok  A. SQL: privileges, impact, confirm name + scope, atomicity, full delete, audit, presence RPC (+ static)');
clientStatic();
await runClient();
console.log('  ok  B. client reconciliation: sync filter, hydrate (both branches), unknown presence, R2 built-in, customs');
uiStatic();
await runUi();
console.log('  ok  C. dialog: impact gating, typed confirm, impact / built-in / zero-users copy (C2 notice style), result, errors (admin-error)');
await runApi();
console.log('  ok  C. Admin API: RPC → Storage best-effort cleanup, failure reported, impact mapping');

const PERSIST = 'src/supabase/persistence.ts';
const PRESENCE = 'src/supabase/registryPresence.ts';
const DIALOG = 'src/admin/DeleteServiceDialog.tsx';
const API = 'src/admin/adminRegistryApi.ts';
const src = (rel) => read(rel);
const MUTATIONS = [
  ['S1 delete: admin check removed', () => runSql(replaceInFunction(migration, 'admin_delete_service', 'if not public.is_admin() then', 'if false then'))],
  ['S2 impact: admin check removed', () => runSql(replaceInFunction(migration, 'admin_service_delete_impact', 'if not public.is_admin() then', 'if false then'))],
  ['S3 confirm name not checked', () => runSql(replaceOnce(migration, "     or btrim(p_confirm_display_name) <> btrim(v_display_name) then", '     and false then', 'confirm'))],
  ['S4 user_services not deleted', () => runSql(replaceOnce(migration, '  delete from public.user_services where service_id = p_service_id;\n', '', 'us delete'))],
  ['S5 registry row not deleted', () => runSql(replaceOnce(migration, '  delete from public.service_registry where id = p_service_id;\n', '', 'reg delete'))],
  ['S6 no audit row', () => runSql(replaceOnce(migration, "  insert into public.admin_audit_log (actor_user_id, action, service_id, details)\n  values (\n    auth.uid(),\n    'delete_service',\n    p_service_id,\n    v_result || jsonb_build_object('display_name', v_display_name)\n  );\n", '', 'audit insert'))],
  ['S7 anon keeps execute (revoke removed)', () => runSql(replaceOnce(migration, 'revoke all on function public.admin_delete_service(text, text) from anon;\n', '', 'anon revoke'))],
  ['S8 credentials count wrong', () => runSql(replaceOnce(migration, "    'credentials_count', v_credentials,", "    'credentials_count', 0,", 'cred count'))],
  ['S9 presence ignores disabled sites', () => runSql(replaceInFunction(migration, 'registry_service_ids_existing', '      and (r.owner_user_id is null or r.owner_user_id = auth.uid());', "      and (r.owner_user_id is null or r.owner_user_id = auth.uid())\n      and r.service_status = 'active';"))],
  ['S10 presence leaks private rows', () => runSql(replaceInFunction(migration, 'registry_service_ids_existing', '      and (r.owner_user_id is null or r.owner_user_id = auth.uid());', ';'))],
  ['S11 built-in list drift', () => { const m = replaceOnce(migration, "'hapoalim', 'leumi', 'discount', 'mizrahi',", "'hapoalim', 'leumi', 'discount',", 'builtin list'); sqlStatic(m); return runSql(m); }],
  ['S12 user-owned rows deletable', () => runSql(replaceInFunction(migration, 'admin_delete_service', '    where r.id = p_service_id and r.owner_user_id is null\n    for update;', '    where r.id = p_service_id\n    for update;'))],
  ['C1 sync ignores presence', () => runClient({ [PERSIST]: replaceOnce(src(PERSIST), 'const selectedIds = upsertableSelectedIds(localSelectedIds, state, presence);', 'const selectedIds = localSelectedIds;', 'sync filter') })],
  ['C2 hydrate not reconciled', () => runClient({ [PERSIST]: replaceOnce(src(PERSIST), 'return presence ? dropServicesMissingFromRegistry(merged, presence).state : merged;', 'return merged;', 'hydrate reconcile') })],
  ['C3 keep-local branch not reconciled', () => runClient({ [PERSIST]: replaceOnce(src(PERSIST), 'return await reconcileWithRegistry({\n        selectedIds: [...local.selectedIds],', 'return ({\n        selectedIds: [...local.selectedIds],', 'keep-local') })],
  ['C4 dropped credentials kept', () => runClient({ [PRESENCE]: replaceOnce(src(PRESENCE), 'if (!droppedProfileIds.has(profileId)) credentials[profileId] = credential;', 'credentials[profileId] = credential;', 'creds') })],
  ['C5 private customs judged', () => runClient({ [PRESENCE]: src(PRESENCE).split('if (trimmed && !customs.has(trimmed)) ids.add(trimmed);').join('if (trimmed) ids.add(trimmed);') })],
  ['C6 empty registry treated as known', () => runClient({ [PRESENCE]: replaceOnce(src(PRESENCE), 'registryRows <= 0', 'registryRows < 0', 'rows guard') })],
  ['C7 RPC error treated as "nothing exists"', () => runClient({ [PRESENCE]: replaceOnce(src(PRESENCE), "    if (error || !data || typeof data !== 'object') {\n      return null;", "    if (error || !data || typeof data !== 'object') {\n      return new Set();", 'error guard') })],
  ['U1 confirm ignores the typed name', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '&& confirmNameMatches(typed, service.displayName);', ';', 'gating') })],
  ['U2 confirm before impact known', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), 'const canConfirm = impact !== null && ', 'const canConfirm = ', 'impact gate') })],
  ['U3 impact copy changed', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), 'הוא יוסר אצלם יחד עם פרטי הכניסה ששמרו.', 'הוא יוסר.', 'impact copy') })],
  ['U4 built-in line missing', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '{impact.isBuiltin ? (', '{false ? (', 'builtin') })],
  ['U5 click bypasses the gate', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '    if (!canConfirm) return;\n', '', 'guard') })],
  ['U6 list not reloaded after success', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '      onDeleted(done);\n', '', 'onDeleted') })],
  ['U7 Storage failure hidden', () => runApi({ [API]: replaceOnce(src(API), '    storageFailure: storage.failure,', '    storageFailure: null,', 'storage failure') })],
  ['U8 Storage cleanup skipped', () => runApi({ [API]: replaceOnce(src(API), 'const storage = await removeServiceAssetObjects(supabase, serviceId, assetPaths);', 'const storage = { removed: 0, failure: null };', 'storage call') })],
  ['U9 C1 raw text as the main message', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '        {view.message}\n', '        {view.technical}\n', 'main message') })],
  ['U10 C1 function-missing mapping removed', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '/PGRST202|Could not find the function/i', '/$^/', 'missing map') })],
  ['U11 C1 not-admin mapping removed', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '/Admin access required/i', '/$^/', 'admin map') })],
  ['U12 C1 name-mismatch mapping removed', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '/confirmation name does not match/i', '/$^/', 'mismatch map') })],
  ['U13 C1 disabled-reason line missing', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '{impactError ? (\n              <p className="admin-field-hint"', '{false ? (\n              <p className="admin-field-hint"', 'reason line') })],
  ['U14 C1 technical details open by default', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '<details className="admin-special-test-details" data-part="technical">', '<details className="admin-special-test-details" data-part="technical" open>', 'details open') })],
  ['U15 C1 technical text dropped', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '      {view.technical ? (', '      {false ? (', 'technical') })],
  ['U16 C1 impact call not mapped', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), 'setImpactError(deleteServiceErrorView(err));', "setImpactError({ message: err instanceof Error ? err.message : String(err), technical: '' });", 'impact map') })],
  ['U17 C1 delete call not mapped', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), 'setError(deleteServiceErrorView(err));', "setError({ message: err instanceof Error ? err.message : String(err), technical: '' });", 'delete map') })],
  ['U19 C2 old built-in copy restored', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), "'אתר מובנה: יימחק לגמרי, גם אצל המשתמשים. הוא יחזור רק אם יוסף מחדש, במצב ההתחלתי וללא מיפוי.'", "'אתר מובנה — יחזור למצב ההתחלתי, ללא המיפוי.'", 'builtin copy') })],
  ['U20 C2 impact line styled as error', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '<p className={IMPACT_NOTICE_CLASS} data-part="impact-users">', '<p className="admin-error" data-part="impact-users">', 'impact class') })],
  ['U21 C2 built-in line styled as error', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '<p className={IMPACT_NOTICE_CLASS} data-status="delete-service-builtin">', '<p className="admin-error" data-status="delete-service-builtin">', 'builtin class') })],
  ['U22 C2 failure no longer red', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), '<p className="admin-error" role="alert" data-part="message">', '<p className={IMPACT_NOTICE_CLASS} role="alert" data-part="message">', 'failure class') })],
  ['U23 C2 zero-users copy changed', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), "noUsers: 'האתר לא נמצא אצל אף משתמש.',", "noUsers: 'אין משתמשים.',", 'noUsers') })],
  ['U24 C2 notice style not the existing one', () => runUi({ [DIALOG]: replaceOnce(src(DIALOG), "const IMPACT_NOTICE_CLASS = 'admin-gate-login-banner';", "const IMPACT_NOTICE_CLASS = 'admin-muted';", 'notice class') })],
  ['U18 C1 API drops the raw PostgREST text', () => runApi({ [API]: replaceOnce(src(API), "return new Error(raw === 'unknown error' ? 'unexpected RPC error' : raw);", "return new Error('מחיקת האתר נכשלה.');", 'raw error') })],
];

let caught = 0;
for (const [name, run] of MUTATIONS) {
  let failure = null;
  try {
    await run();
  } catch (err) {
    failure = err;
  }
  if (!failure) throw new Error(`mutation NOT caught: ${name}`);
  if (String(failure.message).startsWith('fixture:')) throw new Error(`mutation fixture error: ${name}: ${failure.message}`);
  caught += 1;
  console.log(`  caught ${name} — ${String(failure.message).split('\n')[0]}`);
}
console.log(`PASS — D-121-51 delete site: 4 check groups (SQL / client / dialog / Admin API), ${caught} mutations caught`);
