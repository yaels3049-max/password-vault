-- Phase 101 (schema): zero-knowledge Supabase storage (ciphertext + metadata only)

-- Note: Supabase projects typically include pgcrypto by default; we avoid relying on it explicitly.

create table if not exists public.categories (
  id text primary key,
  display_name text not null,
  sort_order integer not null default 0
);

create table if not exists public.subscription_plans (
  id text primary key,
  display_name text not null,
  capability_flags jsonb not null default '{}'::jsonb
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_registry (
  id text primary key,
  display_name text not null,
  primary_url text not null,
  login_url text null,
  category_id text null references public.categories(id),
  icon text null,
  adapter_id text null,
  login_fields jsonb null,
  source_type text not null default 'built_in',
  service_status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  metadata_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  service_id text not null,
  sort_order integer null,
  created_at timestamptz not null default now(),
  unique (user_id, service_id)
);

create index if not exists user_services_user_id_idx on public.user_services(user_id);

create table if not exists public.access_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_service_id uuid not null references public.user_services(id) on delete cascade,
  -- Stable mapping for dual-write (vault profile ids are client-generated "profile-...").
  local_profile_id text not null,
  display_name text not null,
  is_default boolean not null default false,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_profile_id)
);

create index if not exists access_profiles_user_id_idx on public.access_profiles(user_id);
create index if not exists access_profiles_user_service_id_idx on public.access_profiles(user_service_id);

create table if not exists public.encrypted_credentials (
  id uuid primary key default gen_random_uuid(),
  access_profile_id uuid not null references public.access_profiles(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  algorithm text not null default 'aes-256-gcm',
  -- Field ids only (never values) to support future UX diagnostics without leaking secrets.
  field_ids_present text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  unique (access_profile_id)
);

create index if not exists encrypted_credentials_access_profile_id_idx
  on public.encrypted_credentials(access_profile_id);

-- Seed: production categories used in the Phase 100 UI
insert into public.categories (id, display_name, sort_order)
values
  ('banking', 'בנקים', 10),
  ('health', 'בריאות', 20),
  ('shopping', 'קניות', 30)
on conflict (id) do update
set display_name = excluded.display_name,
    sort_order = excluded.sort_order;

-- Seed: minimal free plan
insert into public.subscription_plans (id, display_name, capability_flags)
values
  ('free', 'חינם', '{}'::jsonb)
on conflict (id) do update
set display_name = excluded.display_name,
    capability_flags = excluded.capability_flags;

