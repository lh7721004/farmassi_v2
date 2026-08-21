-- 뱅크다 가맹점 연결.
--
-- 뱅크다에서 계좌는 가맹점 아래에 붙는다. 농가별로 입금내역을 분리하려면
-- 농가마다 가맹점이 하나씩 있어야 한다. 그 가맹점 이메일을 여기 둔다.
alter table public.farms
  add column if not exists bankda_merchant_email text;

comment on column public.farms.bankda_merchant_email is
  '뱅크다 가맹점 이메일. 계좌 등록 링크(OTT) 발급에 쓴다.';
