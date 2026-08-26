# 농가 정보 수정

전용 엔드포인트가 없다. `POST /query` 의 `update` 로 처리한다.

누가 고칠 수 있는지는 RLS `farms_update` 가 가른다 — 관리자, 그리고 그 농가의
구성원이다. 처음에는 관리자만 열려 있었는데 농가가 자기 정보를 못 고쳐서
구성원까지 넓혔다.

`landing_blocks` 는 jsonb 다. **JSON 문자열로 만들어 보내야 한다** —
[query-write](../../platform/command/query-write.md) 의 주의를 참고.

`delivery_days` 는 최소 하나를 골라야 한다. 화면에서 필수로 강제한다.
