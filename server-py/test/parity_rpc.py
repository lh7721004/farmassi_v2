"""
Edge Function 대조.

부작용 없는 경로만 고른다 — 권한 거부, 검증 실패, 없는 대상, 조회. 실제로
주문을 만들거나 뱅크다를 부르는 경로는 여기서 돌리지 않는다.
"""
import json
import os
import sys

import httpx

NODE = os.environ.get("NODE_URL", "http://127.0.0.1:4310")
PY_ = os.environ.get("PY_URL", "http://127.0.0.1:4320")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.jwt_session import sign  # noqa: E402

ADMIN = "8ae35b50-e1c2-463a-b52b-3321e3c068de"      # 박지훈(admin)
CUSTOMER = "0a1a183f-8ab1-44ab-bfaa-54e43e7fcd72"   # 일반 사용자
MISSING = "00000000-0000-4000-8000-000000000000"

# (이름, 함수, 본문, 토큰 주체)  — 주체 None 이면 비로그인
CASES = [
    ("없는 함수",              "nope",                   {}, ADMIN),
    ("승인: 비로그인",         "approve-farm",           {}, None),
    ("승인: 권한없음",         "approve-farm",           {"applicationId": MISSING, "action": "approve"}, CUSTOMER),
    ("승인: 인자없음",         "approve-farm",           {}, ADMIN),
    ("승인: 없는 신청",        "approve-farm",           {"applicationId": MISSING, "action": "approve"}, ADMIN),
    ("입금확인: 비로그인",     "confirm-deposit",        {}, None),
    ("입금확인: 권한없음",     "confirm-deposit",        {"orderId": MISSING}, CUSTOMER),
    ("입금확인: 인자없음",     "confirm-deposit",        {}, ADMIN),
    ("입금확인: 없는 주문",    "confirm-deposit",        {"orderId": MISSING}, ADMIN),
    ("주문: 비로그인",         "create-order",           {}, None),
    ("주문: 정보부족",         "create-order",           {"farmId": MISSING}, CUSTOMER),
    ("주문: 없는 농가",        "create-order",           {"farmId": MISSING, "items": [{"productId": MISSING, "quantity": 1}], "recipient": {"name": "홍길동", "phone": "010-0000-0000", "address": "서울"}}, CUSTOMER),
    ("대사: 비로그인",         "match-deposit",          {}, None),
    ("대사: 권한없음",         "match-deposit",          {"depositId": MISSING}, CUSTOMER),
    ("대사: 인자없음",         "match-deposit",          {}, ADMIN),
    ("대사: 없는 입금",        "match-deposit",          {"depositId": MISSING}, ADMIN),
    ("택배: 비로그인",         "kpost-shipment",         {}, None),
    ("택배: 빈 목록",          "kpost-shipment",         {}, ADMIN),
    ("택배: 없는 주문",        "kpost-shipment",         {"orderIds": [MISSING]}, ADMIN),
    ("푸시: 비로그인",         "send-push",              {}, None),
    ("푸시: 구독없음",         "send-push",              {"userId": MISSING}, ADMIN),
    ("계좌상태: 비로그인",     "bankda-account-status",  {}, None),
    ("계좌상태: 권한없음",     "bankda-account-status",  {"farmId": MISSING}, CUSTOMER),
    ("계좌상태: 인자없음",     "bankda-account-status",  {}, ADMIN),
    ("계좌상태: 없는 농가",    "bankda-account-status",  {"farmId": MISSING}, ADMIN),
    ("OTT: 비로그인",          "bankda-ott",             {}, None),
    ("OTT: 권한없음",          "bankda-ott",             {"farmId": MISSING}, CUSTOMER),
    ("OTT: 인자없음",          "bankda-ott",             {}, ADMIN),
    ("OTT: 없는 농가",         "bankda-ott",             {"farmId": MISSING}, ADMIN),
    ("스크랩: 비로그인",       "scrape-deposits",        {}, None),
    ("스크랩: 권한없음",       "scrape-deposits",        {}, CUSTOMER),
    ("주소: 비로그인",         "naver-address",          {"action": "search", "query": "서울"}, None),
    ("주소: 잘못된 action",    "naver-address",          {"action": "wat"}, CUSTOMER),
    ("주소: 짧은 검색어",      "naver-address",          {"action": "search", "query": "가"}, CUSTOMER),
    ("주소: 좌표 없음",        "naver-address",          {"action": "reverse"}, CUSTOMER),
    ("주소: 좌표 이상",        "naver-address",          {"action": "reverse", "lat": "abc", "lng": None}, CUSTOMER),
    ("주소: 검색",             "naver-address",          {"action": "search", "query": "서울 중랑구 중랑천로12길 4"}, CUSTOMER),
    ("주소: 역지오코딩",       "naver-address",          {"action": "reverse", "lat": 37.6, "lng": 127.08}, CUSTOMER),
]


def main() -> int:
    same = diff = 0
    with httpx.Client(timeout=40) as client:
        for name, fn, body, subject in CASES:
            headers = {"Authorization": f"Bearer {sign(subject)}"} if subject else {}
            out = []
            for base in (NODE, PY_):
                r = client.post(f"{base}/rpc/{fn}", json=body, headers=headers)
                out.append((r.status_code, r.text))
            (ns, nt), (ps, pt) = out
            if ns == ps and nt == pt:
                same += 1
                print(f"  ✓ {name}")
            else:
                diff += 1
                print(f"  ✗ {name}")
                print(f"      node[{ns}] {nt[:260]}")
                print(f"      py  [{ps}] {pt[:260]}")
    print(f"\n  일치 {same} / 불일치 {diff}")
    return 1 if diff else 0


if __name__ == "__main__":
    raise SystemExit(main())
