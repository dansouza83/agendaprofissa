-- Conclui o fluxo de pagamento PIX direto entre cliente e profissional.
-- O Agenda Profissa não recebe, retém ou confirma valores automaticamente.

alter table public.appointment_notifications
  drop constraint if exists appointment_notifications_notification_type_check;
alter table public.appointment_notifications
  add constraint appointment_notifications_notification_type_check
  check (notification_type in (
    'appointment_created', 'payment_pending', 'receipt_submitted', 'payment_confirmed'
  ));

create unique index if not exists idx_payment_submissions_one_pending_receipt
  on public.appointment_payment_submissions (appointment_id)
  where payment_method = 'pix' and status = 'submitted';

create or replace function private.require_pix_receipt_before_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid'
     and old.payment_status is distinct from 'paid'
     and not exists (
       select 1
       from public.appointment_payment_submissions submission
       where submission.appointment_id = new.id
         and submission.tenant_id = new.tenant_id
         and submission.client_id = new.client_id
         and submission.payment_method = 'pix'
         and submission.status = 'submitted'
     ) then
    raise exception 'O cliente ainda não enviou um comprovante PIX para este agendamento.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.require_pix_receipt_before_confirmation()
  from public, anon, authenticated;

drop trigger if exists require_pix_receipt_before_confirmation on public.appointments;
create trigger require_pix_receipt_before_confirmation
before update of payment_status on public.appointments
for each row execute function private.require_pix_receipt_before_confirmation();

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

  schedule_text := to_char(
    new.starts_at at time zone coalesce(business_timezone, 'America/Sao_Paulo'),
    'DD/MM/YYYY "às" HH24:MI'
  );

  if tg_op = 'INSERT' and new.payment_status = 'pending' then
    insert into public.appointment_notifications (
      tenant_id, appointment_id, client_id, recipient_user_id,
      notification_type, event_key, title, body
    )
    select
      new.tenant_id, new.id, new.client_id, membership.user_id,
      'payment_pending', 'appointment:' || new.id::text || ':professional_payment_pending',
      'Agendamento criado — pagamento pendente',
      coalesce(client_name, 'Cliente') || ' foi agendado para ' ||
      coalesce(service_name, 'um atendimento') || ' em ' || schedule_text ||
      '. Aguarde o comprovante PIX antes de confirmar o recebimento.'
    from public.memberships membership
    where membership.tenant_id = new.tenant_id
    on conflict (recipient_user_id, event_key) do nothing;

    if client_user_id is not null then
      insert into public.appointment_notifications (
        tenant_id, appointment_id, client_id, recipient_user_id,
        notification_type, event_key, title, body
      ) values (
        new.tenant_id, new.id, new.client_id, client_user_id,
        'appointment_created', 'appointment:' || new.id::text || ':client_created',
        'Novo horário — pagamento PIX pendente',
        coalesce(business_name, 'O profissional') || ' marcou ' ||
        coalesce(service_name, 'um atendimento') || ' para ' || schedule_text ||
        '. Abra o agendamento para ver a chave PIX e enviar o comprovante.'
      )
      on conflict (recipient_user_id, event_key) do nothing;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.payment_status is distinct from new.payment_status
     and new.payment_status = 'paid'
     and client_user_id is not null then
    select coalesce(nullif(profile.full_name, ''), business_name), auth_user.email
      into professional_name, professional_email
    from public.memberships membership
    join public.profiles profile on profile.id = membership.user_id
    join auth.users auth_user on auth_user.id = membership.user_id
    where membership.tenant_id = new.tenant_id
      and membership.role in ('owner', 'admin')
    order by case membership.role when 'owner' then 0 else 1 end, membership.created_at
    limit 1;

    insert into public.appointment_notifications (
      tenant_id, appointment_id, client_id, recipient_user_id,
      notification_type, event_key, title, body
    ) values (
      new.tenant_id, new.id, new.client_id, client_user_id,
      'payment_confirmed', 'appointment:' || new.id::text || ':payment_confirmed',
      'Pagamento confirmado — horário reservado',
      'Seu pagamento PIX foi confirmado manualmente pelo profissional. ' ||
      coalesce(service_name, 'Atendimento') || ' em ' || schedule_text ||
      '. Profissional/negócio: ' ||
      coalesce(professional_name, business_name, 'Profissional') ||
      case when professional_email is not null then '. Contato: ' || professional_email else '' end || '.'
    )
    on conflict (recipient_user_id, event_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.create_appointment_notifications()
  from public, anon, authenticated;

create or replace function private.create_payment_receipt_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  client_name text;
  service_name text;
  business_timezone text;
  starts_at timestamptz;
  schedule_text text;
begin
  if new.payment_method <> 'pix' or new.status <> 'submitted' then
    return new;
  end if;

  select client.name into client_name
  from public.clients client
  where client.id = new.client_id and client.tenant_id = new.tenant_id;

  select appointment.starts_at, service.name, tenant.timezone
    into starts_at, service_name, business_timezone
  from public.appointments appointment
  join public.services service
    on service.id = appointment.service_id and service.tenant_id = appointment.tenant_id
  join public.tenants tenant on tenant.id = appointment.tenant_id
  where appointment.id = new.appointment_id and appointment.tenant_id = new.tenant_id;

  schedule_text := to_char(
    starts_at at time zone coalesce(business_timezone, 'America/Sao_Paulo'),
    'DD/MM/YYYY "às" HH24:MI'
  );

  insert into public.appointment_notifications (
    tenant_id, appointment_id, client_id, recipient_user_id,
    notification_type, event_key, title, body
  )
  select
    new.tenant_id, new.appointment_id, new.client_id, membership.user_id,
    'receipt_submitted', 'submission:' || new.id::text || ':receipt_submitted',
    'Novo comprovante PIX recebido',
    coalesce(client_name, 'Cliente') || ' enviou um comprovante para ' ||
    coalesce(service_name, 'o atendimento') || ' de ' || schedule_text ||
    '. Abra Recebimentos PIX, confira o arquivo e confirme somente se o valor entrou na sua conta.'
  from public.memberships membership
  where membership.tenant_id = new.tenant_id
  on conflict (recipient_user_id, event_key) do nothing;

  return new;
end;
$$;

revoke all on function private.create_payment_receipt_notifications()
  from public, anon, authenticated;

drop trigger if exists create_payment_receipt_notifications
  on public.appointment_payment_submissions;
create trigger create_payment_receipt_notifications
after insert on public.appointment_payment_submissions
for each row execute function private.create_payment_receipt_notifications();
