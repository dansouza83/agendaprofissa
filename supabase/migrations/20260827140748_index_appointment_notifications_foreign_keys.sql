-- Índices de cobertura para as chaves estrangeiras dos alertas.
create index idx_appointment_notifications_appointment_fk
  on public.appointment_notifications (appointment_id);

create index idx_appointment_notifications_client_fk
  on public.appointment_notifications (client_id, tenant_id);
