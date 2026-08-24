import { useEffect, useState } from 'react'
import { FarmOrderPageLink } from '../../components/layout/FarmOrderPageLink'
import { Header } from '../../components/layout/Header'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { OrderItem } from '../../components/shared/OrderItem'
import { ShippingPausePanel } from '../../components/shared/ShippingPausePanel'
import { useFarmWorkspace } from '../../lib/farmWorkspace'
import { toOrderListModel, type OrderRow } from '../../lib/orders'
import { supabase } from '../../lib/supabase'

export function FarmDelivery() {
  const { farm, basePath } = useFarmWorkspace()
  const [orders, setOrders] = useState<OrderRow[]>([])

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, order_items(*), shipments(*)')
      .eq('farm_id', farm.id)
      .in('status', ['paid', 'packing'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders((data as OrderRow[]) ?? []))
  }, [farm.id])

  return (
    <>
      <Header
        title="배송 관리"
        subtitle={`출고 대기 ${orders.length}건`}
        rightElement={
          <>
            <FarmOrderPageLink slug={farm.slug} />
            <NotificationBell farmPath={`${basePath}/orders`} />
          </>
        }
      />
      <div className="px-4 py-4 md:px-6 max-w-5xl mx-auto space-y-3">
        <ShippingPausePanel farmName={farm.name} farms={[{ id: farm.id, name: farm.name }]} />
        {orders.map((order) => (
          <OrderItem key={order.id} order={toOrderListModel(order)} />
        ))}
        {orders.length === 0 && <p className="text-center text-muted py-8">출고 대기 주문이 없습니다</p>}
      </div>
    </>
  )
}
