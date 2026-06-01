-- Forja Narrativa Online 0.5.4 — Chat aberto pré-pedido
-- Cria um atendimento independente de pedido para dúvidas antes da compra.

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text,
  client_email text,
  subject text default 'Dúvida pré-pedido',
  status text default 'aberta' check (status in ('aberta', 'respondida', 'fechada')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('cliente', 'admin')),
  message text not null check (length(trim(message)) > 0),
  created_at timestamptz default now()
);

create table if not exists public.support_chat_reads (
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reader_role text not null check (reader_role in ('cliente', 'admin')),
  last_read_at timestamptz default now(),
  primary key (conversation_id, user_id, reader_role)
);

create index if not exists support_conversations_user_id_idx on public.support_conversations(user_id);
create index if not exists support_conversations_updated_at_idx on public.support_conversations(updated_at desc);
create index if not exists support_messages_conversation_id_created_idx on public.support_messages(conversation_id, created_at);
create index if not exists support_chat_reads_user_role_idx on public.support_chat_reads(user_id, reader_role);

create or replace function public.set_support_conversation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_support_conversations_updated_at on public.support_conversations;
create trigger set_support_conversations_updated_at
before update on public.support_conversations
for each row
execute function public.set_support_conversation_updated_at();

create or replace function public.touch_support_conversation_from_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.support_conversations
  set updated_at = now(),
      status = case when new.sender_role = 'admin' then 'respondida' else 'aberta' end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_support_conversation_on_message on public.support_messages;
create trigger touch_support_conversation_on_message
after insert on public.support_messages
for each row
execute function public.touch_support_conversation_from_message();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_chat_reads enable row level security;

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
  )
);

drop policy if exists "support_messages_insert_admin" on public.support_messages;
create policy "support_messages_insert_admin"
on public.support_messages for insert
to authenticated
with check (
  sender_role = 'admin'
  and public.is_forja_admin()
);

drop policy if exists "support_reads_select_own_or_admin" on public.support_chat_reads;
create policy "support_reads_select_own_or_admin"
on public.support_chat_reads for select
to authenticated
using (user_id = auth.uid() or public.is_forja_admin());

drop policy if exists "support_reads_upsert_own" on public.support_chat_reads;
create policy "support_reads_upsert_own"
on public.support_chat_reads for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "support_reads_update_own" on public.support_chat_reads;
create policy "support_reads_update_own"
on public.support_chat_reads for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
