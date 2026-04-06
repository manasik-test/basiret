import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import {
  LayoutDashboard,
  BarChart3,
  Users,
  SmilePlus,
  Lightbulb,
  Settings,
  Sparkles,
} from 'lucide-react'

const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, href: '/' },
  { key: 'analytics', icon: BarChart3, href: '/analytics' },
  { key: 'audience', icon: Users, href: '/audience' },
  { key: 'sentiment', icon: SmilePlus, href: '/sentiment' },
  { key: 'recommendations', icon: Lightbulb, href: '/recommendations' },
  { key: 'settings', icon: Settings, href: '/settings' },
] as const

export default function Sidebar() {
  const { t } = useTranslation()
  const currentPath = '/'

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
              <a
                key={key}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{t(`nav.${key}`)}</span>
              </a>
            )
          })}
        </nav>

        {/* Upgrade CTA */}
        <div className="px-4 pb-6">
          <a
            href="/upgrade"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-cta text-cta-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            {t('nav.upgrade')}
          </a>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 glass-strong z-30 flex items-center justify-around py-2 border-t border-border">
        {navItems.slice(0, 5).map(({ key, icon: Icon, href }) => {
          const active = currentPath === href
          return (
            <a
              key={key}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-foreground/50',
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{t(`nav.${key}`)}</span>
            </a>
          )
        })}
      </nav>
    </>
  )
}
