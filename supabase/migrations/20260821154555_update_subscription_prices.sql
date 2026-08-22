alter table private.integration_settings
  alter column monthly_price set default 20.00,
  alter column annual_price set default 350.00;

update private.integration_settings
set monthly_price = 20.00,
    annual_price = 350.00,
    updated_at = now()
where provider = 'mercado_pago'
  and monthly_price = 49.90
  and annual_price = 478.80;
