import nodemailer from 'nodemailer'

/**
 * 입금 알림 메일.
 *
 * 구글 SMTP + 앱 비밀번호를 쓴다. 설정이 없으면 조용히 넘어간다 —
 * 메일이 안 나간다고 입금 처리 자체가 실패하면 안 되기 때문이다.
 */

let transport: nodemailer.Transporter | null = null

function getTransport(): nodemailer.Transporter | null {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  if (!user || !pass) return null
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: { user, pass },
    })
  }
  return transport
}

const won = (n: number) => `${Number(n).toLocaleString('ko-KR')}원`

export interface DepositMail {
  amount: number
  depositorName: string | null
  occurredAt: string
  accountNumber: string
  bankName: string
  matched: boolean
  orderNo?: string | null
  farmName?: string | null
  reason: string
}

const REASON_TEXT: Record<string, string> = {
  amount_unique: '금액이 일치하는 주문이 하나뿐이라 자동 확인했습니다.',
  deposit_code: '입금자명에 입금코드가 있어 자동 확인했습니다.',
  recipient_name: '입금자명이 수령인과 같아 자동 확인했습니다.',
  no_amount_match: '금액이 맞는 입금대기 주문이 없습니다.',
  ambiguous: '금액이 같은 주문이 여러 건이라 어느 주문인지 정하지 못했습니다.',
}

export async function sendDepositMail(mail: DepositMail): Promise<boolean> {
  const mailer = getTransport()
  if (!mailer) return false

  const to = process.env.DEPOSIT_MAIL_TO
  if (!to) return false

  const when = new Date(mail.occurredAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const subject = mail.matched
    ? `[입금확인] ${won(mail.amount)} · ${mail.depositorName ?? '입금자명 없음'} · 주문 ${mail.orderNo}`
    : `[확인필요] ${won(mail.amount)} · ${mail.depositorName ?? '입금자명 없음'}`

  const lines = [
    mail.matched ? '입금이 확인되어 주문을 결제완료로 바꿨습니다.' : '입금이 들어왔지만 주문과 연결하지 못했습니다.',
    '',
    `금액       ${won(mail.amount)}`,
    `입금자명   ${mail.depositorName ?? '(없음)'}`,
    `입금시각   ${when}`,
    `계좌       ${mail.bankName} ${mail.accountNumber}`,
    mail.farmName ? `농가       ${mail.farmName}` : null,
    mail.orderNo ? `주문번호   ${mail.orderNo}` : null,
    '',
    REASON_TEXT[mail.reason] ?? mail.reason,
    mail.matched ? '' : '관리자 화면 > 입금 에서 직접 확인해주세요.',
    '',
    'https://shop.lkim.me/admin/deposits',
  ].filter((line) => line !== null)

  try {
    await mailer.sendMail({
      from: `팜어시 입금알림 <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: lines.join('\n'),
    })
    return true
  } catch (error) {
    console.error('입금 메일 발송 실패', error)
    return false
  }
}


export interface OrderMail {
  orderNo: string
  farmName: string
  amount: number
  depositCode: string
  recipientName: string
  recipientPhone: string
  address: string
  items: Array<{ name: string; quantity: number }>
  memo?: string | null
}

/**
 * 새 주문 알림 메일.
 *
 * 웹푸시가 이미 있지만 브라우저 구독이 있어야 도착한다. 실제로 관리자가
 * 농가 owner 인데도 구독이 없어 아무 알림도 못 받고 있었다. 메일은 그런
 * 전제가 없어서 확실하다.
 */
export async function sendOrderMail(mail: OrderMail): Promise<boolean> {
  const mailer = getTransport()
  if (!mailer) return false

  const to = process.env.ORDER_MAIL_TO ?? process.env.DEPOSIT_MAIL_TO
  if (!to) return false

  const items = mail.items.map((item) => `${item.name} ×${item.quantity}`).join(', ')
  const lines = [
    `${mail.farmName} 에 새 주문이 들어왔습니다.`,
    '',
    `주문번호   ${mail.orderNo}`,
    `상품       ${items}`,
    `금액       ${won(mail.amount)}`,
    `입금자명   ${mail.depositCode}`,
    '',
    `받는 분    ${mail.recipientName} · ${mail.recipientPhone}`,
    `주소       ${mail.address}`,
    mail.memo ? `요청사항   ${mail.memo}` : null,
    '',
    '입금이 확인되면 자동으로 결제완료가 됩니다.',
    '뱅크다에 계좌가 등록되지 않은 농가는 직접 확인해야 합니다.',
    '',
    'https://farmassi.kr/admin/orders',
  ].filter((line) => line !== null)

  try {
    await mailer.sendMail({
      from: `팜어시 주문알림 <${process.env.SMTP_USER}>`,
      to,
      subject: `[새주문] ${mail.farmName} · ${won(mail.amount)} · ${mail.recipientName}`,
      text: lines.join('\n'),
    })
    return true
  } catch (error) {
    console.error('주문 메일 발송 실패', error)
    return false
  }
}
