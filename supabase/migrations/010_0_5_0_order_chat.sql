-- Forja Narrativa Online 0.5.0 — Chat por Pedido
-- Ativa a conversa real entre cliente e Sala do Criador usando order_messages.

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('cliente', 'admin')),
  message text not null,
  created_at timestamptz default now()
);

create index if not exists order_messages_order_id_created_at_idx
on public.order_messages(order_id, created_at asc);

create index if not exists order_messages_user_id_idx
on public.order_messages(user_id);

alter table public.order_messages enable row level security;

drop policy if exists "messages_select_order_owner_or_admin" on public.order_messages;
drop policy if exists "messages_insert_order_owner_or_admin" on public.order_messages;
drop policy if exists "messages_insert_client_owner" on public.order_messages;
drop policy if exists "messages_insert_admin" on public.order_messages;
drop policy if exists "messages_update_none" on public.order_messages;
drop policy if exists "messages_delete_admin" on public.order_messages;

-- Cliente vê mensagens dos próprios pedidos. Admin vê todas.
create policy "messages_select_order_owner_or_admin"
on public.order_messages
for select
to authenticated
using (
  public.is_forja_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_messages.order_id
      and o.user_id = auth.uid()
  )
);

-- Cliente só pode mandar mensagem como cliente e apenas nos próprios pedidos.
create policy "messages_insert_client_owner"
on public.order_messages
for insert
to authenticated
with check (
  sender_role = 'cliente'
  and user_id = auth.uid()
  and exists (
    select 1
    from public.orders o
    where o.id = order_messages.order_id
      and o.user_id = auth.uid()
  )
);

-- Admin pode responder como admin em qualquer pedido.
create policy "messages_insert_admin"
on public.order_messages
for insert
to authenticated
with check (
  sender_role = 'admin'
  and user_id = auth.uid()
  and public.is_forja_admin()
);

-- Mensagens não são editadas. Se precisar corrigir, envie outra mensagem.
create policy "messages_update_none"
on public.order_messages
for update
to authenticated
using (false)
with check (false);

-- Admin pode limpar mensagens junto com testes/erros se necessário.
create policy "messages_delete_admin"
on public.order_messages
for delete
to authenticated
using (public.is_forja_admin());

-- Permissões SQL básicas para usuários autenticados, RLS decide o que cada um pode fazer.
grant select, insert, delete on public.order_messages to authenticated;

-- Realtime é opcional: se a tabela já estiver na publication, este bloco ignora o erro.
do $$
begin
  begin
    alter publication supabase_realtime add table public.order_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
