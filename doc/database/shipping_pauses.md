# `shipping_pauses` — 배송 일시정지

농가가 배송을 쉬는 기간. **컬럼이 아니라 행으로 둔 것이 요점이다.**

관리자와 농가가 각각 정지를 걸 수 있고 기간이 겹칠 수 있다. 컬럼으로 두면 하나만
남지만, 행으로 두면 여러 개가 자연스럽게 합쳐진다.

`start_date`·`end_date` 는 양끝을 포함한다. 예상 배송일 계산에서 이 기간은 건너뛰고
그 다음 배송 가능 요일을 찾는다.

관련 문서: [farms](farms.md) · [holidays](holidays.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `farm_id` | uuid | 아니오 |  |  |
| `start_date` | date | 아니오 |  |  |
| `end_date` | date | 아니오 |  |  |
| `reason` | text | 예 |  |  |
| `created_by` | uuid | 예 |  |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `farm_id` | `farms.id` |

## 제약

- `shipping_pauses_range_check` — `CHECK ((end_date >= start_date))`

## 인덱스

- `shipping_pauses_farm_idx`
- `shipping_pauses_pkey`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `shipping_pauses_select` | SELECT | `true` |
| `shipping_pauses_write` | ALL | `(private.is_admin() OR private.is_farm_member(farm_id))` |
