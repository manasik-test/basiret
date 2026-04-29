import { useState, useRef, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { useAskBasiret } from '../../contexts/AskBasiretContext'
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

// `askBasiret` opens the chat panel instead of navigating, so it lives outside
// the link-based navItems list and is rendered separately as a button.
const navItems = [
  { key: 'home', icon: Home, href: '/dashboard', primary: true },
  { key: 'myPosts', icon: FileText, href: '/my-posts', primary: true },
  { key: 'myAudience', icon: Users, href: '/my-audience', primary: true },
  { key: 'contentPlan', icon: CalendarRange, href: '/content-plan', primary: true },
  { key: 'competitors', icon: Swords, href: '/competitors', primary: false },
  { key: 'sentiment', icon: Smile, href: '/sentiment', primary: false },
  { key: 'trends', icon: TrendingUp, href: '/trends', primary: false },
  { key: 'myGoals', icon: Target, href: '/my-goals', primary: false },
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
              {isAr ? 'العربية' : 'English'}
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
  const { open: openAsk, isOpen: askIsOpen } = useAskBasiret()
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <>
      {/* Desktop sidebar — 240px wide, tighter padding to match Sidebar.jsx */}
      <aside className="hidden md:flex flex-col w-60 h-screen fixed start-0 top-0 glass-strong z-30 px-4 pt-5 pb-4">
        {/* Logo — 36×36, matches design's .sb-brand */}
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-[18px] h-[18px] text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold text-primary tracking-tight">Basiret</span>
            <span className="text-[10px] text-muted-foreground tracking-[0.08em] uppercase">Insight</span>
          </div>
        </div>

        {/* Nav — 2px gap, 10/12 item padding, 18px icons */}
        <nav className="flex-1 flex flex-col gap-0.5 mt-1">
          {navItems.map(({ key, icon: Icon, href }) => {
            const active = currentPath === href
            const isAfterMyGoals = key === 'settings'
            return (
              <Fragment key={key}>
                {isAfterMyGoals && (
                  <button
                    onClick={openAsk}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors text-start',
                      askIsOpen
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <MessageCircleQuestion className="w-[18px] h-[18px] shrink-0" />
                    <span>{t('nav.askBasiret')}</span>
                  </button>
                )}
                <Link
                  to={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{t(`nav.${key}`)}</span>
                </Link>
              </Fragment>
            )
          })}

          {/* Admin link — system_admin only */}
          {user?.role === 'system_admin' && (
            <Link
              to="/admin"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors',
                currentPath === '/admin'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground',
              )}
            >
              <Shield className="w-[18px] h-[18px] shrink-0" />
              <span>{t('nav.admin')}</span>
            </Link>
          )}
        </nav>

        {/* Foot — Upgrade CTA + user/logout, separated by border per design */}
        <div className="flex flex-col gap-3 pt-3.5 border-t border-border">
          <UpgradeButton />
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {user?.full_name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-foreground leading-tight truncate">
                {user?.full_name}
              </div>
              <button
                onClick={() => { void logout() }}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                {t('nav.logout')}
              </button>
            </div>
          </div>
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
