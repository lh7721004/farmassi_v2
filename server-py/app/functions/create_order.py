import re

from ..sb import sb
from ..shared.push import notify_farm_members
from ..shared.util import now_iso, random_code, seoul_date_compact
from .types import FnCtx, FnResult, fail, ok


def _normalize(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


async def create_order(ctx: FnCtx) -> FnResult:
    if not ctx.user_id:
        return fail("로그인이 필요합니다.", 401)
    body = ctx.body
    recipient = body.get("recipient") or {}
    if not (body.get("farmId") and body.get("items") and recipient.get("name")
            and recipient.get("phone") and recipient.get("address")):
        return fail("주문 정보가 올바르지 않습니다.")

    db = sb(ctx.admin)
    farm = (await db.from_("farms").select("*").eq("id", body["farmId"]).maybe_single()).data
    if not farm:
        return fail("농가를 찾을 수 없습니다.", 404)
    # 비활성 농가는 화면은 열려 있지만 주문은 받지 않는다.
    # "찾을 수 없다" 고 하면 사용자가 주소를 잘못 눌렀다고 오해한다.
    if not farm["is_active"]:
        return fail("이 농가는 지금 주문을 받지 않습니다.", 409)

    products = (await db.from_("products").select("*")
                .eq("farm_id", farm["id"]).eq("sale_status", "on_sale")
                .in_("id", [item["productId"] for item in body["items"]])).data or []

    by_id = {p["id"]: p for p in products}
    lines = []
    for item in body["items"]:
        product = by_id.get(item["productId"])
        if not product or item["quantity"] < 1:
            raise Exception("판매 중인 상품만 주문할 수 있습니다.")
        lines.append({
            "product_id": product["id"],
            "product_name": product["name"],
            "unit": product["unit"],
            "unit_price": product["price"],
            "quantity": item["quantity"],
            "line_amount": product["price"] * item["quantity"],
        })
    total = sum(line["line_amount"] for line in lines)
    deposit_code = random_code(6)

    order_result = await db.from_("orders").insert({
        "order_no": f"FA{seoul_date_compact()}-{random_code(4)}",
        "farm_id": farm["id"],
        "customer_id": ctx.user_id,
        "status": "pending_deposit",
        "recipient_name": recipient["name"],
        "recipient_phone": recipient["phone"],
        "zonecode": recipient.get("zonecode"),
        "address": recipient["address"],
        "address_detail": recipient.get("addressDetail"),
        "request_memo": body.get("requestMemo"),
        "total_amount": total,
        "deposit_due_amount": total,
        "deposit_code": deposit_code,
    }).select("id").single()
    if order_result.error or not order_result.data:
        return fail((order_result.error or {}).get("message") or "주문 생성에 실패했습니다.")
    order = order_result.data

    items_result = await db.from_("order_items").insert(
        [{**line, "order_id": order["id"]} for line in lines])
    if items_result.error:
        return fail(items_result.error["message"])

    saved_rows = (await db.from_("saved_addresses")
                  .select("id, address, address_detail, zonecode")
                  .eq("user_id", ctx.user_id)).data or []
    same = next((row for row in saved_rows
                 if _normalize(row["address"]) == _normalize(recipient["address"])
                 and _normalize(row["address_detail"]) == _normalize(recipient.get("addressDetail"))
                 and _normalize(row["zonecode"]) == _normalize(recipient.get("zonecode"))), None)

    saved_payload = {
        "recipient_name": recipient["name"],
        "phone": recipient["phone"],
        "zonecode": recipient.get("zonecode"),
        "address": recipient["address"],
        "address_detail": recipient.get("addressDetail"),
        "last_used_at": now_iso(),
    }
    if same:
        await db.from_("saved_addresses").update(
            {**saved_payload, "is_default": True}).eq("id", same["id"])
    elif body.get("saveAddress"):
        await db.from_("saved_addresses").insert(
            {**saved_payload, "user_id": ctx.user_id, "is_default": True})

    await notify_farm_members(
        ctx.admin,
        farm_id=farm["id"],
        order_id=order["id"],
        type_="order_created",
        title="새 주문(입금대기)",
        body=f"{recipient['name']}님이 ₩{total:,} 주문했습니다. 입금자명 {deposit_code}",
    )
    return ok({"orderId": order["id"]})
