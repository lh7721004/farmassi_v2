-- 뱅크다A 입금내역 연동
-- provider 목록에 bankda 를 추가하고, 같은 거래를 두 번 넣지 않도록 외부 거래번호를 붙인다.

alter table public.deposit_transactions
  drop constraint if exists deposit_transactions_provider_check;

alter table public.deposit_transactions
  add constraint deposit_transactions_provider_check
  check (provider in ('manual', 'gnd', 'hecto', 'banksalad', 'codef', 'bankda'));

-- 뱅크다의 bkcode(거래내역 고유번호). 스크래핑은 같은 구간을 반복 조회하므로
-- 이 값으로 중복을 막지 않으면 폴링할 때마다 같은 입금이 쌓인다.
alter table public.deposit_transactions
  add column if not exists external_id text;

create unique index if not exists deposit_transactions_provider_external_id_key
  on public.deposit_transactions (provider, external_id)
  where external_id is not null;
