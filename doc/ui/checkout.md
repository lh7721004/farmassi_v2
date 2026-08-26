# 주문서 — `/farm/:farmSlug/checkout`

받는 분, 보내는 분, 입금자명, 요청사항을 받아 주문을 만든다. 로그인이 필요하다.

**금액은 화면이 계산한 값을 믿지 않는다.** 서버가 상품 가격과 배송비 구간표를
다시 읽어 계산한다. [create-order](../backend/orders/command/create-order.md) 참고.

배송비는 수량 구간표를 따른다. 2박스를 시켜도 배송비가 두 배가 되지 않는다 —
우체국 요금이 그렇게 붙지 않기 때문이다.

'보내는 분' 이 '받는 분' 과 다를 수 있어 따로 받는다. 선물로 보내는 경우가 있다.

주소는 [naver-address](../backend/address/read/naver-address.md) 로 찾는다.
저장해 둔 주소는 [saved_addresses](../database/saved_addresses.md) 에서 불러온다.

관련: [orders 테이블](../database/orders.md)

---

구현: `src/pages/order/Checkout.tsx` · 경로: `/farm/:farmSlug/checkout`
