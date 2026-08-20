-- 목록에는 안 뜨지만 주소로는 들어갈 수 있는 농가.
--
-- is_active 를 끄면 랜딩·주문 화면까지 막힌다. 시험용 농가는 링크로는 열려야 해서
-- 노출 여부를 따로 둔다.
alter table public.farms
  add column if not exists is_listed boolean not null default true;

comment on column public.farms.is_listed is
  '메인 농가 목록 노출 여부. false 여도 slug 주소로는 접속된다.';
