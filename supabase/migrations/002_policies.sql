-- Forja Narrativa Online — RLS e policies oficiais
-- Ajuste somente se o fluxo do site mudar.

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_messages enable row level security;
alter table public.order_deliveries enable row level security;

create or replace function public.is_forja_admin()
returns boolean as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'forjanarrativa5790@gmail.com'
    or exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    );
$$ language sql security definer stable;

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (auth.uid() = user_id or public.is_forja_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles for update
using (auth.uid() = user_id or public.is_forja_admin())
with check (auth.uid() = user_id or public.is_forja_admin());

-- Admin users: admins can read admin list. Insert admin manually in SQL Editor.
drop policy if exists "admin_users_select_admin" on public.admin_users;
create policy "admin_users_select_admin"
on public.admin_users for select
using (public.is_forja_admin());

-- Orders
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
on public.orders for insert
with check (auth.uid() = user_id);

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
on public.orders for select
using (auth.uid() = user_id or public.is_forja_admin());

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
on public.orders for update
using (public.is_forja_admin())
with check (public.is_forja_admin());

-- Messages
drop policy if exists "messages_select_order_owner_or_admin" on public.order_messages;
create policy "messages_select_order_owner_or_admin"
on public.order_messages for select
using (
  public.is_forja_admin()
  or exists (
    select 1 from public.orders
    where orders.id = order_messages.order_id
    and orders.user_id = auth.uid()
  )
);

drop policy if exists "messages_insert_order_owner_or_admin" on public.order_messages;
create policy "messages_insert_order_owner_or_admin"
on public.order_messages for insert
with check (
  public.is_forja_admin()
  or exists (
    select 1 from public.orders
    where orders.id = order_messages.order_id
    and orders.user_id = auth.uid()
  )
);

-- Deliveries
drop policy if exists "deliveries_select_order_owner_or_admin" on public.order_deliveries;
create policy "deliveries_select_order_owner_or_admin"
on public.order_deliveries for select
using (
  public.is_forja_admin()
  or exists (
    select 1 from public.orders
    where orders.id = order_deliveries.order_id
    and orders.user_id = auth.uid()
  )
);

drop policy if exists "deliveries_insert_admin" on public.order_deliveries;
create policy "deliveries_insert_admin"
on public.order_deliveries for insert
with check (public.is_forja_admin());

drop policy if exists "deliveries_update_admin" on public.order_deliveries;
create policy "deliveries_update_admin"
on public.order_deliveries for update
using (public.is_forja_admin())
with check (public.is_forja_admin());
