import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { Header } from '../../components/layout/Header'
import { KpostParcelExport } from '../../components/shared/KpostParcelExport'
import { OrderItem } from '../../components/shared/OrderItem'
import { mergePauseFarms, ShippingPausePanel } from '../../components/shared/ShippingPausePanel'
import { Card } from '../../components/ui/Card'
import { adminNavItems } from '../../config/adminNav'
import { groupOrdersByFarm, toOrderListModel, type OrderRow } from '../../lib/orders'
import { supabase } from '../../lib/supabase'

const ORDER_SELECT =
  '*, order_items(*, product:products(parcel_weight_kg, parcel_volume_cm, parcel_content_code, parcel_delivery_type)), farms(name, slug)'

export function AdminShipments() {
  const [orders, setOrders] = useState<OrderRow[]>([])

  useEffect(() => {
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .in('status', ['paid', 'packing'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders((data as OrderRow[]) ?? []))
  }, [])

  const groups = useMemo(() => groupOrdersByFarm(orders), [orders])
  const pauseFarms = useMemo(
    () => mergePauseFarms(groups.map((group) => ({ id: group.farmId, name: group.name }))),
    [groups],
  )

  return (
    <AppShell navItems={adminNavItems} roleLabel="관리자" settingsPath="/admin/none">
      <Header title="송장" subtitle="농가별 우체국 창구소포 엑셀" />
      <div className="px-4 py-4 md:px-6 max-w-5xl mx-auto space-y-4">
        <ShippingPausePanel farmSelect farms={pauseFarms} />
        <p className="text-sm text-muted">
          중량·부피·내용품코드는 상품에 저장된 값으로 채워집니다. 인터넷우체국 창구소포접수에서 엑셀을 올린 뒤
          주소검증하세요.
        </p>
        {groups.map((group) => (
          <div key={group.farmId} className="space-y-3">
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{group.name}</h3>
                <p className="text-sm text-muted">출고 대기 {group.orders.length}건</p>
              </div>
              <KpostParcelExport orders={group.orders} fileStem={`kpost_${group.slug}`} />
            </Card>
            {group.orders.map((order) => (
              <OrderItem key={order.id} order={toOrderListModel(order)} />
            ))}
          </div>
        ))}
        {orders.length === 0 && <p className="text-center text-muted py-8">출고 대기 주문이 없습니다</p>}
      </div>
    </AppShell>
  )
}
