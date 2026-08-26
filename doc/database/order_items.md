# `order_items` — 주문 품목

주문 한 건에 담긴 상품 줄. `product_name`·`unit_price` 를 **값으로 베껴 둔다.**

상품이 나중에 이름이나 가격을 바꿔도 지난 주문은 주문 당시의 내용을 그대로
보여야 하기 때문이다. `product_id` 는 참조용이고 상품이 지워지면 `null` 이 된다.

`line_amount` 는 상품가 × 수량이고, `shipping_fee` 는 그 줄의 배송비다. 배송비는
[products](products.md) 의 `shipping_fees` 구간표에서 뽑는다.

관련 문서: [orders](orders.md) · [products](products.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `order_id` | uuid | 아니오 |  |  |
| `product_id` | uuid | 예 |  |  |
| `product_name` | text | 아니오 |  |  |
| `unit` | text | 예 |  |  |
| `unit_price` | integer | 아니오 |  |  |
| `quantity` | integer | 아니오 |  |  |
| `line_amount` | integer | 아니오 |  |  |
| `shipping_fee` | integer | 아니오 | `0` | 이 상품 줄의 배송비. 수량 구간표에서 뽑는다. |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `order_id` | `orders.id` |
| `product_id` | `products.id` |

## 제약

- `order_items_line_amount_check` — `CHECK ((line_amount >= 0))`
- `order_items_quantity_check` — `CHECK ((quantity > 0))`
- `order_items_unit_price_check` — `CHECK ((unit_price >= 0))`

## 인덱스

- `order_items_order_id_idx`
- `order_items_pkey`
- `order_items_product_id_idx`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `order_items_select` | SELECT | `(EXISTS ( SELECT 1    FROM orders o   WHERE ((o.id = order_items.order_id) AND ((o.customer_id = auth.uid()) OR private.is_admin() OR private.is_farm_member(o.farm_id)))))` |
