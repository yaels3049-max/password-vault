-- Phase 111: Service assets (managed icons) + Storage bucket + RLS
-- Binaries live in Storage; service_assets holds metadata references only.

create table if not exists public.service_assets (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.service_registry (id) on delete cascade,
  asset_type text not null default 'app_icon'
    check (asset_type in ('favicon', 'apple_touch_icon', 'app_icon')),
  version integer not null default 1,
  status text not null default 'discovered'
    check (status in (
      'discovering',
      'discovered',
      'approved',
      'active',
      'stale',
      'failed',
      'archived'
    )),
  asset_source text not null default 'auto'
    check (asset_source in ('admin', 'auto', 'discovered', 'user')),
  storage_path text not null,
  public_url text,
  content_type text,
  byte_size integer,
  width integer,
  height integer,
  checksum text not null,
  owner_user_id uuid references auth.users (id) on delete cascade,
  is_global boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, asset_type, version, checksum)
);

create index if not exists service_assets_service_id_idx
  on public.service_assets (service_id);

create index if not exists service_assets_active_idx
  on public.service_assets (service_id, asset_type, status)
  where status = 'active';

create index if not exists service_assets_checksum_idx
  on public.service_assets (checksum);

comment on table public.service_assets is
  'Phase 111 managed visual assets. Image bytes in Storage; this table stores references/metadata only.';

alter table public.service_assets enable row level security;

-- Authenticated: read global assets + own private assets
drop policy if exists "service_assets_select_visible" on public.service_assets;
create policy "service_assets_select_visible"
on public.service_assets
for select
to authenticated
using (
  is_global = true
  or owner_user_id = auth.uid()
  or public.is_admin()
);

-- Users may insert/update/delete their own private assets
drop policy if exists "service_assets_user_insert_private" on public.service_assets;
create policy "service_assets_user_insert_private"
on public.service_assets
for insert
to authenticated
with check (
  is_global = false
  and owner_user_id = auth.uid()
);

drop policy if exists "service_assets_user_update_private" on public.service_assets;
create policy "service_assets_user_update_private"
on public.service_assets
for update
to authenticated
using (is_global = false and owner_user_id = auth.uid())
with check (is_global = false and owner_user_id = auth.uid());

drop policy if exists "service_assets_user_delete_private" on public.service_assets;
create policy "service_assets_user_delete_private"
on public.service_assets
for delete
to authenticated
using (is_global = false and owner_user_id = auth.uid());

-- Admin full write (globals + oversight)
drop policy if exists "service_assets_admin_all" on public.service_assets;
create policy "service_assets_admin_all"
on public.service_assets
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Storage bucket: public-read for global icon URLs (no third-party CDN on paint)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-assets',
  'service-assets',
  true,
  2097152,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS
drop policy if exists "service_assets_storage_select" on storage.objects;
create policy "service_assets_storage_select"
on storage.objects
for select
to authenticated, anon
using (bucket_id = 'service-assets');

drop policy if exists "service_assets_storage_admin_insert" on storage.objects;
create policy "service_assets_storage_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'service-assets'
  and public.is_admin()
);

drop policy if exists "service_assets_storage_admin_update" on storage.objects;
create policy "service_assets_storage_admin_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'service-assets' and public.is_admin())
with check (bucket_id = 'service-assets' and public.is_admin());

drop policy if exists "service_assets_storage_admin_delete" on storage.objects;
create policy "service_assets_storage_admin_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'service-assets' and public.is_admin());

-- Users may write private prefix user/<uid>/...
drop policy if exists "service_assets_storage_user_insert" on storage.objects;
create policy "service_assets_storage_user_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'service-assets'
  and (storage.foldername(name))[1] = 'user'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "service_assets_storage_user_update" on storage.objects;
create policy "service_assets_storage_user_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'service-assets'
  and (storage.foldername(name))[1] = 'user'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'service-assets'
  and (storage.foldername(name))[1] = 'user'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "service_assets_storage_user_delete" on storage.objects;
create policy "service_assets_storage_user_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'service-assets'
  and (storage.foldername(name))[1] = 'user'
  and (storage.foldername(name))[2] = auth.uid()::text
);
