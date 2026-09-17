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

alter table public.clinic_state enable row level security;
alter table public.clinic_users enable row level security;
