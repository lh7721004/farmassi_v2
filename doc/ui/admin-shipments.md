# 송장 — `/admin/shipments`

발송할 주문을 농가별로 묶어 본다. 농가별 배송 일시정지를 함께 표시한다.

엑셀을 내려받으면 `입금완료` 주문이 `송장 발급 완료`(`packing`)로 넘어간다.
받아 놓고 접수하지 않은 건과 구분하기 위해서다.

여기서 [배송이력 관리](admin-shipping-history.md)로 들어간다.

---

구현: `src/pages/admin/Shipments.tsx` · 경로: `/admin/shipments`
