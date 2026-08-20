import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from './Card'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: string
  /** 주면 카드 전체가 이 주소로 가는 링크가 된다. */
  to?: string
}

export function StatCard({ label, value, icon: Icon, trend, to }: StatCardProps) {
  const card = (
    <Card
      className={[
        'flex flex-col gap-2 h-full',
        to && 'transition-shadow hover:shadow-md',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {trend && <p className="text-xs text-primary">{trend}</p>}
    </Card>
  )

  if (!to) return card

  return (
    <Link
      to={to}
      aria-label={`${label} ${value}`}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  )
}
