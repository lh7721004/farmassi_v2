-- 상품 할인 표시.
--
-- price 는 그대로 '실제로 받는 금액' 으로 둔다. 주문 금액 계산이 전부
-- product.price 를 쓰고 있어서(서버 createOrder 포함), 여기에 할인 개념을
-- 끼워 넣으면 한 군데만 놓쳐도 손님에게 잘못된 금액이 청구된다.
--
-- 대신 표시용 '원래 가격' 을 더한다. list_price 가 price 보다 클 때만
-- 화면에서 취소선으로 보여준다. 서버는 손댈 필요가 없다.

alter table public.products
  add column if not exists list_price integer;

alter table public.products
  drop constraint if exists products_list_price_check;

alter table public.products
  add constraint products_list_price_check
  check (list_price is null or list_price >= 0);

comment on column public.products.list_price is
  '할인 전 원래 가격. price 보다 클 때만 취소선으로 표시한다. null 이면 할인 없음.';
