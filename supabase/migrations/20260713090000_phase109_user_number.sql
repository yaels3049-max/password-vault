-- Phase 109 follow-up: human-friendly user_number (starts at 100).
-- Ownership / RLS identity remains users.id = auth.users.id (UUID).
-- user_number is a display / operator identity only — never used as ownership key.

create sequence if not exists public.users_user_number_seq
  as bigint
  start with 100
  increment by 1
  minvalue 100
  no maxvalue
  cache 1;

alter table public.users
  add column if not exists user_number bigint;

-- Backfill any existing rows without a number
update public.users
set user_number = nextval('public.users_user_number_seq')
where user_number is null;

alter table public.users
  alter column user_number set default nextval('public.users_user_number_seq');

alter table public.users
  alter column user_number set not null;

alter sequence public.users_user_number_seq owned by public.users.user_number;

create unique index if not exists users_user_number_uidx
  on public.users (user_number);

comment on column public.users.user_number is
  'Phase 109: human-friendly identity starting at 100. RLS ownership uses id (UUID)=auth.uid().';
