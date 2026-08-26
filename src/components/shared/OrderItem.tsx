import { ChevronDown, MessageSquare, Phone } from 'lucide-react'
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
          <OrderDetails order={order} />
          {extra}
        </div>
      </div>
    </Card>
  )
}

/** 한 줄. 값이 없으면 아예 그리지 않는다 — 빈 칸이 늘어서면 읽기 어렵다. */
function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-gray-800">{value}</dd>
    </div>
  )
}

/**
 * 주문자가 적어 낸 정보 전부.
 *
 * 카드에 다 펼치면 목록을 훑을 수가 없어서 접어 둔다. `details` 를 쓰면
 * 열고 닫는 상태를 따로 들고 있지 않아도 된다.
 */
function OrderDetails({ order }: { order: OrderListModel }) {
  const hasSender = Boolean(order.senderName || order.senderPhone || order.senderAddress)
  const hasMoney = order.itemsAmount !== undefined || order.depositDueAmount !== undefined
  if (!hasSender && !hasMoney && !order.depositorName) return null

  return (
    <details className="group mt-2 rounded-lg border border-gray-100 bg-gray-50/60">
      <summary className="flex cursor-pointer list-none items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-gray-700">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        주문자 작성 정보
      </summary>
      <dl className="space-y-1 px-2.5 pb-2.5 text-xs">
        <Row label="받는 분" value={order.customerName} />
        <Row label="연락처" value={order.customerPhone} />
        <Row label="주소" value={order.address} />
        {hasSender && (
          <>
            <div className="!mt-2 border-t border-gray-200 pt-2" />
            <Row label="보내는 분" value={order.senderName} />
            <Row label="연락처" value={order.senderPhone} />
            <Row label="주소" value={order.senderAddress} />
          </>
        )}
        <div className="!mt-2 border-t border-gray-200 pt-2" />
        <Row label="입금자명" value={order.depositorName} />
        <Row label="요청사항" value={order.memo} />
        <Row
          label="상품 금액"
          value={order.itemsAmount === undefined ? null : formatPrice(order.itemsAmount)}
        />
        <Row
          label="배송비"
          value={order.shippingFee === undefined ? null : formatPrice(order.shippingFee)}
        />
        <Row label="합계" value={formatPrice(order.amount)} />
        {/* 손님이 실제로 보낼 금액. 합계와 다르면 그때만 따로 보여 준다. */}
        {order.depositDueAmount !== undefined && order.depositDueAmount !== order.amount && (
          <Row label="입금 금액" value={formatPrice(order.depositDueAmount)} />
        )}
        <Row label="입금코드" value={order.depositCode} />
        <Row label="주문번호" value={order.orderNo} />
        <Row label="주문일시" value={order.orderDate} />
      </dl>
    </details>
  )
}
