-- PIX direto ao profissional: dados para BR Code, valor preservado e revisão auditável.
alter table public.tenant_payment_settings
  add column pix_key_type text not null default '' check (pix_key_type in ('', 'cpf', 'cnpj', 'email', 'phone', 'random')),
  add column pix_holder_name text not null default '' check (char_length(pix_holder_name) <= 25),
  add column pix_holder_city text not null default '' check (char_length(pix_holder_city) <= 15);
grant insert (pix_key_type, pix_holder_name, pix_holder_city),
  update (pix_key_type, pix_holder_name, pix_holder_city)
  on public.tenant_payment_settings to authenticated;

alter table public.appointment_payment_submissions
  add column review_started_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by_name text,
  add column reviewed_by_user_id uuid references auth.users(id) on delete set null,
  add column rejection_reason text check (rejection_reason is null or char_length(rejection_reason) between 5 and 500);
create index idx_payment_submissions_reviewer on public.appointment_payment_submissions (reviewed_by_user_id);
-- No direct grants for review columns: decisions go through the authorized RPC only.

alter table public.appointment_notifications drop constraint appointment_notifications_notification_type_check;
alter table public.appointment_notifications add constraint appointment_notifications_notification_type_check
  check (notification_type in ('appointment_created', 'payment_pending', 'receipt_submitted', 'receipt_rejected', 'payment_confirmed'));

-- Existing UI used the service price when amount_cents was unset; preserve that amount.
update public.appointments a set amount_cents = s.price_cents
from public.services s where a.service_id = s.id and a.tenant_id = s.tenant_id and a.amount_cents is null;

create or replace function private.preserve_appointment_payment_amount()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.payment_status := 'pending';
    new.payment_confirmed_at := null;
  end if;
  if tg_op = 'UPDATE' then
    if old.payment_status = 'paid' and new.payment_status is distinct from old.payment_status then
      raise exception 'Um pagamento confirmado não pode voltar a pendente por edição do agendamento.' using errcode = 'check_violation';
    end if;
    if (new.service_id, new.client_id, new.amount_cents) is distinct from (old.service_id, old.client_id, old.amount_cents)
       and (old.payment_status = 'paid' or exists (
         select 1 from public.appointment_payment_submissions s where s.appointment_id = old.id and s.payment_method = 'pix'
       )) then
      raise exception 'Este agendamento já possui histórico de pagamento. Não altere cliente, serviço ou valor; combine a correção com o cliente.' using errcode = 'check_violation';
    end if;
  end if;
  if new.amount_cents is null or (tg_op = 'UPDATE' and new.service_id is distinct from old.service_id) then
    select price_cents into new.amount_cents from public.services where id = new.service_id and tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;
revoke all on function private.preserve_appointment_payment_amount() from public, anon, authenticated;
create trigger preserve_appointment_payment_amount before insert or update on public.appointments
for each row execute function private.preserve_appointment_payment_amount();

create or replace function private.require_pix_receipt_before_confirmation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    if new.status = 'cancelado' then
      raise exception 'Não é possível confirmar pagamento de um agendamento cancelado.' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.appointment_payment_submissions s
      where s.appointment_id = new.id and s.tenant_id = new.tenant_id and s.client_id = new.client_id
        and s.payment_method = 'pix' and s.status = 'submitted'
    ) then
      raise exception 'O cliente ainda não enviou um comprovante PIX válido para este agendamento.' using errcode = 'check_violation';
    end if;
    if new.status = 'pendente' then new.status := 'confirmado'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.require_pix_receipt_before_confirmation() from public, anon, authenticated;

create or replace function private.confirm_appointment_payment_submissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    update public.appointment_payment_submissions set status = 'confirmed', updated_at = now(),
      review_started_at = coalesce(review_started_at, now()), reviewed_at = now(), reviewed_by_user_id = auth.uid(),
      reviewed_by_name = coalesce((select nullif(full_name, '') from public.profiles where id = auth.uid()), 'Profissional')
    where appointment_id = new.id and tenant_id = new.tenant_id and payment_method = 'pix' and status = 'submitted';
  end if;
  return new;
end;
$$;
revoke all on function private.confirm_appointment_payment_submissions() from public, anon, authenticated;

create function private.review_pix_receipt(p_receipt_id uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  receipt public.appointment_payment_submissions%rowtype;
  booking public.appointments%rowtype;
  actor uuid := auth.uid();
  recipient uuid;
  reviewer_name text;
begin
  if actor is null then raise exception 'Acesso não autorizado.' using errcode = '42501'; end if;
  select * into receipt from public.appointment_payment_submissions where id = p_receipt_id;
  if not found or not exists (
    select 1 from public.memberships m where m.tenant_id = receipt.tenant_id and m.user_id = actor
  ) or not private.has_active_subscription(receipt.tenant_id) then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  -- Lock in the same order as payment confirmation: appointment, then receipt.
  select * into booking from public.appointments where id = receipt.appointment_id for update;
  select * into receipt from public.appointment_payment_submissions where id = p_receipt_id for update;
  if booking.payment_status <> 'pending' or booking.status = 'cancelado' or receipt.status <> 'submitted' or receipt.payment_method <> 'pix' then
    raise exception 'O comprovante já foi analisado ou o agendamento não está disponível. Atualize a página.' using errcode = 'check_violation';
  end if;
  if p_action = 'start_review' then
    update public.appointment_payment_submissions set review_started_at = coalesce(review_started_at, now()), updated_at = now()
    where id = p_receipt_id;
  elsif p_action = 'request_new' then
    if p_reason is null or char_length(trim(p_reason)) not between 5 and 500 then
      raise exception 'Informe um motivo entre 5 e 500 caracteres.' using errcode = 'check_violation';
    end if;
    select coalesce(nullif(full_name, ''), 'Profissional') into reviewer_name from public.profiles where id = actor;
    update public.appointment_payment_submissions set status = 'rejected',
      review_started_at = coalesce(review_started_at, now()), reviewed_at = now(), reviewed_by_user_id = actor,
      reviewed_by_name = coalesce(reviewer_name, 'Profissional'), rejection_reason = trim(p_reason), updated_at = now()
    where id = p_receipt_id;
    select user_id into recipient from public.clients where id = receipt.client_id and tenant_id = receipt.tenant_id;
    if recipient is not null then
      insert into public.appointment_notifications (tenant_id, appointment_id, client_id, recipient_user_id, notification_type, event_key, title, body)
      values (receipt.tenant_id, receipt.appointment_id, receipt.client_id, recipient, 'receipt_rejected',
        'submission:' || receipt.id::text || ':receipt_rejected', 'Envie outro comprovante PIX',
        'O profissional solicitou outro comprovante para seu agendamento. Motivo: ' || trim(p_reason) ||
        '. Se você já pagou, não pague novamente: confira a transferência no banco e reenvie o comprovante correto.')
      on conflict (recipient_user_id, event_key) do nothing;
    end if;
  else raise exception 'Ação de revisão inválida.' using errcode = 'check_violation';
  end if;
end;
$$;
revoke all on function private.review_pix_receipt(uuid, text, text) from public, anon, authenticated;
grant execute on function private.review_pix_receipt(uuid, text, text) to authenticated;

-- Exposed wrapper is invoker; private helper enforces tenant/actor/status and owns narrow writes.
create function public.review_pix_receipt(p_receipt_id uuid, p_action text, p_reason text default null)
returns void language sql security invoker set search_path = '' as $$
  select private.review_pix_receipt(p_receipt_id, p_action, p_reason);
$$;
revoke all on function public.review_pix_receipt(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_pix_receipt(uuid, text, text) to authenticated;

-- Reject forged file references and serialize uploads with reviews/confirmation.
create function private.validate_pix_receipt_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare booking public.appointments%rowtype;
begin
  if new.payment_method <> 'pix' then return new; end if;
  select * into booking from public.appointments where id = new.appointment_id for update;
  if not found or booking.payment_status <> 'pending' or booking.status = 'cancelado'
    or booking.tenant_id <> new.tenant_id or booking.client_id <> new.client_id then
    raise exception 'Agendamento indisponível para envio de comprovante.' using errcode = 'check_violation';
  end if;
  if new.status <> 'submitted' or new.receipt_size_bytes is null
    or new.receipt_path not like new.tenant_id::text || '/' || new.appointment_id::text || '/' || new.submitted_by_user_id::text || '/%'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'appointment-payment-receipts'
      and o.name = new.receipt_path and o.owner_id = new.submitted_by_user_id::text) then
    raise exception 'Envie primeiro um comprovante válido pelo formulário seguro.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_pix_receipt_insert() from public, anon, authenticated;
create trigger validate_pix_receipt_insert before insert on public.appointment_payment_submissions
for each row execute function private.validate_pix_receipt_insert();
