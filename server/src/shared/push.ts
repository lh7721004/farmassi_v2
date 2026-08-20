import type { Db } from '../db.ts'
import { sb } from '../sb.ts'

interface PushRow { endpoint: string; p256dh: string; auth: string }

export async function notifyFarmMembers(
  db: Db,
  params: {
    farmId: string
    orderId: string
    type: 'order_created' | 'deposit_confirmed' | 'shipment_requested'
    title: string
    body: string
    url?: string
  },
): Promise<void> {
  const client = sb(db)
  const { data: members } = await client.from('farm_members').select('user_id').eq('farm_id', params.farmId)
  const userIds = [...new Set((members ?? []).map((row: any) => row.user_id as string))]
  if (userIds.length === 0) return

  await client.from('notifications').insert(
    userIds.map((userId) => ({
      user_id: userId,
      farm_id: params.farmId,
      order_id: params.orderId,
      type: params.type,
      title: params.title,
      body: params.body,
    })),
  )

  const { data: subs } = await client
    .from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', userIds)
  await sendPush((subs ?? []) as PushRow[], {
    title: params.title,
    body: params.body,
    url: params.url ?? `/admin/farms/${params.farmId}/orders`,
  })
}

export async function sendPush(
  subscriptions: PushRow[],
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate || subscriptions.length === 0) return

  try {
    const webpush = (await import('web-push')).default
    webpush.setVapidDetails('mailto:hello@farmassi.kr', vapidPublic, vapidPrivate)
    await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        ),
      ),
    )
  } catch (error) {
    console.error('web-push 실패', error)
  }
}
