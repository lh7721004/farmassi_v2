# `POST /rpc/confirm-deposit` — 입금 확인 처리

주문을 `paid` 로 넘긴다. 관리자만 부를 수 있다.

입금이 자동으로 붙지 않은 건을 손으로 확인 처리할 때 쓴다.
`deposit_confirmed_at`·`deposit_confirmed_by` 에 누가 언제 했는지 남는다.

## 관련 파일

- [`server-py/app/functions/confirm_deposit.py`](../../../../server-py/app/functions/confirm_deposit.py)
