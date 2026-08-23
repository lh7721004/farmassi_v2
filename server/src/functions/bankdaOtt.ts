import { randomBytes } from 'node:crypto'
import { sb } from '../sb.ts'
import { BankdaError, createMerchant, issueAccountModifyOtt, issueAccountOtt,
         listMerchantAccounts } from '../shared/bankda.ts'
import { isAdmin } from '../shared/util.ts'
import { fail, ok, type FnHandler } from './types.ts'

/**
 * 농가 계좌 등록용 1회용 링크를 발급한다.
 *
 * 뱅크다에서 계좌는 가맹점 아래에 붙으므로, 농가에 가맹점이 없으면 먼저 만든다.
 * 가맹점 이메일은 농가 id 에서 만들어 사람이 정할 필요가 없게 했다.
 * 비밀번호는 공개 테이블에 두지 않고 private 스키마에 보관한다.
 */

/** 영문+숫자 12자. 뱅크다 규칙(영문·숫자 포함 8~20자)을 만족한다. */
function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (const n of randomBytes(12)) out += chars[n % chars.length]
  // 영문과 숫자가 각각 하나 이상 들어가도록 보정
  return `${out.slice(0, 10)}a7`
}

/**
 * 농가 id 전체를 쓴다.
 *
 * 앞 8자만 쓰면 겹칠 수 있다. 실제로 더미 농가 두 곳이 같은 접두사를 갖고 있어서
 * 두 번째 농가의 가맹점 생성이 "이미 등록된 가맹점입니다" 로 실패했다.
 * 하이픈을 뺀 32자를 붙여도 이메일 로컬 파트 길이 제한(64자) 안에 들어간다.
 */
function merchantEmailFor(farmId: string): string {
  const domain = process.env.BANKDA_MERCHANT_DOMAIN ?? 'farm.shop.lkim.me'
  return `farm-${farmId.replace(/-/g, '')}@${domain}`
}

export const bankdaOtt: FnHandler = async ({ userId, body, admin }) => {
  if (!userId) return fail('로그인이 필요합니다.', 401)
  if (!(await isAdmin(admin, userId))) return fail('관리자만 발급할 수 있습니다.', 403)

  const farmId = String(body?.farmId ?? '')
  if (!farmId) return fail('farmId 가 필요합니다.')

  const mainEmail = process.env.BANKDA_EMAIL
  if (!mainEmail) return fail('BANKDA_EMAIL 이 설정되지 않았습니다.', 500)

  const db = sb(admin)
  const { data: farm } = await db.from('farms')
    .select('id, name').eq('id', farmId).maybeSingle()
  if (!farm) return fail('농가를 찾을 수 없습니다.', 404)

  // 가맹점 정보는 private 스키마에만 둔다. farms 는 손님도 읽는 테이블이다.
  const existing = await admin.query(
    'select email from private.bankda_merchant where farm_id = $1', [farmId])
  const known: string | null = existing.rows[0]?.email ?? null

  try {
    let merchantEmail = known ?? ''

    if (!merchantEmail) {
      merchantEmail = merchantEmailFor(farmId)
      const password = randomPassword()
      try {
        await createMerchant({ email: mainEmail, merchantEmail, password, accountsCount: 1 })
      } catch (error) {
        // 가맹점은 만들어졌는데 우리 쪽 기록이 남지 않은 경우가 있을 수 있다.
        // 이미 있다는 응답이면 그대로 쓰고 진행한다.
        const message = error instanceof Error ? error.message : ''
        if (!/이미 등록된 가맹점/.test(message)) throw error
      }

      // 비밀번호는 private 스키마에만 둔다.
      await admin.query(
        `insert into private.bankda_merchant (farm_id, email, password)
         values ($1, $2, $3)
         on conflict (farm_id) do update set email = excluded.email, password = excluded.password`,
        [farmId, merchantEmail, password],
      )
    }

    // 이미 등록된 계좌를 바꾸는 경우에는 수정용 OTT 를 쓴다.
    // 가맹점당 등록 가능 계좌 수가 1이라, 등록용으로 다시 뽑으면 뱅크다가 막는다.
    const accountNumber = String(body?.accountNumber ?? '')
    const ott = accountNumber
      ? await issueAccountModifyOtt({ email: mainEmail, accountNumber })
      : await issueAccountOtt({ email: mainEmail, merchantEmail })

    return ok({
      mode: accountNumber ? 'modify' : 'register',
      url: ott.url,
      expiresIn: ott.expiresIn,
      merchantEmail,
      farmName: farm.name,
      createdMerchant: !known,
    })
  } catch (error) {
    if (error instanceof BankdaError) return fail(error.message, 502)
    throw error
  }
}
