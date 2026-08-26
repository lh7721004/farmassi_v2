# `POST /rpc/send-push` — 웹 푸시 발송

[push_subscriptions](../../../database/push_subscriptions.md) 에 등록된 기기로 보낸다.

**관리자는 다른 사용자에게도 보낼 수 있고, 아니면 자기 자신에게만** 보낼 수 있다.
남의 기기로 아무나 푸시를 쏠 수 없게 한 것이다.

주문이 들어오면 농가에 알림이 필요하다는 요청에서 나왔다.

## 관련 파일

- [`server-py/app/functions/send_push.py`](../../../../server-py/app/functions/send_push.py)
- [`server-py/app/shared/push.py`](../../../../server-py/app/shared/push.py)
