-- Phase 122.7: Admin «אתרים בהוספה ע"י משתמשים» — submitter name / email on the queue cards.
-- users_select_own keeps admins from reading other users' rows; this admin-only RPC returns the
-- profile columns (no credential data) of the requested users who own at least one user-submitted
-- registry row. No table / RLS policy change.

create or replace function public.admin_submitter_profiles(p_user_ids uuid[])
returns table (id uuid, first_name text, last_name text, email text)
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
    select u.id, u.first_name, u.last_name, u.email
    from public.users u
    where u.id = any (coalesce(p_user_ids, array[]::uuid[]))
      and exists (
        select 1
        from public.service_registry r
        where r.owner_user_id = u.id
          and r.source_type = 'user'
      );
end;
$$;

revoke all on function public.admin_submitter_profiles(uuid[]) from public;
revoke all on function public.admin_submitter_profiles(uuid[]) from anon;
grant execute on function public.admin_submitter_profiles(uuid[]) to authenticated;
