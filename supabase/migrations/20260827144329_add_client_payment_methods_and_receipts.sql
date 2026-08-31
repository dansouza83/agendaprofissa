-- Formas de pagamento do profissional e comprovantes privados dos clientes.
create table public.tenant_payment_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  pix_key text not null default '' check (char_length(pix_key) <= 180),
  card_checkout_url text not null default '' check (
    char_length(card_checkout_url) <= 2048
    and (card_checkout_url = '' or card_checkout_url ~ '^https://')
  ),
  updated_at timestamptz not null default now()
);

create table public.appointment_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid not null,
  submitted_by_user_id uuid not null references auth.users(id) on delete cascade,
  payment_method text not null check (payment_method in ('pix', 'credit_card', 'debit_card', 'pay_later')),
  receipt_path text unique,
  receipt_original_name text,
  receipt_content_type text,
  receipt_size_bytes integer check (receipt_size_bytes between 1 and 5242880),
  status text not null check (status in ('submitted', 'pay_later', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, tenant_id) references public.clients(id, tenant_id),
  check (
    (payment_method = 'pix' and status in ('submitted', 'confirmed', 'rejected') and receipt_path is not null
      and receipt_original_name is not null and receipt_content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
    or (payment_method = 'pay_later' and status = 'pay_later' and receipt_path is null)
    or (payment_method in ('credit_card', 'debit_card') and receipt_path is null)
  )
);

create index idx_payment_submissions_appointment
  on public.appointment_payment_submissions (appointment_id, created_at desc);
create index idx_payment_submissions_tenant_status
  on public.appointment_payment_submissions (tenant_id, status, created_at desc);
create index idx_payment_submissions_client_fk
  on public.appointment_payment_submissions (client_id, tenant_id);
create index idx_payment_submissions_user_fk
  on public.appointment_payment_submissions (submitted_by_user_id);

alter table public.tenant_payment_settings enable row level security;
alter table public.appointment_payment_submissions enable row level security;

revoke all on public.tenant_payment_settings, public.appointment_payment_submissions from public, anon, authenticated;
grant select on public.tenant_payment_settings to authenticated;
grant insert (tenant_id, pix_key, card_checkout_url, updated_at) on public.tenant_payment_settings to authenticated;
grant update (pix_key, card_checkout_url, updated_at) on public.tenant_payment_settings to authenticated;
grant select on public.appointment_payment_submissions to authenticated;
grant insert (
  id, tenant_id, appointment_id, client_id, submitted_by_user_id, payment_method,
  receipt_path, receipt_original_name, receipt_content_type, receipt_size_bytes, status
) on public.appointment_payment_submissions to authenticated;

create policy "members read tenant payment settings"
on public.tenant_payment_settings for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.tenant_id = tenant_payment_settings.tenant_id
    and m.user_id = (select auth.uid())
));

create policy "clients read booked tenant payment settings"
on public.tenant_payment_settings for select to authenticated
using (exists (
  select 1
  from public.appointments a
  join public.clients c on c.id = a.client_id and c.tenant_id = a.tenant_id
  where a.tenant_id = tenant_payment_settings.tenant_id
    and c.user_id = (select auth.uid())
));

create policy "subscribed members insert tenant payment settings"
on public.tenant_payment_settings for insert to authenticated
with check (
  (select private.has_active_subscription(tenant_id))
  and exists (
    select 1 from public.memberships m
    where m.tenant_id = tenant_payment_settings.tenant_id
      and m.user_id = (select auth.uid())
  )
);

create policy "subscribed members update tenant payment settings"
on public.tenant_payment_settings for update to authenticated
using (
  (select private.has_active_subscription(tenant_id))
  and exists (
    select 1 from public.memberships m
    where m.tenant_id = tenant_payment_settings.tenant_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  (select private.has_active_subscription(tenant_id))
  and exists (
    select 1 from public.memberships m
    where m.tenant_id = tenant_payment_settings.tenant_id
      and m.user_id = (select auth.uid())
  )
);

create policy "participants read payment submissions"
on public.appointment_payment_submissions for select to authenticated
using (
  exists (
    select 1 from public.memberships m
    where m.tenant_id = appointment_payment_submissions.tenant_id
      and m.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.clients c
    where c.id = appointment_payment_submissions.client_id
      and c.tenant_id = appointment_payment_submissions.tenant_id
      and c.user_id = (select auth.uid())
  )
);

create policy "clients submit own appointment payments"
on public.appointment_payment_submissions for insert to authenticated
with check (
  submitted_by_user_id = (select auth.uid())
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'appointment-payment-receipts',
  'appointment-payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "clients upload own payment receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'appointment-payment-receipts'
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1
    from public.appointments a
    join public.clients c on c.id = a.client_id and c.tenant_id = a.tenant_id
    where a.tenant_id::text = (storage.foldername(name))[1]
      and a.id::text = (storage.foldername(name))[2]
      and a.payment_status = 'pending'
      and a.status <> 'cancelado'
      and c.user_id = (select auth.uid())
  )
);

create policy "participants read private payment receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'appointment-payment-receipts'
  and exists (
    select 1
    from public.appointment_payment_submissions s
    where s.receipt_path = storage.objects.name
      and (
        exists (
          select 1 from public.memberships m
          where m.tenant_id = s.tenant_id
            and m.user_id = (select auth.uid())
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

create policy "clients remove own orphan payment receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'appointment-payment-receipts'
  and owner_id = (select auth.uid()::text)
);

create or replace function private.confirm_appointment_payment_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    update public.appointment_payment_submissions
       set status = 'confirmed', updated_at = now()
     where appointment_id = new.id
       and tenant_id = new.tenant_id
       and status = 'submitted';
  end if;
  return new;
end;
$$;

revoke all on function private.confirm_appointment_payment_submissions() from public, anon, authenticated;

create trigger confirm_appointment_payment_submissions
after update of payment_status on public.appointments
for each row execute function private.confirm_appointment_payment_submissions();
