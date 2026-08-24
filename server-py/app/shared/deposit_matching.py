"""
입금 1건을 입금대기 주문에 붙인다.

원칙: 금액이 정확히 같아야 한다. 이름과 입금코드는 후보를 좁히는 데만 쓴다.
확실하지 않으면 붙이지 않고 사람에게 넘긴다. 잘못 붙이면 주문이 잘못 출고되지만,
안 붙이면 관리자가 화면에서 확인만 하면 되기 때문이다.
"""
import re
from dataclasses import dataclass
from typing import Any, Literal

MatchReason = Literal[
    "amount_unique", "deposit_code", "recipient_name", "no_amount_match", "ambiguous"
]


@dataclass
class MatchResult:
    order_id: str | None
    reason: MatchReason
    candidate_ids: list[str]


def _normalize(value: str | None) -> str:
    """비교용 정규화: 공백 제거 + 대문자. 은행이 이름을 붙여 쓰거나 띄어 쓰는 경우가 있다."""
    return re.sub(r"\s+", "", value or "").upper()


def match_deposit(
    amount: int, depositor_name: str | None, orders: list[dict[str, Any]]
) -> MatchResult:
    same_amount = [o for o in orders if int(o["deposit_due_amount"]) == int(amount)]
    candidate_ids = [o["id"] for o in same_amount]

    if not same_amount:
        return MatchResult(None, "no_amount_match", [])

    depositor = _normalize(depositor_name)

    # 입금자명에 입금코드를 적어준 경우가 가장 확실하다.
    if depositor:
        by_code = [o for o in same_amount
                   if o["deposit_code"] and _normalize(o["deposit_code"]) in depositor]
        if len(by_code) == 1:
            return MatchResult(by_code[0]["id"], "deposit_code", candidate_ids)

    if len(same_amount) == 1:
        return MatchResult(same_amount[0]["id"], "amount_unique", candidate_ids)

    # 금액이 같은 주문이 여럿이면 이름으로 좁힌다.
    # 손님이 직접 적은 입금자명을 먼저 본다 — 수령인과 입금자가 다른 경우
    # ("김철수로 주문하고 고길동이 입금") 를 잡기 위한 것이다.
    if depositor:
        for field in ("depositor_name", "recipient_name"):
            by_name = [o for o in same_amount
                       if o.get(field) and _normalize(o[field]) == depositor]
            if len(by_name) == 1:
                return MatchResult(by_name[0]["id"], "recipient_name", candidate_ids)

    return MatchResult(None, "ambiguous", candidate_ids)
