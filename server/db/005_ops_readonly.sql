-- 로컬 관리자 웹(server/ops)이 쓰는 읽기 전용 롤.
--
-- 조회 전용 도구라 쓰기 권한을 주지 않는다. 오타 하나로 운영 데이터가
-- 바뀌는 일을 롤 수준에서 막는 것이 목적이고, 도구 쪽에서도 모든 질의를
-- READ ONLY 트랜잭션으로 감싼다(이중 방어).
--
-- BYPASSRLS 를 준다. RLS 정책이 auth.uid() 기준이라 익명 접속으로는 orders 같은
-- 테이블이 0 건으로 보여 조회 도구로서 쓸모가 없다. 읽기 전용이라 우회를 허용해도
-- 데이터가 바뀌지는 않는다. (BYPASSRLS 는 롤 멤버십으로 상속되지 않아 직접 준다)

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ops_ro') then
    create role ops_ro login bypassrls;
  end if;
end $$;

alter role ops_ro bypassrls;

grant connect on database farmassi to ops_ro;

grant usage on schema public, auth, private to ops_ro;
grant select on all tables in schema public, auth, private to ops_ro;

-- 앞으로 만들어질 테이블에도 자동으로 붙게 한다.
alter default privileges in schema public  grant select on tables to ops_ro;
alter default privileges in schema auth    grant select on tables to ops_ro;
alter default privileges in schema private grant select on tables to ops_ro;
