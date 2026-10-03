-- Phase 122.8 R4: Admin «הערות» — one internal note per registry service, admins only.
-- Separate table (never in service_registry.metadata, never sent to users). Deleting the
-- service deletes its note (FK cascade). No change to other tables or policies.

create table if not exists public.admin_service_notes (
  service_id text primary key references public.service_registry(id) on delete cascade,
  body text not null check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.admin_service_notes enable row level security;

drop policy if exists admin_service_notes_select_admin on public.admin_service_notes;
create policy admin_service_notes_select_admin
  on public.admin_service_notes
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists admin_service_notes_insert_admin on public.admin_service_notes;
create policy admin_service_notes_insert_admin
  on public.admin_service_notes
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists admin_service_notes_update_admin on public.admin_service_notes;
create policy admin_service_notes_update_admin
  on public.admin_service_notes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_service_notes_delete_admin on public.admin_service_notes;
create policy admin_service_notes_delete_admin
  on public.admin_service_notes
  for delete
  to authenticated
  using (public.is_admin());

revoke all on table public.admin_service_notes from anon;
revoke all on table public.admin_service_notes from public;
grant select, insert, update, delete on table public.admin_service_notes to authenticated;
