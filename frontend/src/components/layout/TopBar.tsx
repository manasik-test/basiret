import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Globe, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'

function applyDir(lang: string) {
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

const pageTitleMap: Record<string, string> = {
  '/dashboard': 'nav.home',
  '/my-posts': 'nav.myPosts',
  '/my-audience': 'nav.myAudience',
  '/content-plan': 'nav.contentPlan',
  '/competitors': 'nav.competitors',
  '/trends': 'nav.trends',
  '/my-goals': 'nav.myGoals',
  '/ask-basiret': 'nav.askBasiret',
  '/settings': 'nav.settings',
  '/admin': 'nav.admin',
}

export default function TopBar() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const [dateRange, setDateRange] = useState('last30')
  const titleKey = pageTitleMap[pathname] || 'nav.dashboard'

  // Sync dir on initial load (i18next may restore 'ar' from localStorage)
  useEffect(() => {
    applyDir(i18n.language)
  }, [i18n.language])

  const toggleLanguage = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar'
    i18n.changeLanguage(next)
  }

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <h1 className="text-2xl font-bold text-foreground">{t(titleKey)}</h1>

      <div className="flex items-center gap-3">
        {/* Date range selector */}
        <div className="relative">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="glass appearance-none rounded-lg px-4 py-2 pe-9 text-sm font-medium text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="last7">{t('topbar.last7')}</option>
            <option value="last30">{t('topbar.last30')}</option>
            <option value="last90">{t('topbar.last90')}</option>
            <option value="allTime">{t('topbar.allTime')}</option>
          </select>
          <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50 pointer-events-none" />
        </div>

        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          className="glass flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Globe className="w-4 h-4" />
          {t('common.language')}
        </button>
      </div>
    </header>
  )
}
