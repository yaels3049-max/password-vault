-- Phase 102 (RPC): cache discovered login URL on global built-in registry rows

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

revoke all on function public.persist_discovered_login_url(text, text, jsonb) from public;
grant execute on function public.persist_discovered_login_url(text, text, jsonb) to authenticated;
