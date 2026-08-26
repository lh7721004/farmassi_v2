# 농가 소개 페이지 — `/farm/:farmSlug/landingpage`

농가가 스스로 꾸미는 소개 화면. 내용은 [farms](../database/farms.md) 의
`landing_blocks`(jsonb)에 블록 배열로 들어 있다.

블록 구조로 둔 이유는 농가마다 하고 싶은 말이 달라서다. 고정 양식으로 두면
누구에게도 안 맞는다.

`landing_blocks` 를 저장할 때는 **JSON 문자열로 만들어 보내야 한다.**
[query-write 주의](../backend/platform/command/query-write.md) 참고.

---

구현: `src/pages/order/FarmLanding.tsx` · 경로: `/farm/:farmSlug/landingpage`
