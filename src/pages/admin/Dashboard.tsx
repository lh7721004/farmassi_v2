import { CreditCard, Package, Sprout, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { Header } from '../../components/layout/Header'
import { StatCard } from '../../components/ui/StatCard'
import { adminNavItems } from '../../config/adminNav'
import { useAuth } from '../../lib/auth'
import { formatPrice } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Order } from '../../types/models'

export function AdminDashboard() {
  const { signOut } = useAuth()
  const [farmCount, setFarmCount] = useState(0)
  const [pendingDeposits, setPendingDeposits] = useState(0)
  const [paidOrders, setPaidOrders] = useState(0)
  const [revenue, setRevenue] = useState(0)

  useEffect(() => {
    void Promise.all([
      supabase.from('farms').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200),
    ]).then(([farms, ordersRes]) => {
      setFarmCount(farms.count ?? 0)
      const orders = (ordersRes.data as Order[]) ?? []
      setPendingDeposits(orders.filter((o) => o.status === 'pending_deposit').length)
      setPaidOrders(orders.filter((o) => o.status === 'paid' || o.status === 'packing').length)
      setRevenue(
        orders
          .filter((o) => o.status !== 'cancelled' && o.status !== 'pending_deposit')
          .reduce((sum, o) => sum + o.total_amount, 0),
      )
    })
  }, [])

  return (
    <AppShell navItems={adminNavItems} roleLabel="관리자" settingsPath="/admin/none">
      <Header
        title="관리자"
        subtitle="주문 · 농가 전체 관리"
        rightElement={
          <button type="button" className="text-sm text-muted" onClick={() => void signOut()}>
            로그아웃
          </button>
        }
      />
      <div className="px-4 py-4 md:px-6 max-w-5xl mx-auto grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="농가" value={`${farmCount}곳`} icon={Sprout} to="/admin/farms" />
        <StatCard
          label="입금 대기"
          value={`${pendingDeposits}건`}
          icon={CreditCard}
          to="/admin/deposits"
        />
        {/* 출고 대기는 paid·packing 주문 수. 송장 화면이 같은 조건으로 목록을 보여준다. */}
        <StatCard label="출고 대기" value={`${paidOrders}건`} icon={Truck} to="/admin/shipments" />
        <StatCard
          label="매출(최근)"
          value={formatPrice(revenue)}
          icon={Package}
          to="/admin/orders"
        />
      </div>
    </AppShell>
  )
}
