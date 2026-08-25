-- 배송비를 상품가에서 떼어낸다.
--
-- 지금은 상품가에 배송비가 포함돼 있어서, 2박스를 시키면 배송비도 두 배가
-- 된다. 실제 우체국 요금은 1box 5,000 / 2box 7,000 / 3box 8,000 처럼 수량이
-- 늘어도 비례하지 않는다.
--
-- 상품마다 수량 구간별 배송비를 두고, 주문할 때 그 표를 보고 계산한다.
--   [{"qty": 1, "fee": 5000}, {"qty": 2, "fee": 7000}, {"qty": 3, "fee": 8000}]
-- qty 는 '이 수량까지' 를 뜻한다. 빈 배열이면 배송비 0 — 지금까지처럼
-- 상품가에 포함된 것으로 본다. 기존 상품이 그대로 동작해야 하기 때문이다.

alter table public.products
  add column if not exists shipping_fees jsonb not null default '[]'::jsonb;

alter table public.products drop constraint if exists products_shipping_fees_check;
alter table public.products add constraint products_shipping_fees_check
  check (jsonb_typeof(shipping_fees) = 'array');

comment on column public.products.shipping_fees is
  '수량 구간별 배송비 [{qty, fee}]. qty 는 이 수량까지. 빈 배열이면 상품가에 포함(0원).';

-- 주문에 배송비를 따로 남긴다. total_amount 는 상품가+배송비 합계다.
-- deposit_due_amount 가 자동 대사의 기준이라 손님이 실제로 보낼 금액이어야 한다.
alter table public.orders
  add column if not exists shipping_fee integer not null default 0;

comment on column public.orders.shipping_fee is
  '주문 전체 배송비. total_amount 에 이미 포함돼 있다.';

alter table public.order_items
  add column if not exists shipping_fee integer not null default 0;

comment on column public.order_items.shipping_fee is
  '이 상품 줄의 배송비. 수량 구간표에서 뽑는다.';
