# 농가 관리 — `/admin/farms`

농가 목록과 상세. 상세 안에 농가 작업공간(상품·주문·배송·설정)이 탭으로 들어 있다.

**권한 구조 메모** — admin 페이지 안에 농가 페이지가 들어 있는 형태다. 디스코드에
문의가 올라와 있고 아직 정리 전이다.

`delivery_days` 는 최소 하나를 골라야 저장된다. 비워 두면 예상 배송일을 계산할 수
없기 때문이다.

관련: [farms 테이블](../database/farms.md) · [farm-update](../backend/farms/command/farm-update.md)

---

구현: `src/pages/admin/Farms.tsx` · 경로: `/admin/farms · /admin/farms/:farmId`
