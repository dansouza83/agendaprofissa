-- A subscription authorization alone never unlocks the professional panel.
-- Access requires a matching Mercado Pago payment confirmed as approved.
alter table public.subscriptions
  add column if not exists provider_payment_id text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists amount_cents integer not null default 0;

alter table public.subscriptions
  drop constraint if exists subscriptions_payment_status_check,
  add constraint subscriptions_payment_status_check
    check (payment_status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  drop constraint if exists subscriptions_amount_cents_check,
  add constraint subscriptions_amount_cents_check check (amount_cents >= 0);

create unique index if not exists idx_subscriptions_provider_payment_id
  on public.subscriptions(provider_payment_id)
  where provider_payment_id is not null;

create or replace function private.has_active_subscription(requested_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.memberships m
    join public.subscriptions s on s.tenant_id = m.tenant_id
    where m.tenant_id = requested_tenant_id
      and m.user_id = (select auth.uid())
      and s.status = 'authorized'
      and s.payment_status = 'approved'
  );
$$;

revoke all on function private.has_active_subscription(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_active_subscription(uuid) to authenticated;
