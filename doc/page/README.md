# 페이지

경로 하나에 문서 하나.

## 손님

| 화면 | 경로 |
|---|---|
| [랜딩](landing.md) | `/` |
| [농가 스토어](farm-store.md) | `/farm/:farmSlug` |
| [농가 소개](farm-landing.md) | `/farm/:farmSlug/landingpage` |
| [주문서](checkout.md) | `/farm/:farmSlug/checkout` |
| [주문 완료](order-complete.md) | `/me/orders/:orderId/complete` |
| [계좌 복사](account-copy.md) | `/farm/:farmSlug/qr` |
| [내 주문](my-orders.md) | `/me/orders` |
| [주문 상세](my-order-detail.md) | `/me/orders/:orderId` |

## 로그인

| 화면 | 경로 |
|---|---|
| [로그인](login.md) | `/login` |
| [관리자 로그인](admin-login.md) | `/admin/login` |
| [로그인 콜백](auth-callback.md) | `/auth/callback` |

## 관리자

| 화면 | 경로 |
|---|---|
| [대시보드](admin-dashboard.md) | `/admin` |
| [농가 관리](admin-farms.md) | `/admin/farms` |
| [주문 관리](admin-orders.md) | `/admin/orders` |
| [입금 관리](admin-deposits.md) | `/admin/deposits` |
| [입금 원장](admin-deposit-ledger.md) | `/admin/deposits/ledger` |
| [송장](admin-shipments.md) | `/admin/shipments` |
| [배송이력 관리](admin-shipping-history.md) | `/admin/shipping-history` |
| [우체국 접수 안내](admin-shipping-manual.md) | `/admin/shipping-manual` |

## 농가 작업공간

관리자 화면 안에 탭으로 들어 있다.

| 화면 | 경로 |
|---|---|
| [대시보드](farm-dashboard.md) | `/admin/farms/:farmId` |
| [주문](farm-orders.md) | `/admin/farms/:farmId/orders` |
| [상품 관리](farm-products.md) | `/admin/farms/:farmId/products` |
| [배송 설정](farm-delivery.md) | `/admin/farms/:farmId/delivery` |
| [설정](farm-settings.md) | `/admin/farms/:farmId/settings` |
