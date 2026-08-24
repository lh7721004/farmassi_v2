import { Truck } from 'lucide-react'
import { Card } from '../ui/Card'
import { deliveryDaysLabel, formatDeliveryDate, nextDeliveryDate } from '../../lib/deliveryDays'

/**
 * 예상 배송일정 안내.
 *
 * 농가가 배송 가능 요일을 정해 뒀으면 그 요일 기준으로, 아직 정하지 않았으면
 * 일반 기준(주문 다음날 출고)으로 보여준다. 안내가 두 개 겹치지 않도록
 * 한 컴포넌트에서 처리한다.
 *
 * 출고는 빨라야 다음날이다 — 주문이 들어온 뒤 수확하기 때문이다. 그래서
 * 가장 가까운 배송일도 오늘이 아니라 내일부터 찾는다.
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
}

export function ShippingScheduleNotice({ days }: ShippingScheduleNoticeProps = {}) {
  const label = deliveryDaysLabel(days ?? [])
  const shipDate = label ? nextDeliveryDate(days ?? [], tomorrowInSeoul()) : null

  const headline = shipDate ? `${formatDeliveryDate(shipDate)} 출고 예정` : expectedArriveLabel(ETA_DAYS)
  const detail = shipDate
    ? `${label}요일 출고 · 출고 후 1~2일 내 도착`
    : '평일 17시 이전까지 주문 시 다음날 출고, 1~2일 내 도착'

  return (
    <Card className="flex items-start gap-2 border-primary/15 bg-primary-light px-3 py-2.5">
      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[13px] leading-snug text-gray-700">
          <span className="font-semibold text-gray-900">예상 배송일정</span>
          <span className="ml-1.5 whitespace-nowrap font-semibold text-primary">{headline}</span>
          {' · '}
          {detail}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted">
          신선도를 위해 주문이 들어온 후 수확하므로 다음날부터 출고가 가능한 점 양해 부탁드립니다.
        </p>
      </div>
    </Card>
  )
}
