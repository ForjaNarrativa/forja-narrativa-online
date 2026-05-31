-- Forja Narrativa Online 0.4.0 — Segurança e Fluxo Final
-- Rode no SQL Editor depois das migrations anteriores.

-- Entrega final diretamente no pedido, para o admin preencher e o cliente ver em Meus Pedidos.
alter table public.orders add column if not exists delivery_note text;
alter table public.orders add column if not exists delivery_url text;

-- Função de admin mais segura e compatível com tabelas admin_users antigas.
create or replace function public.is_forja_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  current_uid uuid := auth.uid();
  has_user_id boolean := false;
  has_email boolean := false;
  found_admin boolean := false;
begin
  if current_email = 'forjanarrativa5790@gmail.com' then
    return true;
  end if;

  if to_regclass('public.admin_users') is null then
    return false;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'admin_users'
    and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'admin_users'
    and column_name = 'email'
  ) into has_email;

  if has_user_id and current_uid is not null then
    execute 'select exists (select 1 from public.admin_users where user_id = $1)'
    into found_admin
    using current_uid;

    if found_admin then
      return true;
    end if;
  end if;

  if has_email and current_email <> '' then
    execute 'select exists (select 1 from public.admin_users where lower(email) = lower($1))'
    into found_admin
    using current_email;

    if found_admin then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- Chat futuro: cliente não pode se passar por admin.
alter table public.order_messages enable row level security;

drop policy if exists "messages_insert_order_owner_or_admin" on public.order_messages;
drop policy if exists "messages_insert_client_owner" on public.order_messages;
drop policy if exists "messages_insert_admin" on public.order_messages;

create policy "messages_insert_client_owner"
on public.order_messages
for insert
with check (
  sender_role = 'cliente'
  and user_id = auth.uid()
  and exists (
    select 1
    from public.orders
    where orders.id = order_messages.order_id
    and orders.user_id = auth.uid()
  )
);

create policy "messages_insert_admin"
on public.order_messages
for insert
with check (
  sender_role = 'admin'
  and public.is_forja_admin()
);

-- Entregas futuras continuam restritas ao admin.
alter table public.order_deliveries enable row level security;

drop policy if exists "deliveries_insert_admin" on public.order_deliveries;
create policy "deliveries_insert_admin"
on public.order_deliveries for insert
with check (public.is_forja_admin());

drop policy if exists "deliveries_update_admin" on public.order_deliveries;
create policy "deliveries_update_admin"
on public.order_deliveries for update
using (public.is_forja_admin())
with check (public.is_forja_admin());
