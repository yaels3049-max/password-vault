-- Phase 102 (RLS delta): registry visibility + user-owned CRUD

drop policy if exists "service_registry_select_authenticated" on public.service_registry;

drop policy if exists "service_registry_select_visible" on public.service_registry;
create policy "service_registry_select_visible"
on public.service_registry
for select
to authenticated
using (
  service_status = 'active'
  and (owner_user_id is null or owner_user_id = auth.uid())
);

drop policy if exists "service_registry_insert_own" on public.service_registry;
create policy "service_registry_insert_own"
on public.service_registry
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and source_type = 'user'
);

drop policy if exists "service_registry_update_own" on public.service_registry;
create policy "service_registry_update_own"
on public.service_registry
for update
to authenticated
using (
  owner_user_id = auth.uid()
  and source_type = 'user'
)
with check (
  owner_user_id = auth.uid()
  and source_type = 'user'
);

drop policy if exists "service_registry_delete_own" on public.service_registry;
create policy "service_registry_delete_own"
on public.service_registry
for delete
to authenticated
using (
  owner_user_id = auth.uid()
  and source_type = 'user'
);

-- Global built-in rows remain non-writable by client except via SECURITY DEFINER RPC.
