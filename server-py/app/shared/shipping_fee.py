"""
배송비 계산.

상품마다 수량 구간별 요금표를 둔다.
    [{"qty": 1, "fee": 5000}, {"qty": 2, "fee": 7000}, {"qty": 3, "fee": 8000}]
qty 는 '이 수량까지' 를 뜻한다. 2박스를 시키면 7,000원이지 5,000×2 가 아니다.

표가 비어 있으면 0 이다 — 지금까지처럼 상품가에 포함된 것으로 본다.
기존 상품이 그대로 동작해야 하기 때문이다.
"""
from typing import Any


def normalize_tiers(raw: Any) -> list[tuple[int, int]]:
    """[{qty, fee}] 를 (수량, 요금) 목록으로. 잘못된 항목은 버린다."""
    if not isinstance(raw, list):
        return []
    tiers: list[tuple[int, int]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            qty, fee = int(item["qty"]), int(item["fee"])
        except (KeyError, TypeError, ValueError):
            continue
        if qty > 0 and fee >= 0:
            tiers.append((qty, fee))
    return sorted(tiers)


def fee_for(raw: Any, quantity: int) -> int:
    """
    이 수량의 배송비.

    표에 없는 큰 수량은 마지막 구간을 되풀이한다. 3box 까지만 정해 뒀는데
    7box 를 시키면 3box 묶음 세 번으로 본다. 실제로 상자를 나눠 보내야
    하므로 요금도 그만큼 든다.
    """
    tiers = normalize_tiers(raw)
    if not tiers or quantity <= 0:
        return 0
    for qty, fee in tiers:
        if quantity <= qty:
            return fee
    max_qty, max_fee = tiers[-1]
    groups = -(-quantity // max_qty)   # 올림
    return max_fee * groups
