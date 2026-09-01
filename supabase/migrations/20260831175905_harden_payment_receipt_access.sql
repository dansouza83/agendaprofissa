-- Impede que um comprovante vinculado seja apagado pelo remetente e mantém
-- dados financeiros visíveis a profissionais somente durante assinatura ativa.

drop policy if exists "participants read payment submissions"
  on public.appointment_payment_submissions;

create policy "participants read payment submissions"
on public.appointment_payment_submissions for select to authenticated
using (
  (
    (select private.has_active_subscription(tenant_id))
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = appointment_payment_submissions.tenant_id
        and m.user_id = (select auth.uid())
    )
  )
  or exists (
    select 1 from public.clients c
    where c.id = appointment_payment_submissions.client_id
      and c.tenant_id = appointment_payment_submissions.tenant_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists "participants read private payment receipts"
  on storage.objects;

create policy "participants read private payment receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'appointment-payment-receipts'
  and exists (
    select 1
    from public.appointment_payment_submissions s
    where s.receipt_path = storage.objects.name
      and (
        (
          (select private.has_active_subscription(s.tenant_id))
          and exists (
            select 1 from public.memberships m
            where m.tenant_id = s.tenant_id
              and m.user_id = (select auth.uid())
          )
        )
        or exists (
          select 1 from public.clients c
          where c.id = s.client_id
            and c.tenant_id = s.tenant_id
            and c.user_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists "clients remove own orphan payment receipts"
  on storage.objects;

create policy "clients remove own orphan payment receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'appointment-payment-receipts'
  and owner_id = (select auth.uid()::text)
  and not exists (
    select 1
    from public.appointment_payment_submissions s
    where s.receipt_path = storage.objects.name
  )
);

drop policy if exists "clients submit own appointment payments"
  on public.appointment_payment_submissions;

create policy "clients submit own appointment payments"
on public.appointment_payment_submissions for insert to authenticated
with check (
  submitted_by_user_id = (select auth.uid())
  and (
    (payment_method = 'pix' and status = 'submitted' and receipt_path is not null)
    or (payment_method = 'pay_later' and status = 'pay_later' and receipt_path is null)
    or (payment_method in ('credit_card', 'debit_card') and status = 'submitted' and receipt_path is null)
  )
  and exists (
    select 1
    from public.appointments a
    join public.clients c on c.id = a.client_id and c.tenant_id = a.tenant_id
    where a.id = appointment_payment_submissions.appointment_id
      and a.tenant_id = appointment_payment_submissions.tenant_id
      and a.client_id = appointment_payment_submissions.client_id
      and a.payment_status = 'pending'
      and a.status <> 'cancelado'
      and c.user_id = (select auth.uid())
  )
);
