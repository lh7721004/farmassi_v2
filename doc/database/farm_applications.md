# `farm_applications` — 농가 입점 신청

입점 신청서. 승인되면 [farms](farms.md) 행이 만들어지고 `farm_id` 가 채워진다.

`status`: `pending` → `approved` / `rejected`. 승인은 `approve-farm` 함수가 한다.

신청서의 계좌 정보를 그대로 농가로 옮긴다.

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `user_id` | uuid | 아니오 |  |  |
| `farm_name` | text | 아니오 |  |  |
| `owner_name` | text | 아니오 |  |  |
| `location` | text | 예 |  |  |
| `product_summary` | text | 예 |  |  |
| `description` | text | 예 |  |  |
| `bank_name` | text | 아니오 |  |  |
| `account_number` | text | 아니오 |  |  |
| `account_holder` | text | 아니오 |  |  |
| `phone` | text | 예 |  |  |
| `status` | text | 아니오 | `'pending'::text` |  |
| `review_note` | text | 예 |  |  |
| `reviewed_by` | uuid | 예 |  |  |
| `reviewed_at` | timestamptz | 예 |  |  |
| `farm_id` | uuid | 예 |  |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |
| `updated_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `user_id` | `profiles.id` |
| `reviewed_by` | `profiles.id` |
| `farm_id` | `farms.id` |

## 제약

- `farm_applications_status_check` — `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))`

## 인덱스

- `farm_applications_farm_id_idx`
- `farm_applications_pkey`
- `farm_applications_reviewed_by_idx`
- `farm_applications_status_idx`
- `farm_applications_user_id_idx`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `farm_applications_insert` | INSERT | `-` |
| `farm_applications_select` | SELECT | `((user_id = auth.uid()) OR private.is_admin())` |
| `farm_applications_update_admin` | UPDATE | `private.is_admin()` |
