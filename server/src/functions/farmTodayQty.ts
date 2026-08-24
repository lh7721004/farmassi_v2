import { fail, ok, type FnHandler } from './types.ts'

/**
 * 오늘(서울) 농가에 들어온 주문 수량 합.
 *
 * 손님 스토어에서도 쓰므로 로그인 없이 호출한다. RLS 로는 다른 사람 주문을
 * 못 보므로 admin 으로 집계만 돌려준다. cancelled 는 빼고, 입금 전 주문도 센다.
 */
export const farmTodayQty: FnHandler = async ({ body, admin }) => {
  const farmId = String(body?.farmId ?? '').trim()
  if (!farmId) return fail('farmId 가 필요합니다.')

  const farm = await admin.query(
    `select coalesce(sum(oi.quantity), 0)::int as farm_qty
       from public.orders o
       join public.order_items oi on oi.order_id = o.id
      where o.farm_id = $1
        and o.status <> 'cancelled'
        and (timezone('Asia/Seoul', o.created_at))::date
            = (timezone('Asia/Seoul', now()))::date`,
    [farmId],
  )

  const byProduct = await admin.query(
    `select oi.product_id::text as product_id, sum(oi.quantity)::int as qty
       from public.orders o
       join public.order_items oi on oi.order_id = o.id
      where o.farm_id = $1
        and o.status <> 'cancelled'
        and oi.product_id is not null
        and (timezone('Asia/Seoul', o.created_at))::date
            = (timezone('Asia/Seoul', now()))::date
      group by oi.product_id`,
    [farmId],
  )

  const byProductMap: Record<string, number> = {}
  for (const row of byProduct.rows) {
    byProductMap[row.product_id as string] = Number(row.qty) || 0
  }

  return ok({
    farmQty: Number(farm.rows[0]?.farm_qty) || 0,
    byProduct: byProductMap,
  })
}
