# 데이터베이스

PostgreSQL. 권한은 **RLS** 로 건다 — 표마다 정책이 붙어 있고,
요청자의 id 를 `request.jwt.claim.sub` 로 세션에 심어 정책이 그것을 읽는다.

판정 함수는 `private` 스키마에 있다 — `private.is_admin()`, `private.is_farm_member()`.

## 농가·상품

- [`farms`](farms.md)
- [`products`](products.md)
- [`farm_members`](farm_members.md)
- [`farm_applications`](farm_applications.md)

## 주문·입금

- [`orders`](orders.md)
- [`order_items`](order_items.md)
- [`deposit_transactions`](deposit_transactions.md)

## 배송

- [`shipments`](shipments.md)
- [`shipping_history`](shipping_history.md)
- [`shipping_history_products`](shipping_history_products.md)
- [`shipping_pauses`](shipping_pauses.md)
- [`holidays`](holidays.md)

## 사용자

- [`profiles`](profiles.md)
- [`saved_addresses`](saved_addresses.md)
- [`notifications`](notifications.md)
- [`push_subscriptions`](push_subscriptions.md)

## 백업

매일 04:30 전체 백업. DB 를 건드리는 작업 전에는 `server/db/snapshot.sh` 로
따로 스냅샷을 뜨고, 되돌릴 때는 `server/db/restore.sh` 를 쓴다.
마이그레이션은 `supabase/migrations/` 에 시간순으로 쌓는다.
