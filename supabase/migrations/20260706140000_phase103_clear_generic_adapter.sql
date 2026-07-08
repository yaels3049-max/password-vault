-- Phase 103: clear interim generic adapter; autofill driven by login_fields + login_url
update public.service_registry
set
  adapter_id = null,
  updated_at = now()
where id in ('shufersal', 'clalit')
  and adapter_id = 'generic'
  and owner_user_id is null
  and source_type = 'built_in';
