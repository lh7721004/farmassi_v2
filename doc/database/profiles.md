# `profiles` — 사용자

`auth.users` 에 1:1 로 붙는 프로필. 카카오 로그인으로 만들어진다.

`role` 은 `customer` 또는 `admin` 둘뿐이다. 농가 권한은 이 컬럼이 아니라
[farm_members](farm_members.md) 로 준다. 한 사람이 여러 농가에 속할 수 있기 때문이다.

`phone` 은 주문 폼의 기본값으로 쓴다.

## 컬럼

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | uuid | 아니오 |  |  |
| `role` | text | 아니오 | `'customer'::text` |  |
| `display_name` | text | 예 |  |  |
| `phone` | text | 예 |  |  |
| `avatar_url` | text | 예 |  |  |
| `created_at` | timestamptz | 아니오 | `now()` |  |
| `updated_at` | timestamptz | 아니오 | `now()` |  |

## 외래키

| 컬럼 | 참조 |
|---|---|
| `id` | `users.id` |

## 제약

- `profiles_role_check` — `CHECK ((role = ANY (ARRAY['customer'::text, 'admin'::text])))`

## 인덱스

- `profiles_pkey`

## RLS 정책

| 정책 | 대상 | 조건 |
|---|---|---|
| `profiles_admin_all` | ALL | `private.is_admin()` |
| `profiles_select` | SELECT | `((id = auth.uid()) OR private.is_admin())` |
| `profiles_update_self` | UPDATE | `(id = auth.uid())` |

## 정의

- [`supabase/migrations/20260817000001_init_farmassi.sql`](../../supabase/migrations/20260817000001_init_farmassi.sql)

## 쓰는 곳

- [`server-py/app/shared/util.py`](../../server-py/app/shared/util.py)
- [`server-py/app/storage.py`](../../server-py/app/storage.py)
- [`src/components/auth/ProfileCompletionSheet.tsx`](../../src/components/auth/ProfileCompletionSheet.tsx)
- [`src/lib/auth.tsx`](../../src/lib/auth.tsx)
- [`src/pages/admin/Farms.tsx`](../../src/pages/admin/Farms.tsx)
- [`src/pages/farm/Settings.tsx`](../../src/pages/farm/Settings.tsx)
- [`src/pages/order/Checkout.tsx`](../../src/pages/order/Checkout.tsx)
