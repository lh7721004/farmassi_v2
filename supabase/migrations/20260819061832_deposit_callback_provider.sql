alter table public.deposit_transactions
  drop constraint if exists deposit_transactions_provider_check;

alter table public.deposit_transactions
  add constraint deposit_transactions_provider_check
  check (provider in ('manual', 'gnd', 'hecto', 'banksalad', 'codef', 'callback'));
