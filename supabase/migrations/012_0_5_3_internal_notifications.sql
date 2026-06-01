-- Forja Narrativa Online 0.5.3 — Notificações internas e leitura do chat
-- Cria controle de leitura por pedido para permitir bolinhas e contadores de mensagens pendentes.

create table if not exists public.order_chat_reads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reader_role text not null check (reader_role in ('cliente', 'admin')),
  last_read_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (order_id, user_id, reader_role)
);

create index if not exists order_chat_reads_order_id_idx
on public.order_chat_reads(order_id);

create index if not exists order_chat_reads_user_role_idx
on public.order_chat_reads(user_id, reader_role);

alter table public.order_chat_reads enable row level security;

drop policy if exists "chat_reads_select_own_or_admin" on public.order_chat_reads;
drop policy if exists "chat_reads_insert_own_or_admin" on public.order_chat_reads;
drop policy if exists "chat_reads_update_own_or_admin" on public.order_chat_reads;
drop policy if exists "chat_reads_delete_admin" on public.order_chat_reads;

-- Cliente vê leituras dos próprios pedidos. Admin vê todas.
create policy "chat_reads_select_own_or_admin"
on public.order_chat_reads
for select
to authenticated
using (
  public.is_forja_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_chat_reads.order_id
        and o.user_id = auth.uid()
    )
  )
);

-- Cliente só cria marcação de leitura como cliente para pedido próprio.
-- Admin cria marcação como admin para qualquer pedido.
create policy "chat_reads_insert_own_or_admin"
on public.order_chat_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    (
      reader_role = 'cliente'
      and exists (
        select 1 from public.orders o
        where o.id = order_chat_reads.order_id
          and o.user_id = auth.uid()
      )
    )
    or (
      reader_role = 'admin'
      and public.is_forja_admin()
    )
  )
);

create policy "chat_reads_update_own_or_admin"
on public.order_chat_reads
for update
to authenticated
using (
  user_id = auth.uid()
  and (
    (
      reader_role = 'cliente'
      and exists (
        select 1 from public.orders o
        where o.id = order_chat_reads.order_id
          and o.user_id = auth.uid()
      )
    )
    or (
      reader_role = 'admin'
      and public.is_forja_admin()
    )
  )
)
with check (
  user_id = auth.uid()
  and (
    (
      reader_role = 'cliente'
      and exists (
        select 1 from public.orders o
        where o.id = order_chat_reads.order_id
          and o.user_id = auth.uid()
      )
    )
    or (
      reader_role = 'admin'
      and public.is_forja_admin()
    )
  )
);

create policy "chat_reads_delete_admin"
on public.order_chat_reads
for delete
to authenticated
using (public.is_forja_admin());

grant select, insert, update, delete on public.order_chat_reads to authenticated;

-- Trigger leve para manter updated_at da leitura.
create or replace function public.set_order_chat_reads_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_order_chat_reads_updated_at on public.order_chat_reads;
create trigger set_order_chat_reads_updated_at
before update on public.order_chat_reads
for each row
execute function public.set_order_chat_reads_updated_at();

-- Realtime opcional para futuras melhorias.
do $$
begin
  begin
    alter publication supabase_realtime add table public.order_chat_reads;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
