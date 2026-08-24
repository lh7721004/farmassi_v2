-- deposit_transactions.provider 목록에서 빠진 'bankda' 를 되살린다.
--
-- 20260819061832 이 'callback' 을 넣으면서 'bankda' 를 목록에서 빼먹었다.
-- 뱅크다 스크래핑이 넣는 값이 그것이라(scrape_deposits.PROVIDER='bankda'),
-- 그대로 적용하면 기존 6건이 제약을 위반해 마이그레이션 자체가 실패하고,
-- 통과했더라도 자동 입금 확인이 전부 막혔을 것이다.
--
-- 두 값을 모두 허용한다.

alter table public.deposit_transactions
  drop constraint if exists deposit_transactions_provider_check;

alter table public.deposit_transactions
  add constraint deposit_transactions_provider_check
  check (provider in ('manual', 'gnd', 'hecto', 'banksalad', 'codef', 'bankda', 'callback'));
