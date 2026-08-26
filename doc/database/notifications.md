# `notifications` — 알림

사용자에게 보여 줄 알림. 주문이 들어오면 농가에 쌓인다.

브라우저 푸시는 [push_subscriptions](push_subscriptions.md) 를 통해 따로 나간다.
이 표는 화면 안에서 볼 목록이다.

`is_read` 로 읽음을 표시한다.

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `user_id` | uuid | 아니오 |  |  |
| `farm_id` | uuid | 예 |  |  |
| `order_id` | uuid | 예 |  |  |
| `type` | text | 아니오 |  |  |
| `title` | text | 아니오 |  |  |
| `body` | text | 아니오 |  |  |
| `is_read` | boolean | 아니오 | `false` |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `user_id` | `profiles.id` |
| `farm_id` | `farms.id` |
| `order_id` | `orders.id` |

## 제약

- `notifications_type_check` — `CHECK ((type = ANY (ARRAY['order_created'::text, 'deposit_confirmed'::text, 'shipment_requested'::text])))`

## 인덱스

- `notifications_farm_id_idx`
- `notifications_order_id_idx`
- `notifications_pkey`
- `notifications_user_id_idx`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `notifications_select_own` | SELECT | `((user_id = auth.uid()) OR private.is_admin())` |
| `notifications_update_own` | UPDATE | `(user_id = auth.uid())` |
