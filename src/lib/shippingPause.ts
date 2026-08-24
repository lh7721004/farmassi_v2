/**
 * 배송 일시정지 판정.
 *
 * 농가가 정해 둔 기간 안이면 주문을 받지 않는다. 기간이 지나면 저절로
 * 풀려야 하므로 플래그가 아니라 날짜로 판단한다.
 *
 * 오늘 날짜는 서울 기준이다. 브라우저가 어느 시간대에 있든 농가와 같은
 * 날짜로 판단해야 하기 때문이다.
 */
export interface ShippingPauseFields {
  shipping_pause_start?: string | null
  shipping_pause_end?: string | null
  shipping_pause_reason?: string | null
}

export function todayInSeoul(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

/** 정지 기간 안이면 { start, end, reason }, 아니면 null. */
export function activeShippingPause(
  farm: ShippingPauseFields | null | undefined,
  today = todayInSeoul(),
): { start: string; end: string; reason: string | null } | null {
  const start = farm?.shipping_pause_start
  const end = farm?.shipping_pause_end
  if (!start || !end) return null
  // 'YYYY-MM-DD' 는 사전순 비교가 곧 날짜 비교다.
  if (today < start || today > end) return null
  return { start, end, reason: farm?.shipping_pause_reason ?? null }
}

export function shippingPauseMessage(
  pause: { start: string; end: string; reason: string | null },
): string {
  const range = `${pause.start.slice(5).replace('-', '월 ')}일 ~ ${pause.end.slice(5).replace('-', '월 ')}일`
  return pause.reason
    ? `${range} 배송이 멈춥니다 · ${pause.reason}`
    : `${range} 배송이 멈춥니다`
}
