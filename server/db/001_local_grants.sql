-- Supabase 는 테이블 권한을 자동으로 준다. 로컬에선 직접 준다.
-- RLS 는 이 권한 위에서 다시 한 번 행을 거른다. 권한이 없으면 정책 이전에 막힌다.

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, service_role;

grant select, insert, update, delete on auth.users, auth.identities to service_role;

-- 앞으로 만들어질 테이블에도 같은 권한이 붙도록.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant select on tables to anon;
