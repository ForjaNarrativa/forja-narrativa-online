-- Forja Narrativa Online 0.4.1 — Correção de updated_at e status
-- Rode no SQL Editor se a Sala do Criador der erro ao atualizar pedidos.
-- Esta migration registra oficialmente a correção encontrada em produção.

-- 1. Garante a coluna usada pelo trigger de atualização.
alter table public.orders
add column if not exists updated_at timestamptz default now();

-- 2. Garante as colunas de entrega da 0.4.0.
alter table public.orders add column if not exists delivery_url text;
alter table public.orders add column if not exists delivery_note text;

-- 3. Recria função de updated_at.
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

-- 4. Remove possíveis triggers antigos e cria o trigger oficial.
drop trigger if exists set_orders_updated_at on public.orders;
drop trigger if exists orders_updated_at_trigger on public.orders;
drop trigger if exists update_orders_updated_at on public.orders;

create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

-- 5. Remove CHECK constraints antigas que podem ter sido criadas manualmente.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'orders'
      and con.contype = 'c'
  loop
    execute format('alter table public.orders drop constraint if exists %I', constraint_name);
  end loop;
end $$;

-- 6. Recria CHECKs compatíveis com os status atuais da Forja.
alter table public.orders
add constraint orders_status_check
check (
  status is null
  or status in (
    'aguardando análise',
    'aguardando analise',
    'aguardando pagamento',
    'em produção',
    'em producao',
    'aguardando resposta do cliente',
    'revisão solicitada',
    'revisao solicitada',
    'entregue',
    'cancelado',
    'arquivado',
    'teste'
  )
);

alter table public.orders
add constraint orders_payment_status_check
check (
  payment_status is null
  or payment_status in (
    'não pago',
    'nao pago',
    'aguardando pagamento',
    'pago',
    'reembolsado',
    'cancelado',
    'isento'
  )
);
