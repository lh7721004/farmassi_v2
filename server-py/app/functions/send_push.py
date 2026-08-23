from ..sb import sb
from ..shared.push import send_push
from ..shared.util import is_admin
from .types import FnCtx, FnResult, fail, ok


async def send_push_fn(ctx: FnCtx) -> FnResult:
    if not ctx.user_id:
        return fail("로그인이 필요합니다.", 401)
    # 관리자면 다른 사용자에게도 보낼 수 있다. 아니면 자기 자신에게만.
    if await is_admin(ctx.admin, ctx.user_id):
        target = ctx.body.get("userId") or ctx.user_id
    else:
        target = ctx.user_id

    subs = (await sb(ctx.admin).from_("push_subscriptions")
            .select("endpoint, p256dh, auth").eq("user_id", target)).data or []

    await send_push(
        subs,
        title=ctx.body.get("title") or "팜어시",
        body=ctx.body.get("body") or "알림이 도착했습니다.",
        url=ctx.body.get("url") or "/admin",
    )
    return ok({"ok": True, "sent": len(subs)})
