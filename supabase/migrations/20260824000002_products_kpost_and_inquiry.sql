-- 상품 수정 페이지가 쓰는 값들을 DB 가 받도록 넓힌다.
--
-- 화면(ui)에는 이미 들어가 있는데 DB 제약이 막고 있어서 저장이 실패했다.
--
-- 1) 택배 중량에 7·15·25kg 추가
--    우체국 등기소포 요금표는 3 / 3~5 / 5~7 / 7~10 / 10~15 / 15~20 / 20~25 /
--    25~30kg 여덟 구간인데 우리는 다섯 개만 고를 수 있었다. 값은 구간의
--    상한이고, 우체국 창구소포 파일접수양식에 그대로 들어간다.
--
-- 2) 판매상태에 '별도 문의'(inquiry) 추가
--    isProductOrderable 이 on_sale 만 주문 가능으로 보므로, inquiry 는
--    자동으로 주문 불가가 된다. 별도 처리가 필요 없다.

alter table public.products drop constraint if exists products_parcel_weight_kg_check;
alter table public.products add constraint products_parcel_weight_kg_check
  check (parcel_weight_kg = any (array['3','5','7','10','15','20','25','30']));

alter table public.products drop constraint if exists products_sale_status_check;
alter table public.products add constraint products_sale_status_check
  check (sale_status = any (array['on_sale','coming_soon','sold_out','hidden','inquiry']));
