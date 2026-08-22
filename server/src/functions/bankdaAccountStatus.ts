import { sb } from '../sb.ts'
import { BankdaError, listAccounts, listMerchantAccounts } from '../shared/bankda.ts'
import { isAdmin } from '../shared/util.ts'
import { ACCTAG } from '../shared/acttag.ts'
import { fail, ok, type FnHandler } from './types.ts'

/**
 * 농가의 뱅크다 계좌 등록 상태.
 *
 * 화면에서 "계좌 등록" 과 "등록 완료" 를 구분해 보여주기 위한 것이다.
 * 뱅크다를 매번 물어본다 — 우리 DB 에 복제해두면 실제 상태와 어긋난다.
 */
export const bankdaAccountStatus: FnHandler = async ({ userId, body, admin }) => {
  if (!userId) return fail('로그인이 필요합니다.', 401)
  if (!(await isAdmin(admin, userId))) return fail('관리자만 조회할 수 있습니다.', 403)

  const farmId = String(body?.farmId ?? '')
  if (!farmId) return fail('farmId 가 필요합니다.')

  const { data: farm } = await sb(admin).from('farms')
    .select('id, account_number, bankda_merchant_email').eq('id', farmId).maybeSingle()
  if (!farm) return fail('농가를 찾을 수 없습니다.', 404)

  const mainEmail = process.env.BANKDA_EMAIL
  if (!mainEmail) return fail('BANKDA_EMAIL 이 설정되지 않았습니다.', 500)

  const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '')
  const farmAccount = digits(farm.account_number)

  try {
    // 이 농가의 가맹점에 붙은 계좌.
    const owned = farm.bankda_merchant_email
      ? await listMerchantAccounts(mainEmail, farm.bankda_merchant_email)
      : []

    // 가맹점을 나누기 전에 등록한 계좌는 다른 가맹점 아래에 있다. 계좌번호로도 찾는다.
    // 화면이 답해야 하는 질문은 "이 농가 계좌가 뱅크다에 연결됐나" 이지
    // "우리가 만든 가맹점에 있나" 가 아니다.
    const legacy = owned.length === 0 && farmAccount
      ? (await listAccounts()).filter((a) => digits(a.account_number) === farmAccount)
      : []

    const rows = owned.length > 0 ? owned : legacy
    const accounts = rows.map((a) => ({
      accountNumber: a.account_number,
      bankName: a.bank_name,
      acttag: a.acttag,
      state: ACCTAG[a.acttag] ?? a.acttag,
      lastScrapingAt: a.last_scraping_at,
    }))
    return ok({
      registered: accounts.length > 0,
      accounts,
      // 다른 가맹점 아래에 있는 계좌는 우리 쪽 수정 링크로 못 바꾼다.
      underOwnMerchant: owned.length > 0,
    })
  } catch (error) {
    if (error instanceof BankdaError) return fail(error.message, 502)
    throw error
  }
}
