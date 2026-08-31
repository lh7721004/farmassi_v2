# 페이지

경로 하나에 문서 하나.
요소는 왼쪽에서 오른쪽, 위에서 아래 순으로 나열한다
요소는 이름과 document.querySelector를 사용했을 때 검색되는 css selector를 작성한다
구성은 form.md와 exampl.md 를 참고한다
요소와 정책, 예외를 한번호에 작성한다
페이지의 모든 요소 작성, 다른 페이지와 겹치는 header같은 것도 복사해서 작성
요소란 작성자가 지정한 버튼, 카드 등을 말한다
~등으로 표시하지 않고 모든 상태, 사항을 작성한다

## 손님

| 화면 | 경로 |
|---|---|
| [랜딩](landing.md) | `/` |
| [농가 스토어](farm-store.md) | `/farm/:farmSlug` |
| [농가 소개](farm-landing.md) | `/farm/:farmSlug/landingpage` |
| [주문하기](checkout.md) | `/farm/:farmSlug/checkout` |
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
