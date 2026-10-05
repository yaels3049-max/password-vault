-- Phase 123.4 (AD-123-15): admin-only aggregate "apps without profile", read in the SQL editor.
-- One row of counts from user_services.created_at / access_profiles.created_at: no user ids, names,
-- service ids or credential data. Read-only; no table / column / RLS policy change.

create or replace function public.admin_apps_without_profile_counts()
returns table (
  apps_total bigint,
  apps_with_profile bigint,
  apps_without_profile bigint,
  apps_without_profile_over_1d bigint,
  apps_without_profile_over_7d bigint,
  apps_first_profile_after_1d bigint,
  users_with_apps bigint,
  users_with_app_without_profile bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
    with apps as (
      select
        us.user_id,
        us.created_at,
        (select min(ap.created_at)
           from public.access_profiles ap
          where ap.user_service_id = us.id) as first_profile_at
      from public.user_services us
    )
    select
      count(*)::bigint,
      count(*) filter (where a.first_profile_at is not null)::bigint,
      count(*) filter (where a.first_profile_at is null)::bigint,
      count(*) filter (where a.first_profile_at is null
                         and a.created_at < now() - interval '1 day')::bigint,
      count(*) filter (where a.first_profile_at is null
                         and a.created_at < now() - interval '7 days')::bigint,
      count(*) filter (where a.first_profile_at > a.created_at + interval '1 day')::bigint,
      count(distinct a.user_id)::bigint,
      count(distinct a.user_id) filter (where a.first_profile_at is null)::bigint
    from apps a;
end;
$$;

revoke all on function public.admin_apps_without_profile_counts() from public;
revoke all on function public.admin_apps_without_profile_counts() from anon;
grant execute on function public.admin_apps_without_profile_counts() to authenticated;
