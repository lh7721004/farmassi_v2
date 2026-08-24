-- 주문에 입금자명과 보내는 분.
--
-- 지금은 자동 대사가 6자리 입금코드와 수령인 이름으로만 맞춘다. "김철수로
-- 주문하고 고길동이 입금" 같은 건이 자동으로 안 붙는 이유가 이것이다.
-- 손님이 직접 적은 입금자명이 있으면 대사 정확도가 올라간다.
--
-- 보내는 분은 선물 배송을 위한 것이다. 이름·연락처만 필수로 받고 주소는
-- 선택이라 전부 nullable 로 둔다.

alter table public.orders
  add column if not exists depositor_name text,
  add column if not exists sender_name    text,
  add column if not exists sender_phone   text,
  add column if not exists sender_address text;

comment on column public.orders.depositor_name is '손님이 적은 입금자명. 자동 대사의 후보로 쓴다.';
comment on column public.orders.sender_name    is '보내는 분 이름 (선택).';
comment on column public.orders.sender_phone   is '보내는 분 연락처.';
comment on column public.orders.sender_address is '보내는 분 주소 (선택).';
