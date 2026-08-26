# `holidays` — 공휴일

우체국이 쉬는 날. 공공데이터포털 특일 정보 API 에서 받아 채운다.

일요일은 이 표에 없다. 날짜만 보면 알 수 있어서 코드에서 따로 판정한다.

출고일과 도착 예정일을 셀 때 이 날짜들을 건너뛴다.

`source` 는 `seed`(손으로 넣음) 또는 API 출처다.

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `holiday_date` | date | 아니오 |  |  |
| `name` | text | 아니오 |  |  |
| `source` | text | 아니오 | `'seed'::text` |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |

## 인덱스

- `holidays_pkey`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `holidays_select` | SELECT | `true` |
