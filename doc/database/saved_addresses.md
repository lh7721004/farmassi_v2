# `saved_addresses` — 저장된 주소

손님이 다시 쓰려고 저장해 둔 배송지. 본인 것만 보인다(RLS `saved_addresses_own`).

`is_default` 는 사용자당 하나만 참이어야 한다. `last_used_at` 으로 최근 것을 위에
올린다.

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `user_id` | uuid | 아니오 |  |  |
| `recipient_name` | text | 아니오 |  |  |
| `phone` | text | 아니오 |  |  |
| `zonecode` | text | 예 |  |  |
| `address` | text | 아니오 |  |  |
| `address_detail` | text | 예 |  |  |
| `is_default` | boolean | 아니오 | `false` |  |
| `last_used_at` | timestamptz | 예 |  |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |
| `updated_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `user_id` | `profiles.id` |

## 인덱스

- `saved_addresses_pkey`
- `saved_addresses_user_id_idx`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `saved_addresses_own` | ALL | `(user_id = auth.uid())` |
