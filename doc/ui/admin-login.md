# 관리자 로그인 — `/admin/login`

역시 카카오만 쓴다. 로그인한 계정의 `profiles.role` 이 `admin` 이 아니면
'관리자가 아닙니다' 를 띄우고 다시 로그인시킨다.

**헤드리스 검증 메모** — 카카오를 거쳐야 해서 자동 확인이 어렵다. 개발 환경에서는
`localStorage` 의 `farmassi-token` 에 직접 서명한 토큰을 넣거나
[dev-login](../backend/auth/command/dev-login.md) 을 쓴다.

## 관련 파일

- [`src/pages/auth/AdminLogin.tsx`](../../src/pages/auth/AdminLogin.tsx)
- [`src/lib/auth.tsx`](../../src/lib/auth.tsx)
- 라우트: [`src/App.tsx`](../../src/App.tsx)
