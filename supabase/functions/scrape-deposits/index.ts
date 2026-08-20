import { adminClient, corsHeaders, getUserFromRequest, isAdmin, json } from '../_shared/http.ts'
import { notifyFarmMembers } from '../_shared/push.ts'
import { BankdaError, fetchTransactions, toBankdaDate, toIsoAt } from '../_shared/bankda.ts'
import { matchDeposit, type CandidateOrder } from '../_shared/depositMatching.ts'

const PROVIDER = 'bankda'

/**
 * 뱅크다A 에서 입금내역을 가져와 입금대기 주문에 붙인다.
 *
 * 호출 방법 두 가지:
 *   - 크론: x-cron-secret 헤더에 CRON_SECRET 값
 *   - 관리자: 화면에서 수동 실행 (Authorization 헤더)
 *
 * 뱅크다 조회는 계좌당 5분 제한이 있으므로 크론 간격을 그보다 짧게 두지 말 것.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = adminClient()

  // 인증: 크론 시크릿이거나 관리자여야 한다.
  const cronSecret = Deno.env.get('CRON_SECRET')
  const byCron = Boolean(cronSecret) && req.headers.get('x-cron-secret') === cronSecret
  if (!byCron) {
    const user = await getUserFromRequest(req)
    if (!user) return json({ error: '로그인이 필요합니다.' }, 401)
    if (!(await isAdmin(admin, user.id))) {
      return json({ error: '관리자만 실행할 수 있습니다.' }, 403)
    }
  }

  const body = (await req.json().catch(() => ({}))) as { days?: number; accountNumber?: string }
  // 기본 3일. 크론이 몇 번 실패해도 다음 실행에서 따라잡을 수 있는 폭.
  const days = Math.min(Math.max(body.days ?? 3, 1), 31)
  const now = new Date()
  const from = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)

  let rows
  try {
    rows = await fetchTransactions({
      datefrom: toBankdaDate(from),
      dateto: toBankdaDate(now),
      accountnum: body.accountNumber,
    })
  } catch (error) {
    if (error instanceof BankdaError) return json({ error: error.message }, 502)
    throw error
  }

  // 입금만 본다. 출금은 주문과 무관하다.
  const deposits = rows.filter((row) => Number(row.bkinput || 0) > 0)
  if (deposits.length === 0) {
    return json({ ok: true, fetched: rows.length, inserted: 0, matched: 0, results: [] })
  }

  // 계좌번호로 농가를 찾는다. farms.account_number 는 하이픈이 섞여 있을 수 있다.
  const { data: farms } = await admin.from('farms').select('id, account_number')
  const farmByAccount = new Map<string, string>()
  for (const farm of farms ?? []) {
    const digits = String(farm.account_number ?? '').replace(/\D/g, '')
    if (digits) farmByAccount.set(digits, farm.id as string)
  }

  const results: Array<Record<string, unknown>> = []
  let inserted = 0
  let matched = 0

  for (const row of deposits) {
    const amount = Number(row.bkinput || 0)
    const accountDigits = String(row.accountnum ?? '').replace(/\D/g, '')
    const farmId = farmByAccount.get(accountDigits) ?? null
    const depositorName = row.bkjukyo?.trim() || null

    // 이미 넣은 거래면 건너뛴다. (provider, external_id) 유니크 인덱스가 최종 방어선이다.
    const { data: existing } = await admin
      .from('deposit_transactions')
      .select('id')
      .eq('provider', PROVIDER)
      .eq('external_id', row.bkcode)
      .maybeSingle()
    if (existing) continue

    let candidates: CandidateOrder[] = []
    if (farmId) {
      const { data: orders } = await admin
        .from('orders')
        .select('id, deposit_due_amount, deposit_code, recipient_name')
        .eq('farm_id', farmId)
        .eq('status', 'pending_deposit')
      candidates = (orders ?? []) as CandidateOrder[]
    }

    const match = matchDeposit({ amount, depositorName }, candidates)

    const { error: insertError } = await admin.from('deposit_transactions').insert({
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
    // 유니크 인덱스에 걸렸다면 다른 실행이 먼저 넣은 것이므로 조용히 넘어간다.
    if (insertError) {
      results.push({ bkcode: row.bkcode, skipped: insertError.message })
      continue
    }
    inserted += 1

    if (match.orderId) {
      const { data: order } = await admin
        .from('orders')
        .update({
          status: 'paid',
          deposit_confirmed_at: new Date().toISOString(),
          deposit_provider: PROVIDER,
        })
        .eq('id', match.orderId)
        .eq('status', 'pending_deposit')  // 사람이 먼저 확인했으면 덮어쓰지 않는다
        .select('id, order_no, farm_id')
        .maybeSingle()

      if (order) {
        matched += 1
        await notifyFarmMembers(admin, {
          farmId: order.farm_id as string,
          orderId: order.id as string,
          type: 'deposit_confirmed',
          title: '입금 확인됨, 출고 준비',
          body: `${order.order_no} 입금이 확인되었습니다. 포장을 시작해주세요.`,
        })
      }
    }

    results.push({
      bkcode: row.bkcode,
      amount,
      depositorName,
      farmId,
      reason: match.reason,
      matchedOrderId: match.orderId,
      candidates: match.candidateIds.length,
    })
  }

  return json({ ok: true, fetched: rows.length, deposits: deposits.length, inserted, matched, results })
})
