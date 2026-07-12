-- Phase 108: expand login_url_status vocabulary + admin metadata on manual edit

alter table public.service_registry
  drop constraint if exists service_registry_login_url_status_check;

-- Map Phase 102 transitional invalid → stale before tightening constraint
update public.service_registry
set login_url_status = 'stale'
where login_url_status = 'invalid';

alter table public.service_registry
  add constraint service_registry_login_url_status_check
  check (
    login_url_status in (
      'unknown',
      'valid',
      'invalid',
      'missing',
      'stale',
      'failed',
      'needs_review'
    )
  );

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

  if p_login_url_status not in (
    'unknown', 'valid', 'invalid', 'missing', 'stale', 'failed', 'needs_review'
  ) then
    raise exception 'invalid login_url_status: %', p_login_url_status;
  end if;

  update public.service_registry
  set
    login_url = p_login_url,
    login_fields = coalesce(p_login_fields, login_fields),
    login_url_status = p_login_url_status,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'loginUrlSource', 'admin',
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
