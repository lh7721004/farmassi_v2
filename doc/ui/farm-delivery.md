# 농가 배송 설정

배송 가능 요일과 일시정지를 정한다.

요일은 **최소 하나**를 골라야 한다. 비우면 예상 배송일을 계산할 수 없다.

일시정지는 행으로 쌓인다. 관리자와 농가가 각각 걸 수 있고 겹쳐도 자연스럽게
합쳐진다.

관련: [shipping_pauses](../database/shipping_pauses.md)

---

구현: `src/pages/farm/Delivery.tsx` · 경로: `/admin/farms/:farmId/delivery`
