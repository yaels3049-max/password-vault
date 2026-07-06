-- Phase 102 (schema delta): user-owned registry rows + login URL cache status

alter table public.service_registry
  add column if not exists owner_user_id uuid null references public.users(id) on delete cascade;

alter table public.service_registry
  add column if not exists login_url_status text not null default 'unknown';

alter table public.service_registry
  drop constraint if exists service_registry_login_url_status_check;

alter table public.service_registry
  add constraint service_registry_login_url_status_check
  check (login_url_status in ('unknown', 'valid', 'invalid'));

create index if not exists service_registry_owner_user_id_idx
  on public.service_registry (owner_user_id)
  where owner_user_id is not null;
