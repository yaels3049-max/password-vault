-- Phase 123.5 (O-123-9 / AD-123-16): a regular user can read their own user-submitted registry rows
-- (any status, including pending_review), so the custom-site upsert and the removal delete pass RLS.

drop policy if exists "service_registry_select_own_user_rows" on public.service_registry;
create policy "service_registry_select_own_user_rows" on public.service_registry for select to authenticated using (owner_user_id = auth.uid() and source_type = 'user');
