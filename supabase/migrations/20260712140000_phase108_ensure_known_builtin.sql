-- Phase 108 regression: allow authenticated clients to restore missing known built-in
-- registry rows from the Hub seed (builtinCatalog.ts) after an empty DB wipe.

create or replace function public.ensure_known_builtin_registry_row(
  p_id text,
  p_display_name text,
  p_primary_url text,
  p_login_url text default null,
  p_category_id text default null,
  p_icon text default null,
  p_adapter_id text default null,
  p_login_fields jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_login_url_status text default 'unknown'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_id is null or length(trim(p_id)) = 0 then
    raise exception 'service_id is required';
  end if;

  -- Allowlist: matches src/catalog/builtinCatalog.ts production ids (excludes practice).
  if p_id not in (
    'hapoalim', 'leumi', 'discount', 'mizrahi',
    'clalit', 'maccabi', 'meuhedet', 'leumit',
    'shufersal', 'rami-levy', 'amazon-il', 'ksp', 'htzone'
  ) then
    raise exception 'ensure_known_builtin_registry_row not allowed for service %', p_id;
  end if;

  if p_login_url_status not in (
    'unknown', 'valid', 'invalid', 'missing', 'stale', 'failed', 'needs_review'
  ) then
    raise exception 'invalid login_url_status: %', p_login_url_status;
  end if;

  if p_login_fields is not null then
    if jsonb_typeof(p_login_fields) <> 'array' then
      raise exception 'login_fields must be a JSON array';
    end if;
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
    login_url_status,
    owner_user_id,
    updated_at
  )
  values (
    p_id,
    p_display_name,
    p_primary_url,
    nullif(trim(coalesce(p_login_url, '')), ''),
    p_category_id,
    p_icon,
    nullif(trim(coalesce(p_adapter_id, '')), ''),
    p_login_fields,
    'built_in',
    'active',
    coalesce(p_metadata, '{}'::jsonb),
    p_login_url_status,
    null,
    now()
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    primary_url = excluded.primary_url,
    -- Restore integration schema when missing; never wipe an existing approved schema.
    login_url = coalesce(public.service_registry.login_url, excluded.login_url),
    category_id = coalesce(public.service_registry.category_id, excluded.category_id),
    icon = coalesce(public.service_registry.icon, excluded.icon),
    adapter_id = excluded.adapter_id,
    login_fields = coalesce(public.service_registry.login_fields, excluded.login_fields),
    source_type = 'built_in',
    service_status = 'active',
    owner_user_id = null,
    metadata = coalesce(public.service_registry.metadata, '{}'::jsonb)
      || coalesce(excluded.metadata, '{}'::jsonb),
    login_url_status = case
      when public.service_registry.login_url is not null
        and public.service_registry.login_url_status = 'valid'
      then public.service_registry.login_url_status
      when excluded.login_url is not null then excluded.login_url_status
      else public.service_registry.login_url_status
    end,
    updated_at = now()
  where public.service_registry.owner_user_id is null
     or public.service_registry.source_type = 'user';
end;
$$;

revoke all on function public.ensure_known_builtin_registry_row(
  text, text, text, text, text, text, text, jsonb, jsonb, text
) from public;
grant execute on function public.ensure_known_builtin_registry_row(
  text, text, text, text, text, text, text, jsonb, jsonb, text
) to authenticated;
