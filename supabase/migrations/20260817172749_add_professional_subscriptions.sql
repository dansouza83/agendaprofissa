create table public.subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  provider text not null default 'mercado_pago' check (provider = 'mercado_pago'),
  provider_subscription_id text unique,
  plan_code text not null check (plan_code in ('monthly', 'annual')),
  status text not null default 'pending' check (status in ('pending', 'authorized', 'paused', 'cancelled')),
  payer_email text not null default '',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_status on public.subscriptions(status, current_period_end);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from public, anon, authenticated;
grant select on public.subscriptions to authenticated;

create policy "members read own subscription" on public.subscriptions for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.tenant_id = subscriptions.tenant_id and m.user_id = (select auth.uid())
));

-- O bloqueio é aplicado no banco, não apenas na interface.
drop policy if exists "members read clients" on public.clients;
drop policy if exists "members insert clients" on public.clients;
drop policy if exists "members update clients" on public.clients;
drop policy if exists "members delete clients" on public.clients;
drop policy if exists "members read services" on public.services;
drop policy if exists "members insert services" on public.services;
drop policy if exists "members update services" on public.services;
drop policy if exists "members delete services" on public.services;
drop policy if exists "members read appointments" on public.appointments;
drop policy if exists "members insert appointments" on public.appointments;
drop policy if exists "members update appointments" on public.appointments;
drop policy if exists "members delete appointments" on public.appointments;

create or replace function private.has_active_subscription(requested_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.subscriptions s on s.tenant_id = m.tenant_id
    where m.tenant_id = requested_tenant_id
      and m.user_id = (select auth.uid())
      and s.status = 'authorized'
  );
$$;
revoke all on function private.has_active_subscription(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_active_subscription(uuid) to authenticated;

create policy "subscribers read clients" on public.clients for select to authenticated using ((select private.has_active_subscription(tenant_id)));
create policy "subscribers insert clients" on public.clients for insert to authenticated with check ((select private.has_active_subscription(tenant_id)));
create policy "subscribers update clients" on public.clients for update to authenticated using ((select private.has_active_subscription(tenant_id))) with check ((select private.has_active_subscription(tenant_id)));
create policy "subscribers delete clients" on public.clients for delete to authenticated using ((select private.has_active_subscription(tenant_id)));
create policy "subscribers read services" on public.services for select to authenticated using ((select private.has_active_subscription(tenant_id)));
create policy "subscribers insert services" on public.services for insert to authenticated with check ((select private.has_active_subscription(tenant_id)));
create policy "subscribers update services" on public.services for update to authenticated using ((select private.has_active_subscription(tenant_id))) with check ((select private.has_active_subscription(tenant_id)));
create policy "subscribers delete services" on public.services for delete to authenticated using ((select private.has_active_subscription(tenant_id)));
create policy "subscribers read appointments" on public.appointments for select to authenticated using ((select private.has_active_subscription(tenant_id)));
create policy "subscribers insert appointments" on public.appointments for insert to authenticated with check ((select private.has_active_subscription(tenant_id)));
create policy "subscribers update appointments" on public.appointments for update to authenticated using ((select private.has_active_subscription(tenant_id))) with check ((select private.has_active_subscription(tenant_id)));
create policy "subscribers delete appointments" on public.appointments for delete to authenticated using ((select private.has_active_subscription(tenant_id)));
