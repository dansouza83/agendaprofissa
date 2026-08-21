create extension if not exists supabase_vault with schema vault;

create table private.integration_settings (
  provider text primary key check (provider = 'mercado_pago'),
  active_environment text not null default 'test' check (active_environment in ('test', 'production')),
  test_public_key text not null default '',
  test_client_id text not null default '',
  production_public_key text not null default '',
  production_client_id text not null default '',
  monthly_price numeric(10,2) not null default 49.90 check (monthly_price > 0),
  annual_price numeric(10,2) not null default 478.80 check (annual_price > 0),
  test_monthly_plan_id text not null default '',
  test_annual_plan_id text not null default '',
  production_monthly_plan_id text not null default '',
  production_annual_plan_id text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
revoke all on private.integration_settings from public, anon, authenticated;

create or replace function private.put_vault_secret(secret_name text, secret_value text) returns void
language plpgsql security definer set search_path = '' as $$
declare existing_id uuid;
begin
  if coalesce(secret_value, '') = '' then return; end if;
  select id into existing_id from vault.secrets where name = secret_name;
  if existing_id is null then
    perform vault.create_secret(secret_value, secret_name, 'Agenda Profissa — credencial Mercado Pago');
  else
    perform vault.update_secret(existing_id, secret_value);
  end if;
end; $$;
revoke all on function private.put_vault_secret(text, text) from public, anon, authenticated;

create or replace function public.admin_save_mp_credentials(
  selected_environment text, public_key text, access_token text, client_id text,
  client_secret text, webhook_secret text, make_active boolean, administrator_email text
) returns void language plpgsql security definer set search_path = '' as $$
declare prefix text;
begin
  if selected_environment not in ('test', 'production') then raise exception 'Ambiente inválido'; end if;
  if lower(administrator_email) <> 'dansouzafloripa@gmail.com' then raise exception 'Acesso negado'; end if;
  prefix := 'agenda_profissa_mp_' || selected_environment || '_';
  perform private.put_vault_secret(prefix || 'access_token', access_token);
  perform private.put_vault_secret(prefix || 'client_secret', client_secret);
  perform private.put_vault_secret(prefix || 'webhook_secret', webhook_secret);
  insert into private.integration_settings(provider, active_environment, updated_by)
  values ('mercado_pago', case when make_active then selected_environment else 'test' end, administrator_email)
  on conflict (provider) do update set
    active_environment = case when make_active then selected_environment else private.integration_settings.active_environment end,
    test_public_key = case when selected_environment = 'test' and public_key <> '' then public_key else private.integration_settings.test_public_key end,
    test_client_id = case when selected_environment = 'test' and client_id <> '' then client_id else private.integration_settings.test_client_id end,
    production_public_key = case when selected_environment = 'production' and public_key <> '' then public_key else private.integration_settings.production_public_key end,
    production_client_id = case when selected_environment = 'production' and client_id <> '' then client_id else private.integration_settings.production_client_id end,
    updated_at = now(), updated_by = administrator_email;
end; $$;
revoke all on function public.admin_save_mp_credentials(text,text,text,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.admin_save_mp_credentials(text,text,text,text,text,text,boolean,text) to service_role;

create or replace function public.admin_get_mp_credentials(requested_environment text default null)
returns table(environment text, public_key text, access_token text, client_id text, client_secret text, webhook_secret text, monthly_price numeric, annual_price numeric, monthly_plan_id text, annual_plan_id text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with config as (
    select coalesce(requested_environment, s.active_environment) env, s.*
    from private.integration_settings s where s.provider = 'mercado_pago'
  )
  select c.env,
    case when c.env = 'production' then c.production_public_key else c.test_public_key end,
    coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'agenda_profissa_mp_' || c.env || '_access_token'), ''),
    case when c.env = 'production' then c.production_client_id else c.test_client_id end,
    coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'agenda_profissa_mp_' || c.env || '_client_secret'), ''),
    coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'agenda_profissa_mp_' || c.env || '_webhook_secret'), ''),
    c.monthly_price, c.annual_price,
    case when c.env = 'production' then c.production_monthly_plan_id else c.test_monthly_plan_id end,
    case when c.env = 'production' then c.production_annual_plan_id else c.test_annual_plan_id end,
    c.updated_at from config c;
$$;
revoke all on function public.admin_get_mp_credentials(text) from public, anon, authenticated;
grant execute on function public.admin_get_mp_credentials(text) to service_role;

create or replace function public.admin_save_mp_plans(selected_environment text, new_monthly_price numeric, new_annual_price numeric, monthly_plan_id text, annual_plan_id text, administrator_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if lower(administrator_email) <> 'dansouzafloripa@gmail.com' then raise exception 'Acesso negado'; end if;
  if selected_environment not in ('test','production') or new_monthly_price <= 0 or new_annual_price <= 0 then raise exception 'Dados inválidos'; end if;
  insert into private.integration_settings(provider, active_environment, updated_by)
  values ('mercado_pago', selected_environment, administrator_email)
  on conflict (provider) do nothing;
  update private.integration_settings set monthly_price = new_monthly_price, annual_price = new_annual_price,
    test_monthly_plan_id = case when selected_environment='test' then monthly_plan_id else test_monthly_plan_id end,
    test_annual_plan_id = case when selected_environment='test' then annual_plan_id else test_annual_plan_id end,
    production_monthly_plan_id = case when selected_environment='production' then monthly_plan_id else production_monthly_plan_id end,
    production_annual_plan_id = case when selected_environment='production' then annual_plan_id else production_annual_plan_id end,
    updated_at = now(), updated_by = administrator_email where provider='mercado_pago';
end; $$;
revoke all on function public.admin_save_mp_plans(text,numeric,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_save_mp_plans(text,numeric,numeric,text,text,text) to service_role;
