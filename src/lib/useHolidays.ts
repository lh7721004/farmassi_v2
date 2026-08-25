import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * 그 달의 공휴일.
 *
 * 달력마다 따로 짜지 않도록 여기로 모았다. 배송 일시정지 달력과 배송 이력
 * 달력이 같은 값을 쓴다.
 *
 * 값은 공공데이터포털 특일 정보 API 가 채운다(server-py/app/shared/holidays.py).
 * 화면에서는 읽기만 한다.
 */
export function useHolidays(year: number, month: number, enabled = true) {
  const [holidays, setHolidays] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void (async () => {
      const pad = (n: number) => `${n}`.padStart(2, '0')
      const last = new Date(year, month, 0).getDate()
      const { data } = await supabase
        .from('holidays').select('holiday_date, name')
        .gte('holiday_date', `${year}-${pad(month)}-01`)
        .lte('holiday_date', `${year}-${pad(month)}-${pad(last)}`)
      if (!alive) return
      const map: Record<string, string> = {}
      for (const row of (data ?? []) as any[]) map[row.holiday_date] = row.name
      setHolidays(map)
    })()
    return () => { alive = false }
  }, [year, month, enabled])

  return holidays
}

/** 일요일인가. 우체국이 쉬는 날이라 공휴일과 같이 취급한다. */
export function isSundayYmd(ymd: string): boolean {
  return new Date(
    Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8)),
  ).getDay() === 0
}

/**
 * 이름을 달력 칸에 넣을 만큼 줄인다.
 *
 * '대체공휴일(개천절)' 처럼 긴 이름이 칸을 밀어내지 않게 괄호를 걷고
 * 길면 잘라 낸다. 전체 이름은 title 로 따로 붙인다.
 */
export function shortHolidayName(name: string, max = 5): string {
  const base = name.replace(/\s*\(.*\)\s*/g, '').trim() || name
  return base.length > max ? `${base.slice(0, max)}…` : base
}
