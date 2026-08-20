-- 뱅크다가 각 계좌를 마지막으로 긁어간 시각을 기억한다.
-- 이 값이 바뀌었을 때만 거래내역을 가져온다. 서버를 재시작해도 유지되도록 DB 에 둔다.
create table if not exists private.bankda_scrape_state (
  account_number   text primary key,
  last_scraping_at text,
  checked_at       timestamptz not null default now()
);
grant select, insert, update on private.bankda_scrape_state to service_role;
