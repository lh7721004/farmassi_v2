import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { notifyFarmMembers } from './push.ts'

export type CallbackProvider = 'manual' | 'gnd' | 'hecto' | 'banksalad' | 'codef' | 'callback'

export interface IncomingDeposit {
  amount: number
  depositorName?: string
  occurredAt: string
  accountNumber?: string
  externalId?: string
  raw: Record<string, unknown>
}

export interface IngestResult {
  saved: boolean
  matched: boolean
  skipped?: string
  transactionId?: string
  orderId?: string
}

const PROVIDERS = new Set<CallbackProvider>(['manual', 'gnd', 'hecto', 'banksalad', 'codef', 'callback'])

export function parseProvider(value: string | null): CallbackProvider {
  const normalized = (value ?? '').trim().toLowerCase()
  if (PROVIDERS.has(normalized as CallbackProvider)) return normalized as CallbackProvider
  return 'callback'
}

function digits(value: string | undefined) {
  return (value ?? '').replace(/\D/g, '')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map(Object.keys(record).map((key) => [key.toLowerCase(), record[key]]))
  for (const key of keys) {
    const value = record[key] ?? lower.get(key.toLowerCase())
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  return null
}

function toIso(dateValue?: string, timeValue?: string): string {
  const date = (dateValue ?? '').replace(/\D/g, '')
  const time = (timeValue ?? '').replace(/\D/g, '').padEnd(6, '0')
  if (date.length === 8) {
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}+09:00`
    const parsed = new Date(iso)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  if (dateValue && !Number.isNaN(Date.parse(dateValue))) return new Date(dateValue).toISOString()
  return new Date().toISOString()
}

function isDepositFlag(value: unknown): boolean | null {
  const text = asString(value)?.toLowerCase()
  if (!text) return null
  if (['1', '2', 'm', 'in', 'deposit', 'credit', 'mnrc', '입금'].includes(text)) return true
  if (['3', '4', 'd', 'out', 'withdraw', 'debit', 'drot', '출금'].includes(text)) return false
  return null
}

function fromObject(record: Record<string, unknown>, fallbackAccount?: string): IncomingDeposit | null {
  const amount = parseAmount(
    pick(record, [
      'Tram',
      'tram',
      'amount',
      'amt',
      'inAmt',
      'mnrcAmt',
      'MnrcAmt',
      'trPrice',
      'payPrice',
      'deposit_amount',
      'depositAmount',
    ]),
  )
  if (amount === null || amount <= 0) return null

  const depositFlag = isDepositFlag(pick(record, ['MnrcDrotDsnc', 'TrnsDsnc', 'trnsDsnc', 'type', 'inout', 'ioGb']))
  if (depositFlag === false) return null

  const depositorName = asString(
    pick(record, [
      'BnprCntn',
      'bnprCntn',
      'Smr',
      'smr',
      'depositorName',
      'depositor_name',
      'inName',
      'inpNm',
      'rmtrNm',
      '입금자명',
    ]),
  )
  const occurredAt = toIso(
    asString(pick(record, ['Trdd', 'trdd', 'trDay', 'trDt', 'occurredAt', 'occurred_at', 'inDate', 'date'])),
    asString(pick(record, ['Txtm', 'txtm', 'trTime', 'trTm', 'time'])),
  )
  const accountNumber =
    asString(pick(record, ['Acno', 'acno', 'accountNumber', 'account_no', 'acctNo', 'vran'])) ?? fallbackAccount
  const externalId = asString(pick(record, ['Tuno', 'tuno', 'trNo', 'external_id', 'externalId', 'id']))

  return {
    amount,
    depositorName,
    occurredAt,
    accountNumber,
    externalId,
    raw: record,
  }
}

function collectRecords(payload: unknown): { records: Record<string, unknown>[]; accountNumber?: string } {
  const root = asRecord(payload)
  if (!root) return { records: [] }

  const accountNumber = asString(pick(root, ['Acno', 'acno', 'accountNumber', 'account_no', 'acctNo']))
  const nestedKeys = ['REC', 'rec', 'transactions', 'list', 'trList', 'data', 'items']
  for (const key of nestedKeys) {
    const value = pick(root, [key])
    if (Array.isArray(value)) {
      return {
        records: value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)),
        accountNumber,
      }
    }
    const nested = asRecord(value)
    if (nested) {
      const inner = collectRecords(nested)
      if (inner.records.length > 0) {
        return { records: inner.records, accountNumber: inner.accountNumber ?? accountNumber }
      }
    }
  }

  return { records: [root], accountNumber }
}

export function parseIncomingDeposits(payload: unknown): IncomingDeposit[] {
  if (payload == null) return []
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        const record = asRecord(item)
        return record ? fromObject(record) : null
      })
      .filter((item): item is IncomingDeposit => Boolean(item))
  }

  const { records, accountNumber } = collectRecords(payload)
  return records
    .map((record) => fromObject(record, accountNumber))
    .filter((item): item is IncomingDeposit => Boolean(item))
}

export function paramsToObject(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    if (key === 'token' || key === 'key' || key === 'apikey') continue
    result[key] = value
  }
  return result
}

async function findFarmId(admin: SupabaseClient, accountNumber?: string) {
  const target = digits(accountNumber)
  if (!target) return null
  const { data: farms } = await admin.from('farms').select('id, account_number')
  const farm = (farms ?? []).find((row) => digits(row.account_number as string) === target)
  return (farm?.id as string | undefined) ?? null
}

function namesMatch(depositorName: string | undefined, depositCode: string) {
  if (!depositorName) return false
  const haystack = depositorName.replace(/\s+/g, '').toUpperCase()
  const needle = depositCode.replace(/\s+/g, '').toUpperCase()
  return Boolean(needle) && haystack.includes(needle)
}

async function matchOrder(
  admin: SupabaseClient,
  deposit: IncomingDeposit,
  farmId: string | null,
) {
  let query = admin
    .from('orders')
    .select('id, farm_id, order_no, deposit_code, deposit_due_amount')
    .eq('status', 'pending_deposit')
    .eq('deposit_due_amount', deposit.amount)
  if (farmId) query = query.eq('farm_id', farmId)

  const { data: orders } = await query
  const candidates = orders ?? []
  if (candidates.length === 0) return null

  const named = candidates.filter((order) => namesMatch(deposit.depositorName, order.deposit_code as string))
  if (named.length === 1) return named[0]
  if (named.length > 1) return null
  if (farmId && candidates.length === 1) return candidates[0]
  return null
}

export async function ingestDeposit(
  admin: SupabaseClient,
  provider: CallbackProvider,
  deposit: IncomingDeposit,
): Promise<IngestResult> {
  if (deposit.externalId) {
    const { data: existing } = await admin
      .from('deposit_transactions')
      .select('id, matched_order_id, match_status')
      .eq('provider', provider)
      .filter('raw_payload->>external_id', 'eq', deposit.externalId)
      .maybeSingle()
    if (existing) {
      return {
        saved: false,
        matched: existing.match_status === 'matched',
        skipped: 'duplicate',
        transactionId: existing.id as string,
        orderId: (existing.matched_order_id as string | null) ?? undefined,
      }
    }
  }

  const farmId = await findFarmId(admin, deposit.accountNumber)
  const order = await matchOrder(admin, deposit, farmId)
  const now = new Date().toISOString()

  if (order) {
    const { error: updateError } = await admin
      .from('orders')
      .update({
        status: 'paid',
        deposit_confirmed_at: now,
        deposit_provider: provider,
      })
      .eq('id', order.id)
      .eq('status', 'pending_deposit')
    if (updateError) throw new Error(updateError.message)
  }

  const { data: inserted, error: insertError } = await admin
    .from('deposit_transactions')
    .insert({
      farm_id: (order?.farm_id as string | undefined) ?? farmId,
      provider,
      occurred_at: deposit.occurredAt,
      amount: deposit.amount,
      depositor_name: deposit.depositorName ?? order?.deposit_code ?? null,
      raw_payload: {
        ...deposit.raw,
        source: 'deposit-callback',
        external_id: deposit.externalId ?? null,
      },
      matched_order_id: order?.id ?? null,
      match_status: order ? 'matched' : 'unmatched',
    })
    .select('id')
    .single()

  if (insertError) throw new Error(insertError.message)

  if (order) {
    await notifyFarmMembers(admin, {
      farmId: order.farm_id as string,
      orderId: order.id as string,
      type: 'deposit_confirmed',
      title: '입금 확인됨, 출고 준비',
      body: `${order.order_no} 입금이 확인되었습니다. 포장을 시작해주세요.`,
    })
  }

  return {
    saved: true,
    matched: Boolean(order),
    transactionId: inserted?.id as string | undefined,
    orderId: order?.id as string | undefined,
  }
}
