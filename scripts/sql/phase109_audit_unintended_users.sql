-- Phase 109 M8: Audit unintended / anonymous-linked users BEFORE any cleanup.
-- Run read-only. Does not delete.
--
-- Classification:
--   empty_orphan     — no user_services, access_profiles, encrypted_credentials, owned registry
--   data_bearing     — has any of the above (requires explicit operator decision)
--
-- Usage (psql / Supabase SQL editor):
--   \i scripts/sql/phase109_audit_unintended_users.sql

with auth_users as (
  select
    id,
    email,
    created_at,
    coalesce((raw_app_meta_data->>'provider') = 'anonymous', false)
      or email is null as is_anonymous_like
  from auth.users
),
owned as (
  select
    u.id as user_id,
    u.email,
    u.email_normalized,
    u.role,
    u.status,
    u.is_admin,
    u.created_at as profile_created_at,
    a.is_anonymous_like,
    a.email as auth_email,
    a.created_at as auth_created_at,
    (select count(*) from public.user_services us where us.user_id = u.id) as user_services_count,
    (select count(*) from public.access_profiles ap where ap.user_id = u.id) as access_profiles_count,
    (
      select count(*)
      from public.encrypted_credentials ec
      join public.access_profiles ap on ap.id = ec.access_profile_id
      where ap.user_id = u.id
    ) as encrypted_credentials_count,
    (
      select count(*)
      from public.service_registry sr
      where sr.owner_user_id = u.id
    ) as owned_registry_count
  from public.users u
  left join auth_users a on a.id = u.id
)
select
  user_id,
  auth_email,
  email_normalized,
  role,
  status,
  is_admin,
  is_anonymous_like,
  auth_created_at,
  user_services_count,
  access_profiles_count,
  encrypted_credentials_count,
  owned_registry_count,
  case
    when coalesce(user_services_count, 0)
       + coalesce(access_profiles_count, 0)
       + coalesce(encrypted_credentials_count, 0)
       + coalesce(owned_registry_count, 0) = 0
      then 'empty_orphan'
    else 'data_bearing'
  end as classification
from owned
where is_anonymous_like is true
   or email_normalized is null
order by classification, auth_created_at nulls last;
