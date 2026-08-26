# API

도메인별로 폴더를 나누고, 그 아래를 **`read`(조회)** 와 **`command`(변경)** 로 가른다.

엔드포인트는 셋뿐이다.

| 엔드포인트 | 쓰임 |
|---|---|
| `POST /query` | 표 읽기·쓰기. Supabase 문법을 그대로 흉내낸다 |
| `POST /rpc/{name}` | 이름 붙은 동작 (주문 생성, 입금 대사 …) |
| `GET /auth/*`, `/files/*`, `/storage/*` | 로그인, 파일 |

**권한은 코드가 아니라 DB 의 RLS 가 본다.** 요청자의 id 를
`request.jwt.claim.sub` 로 세션에 심고 정책이 그것을 읽는다. 그래서 어느 화면에서
불러도 같은 규칙이 적용된다.

## 도메인

| 도메인 | 내용 |
|---|---|
| [platform](platform/) | `/query`, 스케줄러, 헬스체크 |
| [auth](auth/) | 카카오 로그인, 세션 |
| [farms](farms/) | 농가, 입점 승인 |
| [orders](orders/) | 주문 생성·조회, 수량 한도 |
| [deposits](deposits/) | 입금 수집, 자동·수동 대사 |
| [shipments](shipments/) | 우체국 접수, 배송 이력 |
| [notifications](notifications/) | 알림, 웹 푸시 |
| [address](address/) | 주소 검색, 좌표 변환 |
| [storage](storage/) | 파일 업로드·서빙 |
