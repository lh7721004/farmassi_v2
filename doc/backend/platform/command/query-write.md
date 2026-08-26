# `POST /query` — 쓰기 (insert · upsert · update · delete)

조회와 같은 엔드포인트에 `op` 만 다르다.

**jsonb 컬럼은 문자열로 만들어 보낸다.** 이것이 실제로 사고가 났던 지점이다.
JS 배열을 그대로 넘기면 드라이버가 PostgreSQL 배열 리터럴(`{a,b}`)로 바꾸는데,
jsonb 컬럼은 그걸 받지 못하고 `invalid input syntax for type json` 을 낸다.
그래서 기동할 때 json/jsonb 컬럼 목록을 캐시에 담아 두고, 바인딩할 때 해당
컬럼이면 JSON 문자열로 만든다.

`date` 컬럼은 `'YYYY-MM-DD'` 문자열로 통일한다. asyncpg 는 `date` 객체를
원하고 예전 Node 드라이버는 JS `Date` 를 주던 자리라, 문자열로 못 박아 두는
편이 헷갈리지 않는다.

## 관련 파일

- [`server-py/app/query.py`](../../../../server-py/app/query.py)
- [`server-py/app/schema.py`](../../../../server-py/app/schema.py)
