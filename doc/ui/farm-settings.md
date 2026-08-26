# 농가 설정

계좌, 연락처, 주소, 카카오 채널, 소개 문구를 고친다.

계좌는 뱅크다에 등록돼야 입금이 자동으로 잡힌다. 등록 상태를
[bankda-account-status](../backend/deposits/read/bankda-account-status.md) 로 확인하고,
[bankda-ott](../backend/deposits/command/bankda-ott.md) 로 등록 링크를 받는다.

---

구현: `src/pages/farm/Settings.tsx` · 경로: `/admin/farms/:farmId/settings`
