-- Supabase 호환 껍데기.
--
-- 목적: supabase/migrations 의 SQL 을 한 줄도 고치지 않고 로컬 Postgres 에서 그대로 돌린다.
-- 마이그레이션이 기대하는 것은 auth.users 테이블과 auth.uid() / auth.jwt() 뿐이다.
--
-- RLS 정책 24개는 그대로 살려둔다. API 가 요청마다
--   set_config('request.jwt.claim.sub', <사용자 id>, true)
-- 를 걸고 farmassi_app 역할로 접속하면, Supabase 에서 쓰던 인가 규칙이 그대로 적용된다.
-- 정책을 자바스크립트로 다시 구현하지 않기 위한 선택이다.

-- 마이그레이션이 스키마 소유자를 postgres 로 지정한다. Homebrew Postgres 에는 없는 역할이라 만들어 준다.
-- Supabase 가 기본으로 갖고 있는 역할들. 마이그레이션의 grant 문이 이 이름들을 참조한다.
--   anon          : 비로그인
--   authenticated : 로그인 사용자 (RLS 적용)
--   service_role  : 서버 내부 작업 (RLS 우회)
do $$
declare r text;
begin
  if not exists (select 1 from pg_roles where rolname = 'postgres') then
    create role postgres superuser login;
  end if;
  foreach r in array array['anon', 'authenticated'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;

  -- API 가 실제로 접속하는 두 역할.
  if not exists (select 1 from pg_roles where rolname = 'farmassi_app') then
    create role farmassi_app login in role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'farmassi_admin') then
    create role farmassi_admin login in role service_role;
  end if;
  -- BYPASSRLS 는 역할 속성이라 멤버십으로 상속되지 않는다. 직접 줘야 한다.
  alter role farmassi_admin bypassrls;
end $$;

create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists private;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 카카오 로그인 식별자. 같은 사람이 다시 로그인하면 여기서 찾는다.
create table if not exists auth.identities (
  provider text not null,
  provider_user_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, provider_user_id)
);

-- 요청 컨텍스트에서 현재 사용자를 읽는다. 없으면 null (= 비로그인).
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create or replace function auth.role() returns text
language sql stable
as $$ select coalesce(auth.jwt() ->> 'role', 'anon') $$;

-- 마이그레이션이 테이블을 이 퍼블리케이션에 추가한다. 로컬에선 실제 realtime 을 쓰지 않지만,
-- 문장이 통과해야 하므로 빈 퍼블리케이션을 만들어 둔다.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
