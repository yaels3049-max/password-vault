/**
 * Phase 122.7 — `admin_submitter_profiles(uuid[])` (Admin «אתרים בהוספה ע"י משתמשים» cards).
 * The REAL migration runs on PGlite (real Postgres) with Supabase-like roles / default privileges,
 * the REAL Phase 101 schema and the REAL Phase 109 is_admin(). Admin only; only users who own a
 * user-submitted registry row; name / email columns only; no table / policy change.
 * Synthetic fixtures only. Mutations must be caught.
 * Usage: node scripts/verifyPhase122SubmitterProfiles.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = 'supabase/migrations/20261001120000_phase122_admin_submitter_profiles.sql';
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
function replaceOnce(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`fixture: mutation anchor "${label}" found ${n}×`);
  return src.replace(from, () => to);
}

const ADMIN = '00000000-0000-4000-8000-00000000000a';
const DISABLED_ADMIN = '00000000-0000-4000-8000-00000000000d';
const SUBMITTER = '00000000-0000-4000-8000-000000000001';
const MEMBER_ONLY = '00000000-0000-4000-8000-000000000002';
const GLOBAL_OWNER = '00000000-0000-4000-8000-000000000003';
const SECOND_SUBMITTER = '00000000-0000-4000-8000-000000000004';

function isAdminSql() {
  const src = read('supabase/migrations/20260712200000_phase109_user_profile_auth.sql');
  const m = src.match(/create or replace function public\.is_admin\(\)[\s\S]*?\$\$;\n/);
  if (!m) throw new Error('fixture: Phase 109 is_admin() not found');
  return m[0];
}

const SEED = `
insert into auth.users (id) values ('${ADMIN}'), ('${DISABLED_ADMIN}'), ('${SUBMITTER}'), ('${MEMBER_ONLY}'), ('${GLOBAL_OWNER}'), ('${SECOND_SUBMITTER}');
insert into public.users (id, is_admin, role, status, first_name, last_name, email, phone_normalized) values
  ('${ADMIN}', true, 'admin', 'active', 'מנהלת', 'ראשית', 'admin@example.test', '+972500000001'),
  ('${DISABLED_ADMIN}', true, 'admin', 'disabled', 'מושבת', 'מנהל', 'off@example.test', null),
  ('${SUBMITTER}', false, 'user', 'active', 'נועה', 'לוי', 'noa@example.test', '+972500000002'),
  ('${MEMBER_ONLY}', false, 'user', 'active', 'רק', 'חבר', 'member@example.test', null),
  ('${GLOBAL_OWNER}', false, 'user', 'active', 'בעל', 'גלובלי', 'global@example.test', null),
  ('${SECOND_SUBMITTER}', false, 'user', 'active', null, null, 'second@example.test', null);
insert into public.service_registry (id, display_name, primary_url, source_type, service_status, owner_user_id) values
  ('global-site', 'אתר גלובלי', 'https://global.example.test', 'admin', 'active', null),
  ('sub-1', 'הגשה', 'https://sub1.example.test', 'user', 'pending_review', '${SUBMITTER}'),
  ('sub-2', 'הגשה 2', 'https://sub2.example.test', 'user', 'active', '${SECOND_SUBMITTER}'),
  ('not-user-source', 'לא הגשה', 'https://x.example.test', 'approved_global', 'active', '${GLOBAL_OWNER}');
insert into public.user_services (id, user_id, service_id) values
  ('10000000-0000-4000-8000-000000000001', '${MEMBER_ONLY}', 'global-site');
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
      add column role text not null default 'user', add column status text not null default 'active',
      add column first_name text, add column last_name text, add column email text, add column phone_normalized text;
    alter table public.service_registry add column owner_user_id uuid null references auth.users(id) on delete cascade;
  `);
  await db.exec(isAdminSql());
  const schemaBefore = await schemaFingerprint(db);
  await db.exec(migrationSql);
  await db.exec(SEED);
  return { db, schemaBefore };
}

/** Tables, columns and policies — the migration must not change any of them. */
async function schemaFingerprint(db) {
  const cols = await db.query(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' order by 1, 2`);
  const pols = await db.query(`select tablename, policyname from pg_policies where schemaname = 'public' order by 1, 2`);
  const rls = await db.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`);
  return JSON.stringify([cols.rows, pols.rows, rls.rows]);
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
const RPC = 'select * from public.admin_submitter_profiles($1::uuid[])';
const ALL = [ADMIN, DISABLED_ADMIN, SUBMITTER, MEMBER_ONLY, GLOBAL_OWNER, SECOND_SUBMITTER];

async function sqlChecks(migrationSql) {
  const { db, schemaBefore } = await bootDb(migrationSql);
  // Non-admins get an error and nothing else.
  await expectError(as(db, 'anon', RPC, [ALL]), /permission denied/, 'anon');
  for (const who of [SUBMITTER, MEMBER_ONLY, DISABLED_ADMIN]) {
    await expectError(as(db, who, RPC, [ALL]), /Admin access required/, `non-admin ${who}`);
  }
  await expectError(as(db, null, RPC, [ALL]), /Admin access required/, 'no session');

  // Admin: only users who own a user-submitted row; only id / name / email.
  const res = await as(db, ADMIN, RPC, [ALL]);
  const cols = res.fields.map((f) => f.name);
  assert(JSON.stringify(cols) === '["id","first_name","last_name","email"]', `admin: columns id / first_name / last_name / email only (got ${cols.join(', ')})`);
  const byId = Object.fromEntries(res.rows.map((r) => [r.id, r]));
  assert(res.rows.length === 2 && byId[SUBMITTER] && byId[SECOND_SUBMITTER], `admin: only the submitters returned (got ${res.rows.map((r) => r.id).join(', ')})`);
  assert(byId[SUBMITTER].first_name === 'נועה' && byId[SUBMITTER].last_name === 'לוי' && byId[SUBMITTER].email === 'noa@example.test', 'admin: name / email of the submitter');
  assert(byId[SECOND_SUBMITTER].first_name === null && byId[SECOND_SUBMITTER].email === 'second@example.test', 'admin: empty name returned as null (client falls back to the email)');
  assert(!res.rows.some((r) => [MEMBER_ONLY, GLOBAL_OWNER, ADMIN].includes(r.id)), 'admin: ids without a user submission are not returned (member, non-user source, admin)');
  assert(!JSON.stringify(res.rows).includes('+9725'), 'admin: no other profile data (phone) returned');
  const only = await as(db, ADMIN, RPC, [[SUBMITTER]]);
  assert(only.rows.length === 1 && only.rows[0].id === SUBMITTER, 'admin: only the requested ids');
  assert((await as(db, ADMIN, RPC, [[MEMBER_ONLY, GLOBAL_OWNER]])).rows.length === 0, 'admin: ids without a submission → nothing');
  assert((await as(db, ADMIN, RPC, [[]])).rows.length === 0 && (await as(db, ADMIN, RPC, [null])).rows.length === 0, 'admin: empty / null list → nothing');

  // Read-only and no schema / policy change.
  assert((await schemaFingerprint(db)) === schemaBefore, 'migration changes no table, column, RLS flag or policy');
  const users = await db.query('select count(*)::int n from public.users');
  assert(users.rows[0].n === 6, 'RPC writes nothing');
  await db.close();
}

function staticChecks(src) {
  const start = src.indexOf('create or replace function public.admin_submitter_profiles(p_user_ids uuid[])');
  assert(start >= 0, 'function admin_submitter_profiles(p_user_ids uuid[]) defined');
  const body = src.slice(start, src.indexOf('$$;', start));
  assert(/returns table \(id uuid, first_name text, last_name text, email text\)/.test(body), 'returns (id, first_name, last_name, email)');
  assert(/security definer/.test(body) && /set search_path = public/.test(body), 'security definer + search_path = public');
  assert(/if not public\.is_admin\(\) then\s+raise exception/.test(body), 'requires public.is_admin() (raise otherwise)');
  const sig = 'admin_submitter_profiles(uuid[])';
  assert(src.includes(`revoke all on function public.${sig} from public;`), 'revoked from public');
  assert(src.includes(`grant execute on function public.${sig} to authenticated;`), 'granted to authenticated');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert(!/\b(create|alter|drop)\s+(table|policy)\b|enable row level security/i.test(code), 'no table / policy change');
  assert(!/encrypted_credentials|access_profiles|ciphertext|vault/i.test(code), 'no credential data');
}

function clientChecks() {
  const api = read('src/admin/adminRegistryApi.ts');
  const fn = api.slice(api.indexOf('export async function fetchSubmitterProfiles'), api.indexOf('export async function fetchRegistryRowForAdmin'));
  assert(/supabase\.rpc\('admin_submitter_profiles', \{\s*p_user_ids:/.test(fn), 'Hub: fetchSubmitterProfiles calls admin_submitter_profiles(p_user_ids)');
  // G-122-7: the queue and the catalog share one loader (one call with the distinct owners of user rows).
  const loader = read('src/admin/submitterProfiles.ts');
  assert(
    (loader.match(/fetchSubmitterProfiles\(/g) ?? []).length === 1 && /new Set\(/.test(loader) && /source_type === 'user'/.test(loader) && /catch\s*\{\s*return \{\};/.test(loader),
    'Hub: shared loader — one call with the distinct owner ids of user rows, empty map on failure',
  );
  for (const [rel, rowsVar] of [['src/admin/ApprovalQueue.tsx', 'pending'], ['src/admin/RegistryAdmin.tsx', 'registryRows']]) {
    const file = read(rel);
    const reload = file.slice(file.indexOf('const reload = useCallback'), file.indexOf('useEffect(() => {\n    void reload();'));
    assert(
      (reload.match(/loadSubmitterProfiles\(/g) ?? []).length === 1 && reload.includes(`loadSubmitterProfiles(${rowsVar})`) && !/fetchSubmitterProfiles\(/.test(file),
      `Hub: ${rel} — one shared-loader call per load`,
    );
  }
}

const MUTATIONS = [
  ['M1 RPC without the is_admin check', "  if not public.is_admin() then\n    raise exception 'Admin access required';\n  end if;\n", ''],
  ['M2 RPC returns users without a submission', "      and exists (\n        select 1\n        from public.service_registry r\n        where r.owner_user_id = u.id\n          and r.source_type = 'user'\n      );", ';'],
  ['M3 non-user-source rows count as submissions', "          and r.source_type = 'user'\n", '\n'],
  ['M4 anon may execute', 'revoke all on function public.admin_submitter_profiles(uuid[]) from anon;\n', ''],
  ['M5 extra profile column', 'returns table (id uuid, first_name text, last_name text, email text)', 'returns table (id uuid, first_name text, last_name text, email text, phone_normalized text)'],
];

const src = read(MIGRATION);
staticChecks(src);
console.log('  ✓ static: security definer, search_path, is_admin() raise, revoke public / anon, grant authenticated, no table / policy / credential change');
clientChecks();
console.log('  ✓ Hub: fetchSubmitterProfiles → rpc admin_submitter_profiles(p_user_ids); one shared-loader call per queue / catalog load with distinct owner ids');
await sqlChecks(src);
console.log('  ✓ SQL (PGlite): anon / non-admin / disabled admin / no session rejected; admin gets only submitters (user source), id / name / email only, only requested ids; empty / null → nothing; read-only; schema and policies unchanged');

console.log('\nMutations');
let caught = 0;
for (const [label, from, to] of MUTATIONS) {
  const mutated = replaceOnce(src, from, to, label);
  let err = null;
  try {
    if (label.startsWith('M5')) {
      const body = mutated.replace('select u.id, u.first_name, u.last_name, u.email', 'select u.id, u.first_name, u.last_name, u.email, u.phone_normalized');
      staticChecks(body);
      await sqlChecks(body);
    } else {
      staticChecks(mutated);
      await sqlChecks(mutated);
    }
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  assert(err, `mutation NOT caught: ${label}`);
  assert(!err.startsWith('fixture:'), `mutation broke a fixture: ${label} (${err})`);
  // Each SQL mutation must also be caught by the database run alone, not only the static scan.
  if (!label.startsWith('M5')) {
    let sqlErr = null;
    try {
      await sqlChecks(mutated);
    } catch (e) {
      sqlErr = e instanceof Error ? e.message : String(e);
    }
    assert(sqlErr, `mutation passes the database checks: ${label}`);
  }
  caught += 1;
  console.log(`  ✓ mutation caught: ${label} — ${err.slice(0, 120)}`);
}
console.log(`\nPASS — Phase 122.7 admin_submitter_profiles: 3 check groups, ${caught} mutations caught`);
