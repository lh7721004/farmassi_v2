-- 운영·개발 DB 를 권한으로 갈라놓는다.
--
-- 물리적으로는 farmassi / farmassi_dev 로 나뉘어 있었지만, PostgreSQL 이
-- 새 DB 의 CONNECT 를 PUBLIC 에 열어 두기 때문에 farmassi_dev_* 롤로도
-- 운영 DB 에 그대로 붙었다. 실제로 dev 롤로 운영 주문 13건이 읽혔다.
--
-- 즉 분리가 접속 문자열 한 줄에만 기대고 있었다. .env 를 잘못 적으면 개발
-- 서버가 조용히 운영 데이터를 읽고 쓰게 된다 — 오류도 없이, 마스킹된 줄
-- 알고 실명을 다루게 된다.
--
-- PUBLIC 의 CONNECT 를 걷고 각 DB 의 짝 롤에만 준다. lkim(소유자)과 postgres 는
-- 소유자·수퍼유저라 회수와 무관하게 붙는다.
--
-- 주의: 부여 대상을 빠뜨리면 그 서비스가 재접속에 실패한다. 기존 연결은
-- 끊기지 않고 재접속부터 적용된다.

-- 이 파일은 DB 마다 다른 내용을 실행해야 하므로 apply.sh 가 아니라
-- 손으로 각 DB 에 맞춰 돌린다. 아래는 운영(farmassi) 기준이다.

revoke connect on database farmassi from public;
grant  connect on database farmassi to farmassi_app, farmassi_admin, ops_ro, jpark, jpark_ro;

-- farmassi_dev 에서는 아래를 대신 실행한다:
--   revoke connect on database farmassi_dev from public;
--   grant  connect on database farmassi_dev to farmassi_dev_app, farmassi_dev_admin, ops_ro;
