#!/usr/bin/env bash
# 로컬 Postgres 에 스키마를 적용한다.
#   server/db/apply.sh [--reset]
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
DB="${FARMASSI_DB:-farmassi}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

if [ "${1:-}" = "--reset" ]; then
  dropdb --if-exists "$DB"; createdb "$DB"; echo "데이터베이스 재생성: $DB"
fi

psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/000_local_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  # Supabase Storage 전용 마이그레이션은 자체 업로드로 대체했으므로 건너뛴다.
  case "$f" in *product_images_storage*) continue;; esac
  printf "  %-46s " "$(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" && echo OK
done
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/001_local_grants.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/002_admin_grant.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/003_scrape_state.sql"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/004_bankda_merchant.sql"
echo "완료"
