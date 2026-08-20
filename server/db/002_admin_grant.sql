-- 이름으로 관리자를 한 번만 자동 승격한다.
--
-- 박지훈(또는 '지훈' 이 들어간 이름)이 카카오로 처음 로그인하면 그 사람만 관리자가 된다.
-- 이미 한 번 부여되면 같은 이름의 다른 사람이 나중에 들어와도 승격되지 않는다.
-- 로컬 운영용이라 supabase/migrations 가 아니라 여기에 둔다.

create table if not exists private.admin_auto_grant (
  pattern         text primary key,
  granted_user_id uuid,
  granted_name    text,
  granted_at      timestamptz
);

insert into private.admin_auto_grant (pattern) values ('지훈')
  on conflict (pattern) do nothing;

create or replace function private.auto_grant_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  if new.display_name is null or new.role = 'admin' then
    return new;
  end if;

  -- 아직 아무에게도 부여되지 않은 패턴만 집어간다.
  -- 조건을 update 안에 두어서, 동시에 두 명이 들어와도 한 명만 가져간다.
  update private.admin_auto_grant
     set granted_user_id = new.id,
         granted_name    = new.display_name,
         granted_at      = now()
   where granted_user_id is null
     and new.display_name like '%' || pattern || '%';

  get diagnostics claimed = row_count;
  if claimed > 0 then
    new.role := 'admin';
  end if;

  return new;
end;
$$;

-- profiles 는 auth.users 트리거가 만든다. 그 시점에 이름이 이미 들어있다.
drop trigger if exists profiles_auto_admin on public.profiles;
create trigger profiles_auto_admin
  before insert on public.profiles
  for each row execute function private.auto_grant_admin();
