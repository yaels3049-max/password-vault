-- Phase 102: validate login_fields on persist + reset helper for verify-script artifacts

create or replace function public.persist_discovered_login_url(
  p_service_id text,
  p_login_url text,
  p_login_fields jsonb default null
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

  if p_service_id is null or length(trim(p_service_id)) = 0 then
    raise exception 'service_id is required';
  end if;

  if p_login_url is null or length(trim(p_login_url)) = 0 then
    raise exception 'login_url is required';
  end if;

  if p_login_fields is not null then
    if jsonb_typeof(p_login_fields) <> 'array' then
      raise exception 'login_fields must be a JSON array';
    end if;

    if jsonb_array_length(p_login_fields) > 0
      and not exists (
        select 1
        from jsonb_array_elements(p_login_fields) elem
        where elem->>'type' = 'password'
      ) then
      raise exception 'login_fields must include at least one password-type field';
    end if;
  end if;

  update public.service_registry
  set
    login_url = p_login_url,
    login_fields = coalesce(p_login_fields, login_fields),
    login_url_status = 'valid',
    updated_at = now()
  where id = p_service_id
    and owner_user_id is null
    and source_type = 'built_in'
    and service_status = 'active'
    and (login_url is null or login_url_status = 'invalid');

  if not found then
    raise exception 'persist_discovered_login_url not allowed for service %', p_service_id;
  end if;
end;
$$;

create or replace function public.reset_built_in_verify_discovery(p_service_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.service_registry
  set
    login_url = null,
    login_fields = null,
    login_url_status = 'unknown',
    updated_at = now()
  where id = p_service_id
    and owner_user_id is null
    and source_type = 'built_in'
    and service_status = 'active'
    and (
      login_url like '%example-phase102.test%'
      or (
        login_fields is not null
        and jsonb_typeof(login_fields) = 'array'
        and jsonb_array_length(login_fields) > 0
        and not exists (
          select 1
          from jsonb_array_elements(login_fields) elem
          where elem->>'type' = 'password'
        )
      )
    );

  if not found then
    raise exception 'reset_built_in_verify_discovery not allowed for service %', p_service_id;
  end if;
end;
$$;

revoke all on function public.reset_built_in_verify_discovery(text) from public;
grant execute on function public.reset_built_in_verify_discovery(text) to authenticated;
