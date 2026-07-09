-- Phase 107: Admin authorization, RLS, constraints, and SECURITY DEFINER RPCs

alter table public.users
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_admin from public.users u where u.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Canonical source_type / service_status (Phase 107)
alter table public.service_registry
  drop constraint if exists service_registry_source_type_check;

alter table public.service_registry
  add constraint service_registry_source_type_check
  check (source_type in ('built_in', 'user', 'admin', 'approved_global'));

alter table public.service_registry
  drop constraint if exists service_registry_service_status_check;

alter table public.service_registry
  add constraint service_registry_service_status_check
  check (service_status in ('active', 'pending_review', 'deprecated', 'disabled'));

-- Categories: admin write (SELECT policy unchanged from Phase 101)
drop policy if exists "categories_admin_insert" on public.categories;
create policy "categories_admin_insert"
on public.categories
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "categories_admin_update" on public.categories;
create policy "categories_admin_update"
on public.categories
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "categories_admin_delete" on public.categories;
create policy "categories_admin_delete"
on public.categories
for delete
to authenticated
using (public.is_admin());

-- service_registry: admin visibility + global CRUD + user-row approval updates
drop policy if exists "service_registry_admin_select_all" on public.service_registry;
create policy "service_registry_admin_select_all"
on public.service_registry
for select
to authenticated
using (public.is_admin());

drop policy if exists "service_registry_admin_global_insert" on public.service_registry;
create policy "service_registry_admin_global_insert"
on public.service_registry
for insert
to authenticated
with check (public.is_admin() and owner_user_id is null);

drop policy if exists "service_registry_admin_global_update" on public.service_registry;
create policy "service_registry_admin_global_update"
on public.service_registry
for update
to authenticated
using (public.is_admin() and owner_user_id is null)
with check (public.is_admin() and owner_user_id is null);

drop policy if exists "service_registry_admin_global_delete" on public.service_registry;
create policy "service_registry_admin_global_delete"
on public.service_registry
for delete
to authenticated
using (public.is_admin() and owner_user_id is null);

drop policy if exists "service_registry_admin_user_review" on public.service_registry;
create policy "service_registry_admin_user_review"
on public.service_registry
for update
to authenticated
using (public.is_admin() and owner_user_id is not null)
with check (public.is_admin() and owner_user_id is not null);

-- Atomic promotion: user submission → global built_in row (in-place when ids match)
create or replace function public.promote_user_submission(
  p_user_service_id text,
  p_global_service_id text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_row public.service_registry%rowtype;
  v_global_id text;
  v_admin_id uuid;
  v_provenance jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_user_service_id is null or length(trim(p_user_service_id)) = 0 then
    raise exception 'user_service_id is required';
  end if;

  v_admin_id := auth.uid();

  select * into v_user_row
  from public.service_registry
  where id = p_user_service_id
    and owner_user_id is not null
    and source_type = 'user';

  if not found then
    raise exception 'User submission not found: %', p_user_service_id;
  end if;

  v_global_id := coalesce(nullif(trim(p_global_service_id), ''), v_user_row.id);

  v_provenance := jsonb_build_object(
    'promotedFromUserId', v_user_row.owner_user_id,
    'promotedFromServiceId', v_user_row.id,
    'promotedAt', now(),
    'promotedBy', v_admin_id
  );

  if v_global_id = v_user_row.id then
    update public.service_registry
    set
      owner_user_id = null,
      source_type = 'built_in',
      service_status = 'active',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'provenance', v_provenance,
        'approvalStatus', 'approved',
        'approvedAt', now(),
        'approvedBy', v_admin_id
      ),
      updated_at = now()
    where id = p_user_service_id
      and owner_user_id is not null
      and source_type = 'user';

    if not found then
      raise exception 'Could not promote submission % in-place', p_user_service_id;
    end if;

    return v_global_id;
  end if;

  if exists (select 1 from public.service_registry where id = v_global_id) then
    raise exception 'Global service id % already exists', v_global_id;
  end if;

  insert into public.service_registry (
    id,
    display_name,
    primary_url,
    login_url,
    category_id,
    icon,
    adapter_id,
    login_fields,
    source_type,
    service_status,
    metadata,
    metadata_version,
    login_url_status,
    owner_user_id
  )
  values (
    v_global_id,
    v_user_row.display_name,
    v_user_row.primary_url,
    v_user_row.login_url,
    v_user_row.category_id,
    coalesce(v_user_row.icon, '🔗'),
    v_user_row.adapter_id,
    v_user_row.login_fields,
    'built_in',
    'active',
    coalesce(v_user_row.metadata, '{}'::jsonb) || jsonb_build_object('provenance', v_provenance),
    coalesce(v_user_row.metadata_version, 1),
    coalesce(v_user_row.login_url_status, 'unknown'),
    null
  );

  update public.service_registry
  set
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'approvalStatus', 'approved',
      'approvedAt', now(),
      'approvedBy', v_admin_id,
      'promotedGlobalId', v_global_id
    ),
    updated_at = now()
  where id = p_user_service_id;

  return v_global_id;
end;
$$;

revoke all on function public.promote_user_submission(text, text) from public;
grant execute on function public.promote_user_submission(text, text) to authenticated;

-- Manual admin login URL edit on global curated rows
create or replace function public.admin_update_login_url(
  p_service_id text,
  p_login_url text,
  p_login_fields jsonb default null,
  p_login_url_status text default 'valid'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_service_id is null or length(trim(p_service_id)) = 0 then
    raise exception 'service_id is required';
  end if;

  if p_login_url is null or length(trim(p_login_url)) = 0 then
    raise exception 'login_url is required';
  end if;

  if p_login_url_status not in ('unknown', 'valid', 'invalid') then
    raise exception 'invalid login_url_status: %', p_login_url_status;
  end if;

  update public.service_registry
  set
    login_url = p_login_url,
    login_fields = coalesce(p_login_fields, login_fields),
    login_url_status = p_login_url_status,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'lastAdminEdit', now(),
      'lastAdminUserId', auth.uid()
    ),
    updated_at = now()
  where id = p_service_id
    and owner_user_id is null
    and source_type in ('built_in', 'admin', 'approved_global')
    and service_status in ('active', 'deprecated', 'disabled');

  if not found then
    raise exception 'admin_update_login_url not allowed for service %', p_service_id;
  end if;
end;
$$;

revoke all on function public.admin_update_login_url(text, text, jsonb, text) from public;
grant execute on function public.admin_update_login_url(text, text, jsonb, text) to authenticated;
