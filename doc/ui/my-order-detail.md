# 주문 상세 — `/me/orders/:orderId`

품목, 금액, 배송비, 입금 상태, 배송지를 보여 준다.

품목 이름과 가격은 [order_items](../database/order_items.md) 에 값으로 남아 있어서,
상품이 바뀌어도 주문 당시 내용이 그대로 보인다.

---

구현: `src/pages/me/MyOrderDetail.tsx` · 경로: `/me/orders/:orderId`
