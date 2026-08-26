# 농가 상품 관리

상품을 올리고 고친다. `ProductManager` 컴포넌트를 관리자 화면과 함께 쓴다.

**배송비 구간표**를 여기서 넣는다. `qty` 는 '이 수량까지' 이고, 마지막 구간을
넘는 수량은 마지막 구간이 되풀이된다. 비워 두면 배송비 0 — 상품가에 포함된 것으로
본다.

우체국 요금 참고 이미지가 요금표와 종류별 안내 사이에 들어 있다.

`daily_qty_limit`·`per_order_qty_limit` 은 주문을 막지 않고 경고만 한다.

관련: [products 테이블](../database/products.md)

## 관련 파일

- [`src/pages/farm/Products.tsx`](../../src/pages/farm/Products.tsx)
- [`src/components/shared/ProductManager.tsx`](../../src/components/shared/ProductManager.tsx)
- 라우트: [`src/App.tsx`](../../src/App.tsx)
