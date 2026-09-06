-- Qualify the outer Storage object: unqualified `name` inside the join
-- resolves to clients.name and prevents valid customer uploads.
alter policy "clients upload own payment receipts"
on storage.objects
with check (
  bucket_id = 'appointment-payment-receipts'
  and (storage.foldername(storage.objects.name))[1] is not null
  and (storage.foldername(storage.objects.name))[2] is not null
  and (storage.foldername(storage.objects.name))[3] = (select auth.uid()::text)
  and exists (
    select 1
    from public.appointments a
    join public.clients c on c.id = a.client_id and c.tenant_id = a.tenant_id
    where a.tenant_id::text = (storage.foldername(storage.objects.name))[1]
      and a.id::text = (storage.foldername(storage.objects.name))[2]
      and a.payment_status = 'pending'
      and a.status <> 'cancelado'
      and c.user_id = (select auth.uid())
  )
);
