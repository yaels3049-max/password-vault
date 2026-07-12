-- Phase 108 follow-up: admin manual login URL edit clears stale discovery outcome

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
declare
  v_now timestamptz := now();
  v_clear_discovery boolean := (p_login_url_status = 'valid');
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
    metadata = (
      coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'loginUrlSource', 'admin',
        'lastAdminEdit', v_now,
        'lastAdminUserId', auth.uid()
      )
      || case
        when v_clear_discovery then
          jsonb_build_object(
            'loginUrlDiscoveryError', null,
            'loginUrlDiscoveryOutcome', 'succeeded',
            'loginUrlDiscoveryAttempted', true,
            'loginUrlLastCheckedAt', v_now,
            'loginUrlLastDiscoveredAt', v_now,
            'lastDiscoveryOutcome', jsonb_build_object(
              'at', v_now,
              'success', true,
              'outcome', 'succeeded',
              'method', 'admin_manual',
              'confidence', null,
              'source', 'admin',
              'loginUrl', p_login_url,
              'confidence', null
            )
          )
        else '{}'::jsonb
      end
    ),
    updated_at = v_now
  where id = p_service_id
    and owner_user_id is null
    and source_type in ('built_in', 'admin', 'approved_global')
    and service_status in ('active', 'deprecated', 'disabled');

  if not found then
    raise exception 'admin_update_login_url not allowed for service %', p_service_id;
  end if;
end;
$$;
