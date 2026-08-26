# `POST /rpc/create-order` — 주문 생성

주문과 품목을 한 트랜잭션으로 만든다.

**금액을 프론트가 보낸 값으로 믿지 않는다.** 상품 가격과 배송비 구간표를 DB 에서
다시 읽어 서버가 계산한다. 프론트 값을 그대로 쓰면 값을 바꿔 보낼 수 있다.

배송비는 [products](../../../database/products.md) 의 `shipping_fees` 구간표에서
뽑는다. `qty` 는 '이 수량까지' 이고, 마지막 구간을 넘으면 마지막 구간이 되풀이된다.
계산은 `server-py/app/shared/shipping_fee.py` 에 있고 프론트의
`src/lib/shippingFee.ts` 와 같은 규칙이다.

`deposit_due_amount` 는 **손님이 실제로 보낼 금액**으로 넣는다. 자동 대사가 이
값을 기준으로 맞추기 때문에 여기가 틀리면 입금이 안 붙는다.

주문이 만들어지면 농가에 알림을 쌓는다. [notifications](../../notifications/command/send-push.md) 참고.

구현: `server-py/app/functions/create_order.py`
