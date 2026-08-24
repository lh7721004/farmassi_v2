-- 주문 물량 한도 (경고용).
--
-- 세 종류:
--   farms.daily_qty_limit          — 농가 일일 전체
--   products.daily_qty_limit       — 상품 일일
--   products.per_order_qty_limit   — 1회 주문 시 상품당
--
-- 기본값 100. 넘어도 주문은 받는다. 화면에서 빨간 안내·모달만 띄운다.
-- 일일 경계는 서울 자정 (배송 일시정지·주문번호와 동일).

alter table public.farms
  add column if not exists daily_qty_limit integer not null default 100;

alter table public.farms
  drop constraint if exists farms_daily_qty_limit_check;

alter table public.farms
  add constraint farms_daily_qty_limit_check
  check (daily_qty_limit >= 1);

alter table public.products
  add column if not exists daily_qty_limit integer not null default 100;

alter table public.products
  add column if not exists per_order_qty_limit integer not null default 100;

alter table public.products
  drop constraint if exists products_daily_qty_limit_check;

alter table public.products
  add constraint products_daily_qty_limit_check
  check (daily_qty_limit >= 1);

alter table public.products
  drop constraint if exists products_per_order_qty_limit_check;

alter table public.products
  add constraint products_per_order_qty_limit_check
  check (per_order_qty_limit >= 1);

comment on column public.farms.daily_qty_limit is
  '농가 일일 주문 수량 한도. 넘어도 주문은 받고 화면 경고만 한다.';
comment on column public.products.daily_qty_limit is
  '상품 일일 주문 수량 한도. 넘어도 주문은 받고 화면 경고만 한다.';
comment on column public.products.per_order_qty_limit is
  '1회 주문에서 이 상품을 담을 수 있는 한도. 넘어도 주문은 받고 화면 경고만 한다.';
