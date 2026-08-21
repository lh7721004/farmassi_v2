-- 가맹점 비밀번호는 공개 테이블에 두지 않는다.
create table if not exists private.bankda_merchant (
  farm_id    uuid primary key references public.farms (id) on delete cascade,
  email      text not null unique,
  password   text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on private.bankda_merchant to service_role;
