-- farms.bankda_merchant_email 제거.
--
-- farms 는 손님도 읽는 테이블이고 화면이 select('*') 로 통째로 가져간다.
-- 그래서 내부 식별자인 가맹점 이메일이 비로그인 사용자에게도 노출됐다.
-- 같은 값이 private.bankda_merchant 에 이미 있으므로 그쪽만 남긴다.
alter table public.farms drop column if exists bankda_merchant_email;
