from ..sb import sb
from ..shared.util import is_admin
from .types import FnCtx, FnResult, fail, ok


async def kpost_shipment(ctx: FnCtx) -> FnResult:
    if not ctx.user_id:
        return fail("로그인이 필요합니다.", 401)
    order_ids = ctx.body.get("orderIds") or []
    if not order_ids:
        return ok({
            "implemented": False,
            "message": "우체국(계약소포) API 연동은 준비 중입니다."
                       " KPOST_API_KEY / KPOST_CONTRACT_NO 환경변수를 사용할 예정입니다.",
        })

    db = sb(ctx.admin)
    orders = (await db.from_("orders").select("id, farm_id").in_("id", order_ids)).data
    if not orders:
        return fail("대상 주문이 없습니다.", 404)

    farm_ids = list(dict.fromkeys(o["farm_id"] for o in orders))
    if not await is_admin(ctx.admin, ctx.user_id):
        memberships = (await db.from_("farm_members").select("farm_id")
                       .eq("user_id", ctx.user_id).in_("farm_id", farm_ids)).data or []
        if len(memberships) != len(farm_ids):
            return fail("해당 농가의 주문만 신청할 수 있습니다.", 403)

    drafts = [{
        "order_id": o["id"],
        "provider": "kpost",
        "status": "draft",
        "request_payload": {"stub": True},
        "response_payload": {"implemented": False},
    } for o in orders]
    await db.from_("shipments").insert(drafts)

    return ok({
        "implemented": False,
        "message": "송장 초안만 저장했습니다. 우체국 API 연동 후 실제 운송장이 발급됩니다.",
        "count": len(drafts),
    })
