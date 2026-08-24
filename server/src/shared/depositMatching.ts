/**
 * 입금 1건을 입금대기 주문에 붙인다.
 *
 * 원칙: 금액이 정확히 같아야 한다. 이름과 입금코드는 후보를 좁히는 데만 쓴다.
 * 확실하지 않으면 붙이지 않고 사람에게 넘긴다. 잘못 붙이면 주문이 잘못 출고되지만,
 * 안 붙이면 관리자가 화면에서 확인만 하면 되기 때문이다.
 */

export interface CandidateOrder {
  id: string
  deposit_due_amount: number
  deposit_code: string | null
  recipient_name: string | null
  /** 손님이 직접 적은 입금자명. 수령인과 다를 수 있어 먼저 본다. */
  depositor_name?: string | null
}

export type MatchReason =
  | 'amount_unique'
  | 'deposit_code'
  | 'recipient_name'
  | 'no_amount_match'
  | 'ambiguous'

export interface MatchResult {
  orderId: string | null
  reason: MatchReason
  candidateIds: string[]
}

/** 비교용 정규화: 공백 제거 + 대문자. 은행이 이름을 붙여 쓰거나 띄어 쓰는 경우가 있다. */
function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase()
}

export function matchDeposit(
  deposit: { amount: number; depositorName?: string | null },
  orders: CandidateOrder[],
): MatchResult {
  const sameAmount = orders.filter((order) => order.deposit_due_amount === deposit.amount)
  const candidateIds = sameAmount.map((order) => order.id)

  if (sameAmount.length === 0) {
    return { orderId: null, reason: 'no_amount_match', candidateIds: [] }
  }

  const depositor = normalize(deposit.depositorName)

  // 입금자명에 입금코드를 적어준 경우가 가장 확실하다.
  if (depositor) {
    const byCode = sameAmount.filter(
      (order) => order.deposit_code && depositor.includes(normalize(order.deposit_code)),
    )
    if (byCode.length === 1) {
      return { orderId: byCode[0].id, reason: 'deposit_code', candidateIds }
    }
  }

  if (sameAmount.length === 1) {
    return { orderId: sameAmount[0].id, reason: 'amount_unique', candidateIds }
  }

  // 금액이 같은 주문이 여럿이면 이름으로 좁힌다.
  // 손님이 직접 적은 입금자명을 먼저 본다 — 수령인과 입금자가 다른 경우를 잡는다.
  if (depositor) {
    for (const field of ['depositor_name', 'recipient_name'] as const) {
      const byName = sameAmount.filter(
        (order) => order[field] && normalize(order[field]) === depositor,
      )
      if (byName.length === 1) {
        return { orderId: byName[0].id, reason: 'recipient_name', candidateIds }
      }
    }
  }

  return { orderId: null, reason: 'ambiguous', candidateIds }
}
