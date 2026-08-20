import { LayoutDashboard, Package, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FarmOrderPageLink } from '../../components/layout/FarmOrderPageLink'
import { Header } from '../../components/layout/Header'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { OrderChart } from '../../components/shared/OrderChart'
import { OrderItem } from '../../components/shared/OrderItem'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../lib/auth'
import { useFarmWorkspace } from '../../lib/farmWorkspace'
import { formatDate, formatPrice } from '../../lib/format'
import { toOrderListModel, type OrderRow } from '../../lib/orders'
import { supabase } from '../../lib/supabase'

export function FarmDashboard() {
  const { farm, basePath, isAdminView } = useFarmWorkspace()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [trend, setTrend] = useState<{ label: string; day: string; orders: number; today?: boolean }[]>([])

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('farm_id', farm.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const rows = (data as OrderRow[]) ?? []
        setOrders(rows)
        const days = [...Array(7)].map((_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (6 - i))
          d.setHours(0, 0, 0, 0)
          const day = d.toLocaleDateString('ko-KR', { weekday: 'short' })
          const label = `${d.getMonth() + 1}/${d.getDate()}`
          const count = rows.filter((order) => {
            const created = new Date(order.created_at)
            return created.toDateString() === d.toDateString()
          }).length
          return { label, day, orders: count, today: i === 6 }
        })
        setTrend(days)
      })
  }, [farm.id])

  const today = new Date().toDateString()
  const todayOrders = orders.filter((o) => new Date(o.created_at).toDateString() === today).length
  const pendingDelivery = orders.filter((o) => o.status === 'paid' || o.status === 'packing').length
  const monthRevenue = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'pending_deposit')
    .filter((o) => {
      const d = new Date(o.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, o) => sum + o.total_amount, 0)

  return (
    <>
      <Header
        title={farm.name}
        subtitle={farm.location ?? formatDate(farm.created_at)}
        rightElement={
          <>
            <FarmOrderPageLink slug={farm.slug} />
            {!isAdminView && (
              <button type="button" className="text-sm text-muted" onClick={() => void signOut()}>
                로그아웃
              </button>
            )}
            <NotificationBell farmPath={`${basePath}/orders`} />
          </>
        }
      />
      <div className="px-4 py-4 md:px-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            label="오늘 주문"
            value={`${todayOrders}건`}
            icon={Package}
            to={`${basePath}/orders`}
          />
          {/* 배송 화면이 같은 조건(paid·packing)으로 목록을 보여준다. */}
          <StatCard
            label="출고 대기"
            value={`${pendingDelivery}건`}
            icon={Truck}
            to={`${basePath}/delivery`}
          />
          <StatCard
            label="이번 달 매출"
            value={formatPrice(monthRevenue)}
            icon={LayoutDashboard}
            to={`${basePath}/orders`}
          />
        </div>
        {trend.length > 0 && <OrderChart data={trend} />}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">최근 주문</h3>
            <button
              type="button"
              onClick={() => navigate(`${basePath}/orders`)}
              className="text-sm text-primary font-medium"
            >
              전체보기
            </button>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <OrderItem key={order.id} order={toOrderListModel(order)} />
            ))}
            {orders.length === 0 && <p className="text-sm text-muted">아직 주문이 없습니다.</p>}
          </div>
        </section>
      </div>
    </>
  )
}
