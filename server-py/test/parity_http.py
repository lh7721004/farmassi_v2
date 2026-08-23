"""
인증·업로드·파일 서빙 대조.

리다이렉트는 따라가지 않고 Location 헤더를 비교한다 — 카카오로 실제로
가버리면 대조가 아니라 로그인 시도가 된다. state 는 서명이라 양쪽이 같은
시크릿으로 만들면 값도 같아야 한다.
"""
import json
import os
import sys
from urllib.parse import parse_qs, urlsplit

import httpx

NODE = os.environ.get("NODE_URL", "http://127.0.0.1:4310")
PY_ = os.environ.get("PY_URL", "http://127.0.0.1:4320")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.jwt_session import sign  # noqa: E402

ADMIN = "8ae35b50-e1c2-463a-b52b-3321e3c068de"
CUSTOMER = "0a1a183f-8ab1-44ab-bfaa-54e43e7fcd72"
FARM = "00b24f79-ff20-4933-be35-fe2fb66a56a7"
TINY_PNG = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
            "z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

CASES = []


def add(name, method, path, *, subject=None, body=None, follow=False):
    CASES.append((name, method, path, subject, body, follow))


add("me: 비로그인",        "GET", "/auth/me")
add("me: 로그인",          "GET", "/auth/me", subject=ADMIN)
add("me: 잘못된 토큰",     "GET", "/auth/me", subject="BAD")
add("카카오 start",        "GET", "/auth/kakao/start")
add("카카오 start+리다이렉트", "GET", "/auth/kakao/start?redirect=https%3A%2F%2Ffarmassi.kr%2Fauth%2Fcallback")
add("카카오 start+외부주소",   "GET", "/auth/kakao/start?redirect=https%3A%2F%2Fevil.example.com%2Fx")
add("카카오 callback: 코드없음", "GET", "/auth/kakao/callback")
add("카카오 callback: state위조", "GET", "/auth/kakao/callback?code=x&state=YWJj.bm9wZQ")
add("dev-login 꺼짐",      "POST", "/auth/dev-login", body={"email": "a@b.c"})
add("파일: 없음",          "GET", "/files/nope/nope.jpg")
add("파일: 경로탈출",      "GET", "/files/../../etc/passwd")
add("업로드: 비로그인",    "POST", "/storage/upload", body={"path": f"{FARM}/a.png", "contentType": "image/png", "data": TINY_PNG})
add("업로드: 권한없음",    "POST", "/storage/upload", subject=CUSTOMER, body={"path": f"{FARM}/a.png", "contentType": "image/png", "data": TINY_PNG})
add("업로드: 경로가 농가아님", "POST", "/storage/upload", subject=ADMIN, body={"path": "notauuid/a.png", "contentType": "image/png", "data": TINY_PNG})
add("업로드: 금지 형식",   "POST", "/storage/upload", subject=ADMIN, body={"path": f"{FARM}/a.svg", "contentType": "image/svg+xml", "data": TINY_PNG})
add("업로드: 확장자 불일치", "POST", "/storage/upload", subject=ADMIN, body={"path": f"{FARM}/a.jpg", "contentType": "image/png", "data": TINY_PNG})
add("업로드: 빈 파일",     "POST", "/storage/upload", subject=ADMIN, body={"path": f"{FARM}/a.png", "contentType": "image/png", "data": ""})
add("삭제: 비로그인",      "POST", "/storage/delete", body={"path": f"{FARM}/a.png"})
add("삭제: 권한없음",      "POST", "/storage/delete", subject=CUSTOMER, body={"path": f"{FARM}/a.png"})
add("삭제: 경로 이상",     "POST", "/storage/delete", subject=ADMIN, body={"path": "notauuid/a.png"})


def main() -> int:
    same = diff = 0
    with httpx.Client(timeout=30, follow_redirects=False) as client:
        for name, method, path, subject, body, _ in CASES:
            headers = {}
            if subject:
                headers["Authorization"] = f"Bearer {sign(subject) if subject != 'BAD' else 'bad.token.x'}"
            out = []
            for base in (NODE, PY_):
                r = client.request(method, base + path, json=body, headers=headers)
                out.append((r.status_code, r.headers.get("location", ""), r.text))
            (ns, nl, nt), (ps, pl, pt) = out
            if ns == ps and nl == pl and nt == pt:
                same += 1
                print(f"  ✓ {name}")
            else:
                diff += 1
                print(f"  ✗ {name}")
                print(f"      node[{ns}] {(nl or nt)[:230]}")
                print(f"      py  [{ps}] {(pl or pt)[:230]}")
    print(f"\n  일치 {same} / 불일치 {diff}")
    return 1 if diff else 0


if __name__ == "__main__":
    raise SystemExit(main())
