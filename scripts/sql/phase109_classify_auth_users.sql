-- Phase 109: Classify auth.users — anonymous orphans vs email accounts
-- Run read-only in SQL editor to understand the flood.

select
  count(*) as total_auth_users,
  count(*) filter (
    where email is null
       or coalesce((raw_app_meta_data->>'provider'), '') = 'anonymous'
       or is_anonymous is true
  ) as anonymous_like,
  count(*) filter (
    where email is not null
      and coalesce((raw_app_meta_data->>'provider'), '') is distinct from 'anonymous'
      and coalesce(is_anonymous, false) is not true
  ) as email_accounts
from auth.users;

-- Sample of newest rows (see email vs empty)
select
  id,
  email,
  is_anonymous,
  raw_app_meta_data->>'provider' as provider,
  created_at,
  last_sign_in_at
from auth.users
order by created_at desc
limit 30;
