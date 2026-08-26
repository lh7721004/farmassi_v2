# `GET /health` · `GET /version`

살아 있는지, 어느 커밋으로 도는지 확인한다. 배포 후 이 둘로 확인한다.

`/health` 는 인증 없이 200 을 돌려준다. launchd 로 재시작한 뒤 이 응답을 기다린다.

구현: `server-py/app/main.py`, `server-py/app/version.py`
