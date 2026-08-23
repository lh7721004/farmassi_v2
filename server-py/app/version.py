"""
서버 버전. 기동 시 한 번만 읽는다 — 돌아가는 동안 바뀌지 않는 값이다.

배포 후 "고친 게 반영됐나" 를 화면에서 바로 확인할 수 있어야 해서
pyproject 의 버전과 지금 돌고 있는 커밋을 함께 낸다.
"""
import subprocess
import tomllib
from datetime import datetime, timezone
from pathlib import Path

_here = Path(__file__).resolve().parent


def _package_version() -> str:
    try:
        return tomllib.loads((_here.parent / "pyproject.toml").read_text())["project"]["version"]
    except Exception:
        return "0.0.0"


def _commit() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=_here, capture_output=True, text=True, timeout=5, check=True,
        ).stdout.strip()
    except Exception:
        return "unknown"


VERSION = {
    "version": _package_version(),
    "commit": _commit(),
    # Node 의 toISOString() 과 같은 밀리초 3자리 + 'Z'
    "startedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.")
    + f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z",
}
