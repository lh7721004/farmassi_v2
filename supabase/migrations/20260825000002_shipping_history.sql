-- 배송 이력 관리.
--
-- 송장을 대신 접수한 건을 농가별·날짜별로 적어 정산하는 표다. 건당 500원으로
-- 월 합계를 낸다. 요청자가 "훼손되면 곤란"하다고 못박은 데이터라 지우지 않고
-- 쌓기만 한다.
--
-- 한 칸(cell) = (날짜, 농가, 채널). 채널은 직접연락 / 카톡 비즈니스 / 팜어시.
-- 팜어시는 사이트 주문이라 자동 집계지만, 손으로 고칠 수 있어야 해서 같은
-- 테이블에 둔다.

create table if not exists public.shipping_history (
  id           uuid primary key default gen_random_uuid(),
  entry_date   date not null,
  farm_id      uuid not null references public.farms(id) on delete restrict,
  channel      text not null,
  count        integer not null default 0,
  -- 우체국 접수번호. 쉼표·공백으로 여러 개를 적을 수 있어 원문 그대로 둔다.
  receipt_text text,
  updated_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint shipping_history_channel_check
    check (channel in ('직접연락', '카톡 비즈니스', '팜어시')),
  constraint shipping_history_count_check check (count >= 0),
  constraint shipping_history_unique unique (entry_date, farm_id, channel)
);

-- 그날 그 농가에서 무엇이 몇 개 팔렸는지. 합계는 송장 건수를 넘을 수 없다는
-- 규칙이 있지만, 사람이 맞춰 넣는 값이라 DB 에서 강제하지 않는다.
create table if not exists public.shipping_history_products (
  id          uuid primary key default gen_random_uuid(),
  entry_date  date not null,
  farm_id     uuid not null references public.farms(id) on delete restrict,
  -- 상품이 지워져도 이력은 남아야 하므로 이름을 함께 박아 둔다.
  product_id  uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint shipping_history_products_qty_check check (quantity >= 0),
  constraint shipping_history_products_unique unique (entry_date, farm_id, product_name)
);

create index if not exists shipping_history_month_idx
  on public.shipping_history (entry_date, farm_id);
create index if not exists shipping_history_products_month_idx
  on public.shipping_history_products (entry_date, farm_id);

drop trigger if exists shipping_history_updated_at on public.shipping_history;
create trigger shipping_history_updated_at before update on public.shipping_history
  for each row execute function private.set_updated_at();

drop trigger if exists shipping_history_products_updated_at on public.shipping_history_products;
create trigger shipping_history_products_updated_at before update on public.shipping_history_products
  for each row execute function private.set_updated_at();

alter table public.shipping_history enable row level security;
alter table public.shipping_history_products enable row level security;

-- 정산용 내부 자료다. 관리자만 본다.
drop policy if exists shipping_history_admin on public.shipping_history;
create policy shipping_history_admin on public.shipping_history for all
  using (private.is_admin()) with check (private.is_admin());

drop policy if exists shipping_history_products_admin on public.shipping_history_products;
create policy shipping_history_products_admin on public.shipping_history_products for all
  using (private.is_admin()) with check (private.is_admin());

grant select, insert, update, delete
  on public.shipping_history, public.shipping_history_products to authenticated;
