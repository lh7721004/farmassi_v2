# 입금 원장 조회

전용 엔드포인트가 없다. `POST /query` 로
[deposit_transactions](../../../database/deposit_transactions.md) 를 읽는다.

`match_status` 로 거른다 — `unmatched` 만 보면 사람이 처리할 것만 남는다.

`raw_payload` 에 뱅크다 원본 응답이 통째로 들어 있다. 대사가 틀렸을 때 무엇을
보고 그렇게 판단했는지 되짚을 수 있다.
