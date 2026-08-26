# `POST /rpc/match-deposit` — 손으로 붙이거나 떼기

자동 대사가 붙이지 못한 입금을 사람이 주문에 연결한다. 떼어내는 것도 같은 함수다.

자동이 못 붙이는 전형적인 경우는 입금자명이 주문자와 다를 때다. 자동을 느슨하게
만들어 엉뚱한 주문에 붙이는 것보다, 못 붙인 것을 사람이 처리하는 편이 안전하다.

관리자만 부를 수 있다.

## 관련 파일

- [`server-py/app/functions/match_deposit.py`](../../../../server-py/app/functions/match_deposit.py)
