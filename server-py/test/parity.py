"""
Node 서버와 응답을 대조한다.

이관 중 유일하게 믿을 수 있는 기준은 지금 돌고 있는 Node 서버다. 같은 요청을
양쪽에 보내 JSON 이 바이트 단위로 같은지 본다. 다르면 그 자리에서 드러난다.

읽기만 보낸다 — 두 서버가 같은 운영 DB 를 보고 있어서 쓰기는 실제 데이터를
바꾼다. 쓰기 대조는 dev DB 로 따로 돌린다.
"""
import json
import os
import sys

import httpx

NODE = os.environ.get("NODE_URL", "http://127.0.0.1:4310")
PY_ = os.environ.get("PY_URL", "http://127.0.0.1:4320")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.jwt_session import sign  # noqa: E402

ADMIN = "8ae35b50-e1c2-463a-b52b-3321e3c068de"   # 박지훈(admin)

CASES: list[tuple[str, dict, bool]] = [
    # (이름, 요청, 로그인 여부)
    ("전체 조회",            {"table": "farms", "select": "*"}, False),
    ("컬럼 지정",            {"table": "farms", "select": "id, name"}, False),
    ("정렬 desc",            {"table": "farms", "select": "*", "order": [{"column": "created_at", "ascending": False}]}, False),
    ("정렬 asc + nulls",     {"table": "products", "select": "id, sort_order", "order": [{"column": "sort_order", "ascending": True, "nullsFirst": True}]}, False),
    ("limit",                {"table": "farms", "select": "*", "limit": 2}, False),
    ("limit + offset",       {"table": "farms", "select": "id", "order": [{"column": "id"}], "limit": 2, "offset": 1}, False),
    ("count exact",          {"table": "farms", "select": "id", "count": "exact"}, False),
    ("count head",           {"table": "farms", "select": "id", "count": "exact", "head": True}, False),
    ("eq",                   {"table": "farms", "select": "name", "filters": [{"column": "is_active", "op": "eq", "value": True}]}, False),
    ("neq",                  {"table": "farms", "select": "name", "filters": [{"column": "is_listed", "op": "neq", "value": True}]}, False),
    ("in",                   {"table": "farms", "select": "name", "filters": [{"column": "slug", "op": "in", "value": ["juyeongnongwon", "takine-podowon"]}]}, False),
    ("in 빈 배열",           {"table": "farms", "select": "name", "filters": [{"column": "slug", "op": "in", "value": []}]}, False),
    ("like",                 {"table": "farms", "select": "name", "filters": [{"column": "name", "op": "like", "value": "%농원%"}]}, False),
    ("ilike",                {"table": "farms", "select": "name", "filters": [{"column": "slug", "op": "ilike", "value": "%NONG%"}]}, False),
    ("is null",              {"table": "farms", "select": "name", "filters": [{"column": "owner_user_id", "op": "is", "value": None}]}, False),
    ("gte + lt",             {"table": "orders", "select": "order_no, total_amount", "filters": [{"column": "total_amount", "op": "gte", "value": 100}, {"column": "total_amount", "op": "lt", "value": 100000}]}, True),
    ("maybeSingle 있음",     {"table": "farms", "select": "*", "filters": [{"column": "slug", "op": "eq", "value": "juyeongnongwon"}], "single": "maybe"}, False),
    ("maybeSingle 없음",     {"table": "farms", "select": "*", "filters": [{"column": "slug", "op": "eq", "value": "없는농가"}], "single": "maybe"}, False),
    ("single 여러 개(오류)", {"table": "farms", "select": "*", "single": "one"}, False),
    ("single 없음(오류)",    {"table": "farms", "select": "*", "filters": [{"column": "slug", "op": "eq", "value": "없는농가"}], "single": "one"}, False),
    ("limit(1).maybeSingle", {"table": "farms", "select": "id", "limit": 1, "single": "maybe"}, False),
    ("임베드 1:N",           {"table": "orders", "select": "order_no, order_items(*)", "order": [{"column": "created_at"}]}, True),
    ("임베드 N:1",           {"table": "orders", "select": "order_no, farms(name, slug)", "order": [{"column": "created_at"}]}, True),
    ("임베드 별칭",          {"table": "orders", "select": "order_no, ship:shipments(tracking_number)", "order": [{"column": "created_at"}]}, True),
    ("임베드 중첩",          {"table": "orders", "select": "order_no, order_items(*), farms(name), shipments(*)", "order": [{"column": "created_at"}]}, True),
    ("RLS 익명",             {"table": "orders", "select": "order_no"}, False),
    ("RLS 로그인",           {"table": "orders", "select": "order_no", "order": [{"column": "created_at"}]}, True),
    ("프로필 본인",          {"table": "profiles", "select": "*", "filters": [{"column": "id", "op": "eq", "value": ADMIN}], "single": "maybe"}, True),
    ("없는 테이블(오류)",    {"table": "nope", "select": "*"}, False),
    ("없는 컬럼(오류)",      {"table": "farms", "select": "nope"}, False),
    ("없는 연산자(오류)",    {"table": "farms", "select": "id", "filters": [{"column": "id", "op": "wat", "value": 1}]}, False),
    ("관계 없음(오류)",      {"table": "farms", "select": "notifications(*)"}, False),
]


def main() -> int:
    token = sign(ADMIN)
    same = diff = 0
    with httpx.Client(timeout=20) as client:
        for name, body, auth in CASES:
            headers = {"Authorization": f"Bearer {token}"} if auth else {}
            out = []
            for base in (NODE, PY_):
                r = client.post(f"{base}/query", json=body, headers=headers)
                out.append((r.status_code, r.text))
            (ns, nt), (ps, pt) = out
            if ns == ps and nt == pt:
                same += 1
                print(f"  ✓ {name}")
            else:
                diff += 1
                print(f"  ✗ {name}")
                print(f"      node[{ns}] {nt[:220]}")
                print(f"      py  [{ps}] {pt[:220]}")
    print(f"\n  일치 {same} / 불일치 {diff}")
    return 1 if diff else 0


if __name__ == "__main__":
    raise SystemExit(main())
