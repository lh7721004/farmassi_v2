import { randomBytes } from 'node:crypto'
import { sb } from '../sb.ts'
import { BankdaError, createMerchant, issueAccountOtt } from '../shared/bankda.ts'
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

function merchantEmailFor(farmId: string): string {
  const domain = process.env.BANKDA_MERCHANT_DOMAIN ?? 'farm.shop.lkim.me'
  return `farm-${farmId.slice(0, 8)}@${domain}`
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
    .select('id, name, bankda_merchant_email').eq('id', farmId).maybeSingle()
  if (!farm) return fail('농가를 찾을 수 없습니다.', 404)

  try {
    let merchantEmail: string = farm.bankda_merchant_email

    if (!merchantEmail) {
      merchantEmail = merchantEmailFor(farmId)
      const password = randomPassword()
      await createMerchant({ email: mainEmail, merchantEmail, password, accountsCount: 1 })

      // 비밀번호는 private 스키마에만 둔다.
      await admin.query(
        `insert into private.bankda_merchant (farm_id, email, password)
         values ($1, $2, $3)
         on conflict (farm_id) do update set email = excluded.email, password = excluded.password`,
        [farmId, merchantEmail, password],
      )
      await db.from('farms').update({ bankda_merchant_email: merchantEmail }).eq('id', farmId)
    }

    const ott = await issueAccountOtt({ email: mainEmail, merchantEmail })
    return ok({
      url: ott.url,
      expiresIn: ott.expiresIn,
      merchantEmail,
      farmName: farm.name,
      createdMerchant: !farm.bankda_merchant_email,
    })
  } catch (error) {
    if (error instanceof BankdaError) return fail(error.message, 502)
    throw error
  }
}
