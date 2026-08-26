# `shipments` — 송장

우체국 접수 한 건. 주문 하나에 송장 하나가 붙는다.

`request_payload`·`response_payload` 를 남기는 이유는 우체국 API 가 실패했을 때
무엇을 보냈는지 알아야 다시 보낼 수 있기 때문이다.

`status`: `draft` → `requested` → `done`. `tracking_number` 는 접수가 끝나야 나온다.

관련 문서: [orders](orders.md) · [products](products.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `order_id` | uuid | 아니오 |  |  |
| `provider` | text | 아니오 | `'kpost'::text` |  |
| `status` | text | 아니오 | `'draft'::text` |  |
| `tracking_number` | text | 예 |  |  |
| `request_payload` | jsonb | 예 |  |  |
| `response_payload` | jsonb | 예 |  |  |
| `requested_at` | timestamptz | 예 |  |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |
| `updated_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `order_id` | `orders.id` |

## 제약

- `shipments_status_check` — `CHECK ((status = ANY (ARRAY['draft'::text, 'requested'::text, 'printed'::text, 'cancelled'::text])))`

## 인덱스

- `shipments_order_id_idx`
- `shipments_pkey`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `shipments_admin_write` | ALL | `private.is_admin()` |
| `shipments_select` | SELECT | `(private.is_admin() OR (EXISTS ( SELECT 1    FROM orders o   WHERE ((o.id = shipments.order_id) AND private.is_farm_member(o.farm_id)))))` |

## 정의

- [`supabase/migrations/20260817000001_init_farmassi.sql`](../../supabase/migrations/20260817000001_init_farmassi.sql)

## 쓰는 곳

- [`server-py/app/functions/kpost_shipment.py`](../../server-py/app/functions/kpost_shipment.py)
