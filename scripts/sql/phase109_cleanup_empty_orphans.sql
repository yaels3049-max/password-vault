-- Phase 109 M8: Empty-only auto-delete for confirmed orphan anonymous users.
-- HARD RULE: only rows classified empty_orphan. Never touch data_bearing without operator log.
--
-- Prerequisites:
--   1. Run phase109_audit_unintended_users.sql and export results.
--   2. Backup / screenshot classification.
--   3. Review data_bearing rows — retain / manual migrate / later lifecycle only.
--
-- This script deletes ONLY empty orphans (no services/profiles/credentials/registry ownership).
-- Delete from auth.users cascades to public.users when FK ON DELETE CASCADE is present.

begin;

create temporary table phase109_empty_orphans on commit drop as
with auth_users as (
  select
    id,
    coalesce((raw_app_meta_data->>'provider') = 'anonymous', false)
      or email is null as is_anonymous_like
  from auth.users
),
owned as (
  select
    u.id as user_id,
    a.is_anonymous_like,
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
select user_id
from owned
where is_anonymous_like is true
  and coalesce(user_services_count, 0)
    + coalesce(access_profiles_count, 0)
    + coalesce(encrypted_credentials_count, 0)
    + coalesce(owned_registry_count, 0) = 0;

-- Safety: refuse if somehow a non-empty id slipped in
do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from phase109_empty_orphans e
  where exists (select 1 from public.user_services us where us.user_id = e.user_id)
     or exists (select 1 from public.access_profiles ap where ap.user_id = e.user_id)
     or exists (
          select 1
          from public.encrypted_credentials ec
          join public.access_profiles ap on ap.id = ec.access_profile_id
          where ap.user_id = e.user_id
        )
     or exists (select 1 from public.service_registry sr where sr.owner_user_id = e.user_id);

  if v_bad > 0 then
    raise exception 'Abort: empty-orphan set contains data-bearing users';
  end if;
end $$;

-- Preview count
select count(*) as empty_orphans_to_delete from phase109_empty_orphans;

-- Uncomment to execute after operator confirmation:
-- delete from auth.users
-- where id in (select user_id from phase109_empty_orphans);

commit;
