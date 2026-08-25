-- Mensagens internas entre uma conta de cliente vinculada e o negócio.
-- O banco valida cada participante; o frontend nunca decide sozinho quem pode ler.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (client_id, tenant_id) references public.clients(id, tenant_id) on delete cascade
);

create index idx_chat_messages_conversation
  on public.chat_messages (tenant_id, client_id, created_at desc);
create index idx_chat_messages_sender
  on public.chat_messages (sender_user_id);
create index idx_chat_messages_unread
  on public.chat_messages (tenant_id, client_id, created_at desc)
  where read_at is null;

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from public, anon, authenticated;
grant select, insert on public.chat_messages to authenticated;
grant update (read_at) on public.chat_messages to authenticated;

create policy "participants read chat messages"
on public.chat_messages for select to authenticated
using (
  (
    (select private.has_active_subscription(tenant_id))
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = chat_messages.tenant_id
        and m.user_id = (select auth.uid())
    )
  )
  or exists (
    select 1 from public.clients c
    where c.id = chat_messages.client_id
      and c.tenant_id = chat_messages.tenant_id
      and c.user_id = (select auth.uid())
  )
);

create policy "participants send chat messages"
on public.chat_messages for insert to authenticated
with check (
  sender_user_id = (select auth.uid())
  and (
    (
      (select private.has_active_subscription(tenant_id))
      and exists (
        select 1 from public.memberships m
        where m.tenant_id = chat_messages.tenant_id
          and m.user_id = (select auth.uid())
      )
    )
    or exists (
      select 1 from public.clients c
      where c.id = chat_messages.client_id
        and c.tenant_id = chat_messages.tenant_id
        and c.user_id = (select auth.uid())
    )
  )
);

create policy "recipients mark chat messages read"
on public.chat_messages for update to authenticated
using (
  sender_user_id <> (select auth.uid())
  and (
    (
      (select private.has_active_subscription(tenant_id))
      and exists (
        select 1 from public.memberships m
        where m.tenant_id = chat_messages.tenant_id
          and m.user_id = (select auth.uid())
      )
    )
    or exists (
      select 1 from public.clients c
      where c.id = chat_messages.client_id
        and c.tenant_id = chat_messages.tenant_id
        and c.user_id = (select auth.uid())
    )
  )
)
with check (
  sender_user_id <> (select auth.uid())
  and (
    (
      (select private.has_active_subscription(tenant_id))
      and exists (
        select 1 from public.memberships m
        where m.tenant_id = chat_messages.tenant_id
          and m.user_id = (select auth.uid())
      )
    )
    or exists (
      select 1 from public.clients c
      where c.id = chat_messages.client_id
        and c.tenant_id = chat_messages.tenant_id
        and c.user_id = (select auth.uid())
    )
  )
);
