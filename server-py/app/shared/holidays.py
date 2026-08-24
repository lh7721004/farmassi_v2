"""
공휴일 동기화 (공공데이터포털 특일 정보).

예상 배송일을 셀 때 일요일과 함께 건너뛴다. 값이 틀리면 손님에게 잘못된
도착일을 알려주게 되므로, 손으로 넣지 않고 API 에서 받는다.

응답이 XML 이라 표준 라이브러리로 파싱한다. 실패해도 예외를 올리지 않는다 —
동기화가 안 됐다고 서버가 죽으면 안 되고, 이미 들어 있는 값으로 계속 돈다.
"""
import os
import re
from datetime import datetime, timedelta, timezone

import httpx
from urllib.parse import unquote

ENDPOINT = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
_KST = timezone(timedelta(hours=9))

_ITEM = re.compile(r"<item>(.*?)</item>", re.S)
_FIELD = {
    "locdate": re.compile(r"<locdate>(\d+)</locdate>"),
    "dateName": re.compile(r"<dateName>([^<]*)</dateName>"),
    "isHoliday": re.compile(r"<isHoliday>([^<]*)</isHoliday>"),
}


def _parse(xml: str) -> list[tuple[str, str]]:
    out = []
    for chunk in _ITEM.findall(xml):
        got = {k: (p.search(chunk).group(1).strip() if p.search(chunk) else "")
               for k, p in _FIELD.items()}
        # isHoliday 가 N 인 항목(기념일 등)은 쉬는 날이 아니다.
        if got["isHoliday"] != "Y" or len(got["locdate"]) != 8:
            continue
        d = got["locdate"]
        out.append((f"{d[:4]}-{d[4:6]}-{d[6:]}", got["dateName"] or "공휴일"))
    return out


async def fetch_year(year: int, key: str) -> list[tuple[str, str]]:
    # 포털이 주는 '일반 인증키' 는 URL 인코딩된 형태다(%2B, %2F, %3D). 그대로
    # params 에 넣으면 httpx 가 % 를 다시 인코딩해 키가 깨진다(403). 먼저 푼다.
    key = unquote(key)
    found: list[tuple[str, str]] = []
    async with httpx.AsyncClient(timeout=20) as client:
        for month in range(1, 13):
            r = await client.get(ENDPOINT, params={
                "serviceKey": key, "solYear": str(year),
                "solMonth": f"{month:02d}", "numOfRows": "50",
            })
            if r.status_code >= 400:
                raise RuntimeError(f"공휴일 API 오류 (HTTP {r.status_code})")
            found.extend(_parse(r.text))
    return found


async def sync(conn, years: list[int] | None = None) -> int:
    """
    올해와 내년을 받아 넣는다.

    지난 공휴일도 지우지 않는다 — 예전 주문의 배송일을 다시 계산할 일이 있다.
    """
    key = os.environ.get("HOLIDAY_API_KEY", "").strip()
    if not key:
        return 0
    now = datetime.now(_KST)
    years = years or [now.year, now.year + 1]

    total = 0
    for year in years:
        rows = await fetch_year(year, key)
        for ymd, name in rows:
            await conn.execute(
                "insert into public.holidays (holiday_date, name, source) values ($1, $2, 'data.go.kr')"
                " on conflict (holiday_date) do update set name = excluded.name, source = excluded.source",
                ymd, name)
        total += len(rows)
    return total
