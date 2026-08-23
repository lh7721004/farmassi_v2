import { sb } from '../sb.ts'
import { notifyFarmMembers } from '../shared/push.ts'
import { randomCode, seoulDateCompact } from '../shared/util.ts'
import { fail, ok, type FnHandler } from './types.ts'

const normalizeText = (value?: string | null) => (value ?? '').trim().replace(/\s+/g, ' ')

export const createOrder: FnHandler = async ({ userId, body, admin }) => {
  if (!userId) return fail('로그인이 필요합니다.', 401)
  if (!body?.farmId || !body.items?.length || !body.recipient?.name
      || !body.recipient?.phone || !body.recipient?.address) {
    return fail('주문 정보가 올바르지 않습니다.')
  }

  const db = sb(admin)
  const { data: farm } = await db.from('farms').select('*')
    .eq('id', body.farmId).maybeSingle()
  if (!farm) return fail('농가를 찾을 수 없습니다.', 404)
  // 비활성 농가는 화면은 열려 있지만 주문은 받지 않는다.
  // "찾을 수 없다" 고 하면 사용자가 주소를 잘못 눌렀다고 오해한다.
  if (!farm.is_active) return fail('이 농가는 지금 주문을 받지 않습니다.', 409)

  const { data: products } = await db.from('products').select('*')
    .eq('farm_id', farm.id).eq('sale_status', 'on_sale')
    .in('id', body.items.map((item: any) => item.productId))

  const productMap = new Map((products ?? []).map((p: any) => [p.id as string, p]))
  const lines = body.items.map((item: any) => {
    const product: any = productMap.get(item.productId)
    if (!product || item.quantity < 1) throw new Error('판매 중인 상품만 주문할 수 있습니다.')
    return {
      product_id: product.id,
      product_name: product.name,
      unit: product.unit,
      unit_price: product.price,
      quantity: item.quantity,
      line_amount: product.price * item.quantity,
    }
  })
  const total = lines.reduce((sum: number, line: any) => sum + line.line_amount, 0)
  const depositCode = randomCode(6)

  const { data: order, error: orderError } = await db.from('orders').insert({
    order_no: `FA${seoulDateCompact()}-${randomCode(4)}`,
    farm_id: farm.id,
    customer_id: userId,
    status: 'pending_deposit',
    recipient_name: body.recipient.name,
    recipient_phone: body.recipient.phone,
    zonecode: body.recipient.zonecode ?? null,
    address: body.recipient.address,
    address_detail: body.recipient.addressDetail ?? null,
    request_memo: body.requestMemo ?? null,
    total_amount: total,
    deposit_due_amount: total,
    deposit_code: depositCode,
  }).select('id').single()
  if (orderError || !order) return fail(orderError?.message ?? '주문 생성에 실패했습니다.')

  const { error: itemsError } = await db.from('order_items')
    .insert(lines.map((line: any) => ({ ...line, order_id: order.id })))
  if (itemsError) return fail(itemsError.message)

  const { data: savedRows } = await db.from('saved_addresses')
    .select('id, address, address_detail, zonecode').eq('user_id', userId)
  const sameAddress = (savedRows ?? []).find((row: any) =>
    normalizeText(row.address) === normalizeText(body.recipient.address)
    && normalizeText(row.address_detail) === normalizeText(body.recipient.addressDetail)
    && normalizeText(row.zonecode) === normalizeText(body.recipient.zonecode))

  const savedPayload = {
    recipient_name: body.recipient.name,
    phone: body.recipient.phone,
    zonecode: body.recipient.zonecode ?? null,
    address: body.recipient.address,
    address_detail: body.recipient.addressDetail ?? null,
    last_used_at: new Date().toISOString(),
  }
  if (sameAddress) {
    await db.from('saved_addresses').update({ ...savedPayload, is_default: true }).eq('id', sameAddress.id)
  } else if (body.saveAddress) {
    await db.from('saved_addresses').insert({ ...savedPayload, user_id: userId, is_default: true })
  }

  await notifyFarmMembers(admin, {
    farmId: farm.id,
    orderId: order.id,
    type: 'order_created',
    title: '새 주문(입금대기)',
    body: `${body.recipient.name}님이 ₩${total.toLocaleString('ko-KR')} 주문했습니다. 입금자명 ${depositCode}`,
  })

  return ok({ orderId: order.id })
}
