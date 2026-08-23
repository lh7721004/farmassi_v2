import { MessageSquare, Phone } from 'lucide-react'
import type { ReactNode } from 'react'
import type { OrderListModel } from '../../types/orderList'
import { formatPrice } from '../../lib/format'
import { statusColors, statusLabels } from '../../lib/orderStatus'
import { Card } from '../ui/Card'

interface OrderItemProps {
  order: OrderListModel
  selected?: boolean
  onSelect?: (id: string) => void
  extra?: ReactNode
}

export function OrderItem({ order, selected, onSelect, extra }: OrderItemProps) {
  return (
    <Card className={selected ? 'ring-2 ring-primary' : ''}>
      <div className="flex items-start gap-3">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(order.id)}
            className="mt-1 h-4 w-4 rounded accent-primary"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-gray-900 truncate">{order.customerName}</h4>
              {order.orderNo && <p className="text-xs text-muted">{order.orderNo}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[order.status]}`}>
              {statusLabels[order.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-700">{order.productSummary}</p>
          <p className="mt-0.5 text-sm text-muted truncate">{order.address}</p>
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone.replace(/[^0-9+]/g, '')}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {order.customerPhone}
            </a>
          )}
          {order.memo && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-sm text-amber-900">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p>
                <span className="font-medium">요청사항</span>
                <span className="text-amber-700"> · {order.memo}</span>
              </p>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="font-semibold text-primary">{formatPrice(order.amount)}</span>
            <span className="text-xs text-muted">{order.orderDate}</span>
          </div>
          {order.trackingNumber && (
            <p className="mt-1 text-xs text-muted">운송장: {order.trackingNumber}</p>
          )}
          {extra}
        </div>
      </div>
    </Card>
  )
}
