-- Phase 109: Application user profile, email uniqueness, role/status, registration trigger
-- Account identity foundation (no subscription/billing). Aligns is_admin with role for Phase 107.

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists email_normalized text,
  add column if not exists phone_normalized text,
  add column if not exists role text not null default 'user',
  add column if not exists status text not null default 'active';

alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('user', 'admin'));

alter table public.users
  drop constraint if exists users_status_check;

alter table public.users
  add constraint users_status_check
  check (status in ('active', 'disabled', 'pending_verification', 'deleted'));

-- Unique normalized email (nulls allowed for legacy anonymous orphans)
create unique index if not exists users_email_normalized_uidx
  on public.users (email_normalized)
  where email_normalized is not null;

-- Keep is_admin in sync with role (Phase 107 compatibility)
create or replace function public.users_sync_is_admin_from_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_admin := (new.role = 'admin');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_users_sync_is_admin on public.users;
create trigger trg_users_sync_is_admin
before insert or update of role on public.users
for each row
execute function public.users_sync_is_admin_from_role();

-- Client cannot escalate role / is_admin (AC-109-21, AC-109-22)
create or replace function public.users_protect_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- Allow SECURITY DEFINER callers that set local config, else freeze privileged cols
    if current_setting('app.allow_role_change', true) is distinct from 'on' then
      new.role := old.role;
      new.is_admin := old.is_admin;
      new.status := case
        when current_setting('app.allow_status_change', true) = 'on' then new.status
        else old.status
      end;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if current_setting('app.allow_role_change', true) is distinct from 'on' then
      new.role := 'user';
      new.is_admin := false;
    end if;
  end if;

  new.is_admin := (new.role = 'admin');
  return new;
end;
$$;

drop trigger if exists trg_users_protect_privileged on public.users;
create trigger trg_users_protect_privileged
before insert or update on public.users
for each row
execute function public.users_protect_privileged_columns();

-- ---------------------------------------------------------------------------
-- Registration: create public.users profile from auth.users (atomic with Auth)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_email_norm text;
  v_first text;
  v_last text;
  v_phone text;
begin
  -- Skip anonymous auth users (is_anonymous or no email)
  if coalesce((new.raw_app_meta_data->>'provider') = 'anonymous', false)
     or new.email is null
     or length(trim(new.email)) = 0 then
    -- Still ensure a bare users row for legacy FK if needed
    insert into public.users (id, role, status, is_admin)
    values (new.id, 'user', 'active', false)
    on conflict (id) do nothing;
    return new;
  end if;

  v_email := trim(new.email);
  v_email_norm := lower(v_email);
  v_first := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  v_last := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), '');
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data->>'phone_normalized',
                                  new.raw_user_meta_data->>'phone', '')), '');

  perform set_config('app.allow_role_change', 'on', true);

  insert into public.users (
    id,
    first_name,
    last_name,
    email,
    email_normalized,
    phone_normalized,
    role,
    status,
    is_admin
  )
  values (
    new.id,
    v_first,
    v_last,
    v_email,
    v_email_norm,
    v_phone,
    'user',
    'active',
    false
  )
  on conflict (id) do update set
    first_name = coalesce(excluded.first_name, public.users.first_name),
    last_name = coalesce(excluded.last_name, public.users.last_name),
    email = coalesce(excluded.email, public.users.email),
    email_normalized = coalesce(excluded.email_normalized, public.users.email_normalized),
    phone_normalized = coalesce(excluded.phone_normalized, public.users.phone_normalized),
    updated_at = now();

  return new;
exception
  when unique_violation then
    raise exception 'email_normalized already registered'
      using errcode = '23505';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Explicit RPC for Hub to ensure profile after signUp (idempotent; role always user)
create or replace function public.ensure_app_user_profile(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone_normalized text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_email_norm text;
  v_row public.users;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_email := lower(trim(p_email));
  v_email_norm := v_email;

  if v_email_norm is null or length(v_email_norm) = 0 then
    raise exception 'email required';
  end if;

  perform set_config('app.allow_role_change', 'on', true);

  insert into public.users (
    id,
    first_name,
    last_name,
    email,
    email_normalized,
    phone_normalized,
    role,
    status,
    is_admin
  )
  values (
    v_uid,
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''),
    trim(p_email),
    v_email_norm,
    nullif(trim(p_phone_normalized), ''),
    'user',
    'active',
    false
  )
  on conflict (id) do update set
    first_name = coalesce(excluded.first_name, public.users.first_name),
    last_name = coalesce(excluded.last_name, public.users.last_name),
    email = coalesce(excluded.email, public.users.email),
    email_normalized = coalesce(excluded.email_normalized, public.users.email_normalized),
    phone_normalized = coalesce(excluded.phone_normalized, public.users.phone_normalized),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_app_user_profile(text, text, text, text) from public;
grant execute on function public.ensure_app_user_profile(text, text, text, text) to authenticated;

-- Bootstrap helper: promote/demote by email (SQL-only admin assignment)
create or replace function public.admin_set_user_role_by_email(
  p_email text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := lower(trim(p_email));
begin
  if p_role not in ('user', 'admin') then
    raise exception 'invalid role';
  end if;

  -- Only callable by existing admin (or service role bypassing via direct SQL)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  perform set_config('app.allow_role_change', 'on', true);

  update public.users
  set role = p_role,
      is_admin = (p_role = 'admin'),
      updated_at = now()
  where email_normalized = v_norm;

  if not found then
    raise exception 'user not found for email';
  end if;
end;
$$;

revoke all on function public.admin_set_user_role_by_email(text, text) from public;
grant execute on function public.admin_set_user_role_by_email(text, text) to authenticated;

-- Refresh is_admin() to also honor role (defense in depth)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (u.is_admin or u.role = 'admin')
      from public.users u
      where u.id = auth.uid()
        and u.status = 'active'
    ),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

comment on column public.users.email_normalized is 'Phase 109: trimmed lower-case email; UNIQUE when not null';
comment on column public.users.role is 'Phase 109: user|admin; client cannot escalate';
comment on column public.users.status is 'Phase 109: active|disabled|pending_verification|deleted';
