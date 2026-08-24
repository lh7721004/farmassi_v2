import { PauseCircle, Truck } from 'lucide-react'
import { Card } from '../ui/Card'
import { deliveryDaysLabel, formatDeliveryDate, nextDeliveryDate } from '../../lib/deliveryDays'
import {
  activeShippingPause,
  shippingPauseMessage,
  type ShippingPauseFields,
} from '../../lib/shippingPause'

/**
 * 예상 배송일정 안내.
 *
 * 농가가 배송 가능 요일을 정해 뒀으면 그 요일 기준으로, 아직 정하지 않았으면
 * 일반 기준(주문 다음날 출고)으로 보여준다. 안내가 두 개 겹치지 않도록
 * 한 컴포넌트에서 처리한다.
 *
 * 출고는 빨라야 다음날이다 — 주문이 들어온 뒤 수확하기 때문이다. 그래서
 * 가장 가까운 배송일도 오늘이 아니라 내일부터 찾는다.
 *
 * 배송 일시정지 기간이면 예상일 대신 정지 안내를 보여준다.
 */
const ETA_DAYS = 3

function expectedArriveLabel(daysFromNow: number): string {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const [year, month, day] = ymd.split('-').map(Number)
  const eta = new Date(Date.UTC(year, month - 1, day + daysFromNow, 3))
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(eta)
}

/** 서울 기준 '내일' 0시. 농가 요일 계산의 시작점이다. */
function tomorrowInSeoul(): Date {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(year, month - 1, day + 1)
}

interface ShippingScheduleNoticeProps {
  /** 농가가 정한 배송 가능 요일. 비어 있으면 일반 안내를 쓴다. */
  days?: number[] | null
  farm?: ShippingPauseFields | null
  /** 일일/제품당/1회 한도를 넘었을 때 빨간 안내. 주문은 막지 않는다. */
  volumeWarning?: boolean
  volumeWarningMessage?: string
}

/** 한 줄이면 중간점, 줄어들면 중간점 없이 상세부터 줄바꿈. */
function ScheduleLine({
  headline,
  detail,
  className,
  titleClassName,
  dateClassName,
}: {
  headline: string
  detail: string
  className: string
  titleClassName: string
  dateClassName: string
}) {
  return (
    <p
      className={`flex flex-wrap items-baseline gap-x-[1.125em] overflow-x-clip text-[13px] leading-snug ${className}`}
    >
      <span className="shrink-0 whitespace-nowrap">
        <span className={`font-semibold ${titleClassName}`}>예상 배송일정</span>
        <span className={`ml-1.5 font-semibold ${dateClassName}`}>{headline}</span>
      </span>
      <span className="-ml-[1.125em] flex min-w-[min(100%,max-content)] max-w-[calc(100%+1.125em)] items-baseline">
        <span className="w-[1.125em] shrink-0 text-center" aria-hidden="true">
          ·
        </span>
        <span className="min-w-0 break-keep">{detail}</span>
      </span>
    </p>
  )
}

export function ShippingScheduleNotice({
  days,
  farm,
  volumeWarning = false,
  volumeWarningMessage,
}: ShippingScheduleNoticeProps = {}) {
  const pause = activeShippingPause(farm)
  if (pause) {
    return (
      <Card className="flex items-start gap-2 border-amber-200 bg-amber-50 px-3 py-2.5">
        <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <p className="text-[13px] leading-snug text-amber-950">
            <span className="font-semibold">배송 일시정지</span>
            <span className="ml-1.5">{shippingPauseMessage(pause)}</span>
          </p>
          <p className="mt-0.5 text-xs leading-snug text-amber-800">
            이 기간에는 주문을 받지 않습니다. 기간이 지나면 다시 주문할 수 있습니다.
          </p>
        </div>
      </Card>
    )
  }

  const label = deliveryDaysLabel(days ?? [])
  const shipDate = label ? nextDeliveryDate(days ?? [], tomorrowInSeoul()) : null

  const headline = shipDate ? `${formatDeliveryDate(shipDate)} 출고 예정` : expectedArriveLabel(ETA_DAYS)
  const detail = shipDate
    ? `${label}요일 출고 · 출고 후 1~2일 내 도착`
    : '평일 17시 이전까지 주문 시 다음날 출고, 1~2일 내 도착'

  if (volumeWarning) {
    return (
      <Card className="flex items-start gap-2 border-red-200 bg-red-50 px-3 py-2.5">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <div className="min-w-0">
          <ScheduleLine
            headline={headline}
            detail={detail}
            className="text-red-950"
            titleClassName="text-red-900"
            dateClassName="text-red-700"
          />
          <p className="mt-0.5 text-xs font-medium leading-snug text-red-700">
            {volumeWarningMessage ?? '현재 주문 물량 증가로 예상배송일정을 확인해주세요'}
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex items-start gap-2 border-primary/15 bg-primary-light px-3 py-2.5">
      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <ScheduleLine
          headline={headline}
          detail={detail}
          className="text-gray-700"
          titleClassName="text-gray-900"
          dateClassName="text-primary"
        />
        <p className="mt-0.5 text-xs leading-snug text-muted">
          신선도를 위해 주문이 들어온 후 수확하므로 다음날부터 출고가 가능한 점 양해 부탁드립니다.
        </p>
      </div>
    </Card>
  )
}
