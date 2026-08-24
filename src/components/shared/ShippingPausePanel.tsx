import { ChevronLeft, ChevronRight, PauseCircle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Textarea } from '../ui/Field'
import { supabase } from '../../lib/supabase'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export interface ShippingPauseFarm {
  id: string
  name: string
}

export interface ShippingPause {
  farmIds: string[]
  farmNames: string[]
  start: string
  end: string
  reason: string
}

function todayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
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

function formatDayLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return `${year}년 ${month}월 ${day}일`
}

function formatShortDay(value: string) {
  const [, month, day] = value.split('-').map(Number)
  return `${month}월 ${day}일`
}

function inclusiveDays(start: string, end: string) {
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(`${end}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
}

function formatRange(start: string, end: string) {
  if (start === end) return formatDayLabel(start)
  return `${formatDayLabel(start)} ~ ${formatDayLabel(end)}`
}

interface ShippingPausePanelProps {
  farmSelect?: boolean
  farms?: ShippingPauseFarm[]
  farmName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideCard?: boolean
}

export function ShippingPausePanel({
  farmSelect = false,
  farms = [],
  farmName,
  open: openProp,
  onOpenChange,
  hideCard = false,
}: ShippingPausePanelProps) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = openProp ?? innerOpen
  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (openProp === undefined) setInnerOpen(next)
  }
  const [pause, setPause] = useState<ShippingPause | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const farmIds = useMemo(() => farms.map((farm) => farm.id), [farms])
  const farmKey = farmIds.join(',')

  // 지금 걸려 있는 정지를 DB 에서 읽어 온다. 화면 상태로만 두면 새로고침에
  // 사라지고, 다른 사람이 건 정지도 보이지 않는다.
  useEffect(() => {
    if (farmIds.length === 0) return
    let alive = true
    void (async () => {
      const { data } = await supabase
        .from('farms')
        .select('id, name, shipping_pause_start, shipping_pause_end, shipping_pause_reason')
        .in('id', farmIds)
      if (!alive) return
      const paused = (data ?? []).filter((row: any) => row.shipping_pause_start && row.shipping_pause_end)
      if (paused.length === 0) {
        setPause(null)
        return
      }
      // 여러 농가가 같은 기간으로 걸려 있는 것이 보통이라 첫 건을 대표로 쓴다.
      const head: any = paused[0]
      setPause({
        farmIds: paused.map((row: any) => row.id),
        farmNames: paused.map((row: any) => row.name),
        start: head.shipping_pause_start,
        end: head.shipping_pause_end,
        reason: head.shipping_pause_reason ?? '',
      })
    })()
    return () => {
      alive = false
    }
  }, [farmKey])

  async function persist(next: ShippingPause | null) {
    if (farmIds.length === 0) {
      setError('정지할 농가가 없습니다.')
      return
    }
    setSaving(true)
    setError('')
    // 대상이 바뀔 수 있으므로 이 패널이 다루는 농가 전체를 먼저 지우고 다시 건다.
    const clear = await supabase
      .from('farms')
      .update({ shipping_pause_start: null, shipping_pause_end: null, shipping_pause_reason: null })
      .in('id', farmIds)
      .select('id')
    let failed = clear.error?.message ?? ''
    if (!failed && next) {
      const targets = next.farmIds.length > 0 ? next.farmIds : farmIds
      if (targets.length === 0) {
        failed = '정지할 농가를 선택해 주세요.'
      } else {
        const applied = await supabase
          .from('farms')
          .update({
            shipping_pause_start: next.start,
            shipping_pause_end: next.end,
            shipping_pause_reason: next.reason || null,
          })
          .in('id', targets)
          .select('id, name, shipping_pause_start, shipping_pause_end, shipping_pause_reason')
        failed = applied.error?.message ?? ''
        // RLS 에 막히면 error 없이 빈 배열이 돌아온다. 화면만 바뀌고 DB 는 그대로인 상태.
        if (!failed && (!applied.data || applied.data.length === 0)) {
          failed = '배송 정지를 저장하지 못했습니다. 권한을 확인해 주세요.'
        } else if (!failed && applied.data) {
          next = {
            ...next,
            farmIds: applied.data.map((row: { id: string }) => row.id),
            farmNames: applied.data.map((row: { name: string }) => row.name),
          }
        }
      }
    }
    setSaving(false)
    if (failed) {
      setError(failed)
      return
    }
    setPause(next)
  }

  return (
    <>
      {!hideCard && (
        <Card className={pause ? 'border-amber-200 bg-amber-50' : undefined}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <PauseCircle className={`mt-0.5 h-5 w-5 shrink-0 ${pause ? 'text-amber-700' : 'text-primary'}`} />
              <div className="min-w-0">
                <h3 className="font-semibold">{pause ? '배송 일시정지 중' : '배송 일시정지'}</h3>
                {pause ? (
                  <div className="mt-1 space-y-1 text-sm text-gray-700">
                    <p>
                      {pause.farmNames.length > 0 ? `${pause.farmNames.join(', ')} · ` : ''}
                      {formatRange(pause.start, pause.end)}
                      <span className="text-muted"> · {inclusiveDays(pause.start, pause.end)}일</span>
                    </p>
    
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted">달력에서 기간을 고르면 그 동안 배송을 멈춥니다.</p>
                )}
                {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {pause ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                    기간 변경
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => void persist(null)}
                  >
                    해제
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                  배송 일시정지
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
      <ShippingPauseDialog
        open={open}
        farmSelect={farmSelect}
        farms={farms}
        farmName={farmName}
        initial={pause}
        onClose={() => setOpen(false)}
        onApply={(next) => {
          void persist(next)
          setOpen(false)
        }}
      />
    </>
  )
}

interface ShippingPauseDialogProps {
  open: boolean
  farmSelect: boolean
  farms: ShippingPauseFarm[]
  farmName?: string
  initial: ShippingPause | null
  onClose: () => void
  onApply: (pause: ShippingPause) => void
}

function ShippingPauseDialog({
  open,
  farmSelect,
  farms,
  farmName,
  initial,
  onClose,
  onApply,
}: ShippingPauseDialogProps) {
  const today = todayYmd()
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)))
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([])
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    const seedStart = initial?.start ?? today
    setStart(initial?.start ?? null)
    setEnd(initial?.end ?? null)
    setYear(Number(seedStart.slice(0, 4)))
    setMonth(Number(seedStart.slice(5, 7)))
    setSelectedFarmIds(initial?.farmIds?.length ? initial.farmIds : farmSelect ? [] : [])
    setReason(initial?.reason ?? '')
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, initial, today, farmSelect, onClose])

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const count = daysInMonth(year, month)
    const blanks = Array.from({ length: firstWeekday }, () => null)
    const days = Array.from({ length: count }, (_, index) => ymd(year, month, index + 1))
    return [...blanks, ...days]
  }, [year, month])

  const rangeEnd = end ?? start
  const reasonTrimmed = reason.trim()
  const canApply = Boolean(start) && reasonTrimmed.length > 0 && (!farmSelect || selectedFarmIds.length > 0)

  function pickDay(day: string) {
    if (day < today) return
    if (!start || (start && end)) {
      setStart(day)
      setEnd(null)
      return
    }
    if (day < start) {
      setEnd(start)
      setStart(day)
      return
    }
    setEnd(day)
  }

  function toggleFarm(id: string) {
    setSelectedFarmIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function apply() {
    if (!start || !reasonTrimmed) return
    const nextEnd = end ?? start
    // 농가 배송 페이지(farmSelect=false)는 패널에 넘긴 farms 전체를 대상으로 한다.
    // 예전에는 빈 배열을 넘겨서 clear 만 하고 다시 걸지 않아 새로고침하면 풀렸다.
    const chosen = farmSelect ? farms.filter((farm) => selectedFarmIds.includes(farm.id)) : farms
    onApply({
      farmIds: chosen.map((farm) => farm.id),
      farmNames: chosen.map((farm) => farm.name).filter(Boolean).length
        ? chosen.map((farm) => farm.name)
        : farmName
          ? [farmName]
          : [],
      start,
      end: nextEnd,
      reason: reasonTrimmed,
    })
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shipping-pause-title"
        className="animate-sheet-up relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:rounded-2xl md:shadow-lg"
      >
        <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-3 md:pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="shipping-pause-title" className="text-lg font-bold">
                배송 일시정지
              </h2>
              <p className="mt-1 text-sm text-muted">시작일과 끝나는 날을 순서대로 눌러 주세요.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-gray-100"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {farmSelect && (
            <div>
              <p className="text-xs font-medium text-muted">중지할 농가</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFarmIds(selectedFarmIds.length === farms.length ? [] : farms.map((farm) => farm.id))
                  }
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedFarmIds.length === farms.length && farms.length > 0
                      ? 'bg-primary text-white'
                      : 'border border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  전체
                </button>
                {farms.map((farm) => {
                  const on = selectedFarmIds.includes(farm.id)
                  return (
                    <button
                      key={farm.id}
                      type="button"
                      onClick={() => toggleFarm(farm.id)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        on ? 'bg-primary text-white' : 'border border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {farm.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const value = shiftMonth(year, month, -1)
                  setYear(value.year)
                  setMonth(value.month)
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100"
                aria-label="이전 달"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="font-semibold">
                {year}년 {month}월
              </p>
              <button
                type="button"
                onClick={() => {
                  const value = shiftMonth(year, month, 1)
                  setYear(value.year)
                  setMonth(value.month)
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100"
                aria-label="다음 달"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-muted">
              {WEEKDAYS.map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, index) => {
                if (!day) return <div key={`blank-${index}`} className="h-10" />
                const disabled = day < today
                const isStart = day === start
                const isEnd = Boolean(start && rangeEnd && day === rangeEnd && start !== rangeEnd)
                const inMiddle = Boolean(start && rangeEnd && day > start && day < rangeEnd)
                const isSingle = Boolean(start && rangeEnd && start === rangeEnd && day === start)
                const isToday = day === today
                return (
                  <div
                    key={day}
                    className={`h-10 ${inMiddle ? 'bg-primary-light' : ''} ${
                      isStart && rangeEnd && start !== rangeEnd ? 'rounded-l-full bg-primary-light' : ''
                    } ${isEnd ? 'rounded-r-full bg-primary-light' : ''}`}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => pickDay(day)}
                      className={`flex h-10 w-full items-center justify-center text-sm ${
                        disabled ? 'text-gray-300' : 'text-gray-800'
                      } ${isStart || isEnd || isSingle ? 'rounded-full bg-primary font-semibold text-white' : ''} ${
                        isToday && !isStart && !isEnd && !isSingle ? 'font-semibold text-primary' : ''
                      }`}
                    >
                      {Number(day.slice(8))}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-sm text-muted">
            {start
              ? `${formatShortDay(start)}${rangeEnd && rangeEnd !== start ? ` ~ ${formatShortDay(rangeEnd)}` : ''} · ${inclusiveDays(start, rangeEnd ?? start)}일`
              : '아직 날짜를 고르지 않았습니다.'}
          </p>

          <Textarea
            label="일시정지 사유"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 명절 연휴, 작물 수확 지연"
            rows={3}
          />
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button type="button" fullWidth disabled={!canApply} onClick={apply}>
            적용
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function mergePauseFarms(fromOrders: ShippingPauseFarm[]) {
  return fromOrders
}
