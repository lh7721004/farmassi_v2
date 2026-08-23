#!/bin/bash
# DB 를 건드리기 전에 되돌릴 지점을 만든다.
#
#   ./snapshot.sh "배송요일 컬럼 추가"          → farmassi
#   ./snapshot.sh "마스킹 재적용" farmassi_dev   → dev
#
# --clean --if-exists 로 뽑으므로 이 파일 하나를 같은 DB 에 그대로 되먹이면
# 그 시점으로 돌아간다. restore.sh 가 그 일을 한다.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

DIR="/Users/lkim/FetchAccount/db-backups/snapshots"
LABEL="${1:?쓸 이유를 적어주세요. 예: ./snapshot.sh \"배송요일 컬럼 추가\"}"
DB="${2:-farmassi}"

mkdir -p "$DIR"
# 파일명에 라벨을 넣되 경로로 쓸 수 없는 글자는 뺀다.
SLUG=$(printf '%s' "$LABEL" | tr ' /' '--' | tr -cd '[:alnum:]가-힣_-' | cut -c1-40)
OUT="$DIR/$DB-$(date '+%Y%m%d-%H%M%S')-$SLUG.sql.gz"

if ! pg_dump --clean --if-exists "$DB" | gzip > "$OUT"; then
  echo "실패: pg_dump 오류" >&2
  rm -f "$OUT"
  exit 1
fi

SIZE=$(stat -f%z "$OUT")
# pg_dump 가 조용히 빈 파일을 남기는 경우가 있어 크기로 한 번 더 본다.
if [ "$SIZE" -lt 10240 ]; then
  echo "실패: 파일이 너무 작습니다 ($((SIZE/1024))KB). 지웁니다." >&2
  rm -f "$OUT"
  exit 1
fi

printf '%s  %s  %s  %sKB\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$DB" "$LABEL" "$((SIZE/1024))" \
  >> "$DIR/../snapshot.log"

echo "스냅샷: $OUT  ($((SIZE/1024))KB)"
echo "되돌리려면: $(dirname "$0")/restore.sh $OUT"
