import { Truck } from 'lucide-react'
import { Card } from '../ui/Card'

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

export function ShippingScheduleNotice() {
  const eta = expectedArriveLabel(ETA_DAYS)
  return (
    <Card className="flex items-start gap-2 border-primary/15 bg-primary-light px-3 py-2.5">
      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[13px] leading-snug text-gray-700">
          <span className="font-semibold text-gray-900">예상 배송일정</span>
          <span className="ml-1.5 whitespace-nowrap font-semibold text-primary">{eta}</span>
          {' · '}
          평일 17시 이전까지 주문 시 다음날 출고, 1~2일 내 도착
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted">
          신선도를 위해 주문이 들어온 후 수확하므로 다음날부터 출고가 가능한 점 양해 부탁드립니다.
        </p>
      </div>
    </Card>
  )
}
