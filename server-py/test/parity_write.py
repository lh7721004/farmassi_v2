"""
쓰기 대조. dev DB 를 대상으로만 돌린다.

두 서버가 같은 DB 를 보므로, 같은 요청을 두 번(각 서버로) 보내면 행이 두 개
생긴다. 그래서 자동 생성 컬럼(id, created_at)은 비교에서 뺀다 — 값이 다른 게
정상이다. 만든 행은 끝에 지운다.
"""
import json
import os
import sys
import uuid

import httpx

NODE = os.environ.get("NODE_URL", "http://127.0.0.1:4311")
PY_ = os.environ.get("PY_URL", "http://127.0.0.1:4321")
VOLATILE = {"id", "created_at", "updated_at"}

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.jwt_session import sign  # noqa: E402

ADMIN = "3af2c4cd-d623-4531-b915-0e10ec22f304"


def scrub(text: str) -> str:
    """자동 생성 값을 지운 뒤 비교한다."""
    try:
        payload = json.loads(text)
    except ValueError:
        return text

    def walk(node):
        if isinstance(node, list):
            return [walk(n) for n in node]
        if isinstance(node, dict):
            return {k: ("<가변>" if k in VOLATILE else walk(v)) for k, v in node.items()}
        return node

    return json.dumps(walk(payload), ensure_ascii=False, sort_keys=True)


def main() -> int:
    token = sign(ADMIN)
    headers = {"Authorization": f"Bearer {token}"}
    made: list[tuple[str, str]] = []
    same = diff = 0

    with httpx.Client(timeout=20) as client:
        def both(name: str, body: dict):
            nonlocal same, diff
            out = []
            for base in (NODE, PY_):
                r = client.post(f"{base}/query", json=body, headers=headers)
                out.append((r.status_code, r.text))
            (ns, nt), (ps, pt) = out
            if ns == ps and scrub(nt) == scrub(pt):
                same += 1
                print(f"  ✓ {name}")
            else:
                diff += 1
                print(f"  ✗ {name}")
                print(f"      node[{ns}] {nt[:200]}")
                print(f"      py  [{ps}] {pt[:200]}")
            for status, text in out:
                try:
                    data = json.loads(text).get("data")
                except ValueError:
                    continue
                for row in (data if isinstance(data, list) else [data] if data else []):
                    if isinstance(row, dict) and "id" in row and "slug" in row:
                        made.append(("farms", row["id"]))

        tag = uuid.uuid4().hex[:8]
        both("insert 단건", {"table": "farms", "op": "insert",
                             "values": {"name": f"대조농원{tag}", "slug": f"parity-{tag}"}})
        both("insert 여러 건", {"table": "farms", "op": "insert", "values": [
            {"name": f"대조A{tag}", "slug": f"parity-a-{tag}"},
            {"name": f"대조B{tag}", "slug": f"parity-b-{tag}"}]})
        both("insert 컬럼 불균일", {"table": "farms", "op": "insert", "values": [
            {"name": f"대조C{tag}", "slug": f"parity-c-{tag}"},
            {"name": f"대조D{tag}", "slug": f"parity-d-{tag}", "is_active": False}]})
        both("insert single", {"table": "farms", "op": "insert", "single": "maybe",
                               "values": {"name": f"대조E{tag}", "slug": f"parity-e-{tag}"}})
        both("insert returning false", {"table": "farms", "op": "insert", "returning": False,
                                        "values": {"name": f"대조F{tag}", "slug": f"parity-f-{tag}"}})
        both("insert 없는 컬럼(오류)", {"table": "farms", "op": "insert",
                                        "values": {"nope": 1}})
        both("update", {"table": "farms", "op": "update", "values": {"is_listed": False},
                        "filters": [{"column": "slug", "op": "like", "value": f"parity-a-{tag}"}]})
        both("update 값 없음(오류)", {"table": "farms", "op": "update", "values": {},
                                      "filters": [{"column": "slug", "op": "eq", "value": "x"}]})
        both("upsert", {"table": "farms", "op": "upsert", "onConflict": "slug", "values":
                        {"name": f"대조G{tag}", "slug": f"parity-g-{tag}", "is_active": True}})
        both("upsert 갱신", {"table": "farms", "op": "upsert", "onConflict": "slug", "values":
                             {"name": f"대조G수정{tag}", "slug": f"parity-g-{tag}", "is_active": False}})
        both("delete", {"table": "farms", "op": "delete",
                        "filters": [{"column": "slug", "op": "like", "value": f"parity-b-{tag}"}]})
        both("지원 안 하는 op(오류)", {"table": "farms", "op": "wat"})

        # 정리
        r = client.post(f"{NODE}/query", json={
            "table": "farms", "op": "delete",
            "filters": [{"column": "slug", "op": "like", "value": f"parity-%{tag}"}]}, headers=headers)
        left = client.post(f"{NODE}/query", json={
            "table": "farms", "select": "id",
            "filters": [{"column": "slug", "op": "like", "value": f"%{tag}%"}]}, headers=headers)
        remaining = json.loads(left.text).get("data") or []
        if remaining:
            client.post(f"{NODE}/query", json={
                "table": "farms", "op": "delete",
                "filters": [{"column": "id", "op": "in",
                             "value": [row["id"] for row in remaining]}]}, headers=headers)
        after = client.post(f"{NODE}/query", json={
            "table": "farms", "select": "id",
            "filters": [{"column": "slug", "op": "like", "value": f"%{tag}%"}]}, headers=headers)
        leftover = json.loads(after.text).get("data") or []
        print(f"\n  정리 후 남은 대조용 행: {len(leftover)}")

    print(f"  일치 {same} / 불일치 {diff}")
    return 1 if diff or leftover else 0


if __name__ == "__main__":
    raise SystemExit(main())
