import { CreditCard, Package, Sprout, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { Header } from '../../components/layout/Header'
import { VersionBadge } from '../../components/shared/VersionBadge'
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
      // 카드를 누르면 농가 화면이 '활성' 으로 열린다. 카드가 전체 수를 세면
      // 눌렀을 때 숫자가 달라 보인다. 같은 기준으로 센다.
      supabase.from('farms').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending_deposit'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['paid', 'packing']),
      // 매출은 합계라 세는 것으로 안 되고 값을 받아야 한다. 금액 한 컬럼만 받는다.
      supabase.from('orders').select('total_amount, status'),
    ]).then(([farms, pending, shipping, ordersRes]) => {
      setFarmCount(farms.count ?? 0)
      setPendingDeposits(pending.count ?? 0)
      setPaidOrders(shipping.count ?? 0)
      const orders = (ordersRes.data as Pick<Order, 'total_amount' | 'status'>[]) ?? []
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
        <StatCard label="활성 농가" value={`${farmCount}곳`} icon={Sprout} to="/admin/farms" />
        <StatCard
          label="입금 대기"
          value={`${pendingDeposits}건`}
          icon={CreditCard}
          to="/admin/deposits"
        />
        {/* 출고 대기는 paid·packing 주문 수. 송장 화면이 같은 조건으로 목록을 보여준다. */}
        <StatCard label="출고 대기" value={`${paidOrders}건`} icon={Truck} to="/admin/shipments" />
        <StatCard
          label="매출"
          value={formatPrice(revenue)}
          icon={Package}
          to="/admin/orders"
        />
      </div>
      <VersionBadge />
    </AppShell>
  )
}
