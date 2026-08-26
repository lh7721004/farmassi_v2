# `push_subscriptions` — 푸시 구독

웹 푸시(Web Push) 구독 정보. 브라우저가 준 `endpoint`·`p256dh`·`auth` 를 그대로 담는다.

한 사람이 기기마다 하나씩 가진다. `user_agent` 는 어느 기기인지 구분하려고 남긴다.

발송은 `send-push` 함수가 한다.

관련 문서: [notifications](notifications.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 | `gen_random_uuid()` |  |
| `user_id` | uuid | 아니오 |  |  |
| `endpoint` | text | 아니오 |  |  |
| `p256dh` | text | 아니오 |  |  |
| `auth` | text | 아니오 |  |  |
| `user_agent` | text | 예 |  |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `user_id` | `profiles.id` |

## 인덱스

- `push_subscriptions_endpoint_key`
- `push_subscriptions_pkey`
- `push_subscriptions_user_id_idx`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `push_subscriptions_own` | ALL | `(user_id = auth.uid())` |
