# 알림 목록 조회

`POST /query` 로 [notifications](../../../database/notifications.md) 를 읽는다.
RLS `notifications_select_own` 이 본인 것만 보여 준다.

읽음 처리는 같은 표의 `is_read` 를 `update` 한다.
