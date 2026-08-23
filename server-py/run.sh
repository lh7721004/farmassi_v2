#!/bin/bash
# 파이썬 API 를 Node 서버와 같은 방식으로 띄운다.
#
#   ./run.sh ../server/.env       운영 (PORT=4310)
#   ./run.sh ../server/.env.dev   개발 (PORT=4311)
#
# uvicorn 은 --env-file 이 없어서 여기서 읽어 넘긴다. Node 쪽 .env 를 그대로
# 쓰므로 환경변수 이름을 바꾸지 않았다.
set -uo pipefail
cd "$(dirname "$0")"

ENV_FILE="${1:?환경 파일을 지정하세요. 예: ./run.sh ../server/.env}"
[ -f "$ENV_FILE" ] || { echo "환경 파일이 없습니다: $ENV_FILE" >&2; exit 1; }

# 명령줄에서 준 PORT 가 파일 값을 이기게 한다 (시험 기동용).
PORT_OVERRIDE="${PORT:-}"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

[ -n "$PORT_OVERRIDE" ] && PORT="$PORT_OVERRIDE"
export PORT

exec .venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 --port "${PORT:-4310}" --no-access-log
