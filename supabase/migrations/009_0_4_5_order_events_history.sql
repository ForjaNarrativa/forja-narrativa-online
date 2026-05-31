-- Forja Narrativa Online 0.4.5 — Histórico do Pedido
-- Cria uma linha do tempo simples para pedidos, visível para cliente dono e admins.

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role text not null default 'sistema' check (actor_role in ('admin', 'cliente', 'sistema')),
  event_type text not null default 'note' check (event_type in ('created', 'status_changed', 'delivery_saved', 'delivery_sent', 'note')),
  old_status text,
  new_status text,
  old_payment_status text,
  new_payment_status text,
  note text,
  created_at timestamptz default now()
);

create index if not exists order_events_order_id_created_at_idx
on public.order_events(order_id, created_at desc);

alter table public.order_events enable row level security;

-- Limpa versões antigas das policies desta migration, se existirem.
drop policy if exists "order_events_select_own_or_admin" on public.order_events;
drop policy if exists "order_events_insert_client_own" on public.order_events;
drop policy if exists "order_events_insert_admin" on public.order_events;
drop policy if exists "order_events_update_none" on public.order_events;
drop policy if exists "order_events_delete_admin" on public.order_events;

-- Cliente vê eventos dos próprios pedidos. Admin vê todos.
create policy "order_events_select_own_or_admin"
on public.order_events
for select
to authenticated
using (
  public.is_forja_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_events.order_id
      and o.user_id = auth.uid()
  )
);

-- Cliente só pode registrar o evento inicial do próprio pedido, como cliente.
create policy "order_events_insert_client_own"
on public.order_events
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and actor_role = 'cliente'
  and event_type = 'created'
  and exists (
    select 1
    from public.orders o
    where o.id = order_events.order_id
      and o.user_id = auth.uid()
  )
);

-- Admin pode registrar eventos administrativos.
create policy "order_events_insert_admin"
on public.order_events
for insert
to authenticated
with check (
  public.is_forja_admin()
  and actor_role = 'admin'
);

-- Histórico não deve ser editado; se errar, registra outro evento.
create policy "order_events_update_none"
on public.order_events
for update
to authenticated
using (false)
with check (false);

-- Admin pode limpar histórico junto com testes, se necessário.
create policy "order_events_delete_admin"
on public.order_events
for delete
to authenticated
using (public.is_forja_admin());
