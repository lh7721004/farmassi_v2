# `shipping_history_products` — 배송 이력 품목

그날 그 농가에서 무엇이 몇 개 나갔는지. [shipping_history](shipping_history.md) 의 건수를 품목으로 쪼갠 것이다.

`product_name` 을 값으로 남긴다. 상품이 지워지거나 이름이 바뀌어도 지난 이력은
그대로 남아야 하기 때문이다. `product_id` 는 참조용이라 `null` 이 될 수 있다.

품목 수량의 합은 그날 그 농가의 건수 합계와 맞아야 한다. 화면에서 그렇게 강제한다.

관련 문서: [shipping_history](shipping_history.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `entry_date` | date | 아니오 |  |  |
| `farm_id` | uuid | 아니오 |  |  |
| `product_id` | uuid | 예 |  |  |
| `product_name` | text | 아니오 |  |  |
| `quantity` | integer | 아니오 | `0` |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |
| `updated_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `farm_id` | `farms.id` |
| `product_id` | `products.id` |

## 제약

- `shipping_history_products_qty_check` — `CHECK ((quantity >= 0))`

## 인덱스

- `shipping_history_products_month_idx`
- `shipping_history_products_pkey`
- `shipping_history_products_unique`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `shipping_history_products_admin` | ALL | `private.is_admin()` |

## 정의

- [`supabase/migrations/20260825000002_shipping_history.sql`](../../supabase/migrations/20260825000002_shipping_history.sql)

## 쓰는 곳

- [`src/lib/shippingHistory.ts`](../../src/lib/shippingHistory.ts)
