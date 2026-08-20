import { sb } from '../sb.ts'
import { isAdmin } from '../shared/util.ts'
import { fail, ok, type FnHandler } from './types.ts'

export const kpostShipment: FnHandler = async ({ userId, body, admin }) => {
  if (!userId) return fail('로그인이 필요합니다.', 401)
  const orderIds: string[] = body?.orderIds ?? []
  if (orderIds.length === 0) {
    return ok({
      implemented: false,
      message: '우체국(계약소포) API 연동은 준비 중입니다. KPOST_API_KEY / KPOST_CONTRACT_NO 환경변수를 사용할 예정입니다.',
    })
  }

  const db = sb(admin)
  const { data: orders } = await db.from('orders').select('id, farm_id').in('id', orderIds)
  if (!orders?.length) return fail('대상 주문이 없습니다.', 404)

  const farmIds = [...new Set(orders.map((o: any) => o.farm_id as string))]
  if (!(await isAdmin(admin, userId))) {
    const { data: memberships } = await db.from('farm_members')
      .select('farm_id').eq('user_id', userId).in('farm_id', farmIds)
    if ((memberships ?? []).length !== farmIds.length) {
      return fail('해당 농가의 주문만 신청할 수 있습니다.', 403)
    }
  }

  const drafts = orders.map((order: any) => ({
    order_id: order.id,
    provider: 'kpost',
    status: 'draft',
    request_payload: { stub: true },
    response_payload: { implemented: false },
  }))
  await db.from('shipments').insert(drafts)

  return ok({
    implemented: false,
    message: '송장 초안만 저장했습니다. 우체국 API 연동 후 실제 운송장이 발급됩니다.',
    count: drafts.length,
  })
}
