-- Forja Narrativa Online 0.4.3 — Conta do Cliente e Profiles
-- Rode no SQL Editor depois da migration 007.
-- Esta migration reforça o uso da tabela profiles para preencher pedidos e centralizar o nome do cliente.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists nome text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id or public.is_forja_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id or public.is_forja_admin())
with check (auth.uid() = user_id or public.is_forja_admin());
