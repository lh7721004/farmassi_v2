# 농가 스토어 — `/farm/:farmSlug`

한 농가의 상품 목록. 손님이 실제로 주문을 시작하는 화면이다.

**예상 배송일정**이 여기 붙는다. 농가의 배송 가능 요일, 배송 일시정지, 공휴일,
17시 주문 마감을 모두 보고 계산한다.

```
예상 배송일정 9월 2일(수)
월, 화 출고 · 8월 31일(월) 출고 예정
"사유"로 인해 "8월 26일 ~ 8월 28일" 배송이 불가능합니다
```

정지 중이어도 출고 예정 줄을 보여 준다. 정지가 끝나는 날을 알고 있으니 언제 나갈지
계산이 되고, 손님이 알고 싶은 것도 그것이다. 다만 정지 중에는 마감 안내를 띄우지
않는다 — 마감과 무관하게 밀리는 상황이라 '17시 전에 결제하면 내일 출발' 이 사실이
아니게 된다.

할인은 [products](../database/products.md) 의 `list_price` 가 `price` 보다 클 때만
취소선으로 보인다.

관련: [`src/lib/deliveryEstimate.ts`](../../src/lib/deliveryEstimate.ts) · [`src/lib/useShippingSchedule.ts`](../../src/lib/useShippingSchedule.ts) · [`src/components/shared/ShippingScheduleNotice.tsx`](../../src/components/shared/ShippingScheduleNotice.tsx)

## 관련 파일

- [`src/pages/order/FarmStore.tsx`](../../src/pages/order/FarmStore.tsx)
- [`src/lib/deliveryEstimate.ts`](../../src/lib/deliveryEstimate.ts)
- [`src/lib/useShippingSchedule.ts`](../../src/lib/useShippingSchedule.ts)
- [`src/components/shared/ShippingScheduleNotice.tsx`](../../src/components/shared/ShippingScheduleNotice.tsx)
- 라우트: [`src/App.tsx`](../../src/App.tsx)
