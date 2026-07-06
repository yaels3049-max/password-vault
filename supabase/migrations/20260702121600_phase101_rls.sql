-- Phase 101 (RLS): isolate user-owned rows by auth.uid()

-- Enable RLS on user-owned tables
alter table public.users enable row level security;
alter table public.user_services enable row level security;
alter table public.access_profiles enable row level security;
alter table public.encrypted_credentials enable row level security;

-- Enable RLS on global tables (select-only for authenticated)
alter table public.categories enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.service_registry enable row level security;

-- USERS: user can see and update their own row
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- USER_SERVICES: CRUD only for own rows
drop policy if exists "user_services_crud_own" on public.user_services;
create policy "user_services_crud_own"
on public.user_services
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ACCESS_PROFILES: CRUD only for own rows
drop policy if exists "access_profiles_crud_own" on public.access_profiles;
create policy "access_profiles_crud_own"
on public.access_profiles
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ENCRYPTED_CREDENTIALS: CRUD only if the referenced access_profile belongs to auth.uid()
drop policy if exists "encrypted_credentials_crud_via_profile" on public.encrypted_credentials;
create policy "encrypted_credentials_crud_via_profile"
on public.encrypted_credentials
for all
to authenticated
using (
  exists (
    select 1
    from public.access_profiles ap
    where ap.id = encrypted_credentials.access_profile_id
      and ap.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.access_profiles ap
    where ap.id = encrypted_credentials.access_profile_id
      and ap.user_id = auth.uid()
  )
);

-- GLOBAL TABLES: select-only for authenticated
drop policy if exists "categories_select_authenticated" on public.categories;
create policy "categories_select_authenticated"
on public.categories
for select
to authenticated
using (true);

drop policy if exists "subscription_plans_select_authenticated" on public.subscription_plans;
create policy "subscription_plans_select_authenticated"
on public.subscription_plans
for select
to authenticated
using (true);

drop policy if exists "service_registry_select_authenticated" on public.service_registry;
create policy "service_registry_select_authenticated"
on public.service_registry
for select
to authenticated
using (true);

-- Intentionally no INSERT/UPDATE/DELETE policies for global tables in Phase 101:
-- client writes are denied by default under RLS.

