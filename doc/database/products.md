# `products` — 상품

농가가 파는 물건. `farm_id` 로 농가에 매인다.

`price` 는 **실제로 청구하는 금액**이고 `list_price` 는 할인 전 가격이다. 할인을
넣을 때 `price` 의 뜻을 바꾸지 않은 것은, 주문 합계를 계산하는 코드를 한 줄도
건드리지 않기 위해서다. `list_price` 가 `price` 보다 클 때만 취소선으로 보여 준다.

`shipping_fees` 는 수량 구간별 배송비 `[{qty, fee}]` 이고 **`qty` 는 '이 수량까지'**
를 뜻한다. `[{qty:1,fee:5000},{qty:2,fee:7000}]` 이면 1개 5,000원 / 2개 7,000원이다.
마지막 구간을 넘는 수량은 마지막 구간을 되풀이한다. 빈 배열이면 배송비 0 — 지금까지처럼
상품가에 포함된 것으로 본다. 기존 상품이 그대로 동작해야 하기 때문이다.

`daily_qty_limit`·`per_order_qty_limit` 은 **주문을 막지 않는다.** 넘으면 화면에서
경고만 한다. 손님을 돌려보내는 것보다 농가가 알고 조정하는 편이 낫다고 봤다.

`parcel_*` 은 우체국 접수에 넣을 값이다. [shipments](shipments.md) 참고.

관련 문서: [farms](farms.md) · [order_items](order_items.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `farm_id` | uuid | 아니오 |  |  |
| `name` | text | 아니오 |  |  |
| `price` | integer | 아니오 |  |  |
| `unit` | text | 예 |  |  |
| `description` | text | 예 |  |  |
| `image_url` | text | 예 |  |  |
| `is_active` | boolean | 아니오 | `true` |  |
| `sort_order` | integer | 아니오 | `0` |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |
| `updated_at` | timestamptz | 아니오 | `now()` |  |
| `parcel_weight_kg` | text | 아니오 | `'5'::text` |  |
| `parcel_volume_cm` | text | 아니오 | `'80'::text` |  |
| `parcel_content_code` | text | 아니오 | `'농/수/축산물(일반)'::text` |  |
| `parcel_delivery_type` | text | 아니오 | `''::text` |  |
| `sale_status` | text | 아니오 | `'on_sale'::text` |  |
| `list_price` | integer | 예 |  | 할인 전 원래 가격. price 보다 클 때만 취소선으로 표시한다. null 이면 할인 없음. |
| `daily_qty_limit` | integer | 아니오 | `100` | 상품 일일 주문 수량 한도. 넘어도 주문은 받고 화면 경고만 한다. |
| `per_order_qty_limit` | integer | 아니오 | `100` | 1회 주문에서 이 상품을 담을 수 있는 한도. 넘어도 주문은 받고 화면 경고만 한다. |
| `shipping_fees` | jsonb | 아니오 | `'[]'::jsonb` | 수량 구간별 배송비 [{qty, fee}]. qty 는 이 수량까지. 빈 배열이면 상품가에 포함(0원). |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `farm_id` | `farms.id` |

## 제약

- `products_daily_qty_limit_check` — `CHECK ((daily_qty_limit >= 1))`
- `products_list_price_check` — `CHECK (((list_price IS NULL) OR (list_price >= 0)))`
- `products_parcel_delivery_type_check` — `CHECK ((parcel_delivery_type = ANY (ARRAY[''::text, '대면'::text, '비대면'::text])))`
- `products_parcel_volume_cm_check` — `CHECK ((parcel_volume_cm = ANY (ARRAY['80'::text, '100'::text, '120'::text, '160'::text])))`
- `products_parcel_weight_kg_check` — `CHECK ((parcel_weight_kg = ANY (ARRAY['3'::text, '5'::text, '7'::text, '10'::text, '15'::text, '20'::text, '25'::text, '30'::text])))`
- `products_per_order_qty_limit_check` — `CHECK ((per_order_qty_limit >= 1))`
- `products_price_check` — `CHECK ((price >= 0))`
- `products_sale_status_check` — `CHECK ((sale_status = ANY (ARRAY['on_sale'::text, 'coming_soon'::text, 'sold_out'::text, 'hidden'::text, 'inquiry'::text])))`
- `products_shipping_fees_check` — `CHECK ((jsonb_typeof(shipping_fees) = 'array'::text))`

## 인덱스

- `products_farm_id_idx`
- `products_pkey`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `products_select` | SELECT | `((is_active = true) OR private.is_admin() OR private.is_farm_member(farm_id))` |
| `products_write` | ALL | `(private.is_admin() OR private.is_farm_member(farm_id))` |

## 정의

- [`supabase/migrations/20260819000004_product_sale_status.sql`](../../supabase/migrations/20260819000004_product_sale_status.sql)
- [`supabase/migrations/20260819000010_product_parcel_weight_3kg.sql`](../../supabase/migrations/20260819000010_product_parcel_weight_3kg.sql)
- [`supabase/migrations/20260823000002_farms_visible_when_inactive.sql`](../../supabase/migrations/20260823000002_farms_visible_when_inactive.sql)
- [`supabase/migrations/20260824000001_products_list_price.sql`](../../supabase/migrations/20260824000001_products_list_price.sql)
- [`supabase/migrations/20260824000002_products_kpost_and_inquiry.sql`](../../supabase/migrations/20260824000002_products_kpost_and_inquiry.sql)
- [`supabase/migrations/20260824000007_qty_limits.sql`](../../supabase/migrations/20260824000007_qty_limits.sql)
- [`supabase/migrations/20260825000002_shipping_history.sql`](../../supabase/migrations/20260825000002_shipping_history.sql)
- [`supabase/migrations/20260826000000_shipping_fees.sql`](../../supabase/migrations/20260826000000_shipping_fees.sql)

## 쓰는 곳

- [`server-py/app/functions/create_order.py`](../../server-py/app/functions/create_order.py)
- [`src/App.tsx`](../../src/App.tsx)
- [`src/components/shared/ProductImportDialog.tsx`](../../src/components/shared/ProductImportDialog.tsx)
- [`src/components/shared/ProductManager.tsx`](../../src/components/shared/ProductManager.tsx)
- [`src/lib/shippingHistory.ts`](../../src/lib/shippingHistory.ts)
- [`src/pages/admin/Farms.tsx`](../../src/pages/admin/Farms.tsx)
- [`src/pages/order/Checkout.tsx`](../../src/pages/order/Checkout.tsx)
- [`src/pages/order/FarmStore.tsx`](../../src/pages/order/FarmStore.tsx)
