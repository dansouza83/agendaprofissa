create index idx_chat_messages_client_fk
  on public.chat_messages (client_id, tenant_id);
