/**
 * 뱅크다A 거래내역 조회 (bank_tr.php).
 *
 * 조회는 계좌당 5분에 한 번만 된다. 제한에 걸리면 응답 본문의 description 에
 * 남은 시간이 담겨 오므로 그대로 올려보낸다.
 */

const TRANSACTIONS_URL = 'https://a.bankda.com/dtsvc/bank_tr.php'

export interface BankdaRow {
  bkcode: string
  accountnum: string
  bkname: string
  bkdate: string
  bktime: string
  bkjukyo: string
  bkcontent: string
  bketc: string
  bkinput: string
  bkoutput: string
  bkjango: string
}

export class BankdaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BankdaError'
  }
}

function accessToken(): string {
  const token = Deno.env.get('BANKDA_ACCESS_TOKEN')?.trim()
  if (!token) throw new BankdaError('BANKDA_ACCESS_TOKEN 이 설정되지 않았습니다.')
  return token
}

export function toBankdaDate(date: Date): string {
  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return seoul.toISOString().slice(0, 10).replace(/-/g, '')
}

/** 거래일자(YYYYMMDD) + 거래시간(HHMMSS) 을 KST 기준 ISO 문자열로 바꾼다. */
export function toIsoAt(bkdate: string, bktime: string): string {
  const t = (bktime || '').padStart(6, '0')
  const iso = `${bkdate.slice(0, 4)}-${bkdate.slice(4, 6)}-${bkdate.slice(6, 8)}` +
    `T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}+09:00`
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

export async function fetchTransactions(options: {
  datefrom: string
  dateto: string
  accountnum?: string
  istest?: boolean
}): Promise<BankdaRow[]> {
  const token = accessToken()
  const body = new URLSearchParams({
    datefrom: options.datefrom,
    dateto: options.dateto,
    datatype: 'json',
    charset: 'utf8',
    istest: options.istest ? 'y' : 'n',
  })
  if (options.accountnum) body.set('accountnum', options.accountnum.replace(/\D/g, ''))

  const response = await fetch(TRANSACTIONS_URL, {
    method: 'POST',
    headers: {
      // 문서마다 표기가 달라 둘 다 보낸다.
      Authorization: `Bearer ${token}`,
      access_token: token,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body,
  })

  const text = await response.text()
  if (!response.ok) throw new BankdaError(`뱅크다 응답 오류 (HTTP ${response.status})`)

  let parsed: { response?: { bank?: BankdaRow[]; description?: string } }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BankdaError(`JSON 이 아닌 응답을 받았습니다: ${text.slice(0, 200)}`)
  }

  const rows = parsed.response?.bank ?? []
  const description = parsed.response?.description?.trim() ?? ''
  // 조회 제한이나 통신 오류는 description 에 담겨 온다.
  if (rows.length === 0 && description) throw new BankdaError(description)
  return rows
}
