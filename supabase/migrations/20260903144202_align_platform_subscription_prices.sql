-- Platform subscription prices, separate from each professional's PIX receipts.
-- Defaults for newly created configuration records only.
-- No UPDATE: existing settings, prices, subscriptions and agreements are untouched.
alter table private.integration_settings
  alter column monthly_price set default 35.00,
  alter column annual_price set default 350.00;
