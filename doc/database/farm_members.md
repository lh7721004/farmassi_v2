# `farm_members` — 농가 구성원

누가 어느 농가를 다룰 수 있는지. 복합 기본키(`farm_id`, `user_id`)다.

농가 권한을 [profiles](profiles.md) 의 `role` 로 두지 않은 이유는 한 사람이 여러
농가에 속할 수 있어서다. RLS 의 `private.is_farm_member()` 가 이 표를 본다.

관련 문서: [farms](farms.md) · [profiles](profiles.md)

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `farm_id` | uuid | 아니오 |  |  |
| `user_id` | uuid | 아니오 |  |  |
| `member_role` | text | 아니오 | `'owner'::text` |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `farm_id` | `farms.id` |
| `user_id` | `profiles.id` |

## 제약

- `farm_members_member_role_check` — `CHECK ((member_role = ANY (ARRAY['owner'::text, 'staff'::text])))`

## 인덱스

- `farm_members_pkey`
- `farm_members_user_id_idx`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `farm_members_admin_write` | ALL | `private.is_admin()` |
| `farm_members_select` | SELECT | `((user_id = auth.uid()) OR private.is_admin() OR private.is_farm_member(farm_id))` |
