-- Phase 109: harden registration trigger for user_number + safer profile insert.
-- Fixes: signUp "Database error saving new user" when user_number is NOT NULL
-- without a reliable default on trigger inserts; orphan profiles after failed Hub finish.

-- Ensure sequence + column (idempotent if 20260713090000 already applied)
create sequence if not exists public.users_user_number_seq
  as bigint
  start with 100
  increment by 1
  minvalue 100
  no maxvalue
  cache 1;

alter table public.users
  add column if not exists user_number bigint;

update public.users
set user_number = nextval('public.users_user_number_seq')
where user_number is null;

alter table public.users
  alter column user_number set default nextval('public.users_user_number_seq');

do $$
begin
  alter table public.users alter column user_number set not null;
exception
  when others then
    null; -- already not null or cannot set yet
end $$;

alter sequence public.users_user_number_seq owned by public.users.user_number;

create unique index if not exists users_user_number_uidx
  on public.users (user_number);

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
  v_num bigint;
begin
  v_num := nextval('public.users_user_number_seq');

  if coalesce((new.raw_app_meta_data->>'provider') = 'anonymous', false)
     or new.email is null
     or length(trim(new.email)) = 0 then
    insert into public.users (id, role, status, is_admin, user_number)
    values (new.id, 'user', 'active', false, v_num)
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
    is_admin,
    user_number
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
    false,
    v_num
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
    is_admin,
    user_number
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
    false,
    nextval('public.users_user_number_seq')
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
