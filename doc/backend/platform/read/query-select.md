# `POST /query` — 조회

프론트가 `supabase.from('orders').select('*').eq(...)` 형태로 부르면 이 엔드포인트로
온다. 몸통은 `{table, op:'select', select, filters, order, range}` 다.

Supabase 를 걷어내면서 **프론트 호출부를 한 줄도 고치지 않으려고** 문법을 그대로
흉내냈다. 화면 20여 곳이 그 문법으로 쓰여 있었다.

`select` 문자열은 `parse_select()` 가 파싱해 조인까지 만든다.
`products(name, price)` 같은 중첩 표기를 지원한다.

지원하는 필터: `eq` `neq` `gt` `gte` `lt` `lte` `like` `ilike` `is` `in`.

**권한은 여기서 보지 않는다.** DB 의 RLS 가 본다. 요청자의 id 를
`request.jwt.claim.sub` 로 세션에 심고, 정책이 그것을 읽는다. 어느 화면에서
불러도 같은 규칙이 적용된다.

구현: `server-py/app/query.py`
