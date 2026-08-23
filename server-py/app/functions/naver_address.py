"""
주소 검색·역지오코딩.

이름은 naver-address 지만 실제로는 카카오 로컬 API 를 쓴다. Supabase Edge
Function 시절 이름을 그대로 유지한 것 — 프론트 호출부를 고치지 않기 위해서다.
DB 를 쓰지 않는다.
"""
import math
import os
import re
from typing import Any

import httpx

from .types import FnCtx, FnResult, fail, ok

ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
COORD_URL = "https://dapi.kakao.com/v2/local/geo/coord2address.json"
MAX_RESULTS = 45


def _kakao_headers() -> dict[str, str]:
    key = os.environ.get("KAKAO_REST_API_KEY")
    if not key:
        raise Exception("카카오 REST API 키(KAKAO_REST_API_KEY)가 설정되지 않았습니다.")
    return {"Accept": "application/json", "Authorization": f"KakaoAK {key}"}


def _normalize_keyword(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def _with_space_before_number(value: str) -> str:
    return re.sub(r"([가-힣A-Za-z]+)(\d[\d-]*)$", r"\1 \2", value)


def _road_only_keyword(value: str) -> str:
    return re.sub(r"\s*\d[\d-]*$", "", value).strip()


def _build_search_queries(text: str) -> list[str]:
    normalized = _normalize_keyword(text)
    spaced = _normalize_keyword(_with_space_before_number(normalized))
    road_only = _normalize_keyword(_road_only_keyword(spaced))
    has_trailing_number = bool(re.search(r"\d[\d-]*$", spaced))
    queries = [normalized]

    if spaced and spaced != normalized:
        queries.append(spaced)
    if has_trailing_number and len(road_only) >= 2 and road_only not in (normalized, spaced):
        queries.append(road_only)

    return list(dict.fromkeys(queries))


def _number(value: Any) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return math.nan
    return n


def _to_candidate(
    address: str, lat: float, lng: float, zonecode: str, name: str | None = None
) -> dict | None:
    if not address or not math.isfinite(lat) or not math.isfinite(lng):
        return None
    return {
        "id": f"addr:{_fmt(lng)},{_fmt(lat)},{address}",
        "name": (name or "").strip() or address,
        "address": address,
        "zonecode": zonecode,
        "lat": lat,
        "lng": lng,
    }


def _fmt(n: float) -> str:
    """JS 의 숫자 문자열화와 같게 — 정수는 소수점을 붙이지 않는다."""
    return str(int(n)) if n == int(n) else repr(n)


def _from_address_document(doc: dict) -> dict | None:
    road = doc.get("road_address") or {}
    address = (road.get("address_name") or doc.get("address_name")
               or (doc.get("address") or {}).get("address_name") or "")
    lat = _number(road.get("y") if road.get("y") is not None else doc.get("y"))
    lng = _number(road.get("x") if road.get("x") is not None else doc.get("x"))
    zonecode = road.get("zone_no") or ""
    name = (road.get("building_name") or "").strip() or address
    return _to_candidate(address, lat, lng, zonecode, name)


def _from_keyword_document(doc: dict) -> dict | None:
    address = doc.get("road_address_name") or doc.get("address_name") or ""
    name = (doc.get("place_name") or "").strip() or address
    return _to_candidate(address, _number(doc.get("y")), _number(doc.get("x")), "", name)


def _kakao_error(response: httpx.Response) -> Exception:
    """
    카카오가 돌려준 실패 사유를 그대로 올린다.

    원본은 전부 '주소 검색에 실패했습니다.' 로 뭉갰는데, 그러면 키가 잘못된 건지
    서비스가 꺼진 건지 화면에서 알 수가 없다.
    """
    try:
        body = response.json()
        detail = body.get("message") or body.get("errorType") or ""
    except ValueError:
        detail = ""
    if re.search("disabled OPEN_MAP_AND_LOCAL", detail, re.IGNORECASE):
        return Exception("카카오 개발자센터에서 이 앱의 카카오맵(로컬) 서비스를 켜야 주소 검색이 됩니다.")
    if response.status_code == 401:
        return Exception("카카오 REST API 키가 올바르지 않습니다.")
    return Exception(f"주소 검색 실패: {detail}" if detail
                     else f"주소 검색 실패 (HTTP {response.status_code})")


async def _collect(
    client: httpx.AsyncClient, url: str, query: str, pages: int,
    to_candidate, seen: set[str], results: list[dict], *, optional: bool = False,
) -> None:
    for page in range(1, pages + 1):
        response = await client.get(
            url, params={"query": query, "page": page, "size": 15}, headers=_kakao_headers())
        if response.status_code >= 400:
            # 키워드 검색은 보조 수단이라 실패해도 주소 검색 결과만으로 진행한다.
            # 다만 권한 문제는 주소 검색에서도 똑같이 나므로 거기서 걸린다.
            if optional:
                return
            raise _kakao_error(response)
        payload = response.json()
        page_items = [c for c in (to_candidate(d) for d in payload.get("documents") or []) if c]

        for item in page_items:
            if item["id"] in seen:
                continue
            seen.add(item["id"])
            results.append(item)
            if len(results) >= MAX_RESULTS:
                return

        if (payload.get("meta") or {}).get("is_end") or not page_items:
            break


async def _search_addresses(query: str) -> list[dict]:
    seen: set[str] = set()
    results: list[dict] = []
    queries = _build_search_queries(query)

    async with httpx.AsyncClient(timeout=20) as client:
        for keyword in queries:
            await _collect(client, ADDRESS_URL, keyword, 3, _from_address_document, seen, results)
            if len(results) >= MAX_RESULTS:
                break

        if len(results) < 5:
            for keyword in queries:
                await _collect(client, KEYWORD_URL, keyword, 2, _from_keyword_document,
                               seen, results, optional=True)
                if len(results) >= MAX_RESULTS:
                    break

    return results


async def _reverse_address(lat: float, lng: float) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            COORD_URL, params={"x": _fmt(lng), "y": _fmt(lat), "input_coord": "WGS84"},
            headers=_kakao_headers())
    if response.status_code >= 400:
        raise _kakao_error(response)
    documents = response.json().get("documents") or []
    if not documents:
        raise Exception("이 위치의 주소를 찾지 못했습니다. 주소 검색을 이용해 주세요.")

    doc = documents[0]
    road = doc.get("road_address") or {}
    jibun = doc.get("address") or {}
    address = road.get("address_name") or jibun.get("address_name") or ""
    if not address:
        raise Exception("이 위치의 주소를 찾지 못했습니다. 주소 검색을 이용해 주세요.")

    return {
        "id": f"coord:{_fmt(lng)},{_fmt(lat)}",
        "name": (road.get("building_name") or "").strip() or address,
        "address": address,
        "zonecode": road.get("zone_no") or jibun.get("zone_no") or "",
        "lat": lat,
        "lng": lng,
    }


async def naver_address(ctx: FnCtx) -> FnResult:
    if not ctx.user_id:
        return fail("로그인이 필요합니다.", 401)
    try:
        action = ctx.body.get("action")
        if action == "search":
            query = (ctx.body.get("query") or "").strip()
            if len(query) < 2:
                return fail("검색어를 입력해 주세요.")
            return ok({"results": await _search_addresses(query)})
        if action == "reverse":
            lat, lng = _number(ctx.body.get("lat")), _number(ctx.body.get("lng"))
            if not math.isfinite(lat) or not math.isfinite(lng):
                return fail("위치 정보가 올바르지 않습니다.")
            return ok({"result": await _reverse_address(lat, lng)})
        return fail("요청이 올바르지 않습니다.")
    except Exception as error:  # noqa: BLE001
        return fail(str(error) or "주소 조회에 실패했습니다.", 500)
