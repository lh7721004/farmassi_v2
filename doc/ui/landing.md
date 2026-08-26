# 랜딩 — `/`

농가 목록. 서비스에 들어오면 처음 보는 화면이다.

`is_active=true AND is_listed=true` 인 농가만 싣는다. `is_listed=false` 는 목록에서만
빠지고 `slug` 주소로는 열린다 — 시험용 농가를 링크로만 열어 두려는 것이다.
운영에서 바람들녘·하늘농원이 목록에 없는 이유가 이것이다.

검색은 서버가 아니라 화면에서 거른다. 농가 수가 적어 전부 받아 두고 걸러도 된다.

관련: [farms 테이블](../database/farms.md) · [farms/read/farm-list](../backend/farms/read/farm-list.md)

---

구현: `src/pages/Landing.tsx` · 경로: `/`
