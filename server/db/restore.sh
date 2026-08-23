#!/bin/bash
# 스냅샷 시점으로 되돌린다.
#
#   ./restore.sh /path/to/farmassi-20260824-...sql.gz
#
# 되돌리기 직전에 지금 상태도 스냅샷으로 남긴다 — 잘못 되돌렸을 때
# 다시 앞으로 올 수 있어야 하기 때문이다.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

FILE="${1:?되돌릴 스냅샷 파일을 지정하세요.}"
[ -f "$FILE" ] || { echo "파일이 없습니다: $FILE" >&2; exit 1; }

# 파일명 앞부분이 DB 이름이다.
DB=$(basename "$FILE" | sed -E 's/^([a-z_]+)-[0-9]{8}-.*/\1/')
[ -n "$DB" ] || { echo "파일명에서 DB 를 알 수 없습니다: $(basename "$FILE")" >&2; exit 1; }

echo "대상 DB : $DB"
echo "스냅샷  : $(basename "$FILE")"

ACTIVE=$(psql -d postgres -X -t -A -c \
  "select count(*) from pg_stat_activity where datname='$DB' and pid<>pg_backend_pid();")
if [ "${ACTIVE:-0}" -gt 0 ]; then
  echo
  echo "경고: $DB 에 열린 접속이 $ACTIVE 개 있습니다 (API 서버 등)."
  echo "      되돌리는 동안 그쪽이 오류를 봅니다. 먼저 멈추는 것을 권합니다."
fi

echo
read -r -p "정말 되돌립니까? 되돌리면 지금 데이터는 사라집니다 [yes 입력]: " OK
[ "$OK" = "yes" ] || { echo "취소했습니다."; exit 1; }

# 되돌리기 전 상태도 남긴다.
SAFETY=$("$(dirname "$0")/snapshot.sh" "restore-직전-$DB" "$DB" | head -1)
echo "$SAFETY"

# -1 : 통째로 한 트랜잭션. 중간에 깨지면 아무것도 바뀌지 않는다.
# 덤프가 내뱉는 set_config 결과행과 wal_level 경고는 정상이라 묻어 둔다.
# 진짜 오류는 ON_ERROR_STOP 이 종료 코드로 알려준다.
LOG=$(mktemp)
if gunzip -c "$FILE" | psql -d "$DB" -X -v ON_ERROR_STOP=1 -1 -q -o /dev/null 2>"$LOG"; then
  grep -iE '^(ERROR|FATAL)' "$LOG" >&2 || true
  rm -f "$LOG"
  echo "되돌렸습니다: $DB ← $(basename "$FILE")"
  printf '%s  %s  RESTORE  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$DB" "$(basename "$FILE")" \
    >> "$(dirname "$FILE")/../snapshot.log"
else
  echo "실패했습니다. 트랜잭션이 롤백되어 DB 는 그대로입니다." >&2
  grep -iE '^(ERROR|FATAL)' "$LOG" >&2 | head -5
  rm -f "$LOG"
  exit 1
fi
