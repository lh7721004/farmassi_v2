/**
 * 예상 배송일 계산.
 *
 * 요청자 기준(2026-08-24):
 *   - 출고는 빨라야 다음날이다. 주문이 들어온 뒤 수확하기 때문이다.
 *   - 농가가 배송 요일을 정해 뒀으면 그 요일에만 출고한다.
 *   - 배송 일시정지 기간이면 그 기간이 끝난 뒤로 미룬다.
 *     (정지 중에도 주문은 받는다 — 막지 않는다)
 *   - 도착일 = 출고일 기준 일요일·공휴일을 빼고 2일 뒤.
 *     우체국 택배가 일요일과 공휴일에 움직이지 않기 때문이다.
 */
import { normalizeDeliveryDays } from './deliveryDays'

export interface PauseRange {
  start_date: string
  end_date: string
  reason?: string | null
}

const DAY = 86400000

export function todayInSeoul(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function toDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toYmd(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/** 그 날짜를 덮는 정지 구간. 여러 개가 겹치면 이어지는 만큼 끝까지 민다. */
export function pauseCovering(pauses: PauseRange[], ymd: string): PauseRange | null {
  return pauses.find((p) => p.start_date <= ymd && ymd <= p.end_date) ?? null
}

/**
 * 출고일.
 *
 * 내일부터 시작해서, 정지 기간이면 그 다음날로 밀고, 배송 요일이 정해져
 * 있으면 그 요일이 될 때까지 민다. 정지 구간이 이어 붙어 있으면 계속 밀리므로
 * 넉넉히 돌되 무한루프는 막는다.
 */
export function shipDate(
  days: number[],
  pauses: PauseRange[] = [],
  from = todayInSeoul(),
  holidays: Set<string> = new Set(),
): string | null {
  const allowed = new Set(normalizeDeliveryDays(days))
  let cursor = new Date(toDate(from).getTime() + DAY)

  for (let i = 0; i < 400; i += 1) {
    const ymd = toYmd(cursor)
    const paused = pauseCovering(pauses, ymd)
    if (paused) {
      // 정지 끝난 다음날부터 다시 본다.
      cursor = new Date(toDate(paused.end_date).getTime() + DAY)
      continue
    }
    // 일요일·공휴일에는 우체국이 움직이지 않으므로 출고도 잡지 않는다.
    const closed = cursor.getDay() === 0 || holidays.has(ymd)
    if (!closed && (allowed.size === 0 || allowed.has(cursor.getDay()))) return ymd
    cursor = new Date(cursor.getTime() + DAY)
  }
  return null
}

/**
 * 도착일 = 출고일에서 일요일·공휴일을 빼고 2일 뒤.
 *
 * 마지막에 닿은 날이 곧 도착일이므로, 세는 도중뿐 아니라 도착일 자체도
 * 휴무일이 아니어야 한다. while 이 휴무일을 건너뛰므로 그 성질이 유지된다.
 */
export function arrivalDate(ship: string, holidays: Set<string>, businessDays = 2): string {
  let cursor = toDate(ship)
  let left = businessDays
  for (let i = 0; i < 400 && left > 0; i += 1) {
    cursor = new Date(cursor.getTime() + DAY)
    const ymd = toYmd(cursor)
    if (cursor.getDay() === 0 || holidays.has(ymd)) continue   // 일요일·공휴일은 안 센다
    left -= 1
  }
  return toYmd(cursor)
}

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토']

export function formatYmd(ymd: string): string {
  const d = toDate(ymd)
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAY_LABEL[d.getDay()]})`
}

/** '"추석 연휴"로 인해 "9월 24일 ~ 9월 26일" 배송이 불가능합니다' */
export function pauseMessage(pause: PauseRange): string {
  const range = `${formatShort(pause.start_date)} ~ ${formatShort(pause.end_date)}`
  return pause.reason
    ? `"${pause.reason}"로 인해 "${range}" 배송이 불가능합니다`
    : `"${range}" 배송이 불가능합니다`
}

function formatShort(ymd: string): string {
  const d = toDate(ymd)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
