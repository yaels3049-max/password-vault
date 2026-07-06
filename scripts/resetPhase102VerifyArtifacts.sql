-- One-time fix: reset built-in rows corrupted by early verifyPhase102Registry.mjs runs.
-- Run in Supabase Dashboard → SQL Editor (postgres role; bypasses RLS).

update public.service_registry
set
  login_url = null,
  login_fields = null,
  login_url_status = 'unknown',
  updated_at = now()
where owner_user_id is null
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
