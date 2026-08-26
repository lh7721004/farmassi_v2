# 배송 이력 조회

`POST /query` 로 [shipping_history](../../../database/shipping_history.md) 와
[shipping_history_products](../../../database/shipping_history_products.md) 를 읽는다.

한 달치를 한 번에 가져와 화면에서 날짜별로 쪼갠다. `팜어시` 채널은 저장된 값이
없으면 주문에서 자동으로 센 값을 채워 넣는다.

품목은 이름으로 저장돼 있어서, 불러올 때 **이름 → 상품 id** 로 다시 맞춘다.
상품이 지워져도 이력은 남아야 하기 때문에 이름을 값으로 저장한다.

## 관련 파일

- [`src/lib/shippingHistory.ts`](../../../../src/lib/shippingHistory.ts)
