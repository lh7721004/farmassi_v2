import { Fragment, useEffect, useMemo, useState } from 'react'
import { Pencil, Check, ChevronLeft, ChevronRight, Download, Minus, Plus } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { adminNavItems } from '../../config/adminNav'
import { todayInSeoul } from '../../lib/deliveryEstimate'
import { WEEKDAYS, deliveryDaysLabel } from '../../lib/deliveryDays'
import { formatPrice } from '../../lib/format'

/** 송장 대행 1건당 수익 (원) */
const FEE_PER_SHIPMENT = 500

/** 접수 채널 — 엑셀 행과 동일 */
const CHANNELS = ['직접연락', '카톡 비즈니스', '팜어시'] as const
type Channel = (typeof CHANNELS)[number]

const AUTO_CHANNEL: Channel = '팜어시'

interface FarmCell {
  count: number
  /** 간편사전접수 접수번호 (쉼표·공백 구분, 입력 원문 유지) */
  receiptText: string
}

interface DummyFarm {
  id: string
  name: string
  /** 배송 가능 요일 (0=일 … 6=토) — UI 표시용 더미 */
  deliveryDays: number[]
}

interface DayRecord {
  date: string
  cells: Record<string, Record<Channel, FarmCell>>
  /** 농원별 품목 건수. 합계는 그날 해당 농원 송장 건수를 넘을 수 없다. */
  productQty: Record<string, Record<string, number>>
}

const emptyCell = (): FarmCell => ({ count: 0, receiptText: '' })

function emptyFarmCells(): Record<Channel, FarmCell> {
  return {
    직접연락: emptyCell(),
    '카톡 비즈니스': emptyCell(),
    팜어시: emptyCell(),
  }
}

/** 절대 실데이터/API 연동하지 않음. 화면 확인용 더미만. */
const DUMMY_FARMS: DummyFarm[] = [
  { id: 'jooyoung', name: '주영농원', deliveryDays: [0, 1, 3, 5] },
  { id: 'takine', name: '탁이네 농원', deliveryDays: [0, 1, 2, 4] },
  { id: 'jinyoung', name: '진영농원', deliveryDays: [0, 2, 4, 6] },
]

/** 농원별 판매 품목 더미 */
const DUMMY_PRODUCTS: Record<string, { id: string; name: string }[]> = {
  jooyoung: [
    { id: 'jy-peach', name: '복숭아 2kg' },
    { id: 'jy-grape', name: '캠벨포도 2kg' },
    { id: 'jy-apple', name: '사과 5kg' },
  ],
  takine: [
    { id: 'tk-plum', name: '자두 2kg' },
    { id: 'tk-peach', name: '백도복숭아 2kg' },
    { id: 'tk-tomato', name: '방울토마토 1kg' },
  ],
  jinyoung: [
    { id: 'jn-pear', name: '배 5kg' },
    { id: 'jn-persimmon', name: '단감 5kg' },
    { id: 'jn-chestnut', name: '밤 2kg' },
  ],
}

function emptyProductQty(): Record<string, Record<string, number>> {
  return Object.fromEntries(
    DUMMY_FARMS.map((farm) => [
      farm.id,
      Object.fromEntries((DUMMY_PRODUCTS[farm.id] ?? []).map((p) => [p.id, 0])),
    ]),
  )
}

function productQtySum(qty: Record<string, number> | undefined): number {
  if (!qty) return 0
  return Object.values(qty).reduce((sum, n) => sum + n, 0)
}

function clampFarmProductQty(
  qty: Record<string, number>,
  maxTotal: number,
): Record<string, number> {
  const next = { ...qty }
  let sum = productQtySum(next)
  if (sum <= maxTotal) return next
  // 초과분만큼 뒤에서부터 깎는다
  for (const id of Object.keys(next).reverse()) {
    if (sum <= maxTotal) break
    const cut = Math.min(next[id], sum - maxTotal)
    next[id] -= cut
    sum -= cut
  }
  return next
}

/**
 * 서비스 주문 자동 집계 더미.
 * 실제로는 해당일 팜어시 접수 건수를 농원별로 채워 넣는다.
 */
const DUMMY_FARMASSI_AUTO: Record<string, Record<string, FarmCell>> = {
  '2026-08-23': {
    jooyoung: emptyCell(),
    takine: emptyCell(),
    jinyoung: { count: 1, receiptText: '2026082361452106' },
  },
  '2026-08-24': {
    jooyoung: emptyCell(),
    takine: emptyCell(),
    jinyoung: emptyCell(),
  },
}

function applyFarmassiAuto(day: DayRecord): DayRecord {
  const auto = DUMMY_FARMASSI_AUTO[day.date]
  const cells = { ...day.cells }
  for (const farm of DUMMY_FARMS) {
    const autoCell = auto?.[farm.id] ?? emptyCell()
    cells[farm.id] = {
      ...cells[farm.id],
      [AUTO_CHANNEL]: { ...autoCell },
    }
  }
  return { ...day, cells }
}

function createEmptyDay(date: string): DayRecord {
  return applyFarmassiAuto({
    date,
    cells: Object.fromEntries(DUMMY_FARMS.map((f) => [f.id, emptyFarmCells()])),
    productQty: emptyProductQty(),
  })
}

const SEED_DAYS: DayRecord[] = [
  applyFarmassiAuto({
    date: '2026-08-23',
    productQty: emptyProductQty(),
    cells: {
      jooyoung: {
        직접연락: { count: 3, receiptText: '2026082361450019' },
        '카톡 비즈니스': emptyCell(),
        팜어시: emptyCell(),
      },
      takine: {
        직접연락: { count: 1, receiptText: '2026082361451709' },
        '카톡 비즈니스': emptyCell(),
        팜어시: emptyCell(),
      },
      jinyoung: {
        직접연락: emptyCell(),
        '카톡 비즈니스': emptyCell(),
        팜어시: emptyCell(),
      },
    },
  }),
  applyFarmassiAuto({
    date: '2026-08-24',
    productQty: emptyProductQty(),
    cells: {
      jooyoung: {
        직접연락: { count: 2, receiptText: '2026082461529815' },
        '카톡 비즈니스': emptyCell(),
        팜어시: emptyCell(),
      },
      takine: {
        직접연락: {
          count: 2,
          receiptText: '2026082461496052, 2026082461529896',
        },
        '카톡 비즈니스': emptyCell(),
        팜어시: emptyCell(),
      },
      jinyoung: {
        직접연락: emptyCell(),
        '카톡 비즈니스': emptyCell(),
        팜어시: emptyCell(),
      },
    },
  }),
]

function farmDayTotal(cells: Record<Channel, FarmCell>): number {
  return CHANNELS.reduce((sum, ch) => sum + cells[ch].count, 0)
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()].label
  return `${y}.${m}.${d}. (${weekday})`
}

function farmCanShipOn(farm: DummyFarm, iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  return farm.deliveryDays.includes(new Date(y, m - 1, d).getDay())
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function shiftMonth(year: number, month: number, delta: number) {
  const next = new Date(year, month - 1 + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() + 1 }
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dayHasWork(day: DayRecord): boolean {
  return DUMMY_FARMS.some((farm) => farmDayTotal(day.cells[farm.id]) > 0)
}

/** 화면의 월별 표를 엑셀 형태로 내려받는다 (로컬 더미만). */
async function downloadMonthExcel(
  year: number,
  month: number,
  monthDays: DayRecord[],
) {
  if (monthDays.length === 0) throw new Error('다운로드할 이력이 없습니다.')

  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = 'farmassi'
  const sheet = workbook.addWorksheet(`${year}년 ${month}월`)

  const header = ['채널', ...DUMMY_FARMS.flatMap((f) => [f.name, '접수번호']), '총합계']
  sheet.addRow(header)

  const sorted = [...monthDays].sort((a, b) => a.date.localeCompare(b.date))
  for (const day of sorted) {
    const [y, m, d] = day.date.split('-').map(Number)
    sheet.addRow([`${y}.${m}.${d}.`, ...DUMMY_FARMS.flatMap(() => ['', '']), ''])

    for (const channel of CHANNELS) {
      const dayGrand = DUMMY_FARMS.reduce(
        (sum, farm) => sum + farmDayTotal(day.cells[farm.id]),
        0,
      )
      const row: (string | number)[] = [channel]
      for (const farm of DUMMY_FARMS) {
        const cell = day.cells[farm.id][channel]
        row.push(cell.count || '', cell.receiptText || '')
      }
      row.push(channel === AUTO_CHANNEL ? dayGrand || '' : '')
      sheet.addRow(row)
    }

    const totals: (string | number)[] = ['합계']
    let dayGrand = 0
    for (const farm of DUMMY_FARMS) {
      const total = farmDayTotal(day.cells[farm.id])
      dayGrand += total
      totals.push(total, '')
    }
    totals.push(dayGrand)
    sheet.addRow(totals)
    sheet.addRow([])
  }

  sheet.getColumn(1).width = 14
  DUMMY_FARMS.forEach((_, i) => {
    sheet.getColumn(2 + i * 2).width = 8
    sheet.getColumn(3 + i * 2).width = 28
  })
  sheet.getColumn(2 + DUMMY_FARMS.length * 2).width = 10

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `송장대행이력_${year}-${String(month).padStart(2, '0')}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

const countInputClass =
  'w-12 rounded-lg border border-gray-200 bg-white px-1.5 py-1.5 text-center text-sm tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary'
const receiptInputClass =
  'w-full min-w-[10rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary'

export function AdminShippingHistory() {
  const today = todayInSeoul()
  const [viewYear, setViewYear] = useState(() => Number(today.slice(0, 4)))
  const [viewMonth, setViewMonth] = useState(() => Number(today.slice(5, 7)))
  const [days, setDays] = useState<DayRecord[]>(() =>
    [...SEED_DAYS].sort((a, b) => b.date.localeCompare(a.date)),
  )
  /** 과거 일자 중 수정 잠금 해제된 날짜 */
  const [editingDates, setEditingDates] = useState<Set<string>>(() => new Set())
  /** 경고 확인 후 팜어시 수동 수정이 열린 날짜 */
  const [unlockedFarmassi, setUnlockedFarmassi] = useState<Set<string>>(() => new Set())
  const [farmassiUnlockDate, setFarmassiUnlockDate] = useState<string | null>(null)
  /** 요일 외 농원 수동 수정 — `${date}:${farmId}` */
  const [unlockedOffDay, setUnlockedOffDay] = useState<Set<string>>(() => new Set())
  const [offDayUnlockTarget, setOffDayUnlockTarget] = useState<{
    date: string
    farmId: string
    farmName: string
  } | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState('')

  const viewMonthKey = monthKey(viewYear, viewMonth)

  // 당일 행이 없으면 빈 표로 자동 생성 (로컬만, 서버 저장 없음)
  useEffect(() => {
    setDays((prev) => {
      if (prev.some((d) => d.date === today)) return prev
      return [createEmptyDay(today), ...prev].sort((a, b) => b.date.localeCompare(a.date))
    })
  }, [today])

  // 오늘이 속한 달로 맞춰 둔다 (월이 바뀌면 새 페이지)
  useEffect(() => {
    setViewYear(Number(today.slice(0, 4)))
    setViewMonth(Number(today.slice(5, 7)))
  }, [today])

  const monthDays = useMemo(
    () => days.filter((d) => d.date.startsWith(viewMonthKey)),
    [days, viewMonthKey],
  )

  const daysByDate = useMemo(
    () => Object.fromEntries(days.map((d) => [d.date, d])),
    [days],
  )

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay()
    const count = daysInMonth(viewYear, viewMonth)
    const blanks = Array.from({ length: firstWeekday }, () => null as string | null)
    const dates = Array.from({ length: count }, (_, i) => ymd(viewYear, viewMonth, i + 1))
    return [...blanks, ...dates]
  }, [viewYear, viewMonth])

  function isEditable(date: string): boolean {
    return date === today || editingDates.has(date)
  }

  function isFarmassiEditable(date: string): boolean {
    return isEditable(date) && unlockedFarmassi.has(date)
  }

  function offDayKey(date: string, farmId: string) {
    return `${date}:${farmId}`
  }

  function isOffDayUnlocked(date: string, farmId: string): boolean {
    return unlockedOffDay.has(offDayKey(date, farmId))
  }

  function toggleEdit(date: string) {
    const locking = editingDates.has(date)
    setEditingDates((prev) => {
      const next = new Set(prev)
      if (locking) next.delete(date)
      else next.add(date)
      return next
    })
    if (locking) {
      setUnlockedFarmassi((prev) => {
        const next = new Set(prev)
        next.delete(date)
        return next
      })
      setUnlockedOffDay((prev) => {
        const next = new Set(prev)
        for (const key of prev) {
          if (key.startsWith(`${date}:`)) next.delete(key)
        }
        return next
      })
    }
  }

  function confirmFarmassiUnlock() {
    if (!farmassiUnlockDate) return
    setUnlockedFarmassi((prev) => new Set(prev).add(farmassiUnlockDate))
    setFarmassiUnlockDate(null)
  }

  function confirmOffDayUnlock() {
    if (!offDayUnlockTarget) return
    setUnlockedOffDay((prev) =>
      new Set(prev).add(offDayKey(offDayUnlockTarget.date, offDayUnlockTarget.farmId)),
    )
    setOffDayUnlockTarget(null)
  }

  function updateCell(date: string, farmId: string, channel: Channel, next: FarmCell) {
    setDays((prev) =>
      prev.map((day) => {
        if (day.date !== date) return day
        const cells = {
          ...day.cells,
          [farmId]: {
            ...day.cells[farmId],
            [channel]: next,
          },
        }
        const maxTotal = farmDayTotal(cells[farmId])
        return {
          ...day,
          cells,
          productQty: {
            ...day.productQty,
            [farmId]: clampFarmProductQty(day.productQty[farmId] ?? {}, maxTotal),
          },
        }
      }),
    )
  }

  function bumpProductQty(date: string, farmId: string, productId: string, delta: number) {
    setDays((prev) =>
      prev.map((day) => {
        if (day.date !== date) return day
        const maxTotal = farmDayTotal(day.cells[farmId])
        const current = { ...(day.productQty[farmId] ?? {}) }
        const allocated = productQtySum(current)
        const value = current[productId] ?? 0
        if (delta > 0 && allocated >= maxTotal) return day
        if (delta < 0 && value <= 0) return day
        current[productId] = Math.max(0, value + delta)
        return {
          ...day,
          productQty: {
            ...day.productQty,
            [farmId]: clampFarmProductQty(current, maxTotal),
          },
        }
      }),
    )
  }

  const farmTotals = useMemo(
    () =>
      DUMMY_FARMS.map((farm) => ({
        farm,
        total: monthDays.reduce((sum, day) => sum + farmDayTotal(day.cells[farm.id]), 0),
      })),
    [monthDays],
  )
  const grandTotal = farmTotals.reduce((sum, row) => sum + row.total, 0)

  function goMonth(delta: number) {
    const next = shiftMonth(viewYear, viewMonth, delta)
    setViewYear(next.year)
    setViewMonth(next.month)
  }

  function scrollToDay(date: string) {
    const el = document.getElementById(`shipping-day-${date}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleExcelDownload() {
    setExportError('')
    setExportBusy(true)
    try {
      await downloadMonthExcel(viewYear, viewMonth, monthDays)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '엑셀을 만들지 못했습니다.')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <AppShell navItems={adminNavItems} roleLabel="관리자" settingsPath="/admin/none">
      <Header
        title="배송이력 관리"
        subtitle={`${viewYear}년 ${viewMonth}월 · 더미 (로컬만, 저장 없음)`}
        showBack
        backTo="/admin/shipments"
      />
      <div className="px-4 py-4 md:px-6 max-w-6xl mx-auto space-y-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="font-semibold text-gray-900">
              {viewYear}년 {viewMonth}월
            </p>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100"
              aria-label="다음 달"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted">
            {WEEKDAYS.map((day) => (
              <div key={day.value} className={`py-1 ${day.value === 0 ? 'text-red-500' : ''}`}>
                {day.label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarCells.map((date, index) => {
              if (!date) return <div key={`blank-${index}`} className="h-11" />
              const record = daysByDate[date]
              const hasWork = record ? dayHasWork(record) : false
              const isToday = date === today
              const isSunday = new Date(
                Number(date.slice(0, 4)),
                Number(date.slice(5, 7)) - 1,
                Number(date.slice(8)),
              ).getDay() === 0
              const clickable = Boolean(record)
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!clickable}
                  onClick={() => scrollToDay(date)}
                  className={[
                    'relative flex h-11 w-full flex-col items-center justify-center rounded-xl text-sm',
                    clickable ? 'hover:bg-primary-light/60' : 'cursor-default',
                    isToday ? 'font-semibold text-primary' : isSunday ? 'text-red-600' : 'text-gray-800',
                    !clickable && !isToday ? 'text-gray-300' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {Number(date.slice(8))}
                  {hasWork && (
                    <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted">
            달력에서 월을 바꾸면 해당 월 이력만 보입니다. 점이 있는 날은 작업 기록이 있습니다.
          </p>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {viewYear}년 {viewMonth}월 송장 대행 이력
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={exportBusy || monthDays.length === 0}
            onClick={() => void handleExcelDownload()}
          >
            <Download className="h-4 w-4" />
            엑셀 다운로드
          </Button>
        </div>
        {exportError && <p className="text-sm text-red-600">{exportError}</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {farmTotals.map(({ farm, total }) => (
            <Card key={farm.id} className="space-y-1">
              <p className="text-sm text-muted">{farm.name}</p>
              <p className="text-2xl font-bold text-gray-900">{total}건</p>
              <p className="text-xs text-muted">
                배송요일 {deliveryDaysLabel(farm.deliveryDays) || '미설정'}
              </p>
              <p className="text-sm font-semibold text-primary">
                {formatPrice(total * FEE_PER_SHIPMENT)}
              </p>
            </Card>
          ))}
          <Card className="space-y-1 bg-primary-light/40 border-primary/20">
            <p className="text-sm text-muted">{viewMonth}월 합계</p>
            <p className="text-2xl font-bold text-gray-900">{grandTotal}건</p>
            <p className="text-xs text-muted">건당 {formatPrice(FEE_PER_SHIPMENT)}</p>
            <p className="text-sm font-semibold text-primary">
              {formatPrice(grandTotal * FEE_PER_SHIPMENT)}
            </p>
          </Card>
        </div>

        {monthDays.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            {viewYear}년 {viewMonth}월 이력이 없습니다.
          </p>
        )}

        {monthDays.map((day) => {
          const dayGrand = DUMMY_FARMS.reduce(
            (sum, farm) => sum + farmDayTotal(day.cells[farm.id]),
            0,
          )
          const editable = isEditable(day.date)
          const farmassiOpen = isFarmassiEditable(day.date)
          const isToday = day.date === today
          const isPast = day.date < today

          return (
            <div key={day.date} id={`shipping-day-${day.date}`} className="scroll-mt-4">
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{formatDisplayDate(day.date)}</h3>
                    {isToday && (
                      <span className="rounded-md bg-primary-light px-1.5 py-0.5 text-xs font-medium text-primary">
                        오늘
                      </span>
                    )}
                    {editable && !isToday && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        수정 중
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    배송 가능 농원:{' '}
                    {DUMMY_FARMS.filter((f) => farmCanShipOn(f, day.date))
                      .map((f) => f.name)
                      .join(', ') || '없음'}
                  </p>
                </div>
                {isPast && (
                  <Button
                    size="sm"
                    variant={editable ? 'secondary' : 'outline'}
                    type="button"
                    onClick={() => toggleEdit(day.date)}
                  >
                    {editable ? (
                      <>
                        <Check className="h-4 w-4" />
                        수정 완료
                      </>
                    ) : (
                      <>
                        <Pencil className="h-4 w-4" />
                        수정
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm table-fixed">
                  <colgroup>
                    <col className="w-36" />
                    {DUMMY_FARMS.flatMap((farm) => [
                      <col key={`${farm.id}-count`} className="w-14" />,
                      <col key={`${farm.id}-receipt`} />,
                    ])}
                    <col className="w-16" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50 text-left text-muted">
                      <th className="px-3 py-2 font-medium">채널</th>
                      {DUMMY_FARMS.map((farm) => {
                        const canShip = farmCanShipOn(farm, day.date)
                        const offOpen = isOffDayUnlocked(day.date, farm.id)
                        return (
                          <th key={farm.id} className="px-3 py-2 font-medium align-top" colSpan={2}>
                            <div className="flex flex-col gap-1">
                              <span>
                                {farm.name}
                                {!canShip && (
                                  <span className="ml-1 text-xs font-normal text-amber-700">
                                    (요일 외)
                                  </span>
                                )}
                              </span>
                              {!canShip && editable && !offOpen && (
                                <button
                                  type="button"
                                  className="w-fit text-left text-xs font-normal text-primary hover:underline"
                                  onClick={() =>
                                    setOffDayUnlockTarget({
                                      date: day.date,
                                      farmId: farm.id,
                                      farmName: farm.name,
                                    })
                                  }
                                >
                                  수동 수정…
                                </button>
                              )}
                              {!canShip && offOpen && (
                                <button
                                  type="button"
                                  className="w-fit text-left text-xs font-normal text-muted hover:underline"
                                  onClick={() => {
                                    setUnlockedOffDay((prev) => {
                                      const next = new Set(prev)
                                      next.delete(offDayKey(day.date, farm.id))
                                      return next
                                    })
                                  }}
                                >
                                  다시 잠그기
                                </button>
                              )}
                            </div>
                          </th>
                        )
                      })}
                      <th className="px-3 py-2 font-medium text-right">총합계</th>
                    </tr>
                    <tr className="bg-gray-50/60 text-xs text-muted border-b border-gray-100">
                      <th className="px-3 py-1" />
                      {DUMMY_FARMS.map((farm) => (
                        <Fragment key={farm.id}>
                          <th className="px-2 py-1 font-normal text-center">건</th>
                          <th className="px-2 py-1 font-normal">접수번호</th>
                        </Fragment>
                      ))}
                      <th className="px-3 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {CHANNELS.map((channel) => {
                      const isAuto = channel === AUTO_CHANNEL
                      return (
                        <tr
                          key={channel}
                          className={[
                            'border-b border-gray-50',
                            isAuto && 'bg-slate-50/70',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <td className="px-3 py-2 font-medium text-gray-800">
                            <div className="flex flex-col gap-1">
                              <span className="whitespace-nowrap">
                                {channel}
                                {isAuto && (
                                  <span className="ml-1 text-[10px] font-normal text-muted">
                                    자동
                                  </span>
                                )}
                              </span>
                              {isAuto && editable && !farmassiOpen && (
                                <button
                                  type="button"
                                  className="w-fit text-left text-xs font-normal text-primary hover:underline"
                                  onClick={() => setFarmassiUnlockDate(day.date)}
                                >
                                  수동 수정…
                                </button>
                              )}
                              {isAuto && farmassiOpen && (
                                <button
                                  type="button"
                                  className="w-fit text-left text-xs font-normal text-muted hover:underline"
                                  onClick={() => {
                                    setUnlockedFarmassi((prev) => {
                                      const next = new Set(prev)
                                      next.delete(day.date)
                                      return next
                                    })
                                    setDays((prev) =>
                                      prev.map((d) =>
                                        d.date === day.date ? applyFarmassiAuto(d) : d,
                                      ),
                                    )
                                  }}
                                >
                                  자동으로 되돌리기
                                </button>
                              )}
                            </div>
                          </td>
                          {DUMMY_FARMS.map((farm) => {
                            const cell = day.cells[farm.id][channel]
                            const canShip = farmCanShipOn(farm, day.date)
                            const offOpen = isOffDayUnlocked(day.date, farm.id)
                            const farmOpen = canShip || offOpen
                            const cellEditable =
                              farmOpen && (isAuto ? farmassiOpen : editable)
                            const muted = !farmOpen ? 'bg-gray-50/80' : ''
                            return (
                              <Fragment key={farm.id}>
                                <td className={`px-2 py-2 align-middle text-center ${muted}`}>
                                  {cellEditable ? (
                                    <input
                                      type="number"
                                      min={0}
                                      inputMode="numeric"
                                      className={countInputClass}
                                      value={cell.count || ''}
                                      placeholder="0"
                                      onChange={(e) => {
                                        const count = Math.max(0, Number(e.target.value) || 0)
                                        updateCell(day.date, farm.id, channel, {
                                          ...cell,
                                          count,
                                        })
                                      }}
                                    />
                                  ) : (
                                    <span className="tabular-nums text-gray-900">
                                      {cell.count || (farmOpen ? '' : '—')}
                                    </span>
                                  )}
                                </td>
                                <td className={`px-2 py-2 align-middle ${muted}`}>
                                  {cellEditable ? (
                                    <input
                                      type="text"
                                      className={receiptInputClass}
                                      value={cell.receiptText}
                                      placeholder="번호, 번호…"
                                      onChange={(e) =>
                                        updateCell(day.date, farm.id, channel, {
                                          ...cell,
                                          receiptText: e.target.value,
                                        })
                                      }
                                    />
                                  ) : (
                                    <span
                                      className="block truncate text-xs text-muted whitespace-nowrap"
                                      title={cell.receiptText}
                                    >
                                      {cell.receiptText || (farmOpen ? '' : '—')}
                                    </span>
                                  )}
                                </td>
                              </Fragment>
                            )
                          })}
                          <td className="px-3 py-2 text-right tabular-nums text-muted">
                            {isAuto ? dayGrand || '' : ''}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-2.5">합계</td>
                      {DUMMY_FARMS.map((farm) => (
                        <Fragment key={farm.id}>
                          <td className="px-2 py-2.5 text-center tabular-nums">
                            {farmDayTotal(day.cells[farm.id])}
                          </td>
                          <td className="px-2 py-2.5" />
                        </Fragment>
                      ))}
                      <td className="px-3 py-2.5 text-right tabular-nums">{dayGrand}</td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2.5 align-top text-sm font-medium text-gray-800">
                        팔린 물건
                      </td>
                      {DUMMY_FARMS.map((farm) => {
                        const target = farmDayTotal(day.cells[farm.id])
                        const qtyMap = day.productQty[farm.id] ?? {}
                        const allocated = productQtySum(qtyMap)
                        const remaining = Math.max(0, target - allocated)
                        const products = DUMMY_PRODUCTS[farm.id] ?? []
                        const canEditProducts = editable && target > 0
                        const matched = target > 0 && allocated === target
                        return (
                          <td
                            key={farm.id}
                            colSpan={2}
                            className="px-2 py-2.5 align-top"
                          >
                            {target === 0 ? (
                              <span className="text-xs text-muted">—</span>
                            ) : (
                              <div className="space-y-1.5">
                                <p
                                  className={[
                                    'text-[11px] tabular-nums',
                                    matched ? 'text-primary' : 'text-amber-700',
                                  ].join(' ')}
                                >
                                  {allocated}/{target}건
                                  {!matched && remaining > 0 ? ` · ${remaining}건 남음` : ''}
                                  {!matched && remaining === 0 && allocated > target
                                    ? ' · 초과'
                                    : ''}
                                </p>
                                <ul className="space-y-1">
                                  {products.map((product) => {
                                    const qty = qtyMap[product.id] ?? 0
                                    return (
                                      <li
                                        key={product.id}
                                        className="flex items-center gap-1.5 text-xs"
                                      >
                                        <span className="min-w-0 flex-1 truncate text-gray-700">
                                          {product.name}
                                        </span>
                                        {canEditProducts ? (
                                          <div className="flex shrink-0 items-center gap-0.5">
                                            <button
                                              type="button"
                                              aria-label={`${product.name} 감소`}
                                              disabled={qty <= 0}
                                              onClick={() =>
                                                bumpProductQty(
                                                  day.date,
                                                  farm.id,
                                                  product.id,
                                                  -1,
                                                )
                                              }
                                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                                            >
                                              <Minus className="h-3 w-3" />
                                            </button>
                                            <span className="w-5 text-center tabular-nums font-medium">
                                              {qty}
                                            </span>
                                            <button
                                              type="button"
                                              aria-label={`${product.name} 증가`}
                                              disabled={remaining <= 0}
                                              onClick={() =>
                                                bumpProductQty(
                                                  day.date,
                                                  farm.id,
                                                  product.id,
                                                  1,
                                                )
                                              }
                                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                                            >
                                              <Plus className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="w-5 shrink-0 text-center tabular-nums text-muted">
                                            {qty || '—'}
                                          </span>
                                        )}
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2.5" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={farmassiUnlockDate !== null}
        title="팜어시 값을 수동으로 수정할까요?"
        description={
          <>
            팜어시 건수는 서비스에 접수된 주문을 자동 집계한 값입니다. 수동으로 바꾸면 실제
            접수 현황과 어긋날 수 있습니다. 꼭 필요할 때만 수정하세요.
          </>
        }
        confirmLabel="그래도 수정"
        cancelLabel="취소"
        onConfirm={confirmFarmassiUnlock}
        onCancel={() => setFarmassiUnlockDate(null)}
      />

      <ConfirmDialog
        open={offDayUnlockTarget !== null}
        title="배송 요일이 아닌 농원을 수정할까요?"
        description={
          <>
            {offDayUnlockTarget?.farmName}은(는) 이날 배송 가능 요일이 아닙니다. 예외적으로
            입력하면 일정과 어긋날 수 있습니다. 꼭 필요할 때만 수정하세요.
          </>
        }
        confirmLabel="그래도 수정"
        cancelLabel="취소"
        onConfirm={confirmOffDayUnlock}
        onCancel={() => setOffDayUnlockTarget(null)}
      />
    </AppShell>
  )
}
