# 농가 목록·상세 조회

`POST /query` 로 [farms](../../../database/farms.md) 를 읽는다.

랜딩 목록은 `is_active=true AND is_listed=true` 로 거른다. `is_listed=false` 인
농가는 목록에서만 빠지고 `slug` 주소로는 그대로 열린다 — 시험용 농가를 링크로만
열어 두려고 나눈 것이다.

상세는 `slug` 로 찾는다.
