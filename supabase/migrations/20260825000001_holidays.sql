-- 공휴일. 예상 배송일을 셀 때 일요일과 함께 건너뛴다.
--
-- 한국천문연구원 특일 정보 API 로 채울 예정이라 출처를 남길 수 있게 해 둔다.
-- API 가 붙기 전에도 동작해야 하므로 2026년치를 미리 넣는다.

create table if not exists public.holidays (
  holiday_date date primary key,
  name         text not null,
  source       text not null default 'seed',
  created_at   timestamptz not null default now()
);

alter table public.holidays enable row level security;
drop policy if exists holidays_select on public.holidays;
create policy holidays_select on public.holidays for select using (true);
grant select on public.holidays to anon, authenticated;

insert into public.holidays (holiday_date, name) values
  ('2026-01-01','신정'),
  ('2026-02-16','설날 연휴'), ('2026-02-17','설날'), ('2026-02-18','설날 연휴'),
  ('2026-03-01','삼일절'), ('2026-03-02','삼일절 대체휴일'),
  ('2026-05-05','어린이날'), ('2026-05-24','부처님오신날'), ('2026-05-25','부처님오신날 대체휴일'),
  ('2026-06-06','현충일'),
  ('2026-08-15','광복절'), ('2026-08-17','광복절 대체휴일'),
  ('2026-09-24','추석 연휴'), ('2026-09-25','추석'), ('2026-09-26','추석 연휴'),
  ('2026-10-03','개천절'), ('2026-10-05','개천절 대체휴일'),
  ('2026-10-09','한글날'),
  ('2026-12-25','성탄절')
on conflict (holiday_date) do nothing;
