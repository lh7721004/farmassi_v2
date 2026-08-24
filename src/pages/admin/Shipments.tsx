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
import { pauseCovering, pauseMessage, todayInSeoul, type PauseRange } from '../../lib/deliveryEstimate'

const ORDER_SELECT =
  '*, order_items(*, product:products(parcel_weight_kg, parcel_volume_cm, parcel_content_code, parcel_delivery_type)), farms(name, slug)'

export function AdminShipments() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [pauses, setPauses] = useState<Record<string, PauseRange[]>>({})

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .in('status', ['paid', 'packing'])
      .order('created_at', { ascending: false })
    setOrders((data as OrderRow[]) ?? [])
  }

  // 농가별 정지 구간. 관리자와 농가가 각각 걸 수 있어 행이 여러 개다.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('shipping_pauses').select('farm_id, start_date, end_date, reason')
        .gte('end_date', todayInSeoul())
      const byFarm: Record<string, PauseRange[]> = {}
      for (const row of (data ?? []) as any[]) {
        (byFarm[row.farm_id] ??= []).push(row)
      }
      setPauses(byFarm)
    })()
  }, [])

  useEffect(() => {
    void loadOrders()
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
              <KpostParcelExport
                orders={group.orders}
                fileStem={`kpost_${group.slug}`}
                onUpdated={() => void loadOrders()}
                pausedReason={(() => {
                  // 정지 기간에는 송장을 만들지 않는다. 송장 자동화가 없으므로
                  // 엑셀만 안 뽑으면 그 기간 출고가 멈춘다.
                  const hit = pauseCovering(pauses[group.farmId] ?? [], todayInSeoul())
                  return hit ? `${pauseMessage(hit)} · 송장을 만들지 않습니다` : null
                })()}
              />
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
