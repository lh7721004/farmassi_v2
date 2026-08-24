"""오늘(서울) 농가에 들어온 주문 수량 합.

손님 스토어에서도 쓰므로 로그인 없이 호출한다. RLS 로는 다른 사람 주문을
못 보므로 admin 으로 집계만 돌려준다. cancelled 는 빼고, 입금 전 주문도 센다.
"""
from .types import FnCtx, FnResult, fail, ok


async def farm_today_qty(ctx: FnCtx) -> FnResult:
    farm_id = str((ctx.body or {}).get("farmId") or "").strip()
    if not farm_id:
        return fail("farmId 가 필요합니다.")

    farm_qty = await ctx.admin.fetchval(
        """
        select coalesce(sum(oi.quantity), 0)::int
          from public.orders o
          join public.order_items oi on oi.order_id = o.id
         where o.farm_id = $1
           and o.status <> 'cancelled'
           and (timezone('Asia/Seoul', o.created_at))::date
               = (timezone('Asia/Seoul', now()))::date
        """,
        farm_id,
    )

    rows = await ctx.admin.fetch(
        """
        select oi.product_id::text as product_id, sum(oi.quantity)::int as qty
          from public.orders o
          join public.order_items oi on oi.order_id = o.id
         where o.farm_id = $1
           and o.status <> 'cancelled'
           and oi.product_id is not null
           and (timezone('Asia/Seoul', o.created_at))::date
               = (timezone('Asia/Seoul', now()))::date
         group by oi.product_id
        """,
        farm_id,
    )

    by_product = {str(row["product_id"]): int(row["qty"] or 0) for row in rows}
    return ok({"farmQty": int(farm_qty or 0), "byProduct": by_product})
