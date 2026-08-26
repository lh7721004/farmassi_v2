# `POST /rpc/kpost-shipment` — 우체국 접수

**아직 연동 전이다.** `orderIds` 가 비면 `{implemented: false}` 와 안내 문구를
돌려준다. 화면은 이 응답을 보고 '준비 중' 을 띄운다.

지금 실무는 엑셀로 돌아간다 — 창구소포 간편접수 양식을 만들어 우체국에 넣는다.
[shipping-manual 화면](../../../ui/admin-shipping-manual.md) 참고.

연동이 붙으면 [shipments](../../../database/shipments.md) 에 요청·응답을 통째로
남긴다. 실패했을 때 무엇을 보냈는지 알아야 다시 보낼 수 있기 때문이다.

## 관련 파일

- [`server-py/app/functions/kpost_shipment.py`](../../../../server-py/app/functions/kpost_shipment.py)
