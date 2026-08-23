-- 농가별 배송가능 요일.
--
-- 0=일 … 6=토 로, JS 의 Date.getDay() 와 같은 번호를 쓴다. 화면에서 변환 없이
-- 그대로 비교하기 위해서다.
--
-- 빈 배열은 '아직 설정하지 않음' 이지 '배송 안 함' 이 아니다. 기존 농가 7곳이
-- 전부 빈 값으로 시작하는데, 이걸 '배송 불가' 로 읽으면 멀쩡한 농가의 주문
-- 페이지에 배송일이 사라진다. 설정한 농가만 예상 배송일을 보여준다.

alter table public.farms
  add column if not exists delivery_days smallint[] not null default '{}';

alter table public.farms
  drop constraint if exists farms_delivery_days_check;

alter table public.farms
  add constraint farms_delivery_days_check
  check (
    delivery_days <@ array[0,1,2,3,4,5,6]::smallint[]
    and array_length(delivery_days, 1) is distinct from 0
  );

comment on column public.farms.delivery_days is
  '배송 가능 요일 (0=일 … 6=토). 빈 배열이면 설정 안 함.';
