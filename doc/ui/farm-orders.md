# 농가 주문

농가가 자기 주문을 본다. RLS `private.is_farm_member()` 가 범위를 가른다.

상태 라벨: `입금대기` → `입금완료` → `송장 발급 완료` → `발송` → `완료`.

## 관련 파일

- [`src/pages/farm/Orders.tsx`](../../src/pages/farm/Orders.tsx)
- [`src/lib/orderStatus.ts`](../../src/lib/orderStatus.ts)
- 라우트: [`src/App.tsx`](../../src/App.tsx)
