-- Phase 110: curated Hapoalim consumer login entry for generic autofill.
-- Opens login.bankhapoalim.co.il auth portal (actual landing path /auth/he/).

update public.service_registry
set
  login_url = 'https://login.bankhapoalim.co.il/ng-portals/auth/he/',
  login_url_status = 'valid',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'loginUrlSource', 'catalog_seed',
    'loginUrlDiscoveryOutcome', 'succeeded',
    'loginUrlDiscoveryAttempted', true
  )
where id = 'hapoalim'
  and (
    login_url is null
    or login_url = ''
    or login_url like '%bankhapoalim%'
  );
