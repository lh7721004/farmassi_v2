-- 배송 일시정지를 별도 테이블로 옮긴다.
--
-- farms 에 컬럼 한 벌로 두면 관리자와 농가가 각각 건 정지가 서로를 덮어쓴다.
-- 요청은 둘을 합치는 것이다 — 관리자 8/15~8/17 + 농가 8/16~8/19 이면 그 농가는
-- 8/15~8/19 정지. 행으로 쌓아 두면 합집합이 자연스럽게 나온다.

create table if not exists public.shipping_pauses (
  id         uuid primary key default gen_random_uuid(),
  farm_id    uuid not null references public.farms(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  reason     text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint shipping_pauses_range_check check (end_date >= start_date)
);

create index if not exists shipping_pauses_farm_idx
  on public.shipping_pauses (farm_id, start_date, end_date);

-- 기존 farms 컬럼에 남아 있던 값을 옮긴다.
insert into public.shipping_pauses (farm_id, start_date, end_date, reason)
select id, shipping_pause_start, shipping_pause_end, shipping_pause_reason
from public.farms
where shipping_pause_start is not null and shipping_pause_end is not null;

alter table public.farms
  drop column if exists shipping_pause_start,
  drop column if exists shipping_pause_end,
  drop column if exists shipping_pause_reason;

alter table public.shipping_pauses enable row level security;

-- 손님도 봐야 한다. 주문 페이지에 언제까지 못 보내는지 알려야 하기 때문이다.
drop policy if exists shipping_pauses_select on public.shipping_pauses;
create policy shipping_pauses_select on public.shipping_pauses for select using (true);

-- 거는 것은 관리자와 그 농가 구성원만.
drop policy if exists shipping_pauses_write on public.shipping_pauses;
create policy shipping_pauses_write on public.shipping_pauses for all
  using (private.is_admin() or private.is_farm_member(farm_id))
  with check (private.is_admin() or private.is_farm_member(farm_id));

grant select on public.shipping_pauses to anon, authenticated;
grant insert, update, delete on public.shipping_pauses to authenticated;
