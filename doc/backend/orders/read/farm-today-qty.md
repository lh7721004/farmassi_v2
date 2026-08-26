# `POST /rpc/farm-today-qty` — 오늘 농가 주문 수량

오늘(서울 기준) 그 농가에 들어온 주문 수량의 합.

**로그인 없이 부른다.** 손님 스토어에서 '오늘 남은 수량' 을 보여 주기 때문이다.
RLS 로는 남의 주문을 못 보므로, 이 함수만 admin 권한으로 합계만 돌려준다.
개별 주문 내용은 나가지 않는다.

`cancelled` 는 빼고, 입금 전 주문도 센다. 한도는 [products](../../../database/products.md) 의
`daily_qty_limit` 와 비교하는데, **넘어도 주문을 막지 않고 화면에서 경고만 한다.**

## 관련 파일

- [`server-py/app/functions/farm_today_qty.py`](../../../../server-py/app/functions/farm_today_qty.py)
