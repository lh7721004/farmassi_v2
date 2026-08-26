# `POST /rpc/bankda-account-status` — 계좌 등록 상태

농가 계좌가 뱅크다에 붙었는지, 조회가 되는지 확인한다.

계좌가 안 붙어 있으면 입금이 자동으로 잡히지 않으므로, 농가 설정 화면에서
이 상태를 보여 준다.

## 관련 파일

- [`server-py/app/functions/bankda_account_status.py`](../../../../server-py/app/functions/bankda_account_status.py)
