-- Forja Narrativa Online 0.5.5 — Polimento do chat e segurança do pré-pedido
-- Corrige realtime do suporte, reforça policies e mantém atendimentos fecháveis pelo admin.

-- Realtime das tabelas de atendimento pré-pedido.
do $$
begin
  begin
    alter publication supabase_realtime add table public.support_conversations;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.support_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.support_chat_reads;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_chat_reads enable row level security;

grant select, insert, update on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;
grant select, insert, update on public.support_chat_reads to authenticated;

-- Conversas de suporte: cliente vê/cria a própria; admin vê e fecha/atualiza qualquer uma.
drop policy if exists "support_conversations_select_own_or_admin" on public.support_conversations;
create policy "support_conversations_select_own_or_admin"
on public.support_conversations for select
to authenticated
using (user_id = auth.uid() or public.is_forja_admin());

drop policy if exists "support_conversations_insert_own" on public.support_conversations;
create policy "support_conversations_insert_own"
on public.support_conversations for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "support_conversations_update_admin" on public.support_conversations;
create policy "support_conversations_update_admin"
on public.support_conversations for update
to authenticated
using (public.is_forja_admin())
with check (public.is_forja_admin());

-- Mensagens: cliente só fala como cliente na própria conversa; admin só fala como admin e com o próprio user_id.
drop policy if exists "support_messages_select_own_or_admin" on public.support_messages;
create policy "support_messages_select_own_or_admin"
on public.support_messages for select
to authenticated
using (
  public.is_forja_admin()
  or exists (
    select 1 from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and sc.user_id = auth.uid()
  )
);

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
      and sc.status <> 'fechada'
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
  )
);

-- Leituras: cliente só marca leitura como cliente; admin só marca leitura como admin.
drop policy if exists "support_reads_select_own_or_admin" on public.support_chat_reads;
create policy "support_reads_select_own_or_admin"
on public.support_chat_reads for select
to authenticated
using (user_id = auth.uid() or public.is_forja_admin());

drop policy if exists "support_reads_upsert_own" on public.support_chat_reads;
create policy "support_reads_upsert_own"
on public.support_chat_reads for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    (
      reader_role = 'cliente'
      and exists (
        select 1 from public.support_conversations sc
        where sc.id = support_chat_reads.conversation_id
          and sc.user_id = auth.uid()
      )
    )
    or (
      reader_role = 'admin'
      and public.is_forja_admin()
    )
  )
);

drop policy if exists "support_reads_update_own" on public.support_chat_reads;
create policy "support_reads_update_own"
on public.support_chat_reads for update
to authenticated
using (
  user_id = auth.uid()
  and (
    (
      reader_role = 'cliente'
      and exists (
        select 1 from public.support_conversations sc
        where sc.id = support_chat_reads.conversation_id
          and sc.user_id = auth.uid()
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
        select 1 from public.support_conversations sc
        where sc.id = support_chat_reads.conversation_id
          and sc.user_id = auth.uid()
      )
    )
    or (
      reader_role = 'admin'
      and public.is_forja_admin()
    )
  )
);
