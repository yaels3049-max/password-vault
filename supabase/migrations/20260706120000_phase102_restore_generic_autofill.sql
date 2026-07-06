-- Phase 102 regression fix: restore validated generic autofill for Shufersal and Clalit
-- via adapter registry (adapter_id = 'generic'), not service-id branching in Hub code.

update public.service_registry
set
  adapter_id = 'generic',
  updated_at = now()
where id in ('shufersal', 'clalit')
  and owner_user_id is null
  and source_type = 'built_in';
