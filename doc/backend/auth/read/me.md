# `GET /auth/me` — 내 정보

토큰을 검증하고 사용자와 프로필을 돌려준다. 화면이 뜰 때 세션을 확인하는 곳이다.

응답: `{user: {id, profile: {role, display_name, phone, avatar_url}}}`

`role` 이 `admin` 인지로 관리자 화면 접근을 가른다. 농가 권한은 여기 없고
[farm_members](../../../database/farm_members.md) 를 따로 본다.

## 관련 파일

- [`server-py/app/main.py`](../../../../server-py/app/main.py)
