/**
 * Phase 122.8 R4 — `public.admin_service_notes` (Admin «הערות» per site).
 * The REAL migration runs on PGlite (real Postgres) with Supabase-like roles / default privileges,
 * the REAL Phase 101 schema and the REAL Phase 109 is_admin(). Admin-only CRUD under RLS; anon /
 * non-admin / disabled admin read nothing and cannot write; FK cascade on service delete; 20000
 * character limit; no change to other tables or policies. Synthetic fixtures only.
 * Mutations must be caught.
 * Usage: node scripts/verifyPhase122AdminNotes.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = 'supabase/migrations/20261002120000_phase122_admin_service_notes.sql';
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
const MEMBER = '00000000-0000-4000-8000-000000000001';

function isAdminSql() {
  const src = read('supabase/migrations/20260712200000_phase109_user_profile_auth.sql');
  const m = src.match(/create or replace function public\.is_admin\(\)[\s\S]*?\$\$;\n/);
  if (!m) throw new Error('fixture: Phase 109 is_admin() not found');
  return m[0];
}

const SEED = `
insert into auth.users (id) values ('${ADMIN}'), ('${DISABLED_ADMIN}'), ('${MEMBER}');
insert into public.users (id, is_admin, role, status) values
  ('${ADMIN}', true, 'admin', 'active'),
  ('${DISABLED_ADMIN}', true, 'admin', 'disabled'),
  ('${MEMBER}', false, 'user', 'active');
insert into public.service_registry (id, display_name, primary_url, source_type, service_status) values
  ('site-a', 'אתר א', 'https://a.example.test', 'admin', 'active'),
  ('site-b', 'אתר ב', 'https://b.example.test', 'admin', 'active'),
  ('site-c', 'אתר ג', 'https://c.example.test', 'admin', 'disabled');
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
  `);
  await db.exec(isAdminSql());
  const schemaBefore = await schemaFingerprint(db);
  await db.exec(migrationSql);
  await db.exec(SEED);
  return { db, schemaBefore };
}

/** Tables, columns, RLS flags and policies of every public table except the new one. */
async function schemaFingerprint(db) {
  const cols = await db.query(`select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' and table_name <> 'admin_service_notes' order by 1, 2`);
  const pols = await db.query(`select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename <> 'admin_service_notes' order by 1, 2`);
  const rls = await db.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and relname <> 'admin_service_notes' order by 1`);
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
const count = async (db) => (await db.query('select count(*)::int n from public.admin_service_notes')).rows[0].n;
const bodyOf = async (db, id) =>
  (await db.query('select body from public.admin_service_notes where service_id = $1', [id])).rows[0]?.body ?? null;

async function sqlChecks(migrationSql) {
  const { db, schemaBefore } = await bootDb(migrationSql);

  // Admin CRUD (the Hub upsert / select / delete shapes).
  const upsert = `insert into public.admin_service_notes (service_id, body, updated_at, updated_by)
    values ($1, $2, now(), $3) on conflict (service_id) do update set body = excluded.body,
    updated_at = excluded.updated_at, updated_by = excluded.updated_by returning service_id, body, updated_at`;
  const created = await as(db, ADMIN, upsert, ['site-a', 'להתקשר לתמיכה לפני שינוי', ADMIN]);
  assert(created.rows.length === 1 && created.rows[0].body === 'להתקשר לתמיכה לפני שינוי', 'admin: insert returns the note');
  await as(db, ADMIN, upsert, ['site-b', 'הערה ב', ADMIN]);
  await as(db, ADMIN, upsert, ['site-a', 'עודכן', ADMIN]);
  assert((await bodyOf(db, 'site-a')) === 'עודכן', 'admin: upsert updates the existing note');
  const sel = await as(db, ADMIN, 'select service_id, body, updated_at from public.admin_service_notes where service_id = $1', ['site-a']);
  assert(sel.rows.length === 1 && sel.rows[0].updated_at, 'admin: select one note with updated_at');
  const ids = await as(db, ADMIN, 'select service_id from public.admin_service_notes');
  assert(ids.rows.map((r) => r.service_id).sort().join(',') === 'site-a,site-b', 'admin: ids-only marker query');
  await as(db, ADMIN, 'delete from public.admin_service_notes where service_id = $1', ['site-b']);
  assert((await count(db)) === 1, 'admin: delete removes the note');

  // anon: no table privileges at all.
  await expectError(as(db, 'anon', 'select * from public.admin_service_notes'), /permission denied/, 'anon select');
  await expectError(as(db, 'anon', upsert, ['site-c', 'x', ADMIN]), /permission denied/, 'anon insert');

  // Authenticated non-admin / disabled admin / no session: read nothing, cannot write.
  for (const who of [MEMBER, DISABLED_ADMIN, null]) {
    const label = who ?? 'no session';
    const rows = await as(db, who, 'select * from public.admin_service_notes');
    assert(rows.rows.length === 0, `${label}: select returns nothing`);
    // Plain insert (no RETURNING / ON CONFLICT, which would also need the select policy).
    await expectError(
      as(db, who, 'insert into public.admin_service_notes (service_id, body) values ($1, $2)', ['site-c', 'x']),
      /row-level security|violates/,
      `${label}: insert rejected`,
    );
    await as(db, who, "update public.admin_service_notes set body = 'hijack'");
    assert((await bodyOf(db, 'site-a')) === 'עודכן', `${label}: update changes nothing`);
    await as(db, who, 'delete from public.admin_service_notes');
    assert((await count(db)) === 1, `${label}: delete removes nothing`);
  }

  // Length check: 20000 OK, 20001 rejected.
  await as(db, ADMIN, upsert, ['site-c', 'א'.repeat(20000), ADMIN]);
  assert((await bodyOf(db, 'site-c'))?.length === 20000, 'admin: 20000 characters accepted');
  await expectError(as(db, ADMIN, upsert, ['site-b', 'א'.repeat(20001), ADMIN]), /check constraint/, 'length 20001');

  // Unknown service → FK error; deleting the service deletes its note (cascade).
  await expectError(as(db, ADMIN, upsert, ['no-such-site', 'x', ADMIN]), /foreign key/, 'unknown service');
  await db.exec("delete from public.service_registry where id = 'site-a'");
  assert((await bodyOf(db, 'site-a')) === null, 'service delete cascades to its note');
  assert((await count(db)) === 1, 'cascade removes only that note');

  // No other table / column / RLS flag / policy changed; new table has RLS on.
  assert((await schemaFingerprint(db)) === schemaBefore, 'migration changes no other table, column, RLS flag or policy');
  const rls = await db.query("select relrowsecurity from pg_class where relname = 'admin_service_notes'");
  assert(rls.rows[0]?.relrowsecurity === true, 'RLS enabled on admin_service_notes');
  await db.close();
}

function staticChecks(src) {
  assert(/create table if not exists public\.admin_service_notes \(/.test(src), 'creates public.admin_service_notes');
  assert(/service_id text primary key references public\.service_registry\(id\) on delete cascade/.test(src), 'service_id text PK → service_registry(id) on delete cascade');
  assert(/body text not null check \(char_length\(body\) <= 20000\)/.test(src), 'body text not null, ≤ 20000 characters');
  assert(/updated_at timestamptz not null default now\(\)/.test(src) && /updated_by uuid\n/.test(src), 'updated_at / updated_by');
  assert(/alter table public\.admin_service_notes enable row level security;/.test(src), 'RLS enabled');
  const policies = [...src.matchAll(/create policy (\w+)\s+on public\.admin_service_notes\s+for (\w+)\s+to (\w+)\s+([\s\S]*?);/g)];
  const cmds = policies.map((p) => p[2]).sort().join(',');
  assert(cmds === 'delete,insert,select,update', `one policy per command (got ${cmds})`);
  for (const p of policies) {
    assert(p[3] === 'authenticated', `${p[1]}: to authenticated`);
    const clauses = [...p[4].matchAll(/(using|with check) \(([^)]*\)?)\)/g)].map((c) => c[2]);
    assert(clauses.length > 0 && clauses.every((c) => c === 'public.is_admin()'), `${p[1]}: only public.is_admin()`);
  }
  assert(src.includes('revoke all on table public.admin_service_notes from anon;'), 'anon revoked');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const tables = [...code.matchAll(/\b(?:create|alter|drop)\s+table\s+(?:if (?:not )?exists\s+)?([\w.]+)/gi)].map((m) => m[1]);
  assert(tables.every((t) => t === 'public.admin_service_notes'), `touches no other table (got ${tables.join(', ')})`);
  assert(!/service_registry\s+(add|drop|alter)|metadata|encrypted_credentials|access_profiles|vault/i.test(code), 'no metadata / credential / other-table change');
}

function clientChecks() {
  const api = read('src/admin/adminRegistryApi.ts');
  const notes = api.slice(api.indexOf('export interface AdminServiceNote'), api.indexOf('export async function fetchRegistryRowForAdmin'));
  assert((notes.match(/from\('admin_service_notes'\)/g) ?? []).length === 4, 'Hub: notes API reads / writes only admin_service_notes');
  assert(!/metadata/.test(notes), 'Hub: notes never touch service_registry.metadata');
  assert(/fetchAdminNoteServiceIds[\s\S]*?\.select\('service_id'\)/.test(notes), 'Hub: catalog markers query selects ids only');
  assert(/if \(!body\.trim\(\)\)[\s\S]*?\.delete\(\)\.eq\('service_id', serviceId\)/.test(notes), 'Hub: empty note deletes the row');
  assert(/onConflict: 'service_id'/.test(notes) && /updated_by: writerUserId/.test(notes), 'Hub: upsert on service_id with updated_by');
  const reg = read('src/admin/RegistryAdmin.tsx');
  const reload = reg.slice(reg.indexOf('const reload = useCallback'), reg.indexOf('useEffect(() => {\n    void reload();'));
  assert((reg.match(/fetchAdminNoteServiceIds\(/g) ?? []).length === 1 && /fetchAdminNoteServiceIds\(\)\.catch\(\(\) => \[\]/.test(reload), 'Hub: one ids-only call per catalog load; failure → no markers');
}

const MUTATIONS = [
  ['N1 select policy without is_admin', "  for select\n  to authenticated\n  using (public.is_admin());", "  for select\n  to authenticated\n  using (true);"],
  ['N2 insert policy without is_admin', "  for insert\n  to authenticated\n  with check (public.is_admin());", "  for insert\n  to authenticated\n  with check (true);"],
  ['N3 update policy without is_admin', "  for update\n  to authenticated\n  using (public.is_admin())\n  with check (public.is_admin());", "  for update\n  to authenticated\n  using (true)\n  with check (true);"],
  ['N4 delete policy without is_admin', "  for delete\n  to authenticated\n  using (public.is_admin());", "  for delete\n  to authenticated\n  using (true);"],
  ['N5 RLS not enabled', 'alter table public.admin_service_notes enable row level security;\n', ''],
  ['N6 no cascade on service delete', 'references public.service_registry(id) on delete cascade', 'references public.service_registry(id)'],
  ['N7 no length check', 'body text not null check (char_length(body) <= 20000)', 'body text not null'],
  ['N8 anon keeps table privileges', 'revoke all on table public.admin_service_notes from anon;\n', ''],
];

const src = read(MIGRATION);
staticChecks(src);
console.log('  ✓ static: table / PK / FK cascade / length check, RLS on, one is_admin() policy per command, anon revoked, no other table or metadata change');
clientChecks();
console.log('  ✓ Hub: notes API only on admin_service_notes (never metadata); ids-only marker query once per catalog load, failure → no markers; empty note deletes');
await sqlChecks(src);
console.log('  ✓ SQL (PGlite): admin CRUD; anon permission denied; non-admin / disabled admin / no session read nothing and cannot write; 20000 OK / 20001 rejected; FK + cascade; other schema unchanged');

console.log('\nMutations');
let caught = 0;
for (const [label, from, to] of MUTATIONS) {
  const mutated = replaceOnce(src, from, to, label);
  let err = null;
  try {
    staticChecks(mutated);
    await sqlChecks(mutated);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  assert(err, `mutation NOT caught: ${label}`);
  assert(!err.startsWith('fixture:'), `mutation broke a fixture: ${label} (${err})`);
  let sqlErr = null;
  try {
    await sqlChecks(mutated);
  } catch (e) {
    sqlErr = e instanceof Error ? e.message : String(e);
  }
  assert(sqlErr, `mutation passes the database checks: ${label}`);
  caught += 1;
  console.log(`  ✓ mutation caught: ${label} — ${sqlErr.slice(0, 120)}`);
}
console.log(`\nPASS — Phase 122.8 admin_service_notes: 3 check groups, ${caught} mutations caught`);
