# `POST /rpc/scrape-deposits` — 입금내역 수집·자동 대사

뱅크다A 에서 입금내역을 가져와 입금대기 주문에 붙인다.

크론은 `x-cron-secret` 헤더로, 관리자는 로그인 상태로 부른다.

**뱅크다는 계좌당 5분 조회 제한이 있다.** 스케줄러가 매 주기마다 거래내역을
부르지 않고, 계좌 정보가 갱신됐을 때만 실제 조회를 하는 이유다.

자동 대사 규칙은 보수적이다. 금액이 **정확히** 같아야 하고, 입금자명이 다르면
붙이지 않는다. "김철수" 로 주문했는데 "고길동" 이 보낸 경우가 있어서다. 그런
건은 사람이 [match-deposit](match-deposit.md) 으로 확인해 연결한다.

구현: `server-py/app/functions/scrape_deposits.py`, `server-py/app/shared/deposit_matching.py`
