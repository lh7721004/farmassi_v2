# 입금 관리 — `/admin/deposits`

입금 대기 주문과 들어온 입금을 맞춘다.

자동으로 붙지 않은 건은 [match-deposit](../backend/deposits/command/match-deposit.md) 으로
손으로 연결한다. 입금자명이 주문자와 다를 때가 대부분이다.

## 관련 파일

- [`src/pages/admin/Deposits.tsx`](../../src/pages/admin/Deposits.tsx)
- [`server-py/app/shared/deposit_matching.py`](../../server-py/app/shared/deposit_matching.py)
- 라우트: [`src/App.tsx`](../../src/App.tsx)
