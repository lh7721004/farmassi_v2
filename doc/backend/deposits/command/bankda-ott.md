# `POST /rpc/bankda-ott` — 농가 계좌 등록 링크

농가가 자기 계좌를 등록하도록 1회용 링크를 발급한다.

뱅크다에서 계좌는 가맹점 아래에 붙으므로, 농가에 가맹점이 없으면 먼저 만든다.
**가맹점 이메일은 농가 id 로 만들어** 사람이 정할 필요가 없게 했다.

가맹점 비밀번호는 공개 테이블에 두지 않고 `private` 스키마에 보관한다.

## 관련 파일

- [`server-py/app/functions/bankda_ott.py`](../../../../server-py/app/functions/bankda_ott.py)
- [`server-py/app/shared/bankda.py`](../../../../server-py/app/shared/bankda.py)
