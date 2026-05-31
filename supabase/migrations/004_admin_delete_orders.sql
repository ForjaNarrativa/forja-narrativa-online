-- Forja Narrativa Online — exclusão de pedidos por admin
-- Rode este arquivo no SQL Editor do Supabase depois das migrations 001 e 002.
-- Ele permite que apenas administradores removam pedidos da tabela orders.
-- As tabelas order_messages e order_deliveries já usam ON DELETE CASCADE,
-- então mensagens/entregas ligadas ao pedido também são removidas.

alter table public.orders enable row level security;

drop policy if exists "orders_delete_admin" on public.orders;
create policy "orders_delete_admin"
on public.orders for delete
using (public.is_forja_admin());
