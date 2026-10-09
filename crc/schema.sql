create table if not exists public.clinic_state (
  state_key text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now()
);

alter table public.clinic_users
  add column if not exists role text not null default 'pending';

alter table public.clinic_users
  add column if not exists auth_version text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinic_users_role_check'
      and conrelid = 'public.clinic_users'::regclass
  ) then
    alter table public.clinic_users
      add constraint clinic_users_role_check check (role in ('admin', 'doctor', 'pending'));
  end if;
end
$$;

alter table public.clinic_users drop constraint if exists clinic_users_role_check;
alter table public.clinic_users
  add constraint clinic_users_role_check check (role in ('admin', 'doctor', 'pending'));

alter table public.clinic_state enable row level security;
alter table public.clinic_users enable row level security;

-- After verifying an account, grant the initial administrator role with:
-- update public.clinic_users set role = 'admin' where email = 'verified-admin@example.com';
