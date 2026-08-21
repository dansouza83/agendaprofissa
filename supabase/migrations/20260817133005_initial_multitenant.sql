-- AgendaFacil: esquema inicial multitenant seguro.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  account_type text not null default 'professional' check (account_type in ('professional','client')),
  active_tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','professional','receptionist')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  phone text not null default '', email text not null default '', notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, user_id)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version date not null,
  privacy_version date not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'signup',
  unique (user_id, terms_version, privacy_version)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  duration_minutes integer not null check (duration_minutes between 5 and 1440),
  price_cents integer not null check (price_cents >= 0),
  color text not null default '#2f7d70' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null, service_id uuid not null,
  professional_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','confirmado','concluido','cancelado')),
  notes text not null default '', amount_cents integer check (amount_cents >= 0),
  payment_provider text, payment_external_id text, payment_status text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (client_id, tenant_id) references public.clients(id, tenant_id),
  foreign key (service_id, tenant_id) references public.services(id, tenant_id)
);

create index idx_memberships_user on public.memberships(user_id, tenant_id);
create index idx_profiles_active_tenant on public.profiles(active_tenant_id) where active_tenant_id is not null;
create index idx_clients_tenant_name on public.clients(tenant_id, name);
create index idx_clients_user on public.clients(user_id) where user_id is not null;
create index idx_services_tenant_active on public.services(tenant_id, active);
create index idx_appointments_tenant_starts on public.appointments(tenant_id, starts_at);
create index idx_appointments_tenant_status on public.appointments(tenant_id, status);
create index idx_appointments_client_starts on public.appointments(client_id, tenant_id, starts_at);
create index idx_appointments_service on public.appointments(service_id, tenant_id);
create index idx_appointments_professional on public.appointments(professional_user_id) where professional_user_id is not null;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

revoke all on public.tenants, public.memberships, public.profiles, public.clients, public.services, public.appointments, public.legal_acceptances from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.tenants, public.memberships, public.profiles to authenticated;
grant select on public.legal_acceptances to authenticated;
grant update (name, timezone, updated_at) on public.tenants to authenticated;
grant update (full_name, active_tenant_id, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.clients, public.services to authenticated;
grant select, delete on public.appointments to authenticated;
grant insert (id, tenant_id, client_id, service_id, professional_user_id, starts_at, status, notes, amount_cents) on public.appointments to authenticated;
grant update (client_id, service_id, professional_user_id, starts_at, status, notes, amount_cents, updated_at) on public.appointments to authenticated;

create policy "users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "users update own profile" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "users read own legal acceptances" on public.legal_acceptances for select to authenticated using (user_id = (select auth.uid()));
create policy "users read own memberships" on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy "members read tenant" on public.tenants for select to authenticated
using (exists (select 1 from public.memberships m where m.tenant_id = tenants.id and m.user_id = (select auth.uid())));
create policy "owners update tenant" on public.tenants for update to authenticated
using (exists (select 1 from public.memberships m where m.tenant_id = tenants.id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.memberships m where m.tenant_id = tenants.id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

create policy "members read clients" on public.clients for select to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = clients.tenant_id and m.user_id = (select auth.uid())));
create policy "clients read own records" on public.clients for select to authenticated using (user_id = (select auth.uid()));
create policy "members insert clients" on public.clients for insert to authenticated with check (exists (select 1 from public.memberships m where m.tenant_id = clients.tenant_id and m.user_id = (select auth.uid())));
create policy "members update clients" on public.clients for update to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = clients.tenant_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.memberships m where m.tenant_id = clients.tenant_id and m.user_id = (select auth.uid())));
create policy "members delete clients" on public.clients for delete to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = clients.tenant_id and m.user_id = (select auth.uid())));

create policy "members read services" on public.services for select to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = services.tenant_id and m.user_id = (select auth.uid())));
create policy "clients read booked services" on public.services for select to authenticated using (exists (select 1 from public.appointments a join public.clients c on c.id = a.client_id and c.tenant_id = a.tenant_id where a.service_id = services.id and a.tenant_id = services.tenant_id and c.user_id = (select auth.uid())));
create policy "members insert services" on public.services for insert to authenticated with check (exists (select 1 from public.memberships m where m.tenant_id = services.tenant_id and m.user_id = (select auth.uid())));
create policy "members update services" on public.services for update to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = services.tenant_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.memberships m where m.tenant_id = services.tenant_id and m.user_id = (select auth.uid())));
create policy "members delete services" on public.services for delete to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = services.tenant_id and m.user_id = (select auth.uid())));

create policy "members read appointments" on public.appointments for select to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = appointments.tenant_id and m.user_id = (select auth.uid())));
create policy "clients read own appointments" on public.appointments for select to authenticated using (exists (select 1 from public.clients c where c.id = appointments.client_id and c.tenant_id = appointments.tenant_id and c.user_id = (select auth.uid())));
create policy "members insert appointments" on public.appointments for insert to authenticated with check (exists (select 1 from public.memberships m where m.tenant_id = appointments.tenant_id and m.user_id = (select auth.uid())));
create policy "members update appointments" on public.appointments for update to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = appointments.tenant_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.memberships m where m.tenant_id = appointments.tenant_id and m.user_id = (select auth.uid())));
create policy "members delete appointments" on public.appointments for delete to authenticated using (exists (select 1 from public.memberships m where m.tenant_id = appointments.tenant_id and m.user_id = (select auth.uid())));

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare new_tenant_id uuid := gen_random_uuid();
declare business_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'Meu negócio');
declare selected_account_type text := case when new.raw_user_meta_data ->> 'account_type' = 'client' then 'client' else 'professional' end;
begin
  if selected_account_type = 'professional' then
    insert into public.tenants (id, name, slug) values (new_tenant_id, business_name, 'negocio-' || left(new.id::text, 8));
    insert into public.profiles (id, full_name, account_type, active_tenant_id) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), selected_account_type, new_tenant_id);
    insert into public.memberships (tenant_id, user_id, role) values (new_tenant_id, new.id, 'owner');
  else
    insert into public.profiles (id, full_name, account_type, active_tenant_id) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), selected_account_type, null);
  end if;
  if coalesce(new.raw_user_meta_data ->> 'legal_acceptance', 'false') = 'true' then
    insert into public.legal_acceptances (user_id, terms_version, privacy_version)
    values (new.id, date '2026-08-17', date '2026-08-17');
  end if;
  return new;
end; $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure private.handle_new_user();
