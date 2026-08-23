import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { Header } from '../../components/layout/Header'
import { DepositConfirmExtra } from '../../components/shared/DepositConfirmExtra'
import { FarmFilterChips } from '../../components/shared/FarmFilterChips'
import { OrderItem } from '../../components/shared/OrderItem'
import { adminNavItems } from '../../config/adminNav'
import { farmsFromOrders, groupOrdersByFarm, toOrderListModel, type OrderRow } from '../../lib/orders'
import { supabase } from '../../lib/supabase'

export function AdminDeposits() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [farmId, setFarmId] = useState<string | 'all'>('all')

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*), farms(name, slug)')
      .eq('status', 'pending_deposit')
      .order('created_at', { ascending: false })
    setOrders((data as OrderRow[]) ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  const farms = useMemo(() => farmsFromOrders(orders), [orders])
  const visible = useMemo(
    () => (farmId === 'all' ? orders : orders.filter((order) => order.farm_id === farmId)),
    [farmId, orders],
  )
  const groups = useMemo(() => groupOrdersByFarm(visible), [visible])
  const showGroupHeaders = farmId === 'all' && groups.length > 1

  useEffect(() => {
    if (farmId !== 'all' && !farms.some((farm) => farm.id === farmId)) {
      setFarmId('all')
    }
  }, [farmId, farms])

  return (
    <AppShell navItems={adminNavItems} roleLabel="관리자" settingsPath="/admin/none">
      <Header title="입금 확인" subtitle={`${visible.length}건 대기`} />
      <div className="px-4 pt-4 md:px-6 max-w-3xl mx-auto">
        <Link
          to="/admin/deposits/ledger"
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
        >
          <span className="text-sm text-gray-900">
            입금 내역 원장
            <span className="ml-2 text-xs text-muted">자동으로 붙지 않은 입금 직접 연결</span>
          </span>
          <span className="text-sm font-semibold text-primary">열기</span>
        </Link>
      </div>
      <div className="px-4 py-4 md:px-6 max-w-5xl mx-auto space-y-4">
        <FarmFilterChips farms={farms} selectedId={farmId} onSelect={setFarmId} allCount={orders.length} />
        {groups.map((group) => (
          <section key={group.farmId} className="space-y-3">
            {showGroupHeaders && (
              <h3 className="font-semibold text-gray-900">
                {group.name}
                <span className="ml-2 text-sm font-normal text-muted">{group.orders.length}건</span>
              </h3>
            )}
            {group.orders.map((order) => (
              <OrderItem
                key={order.id}
                order={toOrderListModel(order)}
                extra={
                  <DepositConfirmExtra
                    orderId={order.id}
                    depositCode={order.deposit_code}
                    onConfirmed={() => void load()}
                  />
                }
              />
            ))}
          </section>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted">입금 대기 주문이 없습니다.</p>}
      </div>
    </AppShell>
  )
}
