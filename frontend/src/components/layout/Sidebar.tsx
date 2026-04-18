import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { createCheckout } from '../../api/billing'
import {
  Home,
  FileText,
  Users,
  CalendarRange,
  Swords,
  Smile,
  TrendingUp,
  Target,
  MessageCircleQuestion,
  Settings,
  Sparkles,
  Shield,
  LogOut,
  UserCircle,
  Globe,
} from 'lucide-react'

const navItems = [
  { key: 'home', icon: Home, href: '/dashboard', primary: true },
  { key: 'myPosts', icon: FileText, href: '/my-posts', primary: true },
  { key: 'myAudience', icon: Users, href: '/my-audience', primary: true },
  { key: 'contentPlan', icon: CalendarRange, href: '/content-plan', primary: true },
  { key: 'competitors', icon: Swords, href: '/competitors', primary: false },
  { key: 'sentiment', icon: Smile, href: '/sentiment', primary: false },
  { key: 'trends', icon: TrendingUp, href: '/trends', primary: false },
  { key: 'myGoals', icon: Target, href: '/my-goals', primary: false },
  { key: 'askBasiret', icon: MessageCircleQuestion, href: '/ask-basiret', primary: false },
  { key: 'settings', icon: Settings, href: '/settings', primary: true },
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

function MobileTopBar() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const isAr = i18n.language === 'ar'

  function toggleLang() {
    const next = isAr ? 'en' : 'ar'
    i18n.changeLanguage(next)
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
    setOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="md:hidden fixed top-0 inset-x-0 glass-strong z-30 flex items-center justify-between px-4 py-3 border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-primary tracking-tight">Basiret</span>
      </div>

      {/* Profile button + dropdown */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <UserCircle className="w-6 h-6 text-foreground/70" />
        </button>

        {open && (
          <div className="absolute end-0 top-full mt-1 w-48 rounded-lg glass-strong border border-border shadow-lg py-1 z-50">
            {user && (
              <div className="px-3 py-2 text-sm text-foreground font-medium truncate border-b border-border">
                {user.full_name}
              </div>
            )}
            <button
              onClick={toggleLang}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            >
              <Globe className="w-4 h-4" />
              {isAr ? 'English' : 'العربية'}
            </button>
            <button
              onClick={() => { setOpen(false); logout() }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t('nav.logout')}
            </button>
          </div>
        )}
      </div>
    </div>
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

      {/* Mobile top bar with profile menu */}
      <MobileTopBar />

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 glass-strong z-30 flex items-center justify-around py-2 border-t border-border">
        {navItems.filter((i) => i.primary).map(({ key, icon: Icon, href }) => {
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
