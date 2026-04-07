import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { createCheckout } from '../../api/billing'
import {
  LayoutDashboard,
  BarChart3,
  Users,
  SmilePlus,
  Lightbulb,
  Settings,
  Sparkles,
  Shield,
  LogOut,
} from 'lucide-react'

const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, href: '/' },
  { key: 'analytics', icon: BarChart3, href: '/analytics' },
  { key: 'audience', icon: Users, href: '/audience' },
  { key: 'sentiment', icon: SmilePlus, href: '/sentiment' },
  { key: 'recommendations', icon: Lightbulb, href: '/recommendations' },
  { key: 'settings', icon: Settings, href: '/settings' },
] as const

function UpgradeButton() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const url = await createCheckout()
      window.location.href = url
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-cta text-cta-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      <Sparkles className="w-4 h-4" />
      {loading ? '...' : t('nav.upgrade')}
    </button>
  )
}

export default function Sidebar() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed start-0 top-0 glass-strong z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-primary tracking-tight">Basiret</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 mt-2">
          {navItems.map(({ key, icon: Icon, href }) => {
            const active = currentPath === href
            return (
              <Link
                key={key}
                to={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{t(`nav.${key}`)}</span>
              </Link>
            )
          })}

          {/* Admin link — system_admin only */}
          {user?.role === 'system_admin' && (
            <Link
              to="/admin"
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                currentPath === '/admin'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground',
              )}
            >
              <Shield className="w-5 h-5 shrink-0" />
              <span>{t('nav.admin')}</span>
            </Link>
          )}
        </nav>

        {/* User info + Logout */}
        <div className="px-4 pb-3 space-y-2">
          {user && (
            <div className="px-3 py-2 text-xs text-muted-foreground truncate">
              {user.full_name}
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('nav.logout')}
          </button>
        </div>

        {/* Upgrade CTA */}
        <div className="px-4 pb-6">
          <UpgradeButton />
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 glass-strong z-30 flex items-center justify-around py-2 border-t border-border">
        {navItems.slice(0, 5).map(({ key, icon: Icon, href }) => {
          const active = currentPath === href
          return (
            <Link
              key={key}
              to={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-foreground/50',
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{t(`nav.${key}`)}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
