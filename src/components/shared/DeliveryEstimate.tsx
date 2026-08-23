import { Truck } from 'lucide-react'
import { deliveryDaysLabel, formatDeliveryDate, nextDeliveryDate } from '../../lib/deliveryDays'

interface DeliveryEstimateProps {
  days: number[]
  className?: string
}

/**
 * 배송 가능 요일과 가장 가까운 배송일.
 *
 * 농가가 요일을 설정하지 않았으면 아무것도 그리지 않는다. 기존 농가는
 * 전부 빈 값이라, 없던 안내가 갑자기 틀린 내용으로 뜨는 일이 없어야 한다.
 */
export function DeliveryEstimate({ days, className = '' }: DeliveryEstimateProps) {
  const label = deliveryDaysLabel(days)
  const next = nextDeliveryDate(days)
  if (!label || !next) return null

  return (
    <div
      className={`flex items-start gap-2 rounded-xl bg-primary-light px-3 py-2.5 text-sm text-gray-800 ${className}`}
    >
      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p>
        <span className="font-medium">{label}요일 배송</span>
        <span className="text-muted"> · 가장 가까운 배송일 {formatDeliveryDate(next)}</span>
      </p>
    </div>
  )
}
