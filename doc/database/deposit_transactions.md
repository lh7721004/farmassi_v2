# `deposit_transactions` — 입금 내역

계좌로 들어온 입금 한 건. 뱅크다(`provider='bankda'`)가 긁어다 준 것이 대부분이다.

`match_status` 가 `unmatched` → `matched` 로 옮겨 가고, 맞으면 `matched_order_id` 가
채워진다. 대사는 금액과 입금자명으로 하는데, 금액이 같은 주문이 여럿이면
[orders](orders.md) 의 `deposit_code`·`depositor_name` 으로 가른다.

`external_id` 는 뱅크다 쪽 식별자다. 같은 입금을 두 번 넣지 않으려고 둔다.

`raw_payload` 에 원본 응답을 통째로 넣어 둔다. 대사가 틀렸을 때 무엇을 보고 그렇게
판단했는지 되짚을 수 있어야 하기 때문이다.

관련 문서: [orders](orders.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `farm_id` | uuid | 예 |  |  |
| `provider` | text | 아니오 |  |  |
| `occurred_at` | timestamptz | 아니오 | `now()` |  |
| `amount` | integer | 아니오 |  |  |
| `depositor_name` | text | 예 |  |  |
| `raw_payload` | jsonb | 예 |  |  |
| `matched_order_id` | uuid | 예 |  |  |
| `match_status` | text | 아니오 | `'unmatched'::text` |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |
| `external_id` | text | 예 |  |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `farm_id` | `farms.id` |
| `matched_order_id` | `orders.id` |

## 제약

- `deposit_transactions_match_status_check` — `CHECK ((match_status = ANY (ARRAY['unmatched'::text, 'matched'::text, 'ignored'::text])))`
- `deposit_transactions_provider_check` — `CHECK ((provider = ANY (ARRAY['manual'::text, 'gnd'::text, 'hecto'::text, 'banksalad'::text, 'codef'::text, 'bankda'::text, 'callback'::text])))`

## 인덱스

- `deposit_transactions_farm_id_idx`
- `deposit_transactions_matched_order_id_idx`
- `deposit_transactions_pkey`
- `deposit_transactions_provider_external_id_key`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `deposit_transactions_select` | SELECT | `(private.is_admin() OR ((farm_id IS NOT NULL) AND private.is_farm_member(farm_id)))` |

## 정의

- [`supabase/migrations/20260817000001_init_farmassi.sql`](../../supabase/migrations/20260817000001_init_farmassi.sql)
- [`supabase/migrations/20260817000002_fk_indexes.sql`](../../supabase/migrations/20260817000002_fk_indexes.sql)
- [`supabase/migrations/20260819061832_deposit_callback_provider.sql`](../../supabase/migrations/20260819061832_deposit_callback_provider.sql)
- [`supabase/migrations/20260821000000_deposit_bankda.sql`](../../supabase/migrations/20260821000000_deposit_bankda.sql)
- [`supabase/migrations/20260824000007_deposit_provider_keep_bankda.sql`](../../supabase/migrations/20260824000007_deposit_provider_keep_bankda.sql)

## 쓰는 곳

- [`server-py/app/functions/confirm_deposit.py`](../../server-py/app/functions/confirm_deposit.py)
- [`server-py/app/functions/match_deposit.py`](../../server-py/app/functions/match_deposit.py)
- [`server-py/app/functions/scrape_deposits.py`](../../server-py/app/functions/scrape_deposits.py)
- [`src/pages/admin/DepositLedger.tsx`](../../src/pages/admin/DepositLedger.tsx)
