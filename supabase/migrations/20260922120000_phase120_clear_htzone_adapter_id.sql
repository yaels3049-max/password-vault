-- Phase 120.3.6 Package B — clear dedicated site-adapter routing for htzone seed.
-- Catalog row retained; adapter_id cleared so tile falls through normal non-adapter tree.
-- Does not author Managed config. Does not delete the service.

update public.service_registry
set
  adapter_id = null,
  updated_at = now()
where id = 'htzone'
  and adapter_id is not null;
