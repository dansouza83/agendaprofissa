-- Alertas persistentes de agendamento e confirmação manual de pagamento.
-- Apenas o banco cria alertas; o frontend somente lê e marca como visto.

update public.appointments
set payment_status = 'pending'
where payment_status is null or payment_status not in ('pending', 'paid');

alter table public.appointments
  alter column payment_status set default 'pending',
  alter column payment_status set not null,
  add column if not exists payment_confirmed_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_payment_status_check;
alter table public.appointments
  add constraint appointments_payment_status_check
  check (payment_status in ('pending', 'paid'));

grant update (payment_status) on public.appointments to authenticated;

create table public.appointment_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('payment_pending', 'payment_confirmed')),
  event_key text not null,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (client_id, tenant_id) references public.clients(id, tenant_id) on delete cascade,
  unique (recipient_user_id, event_key)
);

create index idx_appointment_notifications_recipient
  on public.appointment_notifications (recipient_user_id, read_at, created_at desc);
create index idx_appointment_notifications_tenant
  on public.appointment_notifications (tenant_id, appointment_id);

alter table public.appointment_notifications enable row level security;
revoke all on public.appointment_notifications from public, anon, authenticated;
grant select on public.appointment_notifications to authenticated;
grant update (read_at) on public.appointment_notifications to authenticated;

create policy "recipients read appointment notifications"
on public.appointment_notifications for select to authenticated
using (recipient_user_id = (select auth.uid()));

create policy "recipients mark appointment notifications read"
on public.appointment_notifications for update to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

create or replace function private.set_appointment_payment_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.payment_confirmed_at := now();
  elsif new.payment_status = 'pending' then
    new.payment_confirmed_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.set_appointment_payment_confirmation() from public, anon, authenticated;

create trigger set_appointment_payment_confirmation
before update of payment_status on public.appointments
for each row execute function private.set_appointment_payment_confirmation();

create or replace function private.create_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_name text;
  client_user_id uuid;
  service_name text;
  business_name text;
  business_timezone text;
  professional_name text;
  professional_email text;
  schedule_text text;
begin
  select c.name, c.user_id into client_name, client_user_id
  from public.clients c
  where c.id = new.client_id and c.tenant_id = new.tenant_id;

  select s.name into service_name
  from public.services s
  where s.id = new.service_id and s.tenant_id = new.tenant_id;

  select t.name, t.timezone into business_name, business_timezone
  from public.tenants t where t.id = new.tenant_id;

  schedule_text := to_char(new.starts_at at time zone coalesce(business_timezone, 'America/Sao_Paulo'), 'DD/MM/YYYY "às" HH24:MI');

  if tg_op = 'INSERT' and new.payment_status = 'pending' then
    insert into public.appointment_notifications (
      tenant_id, appointment_id, client_id, recipient_user_id,
      notification_type, event_key, title, body
    )
    select
      new.tenant_id, new.id, new.client_id, m.user_id,
      'payment_pending', 'appointment:' || new.id::text || ':payment_pending',
      'Novo agendamento — pagamento pendente',
      coalesce(client_name, 'Cliente') || ' solicitou ' || coalesce(service_name, 'um atendimento') ||
      ' para ' || schedule_text || '. Confirme manualmente somente depois de validar o pagamento.'
    from public.memberships m
    where m.tenant_id = new.tenant_id
    on conflict (recipient_user_id, event_key) do nothing;
  end if;

  if tg_op = 'UPDATE'
     and old.payment_status is distinct from new.payment_status
     and new.payment_status = 'paid'
     and client_user_id is not null then
    select coalesce(nullif(p.full_name, ''), business_name), u.email
      into professional_name, professional_email
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.tenant_id = new.tenant_id and m.role in ('owner', 'admin')
    order by case m.role when 'owner' then 0 else 1 end, m.created_at
    limit 1;

    insert into public.appointment_notifications (
      tenant_id, appointment_id, client_id, recipient_user_id,
      notification_type, event_key, title, body
    ) values (
      new.tenant_id, new.id, new.client_id, client_user_id,
      'payment_confirmed', 'appointment:' || new.id::text || ':payment_confirmed',
      'Pagamento confirmado — horário reservado',
      'Seu pagamento foi confirmado. ' || coalesce(service_name, 'Atendimento') ||
      ' em ' || schedule_text || '. Profissional/negócio: ' ||
      coalesce(professional_name, business_name, 'Profissional') ||
      case when professional_email is not null then '. Contato: ' || professional_email else '' end || '.'
    )
    on conflict (recipient_user_id, event_key) do nothing;
  end if;

  return new;
end;
$$;
revoke all on function private.create_appointment_notifications() from public, anon, authenticated;

create trigger create_appointment_notifications
after insert or update of payment_status on public.appointments
for each row execute function private.create_appointment_notifications();
