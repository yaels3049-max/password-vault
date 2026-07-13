-- Phase 109 DEV RESET: wipe ALL auth users (+ cascaded public.users / owned rows).
-- USE ONLY on development / personal Supabase projects — irreversible.
--
-- Why previous cleanup left rows:
--   phase109_cleanup_empty_orphans.sql only PREVIEWED; DELETE was commented out.
--
-- Before running:
--   1. Supabase → Authentication → Providers → Anonymous → DISABLE
--   2. Confirm this is NOT production with real customer data
--
-- After running: Create Account once → expect ONE email row in auth.users + ONE in public.users.

begin;

-- How many will be removed
select count(*) as auth_users_about_to_delete from auth.users;

-- Wipe Auth identities (FK ON DELETE CASCADE clears public.users and owned child rows)
delete from auth.users;

-- Safety: clear any leftover application profiles
delete from public.users;

select
  (select count(*) from auth.users) as auth_users_remaining,
  (select count(*) from public.users) as public_users_remaining;

commit;
