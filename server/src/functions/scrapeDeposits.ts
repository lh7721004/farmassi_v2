import { sb } from '../sb.ts'
import { BankdaError, fetchTransactions, toBankdaDate, toIsoAt } from '../shared/bankda.ts'
import { matchDeposit, type CandidateOrder } from '../shared/depositMatching.ts'
import { sendDepositMail } from '../shared/mailer.ts'
import { notifyFarmMembers } from '../shared/push.ts'
import { isAdmin } from '../shared/util.ts'
import { fail, ok, type FnHandler } from './types.ts'

const PROVIDER = 'bankda'

/**
 * 뱅크다A 에서 입금내역을 가져와 입금대기 주문에 붙인다.
 *
 * 크론은 x-cron-secret 헤더로, 관리자는 로그인 상태로 호출한다.
 * 뱅크다 조회는 계좌당 5분 제한이 있으므로 크론 간격을 그보다 짧게 두지 말 것.
 */
export const scrapeDeposits: FnHandler = async ({ userId, body, admin }) => {
  if (!body?.__byCron) {
    if (!userId) return fail('로그인이 필요합니다.', 401)
    if (!(await isAdmin(admin, userId))) return fail('관리자만 실행할 수 있습니다.', 403)
  }

  const db = sb(admin)
  const days = Math.min(Math.max(Number(body?.days ?? 3), 1), 31)
  const now = new Date()
  const from = new Date(now.getTime() - (days - 1) * 86400000)

  // 뱅크다를 부르지 않아도 되는 일이라 먼저 한다.
  // 조회가 5분 제한에 걸려도 예전 입금은 계속 붙여볼 수 있어야 한다.
  const rematched = await rematchUnmatched(db, admin)

  // 뱅크다가 아직 새로 긁어간 게 없으면 거래내역을 부르지 않는다.
  // 스케줄러가 계좌의 last_scraping_at 을 보고 판단해서 이 값을 넘긴다.
  if (body?.rematchOnly) return ok({ rematchOnly: true, rematched })

  let rows
  try {
    rows = await fetchTransactions({
      datefrom: toBankdaDate(from),
      dateto: toBankdaDate(now),
      accountnum: body?.accountNumber,
    })
  } catch (error) {
    if (error instanceof BankdaError) {
      return { status: 502, body: { error: error.message, rematched } }
    }
    throw error
  }

  const deposits = rows.filter((row) => Number(row.bkinput || 0) > 0)
  if (deposits.length === 0) {
    return ok({ fetched: rows.length, inserted: 0, matched: 0, rematched, results: [] })
  }

  const { data: farms } = await db.from('farms').select('id, name, account_number')
  const farmByAccount = new Map<string, { id: string; name: string }>()
  for (const farm of (farms ?? []) as any[]) {
    const digits = String(farm.account_number ?? '').replace(/\D/g, '')
    if (digits) farmByAccount.set(digits, { id: farm.id, name: farm.name })
  }

  const results: Array<Record<string, unknown>> = []
  let inserted = 0
  let matched = 0

  for (const row of deposits) {
    const amount = Number(row.bkinput || 0)
    const farm = farmByAccount.get(String(row.accountnum ?? '').replace(/\D/g, '')) ?? null
    const farmId = farm?.id ?? null
    const depositorName = row.bkjukyo?.trim() || null

    const { data: existing } = await db.from('deposit_transactions').select('id')
      .eq('provider', PROVIDER).eq('external_id', row.bkcode).maybeSingle()
    if (existing) continue

    let candidates: CandidateOrder[] = []
    if (farmId) {
      const { data: orders } = await db.from('orders')
        .select('id, deposit_due_amount, deposit_code, recipient_name')
        .eq('farm_id', farmId).eq('status', 'pending_deposit')
      candidates = (orders ?? []) as CandidateOrder[]
    }

    const match = matchDeposit({ amount, depositorName }, candidates)

    const { error: insertError } = await db.from('deposit_transactions').insert({
      farm_id: farmId,
      provider: PROVIDER,
      external_id: row.bkcode,
      occurred_at: toIsoAt(row.bkdate, row.bktime),
      amount,
      depositor_name: depositorName,
      raw_payload: { source: 'bankda', match_reason: match.reason, row },
      matched_order_id: match.orderId,
      match_status: match.orderId ? 'matched' : 'unmatched',
    })
    if (insertError) {
      results.push({ bkcode: row.bkcode, skipped: insertError.message })
      continue
    }
    inserted += 1

    let matchedOrderNo: string | null = null
    if (match.orderId) {
      // 사람이 먼저 확인한 주문은 덮어쓰지 않는다.
      const { data: updated } = await db.from('orders').update({
        status: 'paid',
        deposit_confirmed_at: new Date().toISOString(),
        deposit_provider: PROVIDER,
      }).eq('id', match.orderId).eq('status', 'pending_deposit').select('id, order_no, farm_id')

      const order = (updated ?? [])[0]
      if (order) {
        matched += 1
        matchedOrderNo = order.order_no
        await notifyFarmMembers(admin, {
          farmId: order.farm_id,
          orderId: order.id,
          type: 'deposit_confirmed',
          title: '입금 확인됨, 출고 준비',
          body: `${order.order_no} 입금이 확인되었습니다. 포장을 시작해주세요.`,
        })
      }
    }

    // 새로 들어온 입금 1건마다 메일 1통. 이미 넣은 거래는 위에서 걸러졌으므로 중복 발송되지 않는다.
    const mailed = await sendDepositMail({
      amount,
      depositorName,
      occurredAt: toIsoAt(row.bkdate, row.bktime),
      accountNumber: String(row.accountnum ?? ''),
      bankName: String(row.bkname ?? ''),
      matched: Boolean(matchedOrderNo),
      orderNo: matchedOrderNo,
      farmName: farm?.name ?? null,
      reason: match.reason,
    })

    results.push({
      bkcode: row.bkcode, amount, depositorName, farmId, mailed,
      reason: match.reason, matchedOrderId: match.orderId, candidates: match.candidateIds.length,
    })
  }

  return ok({ fetched: rows.length, deposits: deposits.length, inserted, matched, rematched, results })
}

/** unmatched 로 남은 입금을 현재 입금대기 주문과 다시 맞춰본다. */
async function rematchUnmatched(db: ReturnType<typeof sb>, admin: any): Promise<number> {
  const { data: pending } = await db.from('deposit_transactions')
    .select('id, farm_id, amount, depositor_name')
    .eq('provider', PROVIDER)
    .eq('match_status', 'unmatched')
  if (!pending?.length) return 0

  let count = 0
  for (const deposit of pending as any[]) {
    if (!deposit.farm_id) continue

    const { data: orders } = await db.from('orders')
      .select('id, deposit_due_amount, deposit_code, recipient_name')
      .eq('farm_id', deposit.farm_id).eq('status', 'pending_deposit')

    const match = matchDeposit(
      { amount: deposit.amount, depositorName: deposit.depositor_name },
      (orders ?? []) as CandidateOrder[],
    )
    if (!match.orderId) continue

    const { data: updated } = await db.from('orders').update({
      status: 'paid',
      deposit_confirmed_at: new Date().toISOString(),
      deposit_provider: PROVIDER,
    }).eq('id', match.orderId).eq('status', 'pending_deposit').select('id, order_no, farm_id')

    const order = (updated ?? [])[0]
    if (!order) continue

    await db.from('deposit_transactions').update({
      matched_order_id: match.orderId,
      match_status: 'matched',
    }).eq('id', deposit.id)

    count += 1
    await notifyFarmMembers(admin, {
      farmId: order.farm_id,
      orderId: order.id,
      type: 'deposit_confirmed',
      title: '입금 확인됨, 출고 준비',
      body: `${order.order_no} 입금이 확인되었습니다. 포장을 시작해주세요.`,
    })

    const { data: farm } = await db.from('farms').select('name, account_number, bank_name')
      .eq('id', deposit.farm_id).maybeSingle()
    await sendDepositMail({
      amount: deposit.amount,
      depositorName: deposit.depositor_name,
      occurredAt: new Date().toISOString(),
      accountNumber: farm?.account_number ?? '',
      bankName: farm?.bank_name ?? '',
      matched: true,
      orderNo: order.order_no,
      farmName: farm?.name ?? null,
      reason: match.reason,
    })
  }
  return count
}
