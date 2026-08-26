# 로그인 콜백 — `/auth/callback`

카카오가 돌려보내는 자리. 토큰을 받아 저장하고 원래 가려던 곳으로 보낸다.

가려던 주소는 `sessionStorage` 의 `farmassi-next` 에 담아 둔다.

**환경별 Redirect URI 가 맞아야 한다.** 개발 서버가 `www.farmassi.kr` 로 튄 적이 있다.

## 관련 파일

- [`src/pages/auth/AuthCallback.tsx`](../../src/pages/auth/AuthCallback.tsx)
- [`src/lib/auth.tsx`](../../src/lib/auth.tsx)
- 라우트: [`src/App.tsx`](../../src/App.tsx)
