create table if not exists private.platform_legal_identity (
  identity_key boolean primary key default true check (identity_key),
  legal_name text not null default '' check (char_length(legal_name) <= 160),
  document text not null default '' check (char_length(document) <= 32),
  address text not null default '' check (char_length(address) <= 500),
  support_email text not null default '' check (char_length(support_email) <= 254),
  privacy_email text not null default '' check (char_length(privacy_email) <= 254),
  updated_at timestamptz not null default now(),
  updated_by text not null default '' check (char_length(updated_by) <= 254)
);

alter table private.platform_legal_identity enable row level security;
revoke all on table private.platform_legal_identity from public, anon, authenticated;

create or replace function public.admin_get_legal_identity()
returns table(
  legal_name text,
  document text,
  address text,
  support_email text,
  privacy_email text,
  updated_at timestamptz,
  configured boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    identity.legal_name,
    identity.document,
    identity.address,
    identity.support_email,
    identity.privacy_email,
    identity.updated_at,
    char_length(trim(identity.legal_name)) > 0
      and char_length(trim(identity.document)) > 0
      and char_length(trim(identity.address)) > 0
      and position('@' in identity.support_email) > 1
      and position('@' in identity.privacy_email) > 1
  from private.platform_legal_identity as identity
  where identity.identity_key = true
  limit 1;
$$;

revoke all on function public.admin_get_legal_identity() from public, anon, authenticated;
grant execute on function public.admin_get_legal_identity() to service_role;

create or replace function public.admin_save_legal_identity(
  next_legal_name text,
  next_document text,
  next_address text,
  next_support_email text,
  next_privacy_email text,
  administrator_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_legal_name text := trim(coalesce(next_legal_name, ''));
  normalized_document text := trim(coalesce(next_document, ''));
  normalized_address text := trim(coalesce(next_address, ''));
  normalized_support_email text := lower(trim(coalesce(next_support_email, '')));
  normalized_privacy_email text := lower(trim(coalesce(next_privacy_email, '')));
begin
  if lower(trim(coalesce(administrator_email, ''))) <> 'dansouzafloripa@gmail.com' then
    raise exception 'Acesso negado';
  end if;

  if normalized_legal_name = '' or normalized_document = '' or normalized_address = '' then
    raise exception 'Preencha todos os dados de identificação do fornecedor';
  end if;

  if position('@' in normalized_support_email) <= 1
    or position('@' in normalized_privacy_email) <= 1 then
    raise exception 'Informe e-mails válidos para suporte e privacidade';
  end if;

  insert into private.platform_legal_identity (
    identity_key, legal_name, document, address, support_email, privacy_email, updated_at, updated_by
  ) values (
    true, normalized_legal_name, normalized_document, normalized_address,
    normalized_support_email, normalized_privacy_email, now(), lower(trim(administrator_email))
  ) on conflict (identity_key) do update set
    legal_name = excluded.legal_name,
    document = excluded.document,
    address = excluded.address,
    support_email = excluded.support_email,
    privacy_email = excluded.privacy_email,
    updated_at = now(),
    updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.admin_save_legal_identity(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_save_legal_identity(text, text, text, text, text, text) to service_role;
