-- Phase 121 D-121-51: Admin «מחיקת אתר» — full removal of a global site for all users.
-- user_services.service_id has no FK, so it is deleted explicitly (cascades access_profiles →
-- encrypted_credentials). service_assets cascades from service_registry but is deleted explicitly
-- so its Storage paths can be returned; the Admin client removes the Storage objects afterwards.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null,
  action text not null,
  service_id text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Written only by security definer RPCs; readable by admins.
revoke all on table public.admin_audit_log from public;
revoke all on table public.admin_audit_log from anon;
revoke insert, update, delete on table public.admin_audit_log from authenticated;
grant select on table public.admin_audit_log to authenticated;

drop policy if exists "admin_audit_log_admin_select" on public.admin_audit_log;
create policy "admin_audit_log_admin_select"
on public.admin_audit_log
for select
to authenticated
using (public.is_admin());

-- Ids that ensure_known_builtin_registry_row re-creates from the Hub seed (same allowlist).
create or replace function public.is_known_builtin_service_id(p_service_id text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_service_id = any (array[
    'hapoalim', 'leumi', 'discount', 'mizrahi',
    'clalit', 'maccabi', 'meuhedet', 'leumit',
    'shufersal', 'rami-levy', 'amazon-il', 'ksp', 'htzone'
  ]::text[]), false);
$$;

revoke all on function public.is_known_builtin_service_id(text) from public;
revoke all on function public.is_known_builtin_service_id(text) from anon;
grant execute on function public.is_known_builtin_service_id(text) to authenticated;

create or replace function public.admin_service_delete_impact(p_service_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_users integer;
  v_profiles integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_service_id is null or length(trim(p_service_id)) = 0 then
    raise exception 'service_id is required';
  end if;

  if not exists (
    select 1 from public.service_registry r
    where r.id = p_service_id and r.owner_user_id is null
  ) then
    raise exception 'global service not found: %', p_service_id;
  end if;

  select count(distinct us.user_id)
    into v_users
    from public.user_services us
    where us.service_id = p_service_id;

  select count(*)
    into v_profiles
    from public.access_profiles ap
    join public.user_services us on us.id = ap.user_service_id
    where us.service_id = p_service_id;

  return jsonb_build_object(
    'users_count', v_users,
    'profiles_count', v_profiles,
    'is_builtin', public.is_known_builtin_service_id(p_service_id)
  );
end;
$$;

revoke all on function public.admin_service_delete_impact(text) from public;
revoke all on function public.admin_service_delete_impact(text) from anon;
grant execute on function public.admin_service_delete_impact(text) to authenticated;

create or replace function public.admin_delete_service(
  p_service_id text,
  p_confirm_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_users integer;
  v_profiles integer;
  v_credentials integer;
  v_assets integer;
  v_asset_paths text[];
  v_builtin boolean;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_service_id is null or length(trim(p_service_id)) = 0 then
    raise exception 'service_id is required';
  end if;

  select r.display_name
    into v_display_name
    from public.service_registry r
    where r.id = p_service_id and r.owner_user_id is null
    for update;

  if not found then
    raise exception 'global service not found: %', p_service_id;
  end if;

  if p_confirm_display_name is null
     or btrim(p_confirm_display_name) <> btrim(v_display_name) then
    raise exception 'confirmation name does not match the site name';
  end if;

  select count(distinct us.user_id)
    into v_users
    from public.user_services us
    where us.service_id = p_service_id;

  select count(*)
    into v_profiles
    from public.access_profiles ap
    join public.user_services us on us.id = ap.user_service_id
    where us.service_id = p_service_id;

  select count(*)
    into v_credentials
    from public.encrypted_credentials ec
    join public.access_profiles ap on ap.id = ec.access_profile_id
    join public.user_services us on us.id = ap.user_service_id
    where us.service_id = p_service_id;

  select count(*), coalesce(array_agg(sa.storage_path) filter (where sa.storage_path is not null), '{}'::text[])
    into v_assets, v_asset_paths
    from public.service_assets sa
    where sa.service_id = p_service_id;

  v_builtin := public.is_known_builtin_service_id(p_service_id);

  delete from public.user_services where service_id = p_service_id;
  delete from public.service_assets where service_id = p_service_id;
  delete from public.service_registry where id = p_service_id;

  v_result := jsonb_build_object(
    'users_count', v_users,
    'profiles_count', v_profiles,
    'credentials_count', v_credentials,
    'assets_count', v_assets,
    'is_builtin', v_builtin
  );

  insert into public.admin_audit_log (actor_user_id, action, service_id, details)
  values (
    auth.uid(),
    'delete_service',
    p_service_id,
    v_result || jsonb_build_object('display_name', v_display_name)
  );

  return v_result || jsonb_build_object('asset_paths', to_jsonb(v_asset_paths));
end;
$$;

revoke all on function public.admin_delete_service(text, text) from public;
revoke all on function public.admin_delete_service(text, text) from anon;
grant execute on function public.admin_delete_service(text, text) to authenticated;

-- Hub reconciliation: which of the caller's service ids still exist in the registry, regardless of
-- service_status (a disabled site is not a deleted site). Only global rows or the caller's own rows.
-- registry_rows = 0 means an unseeded / wiped registry; clients must then treat presence as unknown.
create or replace function public.registry_service_ids_existing(p_service_ids text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_existing text[];
  v_registry_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(cardinality(p_service_ids), 0) > 500 then
    raise exception 'too many service ids';
  end if;

  select coalesce(array_agg(r.id), '{}'::text[])
    into v_existing
    from public.service_registry r
    where r.id = any (coalesce(p_service_ids, '{}'::text[]))
      and (r.owner_user_id is null or r.owner_user_id = auth.uid());

  select count(*)
    into v_registry_rows
    from public.service_registry r
    where r.owner_user_id is null;

  return jsonb_build_object('existing', to_jsonb(v_existing), 'registry_rows', v_registry_rows);
end;
$$;

revoke all on function public.registry_service_ids_existing(text[]) from public;
revoke all on function public.registry_service_ids_existing(text[]) from anon;
grant execute on function public.registry_service_ids_existing(text[]) to authenticated;
