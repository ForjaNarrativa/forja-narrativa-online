-- Forja Narrativa Online 0.5.6 — Central da Forja
-- Organiza a central de atendimento com status mais claros, arquivamento e fluxo ativo.

-- Remove checks antigas de support_conversations.status para permitir novos estados.
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
      and rel.relname = 'support_conversations'
      and con.contype = 'c'
  loop
    execute format('alter table public.support_conversations drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.support_conversations
add constraint support_conversations_status_check
check (
  status in (
    'aberta',
    'aguardando_forja',
    'aguardando_cliente',
    'respondida',
    'fechada',
    'arquivada'
  )
);

create index if not exists support_conversations_status_updated_idx
on public.support_conversations(status, updated_at desc);

-- Quando chega mensagem, mantém fechadas/arquivadas paradas e organiza as abertas automaticamente.
create or replace function public.touch_support_conversation_from_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.support_conversations
  set updated_at = now(),
      status = case
        when status in ('fechada', 'arquivada') then status
        when new.sender_role = 'admin' then 'aguardando_cliente'
        else 'aguardando_forja'
      end
  where id = new.conversation_id;
  return new;
end;
$$;

-- Policies reforçadas: clientes não escrevem em atendimento fechado ou arquivado.
drop policy if exists "support_messages_insert_client" on public.support_messages;
create policy "support_messages_insert_client"
on public.support_messages for insert
to authenticated
with check (
  sender_role = 'cliente'
  and user_id = auth.uid()
  and exists (
    select 1 from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and sc.user_id = auth.uid()
      and sc.status not in ('fechada', 'arquivada')
  )
);

drop policy if exists "support_messages_insert_admin" on public.support_messages;
create policy "support_messages_insert_admin"
on public.support_messages for insert
to authenticated
with check (
  sender_role = 'admin'
  and user_id = auth.uid()
  and public.is_forja_admin()
  and exists (
    select 1 from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and sc.status not in ('fechada', 'arquivada')
  )
);
