# 주문 완료 — `/me/orders/:orderId/complete`

입금 안내 화면. 무통장입금이라 여기가 결제의 끝이 아니라 시작이다.

농가 계좌와 **보낼 금액(`deposit_due_amount`)**, 입금자명을 보여 준다. 이 금액이
자동 대사의 기준이라 손님이 정확히 그 금액을 보내야 자동으로 붙는다.

계좌 복사 화면([account-copy](account-copy.md))으로 이어진다.

## 관련 파일

- [`src/pages/order/OrderComplete.tsx`](../../src/pages/order/OrderComplete.tsx)
- [`src/components/shared/DepositGuide.tsx`](../../src/components/shared/DepositGuide.tsx)
- 라우트: [`src/App.tsx`](../../src/App.tsx)
