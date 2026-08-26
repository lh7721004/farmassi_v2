# `POST /rpc/approve-farm` — 입점 승인

[farm_applications](../../../database/farm_applications.md) 을 승인해
[farms](../../../database/farms.md) 행을 만든다.

`slug` 는 농가 이름에서 만들고 뒤에 6자리 임의 코드를 붙인다. 이름이 겹쳐도
주소가 겹치지 않게 하려는 것이다. 한글도 slug 에 쓴다 — 주소가 읽히는 편이 낫다.

신청서의 계좌 정보를 그대로 농가로 옮기고, 신청자를
[farm_members](../../../database/farm_members.md) 에 `owner` 로 넣는다.

관리자만 부를 수 있다.

## 관련 파일

- [`server-py/app/functions/approve_farm.py`](../../../../server-py/app/functions/approve_farm.py)
