import { sb } from '../sb.ts'
import { sendPush } from '../shared/push.ts'
import { isAdmin } from '../shared/util.ts'
import { fail, ok, type FnHandler } from './types.ts'

export const sendPushFn: FnHandler = async ({ userId, body, admin }) => {
  if (!userId) return fail('로그인이 필요합니다.', 401)
  const targetUserId = (await isAdmin(admin, userId)) ? (body?.userId ?? userId) : userId

  const { data: subs } = await sb(admin).from('push_subscriptions')
    .select('endpoint, p256dh, auth').eq('user_id', targetUserId)

  await sendPush((subs ?? []) as any[], {
    title: body?.title ?? '팜어시',
    body: body?.body ?? '알림이 도착했습니다.',
    url: body?.url ?? '/admin',
  })

  return ok({ ok: true, sent: (subs ?? []).length })
}
