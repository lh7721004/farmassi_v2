import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useNavContext } from './NavContext'

interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  backTo?: string
  rightElement?: ReactNode
}

export function Header({ title, subtitle, showBack, backTo, rightElement }: HeaderProps) {
  const navigate = useNavigate()
  const { mobileSettingsItem } = useNavContext()

  const handleBack = () => {
    if (backTo) navigate(backTo, { replace: true })
    else navigate(-1)
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 md:px-6">
      <div className="flex items-center gap-3 max-w-5xl mx-auto">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100 transition-colors shrink-0"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {rightElement}
          {mobileSettingsItem && (
            <NavLink
              to={mobileSettingsItem.to}
              className={({ isActive }) =>
                `md:hidden flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  isActive ? 'bg-primary-light text-primary' : 'text-gray-500 hover:bg-gray-100'
                }`
              }
              aria-label={mobileSettingsItem.label}
            >
              {({ isActive }) => {
                const Icon = mobileSettingsItem.icon
                return <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              }}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  )
}
