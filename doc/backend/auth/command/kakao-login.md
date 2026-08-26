# `GET /auth/kakao/start` · `GET /auth/kakao/callback` — 카카오 로그인

로그인 수단은 카카오 하나뿐이다. 비밀번호를 받지 않는다.

`start` 가 카카오로 보내고, `callback` 이 돌아온 코드를 토큰으로 바꾼 뒤
사용자를 찾거나 만들고, 우리 세션 토큰(HS256 JWT)을 발급한다.

**리다이렉트 주소는 환경마다 다르다.** 개발 서버가 `www.farmassi.kr` 로 튀는
사고가 있었다. 카카오 앱에 등록된 Redirect URI 와 `.env` 의 값이 환경별로
맞아야 한다.

토큰은 브라우저 `localStorage` 의 `farmassi-token` 에 담긴다.

구현: `server-py/app/kakao.py`, `server-py/app/jwt_session.py`
