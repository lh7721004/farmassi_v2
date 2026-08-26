# 주문 목록 조회

전용 엔드포인트가 없다. `POST /query` 로 `orders` 를 읽고, 누가 무엇을 보는지는
RLS 가 가른다.

- 손님 — 자기 주문만
- 농가 — `private.is_farm_member()` 가 참인 농가의 주문
- 관리자 — 전부

품목은 `select` 에 `order_items(*)` 를 중첩해 함께 가져온다.

관련: [platform/read/query-select](../../platform/read/query-select.md) · [orders 테이블](../../../database/orders.md)
