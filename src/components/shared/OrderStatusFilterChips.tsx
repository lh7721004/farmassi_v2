import { statusLabels } from '../../lib/orderStatus'
import type { OrderStatus } from '../../types/models'

export type StatusFilterId = 'all' | OrderStatus

const statusIds = Object.keys(statusLabels) as OrderStatus[]

export function OrderStatusFilterChips({
  orders,
  selectedId,
  onSelect,
}: {
  orders: { status: OrderStatus }[]
  selectedId: StatusFilterId
  onSelect: (id: StatusFilterId) => void
}) {
  const items: { id: StatusFilterId; name: string; count: number }[] = [
    { id: 'all', name: '전체', count: orders.length },
    ...statusIds.map((id) => ({
      id,
      name: statusLabels[id],
      count: orders.filter((order) => order.status === id).length,
    })),
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {items.map(({ id, name, count }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            selectedId === id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          {name}
          <span className="ml-1 text-xs opacity-70">({count})</span>
        </button>
      ))}
    </div>
  )
}
