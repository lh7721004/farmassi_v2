-- 농가별 배송 일시정지 기간.
--
-- 배송 가능 요일(farms.delivery_days)과는 다른 기능이다. 요일은 평상시
-- 규칙이고, 이건 추석 연휴처럼 특정 기간을 통째로 막는 것이다.
--
-- 기간을 지나면 자동으로 풀려야 하므로 플래그가 아니라 날짜로 둔다.
-- 둘 다 비어 있으면 정지 없음이다.

alter table public.farms
  add column if not exists shipping_pause_start date,
  add column if not exists shipping_pause_end   date,
  add column if not exists shipping_pause_reason text;

alter table public.farms drop constraint if exists farms_shipping_pause_range_check;
alter table public.farms add constraint farms_shipping_pause_range_check
  check (
    (shipping_pause_start is null and shipping_pause_end is null)
    or (shipping_pause_start is not null and shipping_pause_end is not null
        and shipping_pause_end >= shipping_pause_start)
  );

comment on column public.farms.shipping_pause_start is '배송 일시정지 시작일. end 와 함께 비어 있으면 정지 없음.';
