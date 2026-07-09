-- Phase 107 fix: promote_user_submission must UPDATE in-place when global id = user id
-- (PK collision — cannot INSERT a second row with the same service_registry.id)

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

  -- Default path: same id — convert the user row to a global built_in catalog entry.
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

  -- Optional alternate global id: insert new built_in row; user private row remains.
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
