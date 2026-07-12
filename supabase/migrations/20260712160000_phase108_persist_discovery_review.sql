-- Phase 108: persist discovery review outcomes for global catalog rows
-- (clear false-positive login_url; set needs_review / modal metadata).
-- Direct UPDATE is blocked by RLS for anon/authenticated on global rows;
-- success path already uses RPCs — failure/review must too.

create or replace function public.persist_login_discovery_review(
  p_service_id text,
  p_login_url_status text,
  p_metadata jsonb,
  p_clear_login_url boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_source text;
begin
  if p_service_id is null or length(trim(p_service_id)) = 0 then
    raise exception 'service_id is required';
  end if;

  if p_login_url_status not in (
    'unknown', 'valid', 'invalid', 'missing', 'stale', 'failed', 'needs_review'
  ) then
    raise exception 'invalid login_url_status: %', p_login_url_status;
  end if;

  -- Never clear administrator-verified login URLs.
  select coalesce(metadata->>'loginUrlSource', '')
    into v_source
  from public.service_registry
  where id = p_service_id;

  update public.service_registry
  set
    login_url = case
      when p_clear_login_url and v_source is distinct from 'admin' then null
      else login_url
    end,
    login_url_status = case
      when p_clear_login_url and v_source is distinct from 'admin' then p_login_url_status
      when v_source = 'admin' then login_url_status
      else p_login_url_status
    end,
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
    updated_at = v_now
  where id = p_service_id
    and (
      owner_user_id = auth.uid()
      or (
        owner_user_id is null
        and source_type in ('built_in', 'admin', 'approved_global', 'user')
      )
    );

  if not found then
    raise exception 'persist_login_discovery_review not allowed for service %', p_service_id;
  end if;
end;
$$;

revoke all on function public.persist_login_discovery_review(text, text, jsonb, boolean) from public;
grant execute on function public.persist_login_discovery_review(text, text, jsonb, boolean) to authenticated;
grant execute on function public.persist_login_discovery_review(text, text, jsonb, boolean) to anon;
