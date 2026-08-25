import { Truck } from 'lucide-react'
import { Card } from '../ui/Card'
import { deliveryDaysLabel } from '../../lib/deliveryDays'
import { CUTOFF_HOUR, formatYmd, pauseMessage } from '../../lib/deliveryEstimate'
import { useShippingSchedule } from '../../lib/useShippingSchedule'

interface ShippingScheduleNoticeProps {
  farmId?: string | null
  farm?: { id: string } | null
  days?: number[] | null
  /** 주문 수량이 많아 부피가 커졌을 때의 경고 */
  volumeWarning?: boolean
  volumeWarningMessage?: string
}

/**
 * 예상 배송일정.
 *
 * 보여주는 것은 도착 예정일이다. 출고일이 아니다 — 손님이 알고 싶은 건
 * 언제 받는가이기 때문이다. 계산은 출고일에서 일요일·공휴일을 빼고 2일이다.
 *
 * 정지 기간이어도 주문은 받는다. 대신 사유와 기간을 함께 보여주고 예상일이
 * 그만큼 미뤄진 것으로 나온다.
 */
export function ShippingScheduleNotice({
  farmId, farm, days, volumeWarning, volumeWarningMessage,
}: ShippingScheduleNoticeProps) {
  const { ready, activePause, shipDate, arrivalDate, missedCutoff } = useShippingSchedule(farmId ?? farm?.id, days)
  if (!ready || !arrivalDate) return null

  const label = deliveryDaysLabel(days ?? [])

  return (
    <Card
      className={`flex items-start gap-2 px-3 py-2.5 ${
        activePause ? 'border-amber-200 bg-amber-50' : 'border-primary/15 bg-primary-light'
      }`}
    >
      <Truck className={`mt-0.5 h-4 w-4 shrink-0 ${activePause ? 'text-amber-700' : 'text-primary'}`} />
      <div className="min-w-0">
        <p className="text-[13px] leading-snug text-gray-700">
          <span className="font-semibold text-gray-900">예상 배송일정</span>
          <span className="ml-1.5 whitespace-nowrap font-semibold text-primary">{formatYmd(arrivalDate)}</span>
        </p>
        {activePause ? (
          <p className="mt-0.5 text-xs leading-snug text-amber-800">{pauseMessage(activePause)}</p>
        ) : (
          <p className="mt-0.5 text-xs leading-snug text-muted">
            {label ? `${label} 출고` : '주문 다음날 출고'} · {formatYmd(shipDate!)} 출고 예정
            <br />
            {/*
              마감 안내는 마감 때문에 실제로 출고가 밀렸을 때만 띄운다.
              어차피 모레 나갈 농가에까지 '마감이 지났다' 고 하면 사실이 아니다.
            */}
            {missedCutoff
              ? `오늘 ${CUTOFF_HOUR}시 주문 마감이 지나 다음 출고일에 배송됩니다`
              : `${CUTOFF_HOUR}시 이전까지 주문하면 다음 출고일에 배송됩니다`}
          </p>
        )}
        {volumeWarning && volumeWarningMessage ? (
          <p className="mt-0.5 text-xs leading-snug text-amber-800">{volumeWarningMessage}</p>
        ) : null}
        <p className="mt-0.5 text-xs leading-snug text-muted">
          신선도를 위해 주문이 들어온 후 수확하므로 다음날부터 출고가 가능한 점 양해 부탁드립니다.
        </p>
      </div>
    </Card>
  )
}
