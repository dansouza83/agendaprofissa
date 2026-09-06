-- Storage deletion requires SELECT as well as DELETE. Keep participant access
-- unchanged, allowing only the uploader to read their own orphan for cleanup.
alter policy "participants read private payment receipts"
on storage.objects
using (
  bucket_id = 'appointment-payment-receipts'
  and (
    (
      owner_id = (select auth.uid()::text)
      and not exists (
        select 1 from public.appointment_payment_submissions orphan_check
        where orphan_check.receipt_path = storage.objects.name
      )
    )
    or exists (
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
  )
);
