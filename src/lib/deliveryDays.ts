/**
 * 농가별 배송 가능 요일.
 *
 * 번호는 JS 의 Date.getDay() 와 같다 (0=일 … 6=토). 화면에서 변환 없이
 * 그대로 비교하려는 것이다.
 *
 * 빈 배열은 '아직 설정하지 않음' 이지 '배송 안 함' 이 아니다. 설정한 농가만
 * 예상 배송일을 보여주고, 나머지는 지금까지와 똑같이 동작한다.
 */

export const WEEKDAYS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
] as const

export function normalizeDeliveryDays(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const days = value
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  return [...new Set(days)].sort((a, b) => a - b)
}

/** '월, 수, 금' — 설정이 없으면 빈 문자열. */
export function deliveryDaysLabel(days: number[]): string {
  const set = new Set(normalizeDeliveryDays(days))
  return WEEKDAYS.filter((day) => set.has(day.value)).map((day) => day.label).join(', ')
}

/**
 * 다음 배송일.
 *
 * 오늘도 후보에 넣는다 — 오전에 주문하면 당일 발송될 수 있고, 아니어도
 * '가장 가까운 배송일' 이라는 뜻은 유지된다. 설정이 없으면 null.
 */
export function nextDeliveryDate(days: number[], from = new Date()): Date | null {
  const set = new Set(normalizeDeliveryDays(days))
  if (set.size === 0) return null

  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(base)
    candidate.setDate(base.getDate() + offset)
    if (set.has(candidate.getDay())) return candidate
  }
  return null
}

/** '8월 26일(화)' */
export function formatDeliveryDate(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${WEEKDAYS[date.getDay()].label})`
}
