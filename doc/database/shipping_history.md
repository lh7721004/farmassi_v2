# `shipping_history` — 배송 이력

송장을 대신 접수해 준 건수를 농가별·날짜별·채널별로 적어 둔 것. 정산 근거다.

`channel` 은 `직접연락`·`카톡 비즈니스`·`팜어시` 셋뿐이다. 앞의 둘은 사람이 손으로
적고, `팜어시` 는 사이트 주문에서 자동으로 센다.

`entry_date` 는 **적는 날**이지 나가는 날이 아니다. 이력은 물건이 나가기 전날 적는다.
그래서 농가의 `delivery_days` 가 월·수·금이면 적는 날은 일·화·목이다.

`receipt_text` 는 우체국 접수번호를 백업 삼아 적어 두는 칸이다.

**이 표는 훼손되면 곤란하다.** 매일 04:30 전체 DB 백업에 포함된다.

관련 문서: [shipping_history_products](shipping_history_products.md) · [farms](farms.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `entry_date` | date | 아니오 |  |  |
| `farm_id` | uuid | 아니오 |  |  |
| `channel` | text | 아니오 |  |  |
| `count` | integer | 아니오 | `0` |  |
| `receipt_text` | text | 예 |  |  |
| `updated_by` | uuid | 예 |  |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |
| `updated_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `farm_id` | `farms.id` |

## 제약

- `shipping_history_channel_check` — `CHECK ((channel = ANY (ARRAY['직접연락'::text, '카톡 비즈니스'::text, '팜어시'::text])))`
- `shipping_history_count_check` — `CHECK ((count >= 0))`

## 인덱스

- `shipping_history_month_idx`
- `shipping_history_pkey`
- `shipping_history_unique`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `shipping_history_admin` | ALL | `private.is_admin()` |
