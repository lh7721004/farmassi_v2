import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import {
  arrivalDate, isAfterCutoff, pauseCovering, shipDate, todayInSeoul, type PauseRange,
} from './deliveryEstimate'

/**
 * 농가의 예상 배송일정.
 *
 * 정지 구간과 공휴일을 DB 에서 읽어 계산한다. 정지 구간은 관리자와 농가가
 * 각각 걸 수 있어 행이 여러 개고, 겹치면 계산이 알아서 합산한다.
 */
export function useShippingSchedule(farmId: string | null | undefined, days: number[] | null | undefined) {
  const [pauses, setPauses] = useState<PauseRange[]>([])
  const [holidays, setHolidays] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!farmId) return
    let alive = true
    void (async () => {
      const today = todayInSeoul()
      const [pauseRes, holidayRes] = await Promise.all([
        supabase.from('shipping_pauses').select('start_date, end_date, reason')
          .eq('farm_id', farmId).gte('end_date', today),
        supabase.from('holidays').select('holiday_date').gte('holiday_date', today),
      ])
      if (!alive) return
      setPauses((pauseRes.data ?? []) as PauseRange[])
      setHolidays(new Set((holidayRes.data ?? []).map((row: any) => row.holiday_date)))
      setReady(true)
    })()
    return () => { alive = false }
  }, [farmId])

  const today = todayInSeoul()
  const ship = shipDate(days ?? [], pauses, today, holidays)
  // 마감이 없었다면 언제 나갔을까. 이것과 실제 출고일이 다르면 마감 때문에
  // 밀린 것이고, 그때만 마감 안내를 띄운다.
  const shipIfInTime = shipDate(days ?? [], pauses, today, holidays, false)
  return {
    /** 마감 때문에 출고가 밀렸나 (= 원래는 더 이른 날 나갈 수 있었나) */
    missedCutoff: isAfterCutoff() && Boolean(shipIfInTime) && shipIfInTime !== ship,
    ready,
    pauses,
    /** 오늘 정지 중인가 (주문은 받되 안내를 띄운다) */
    activePause: pauseCovering(pauses, today),
    /** 출고를 미루게 만든 정지 (미래 정지 포함) */
    blockingPause: ship ? null : (pauses[0] ?? null),
    shipDate: ship,
    arrivalDate: ship ? arrivalDate(ship, holidays) : null,
  }
}
