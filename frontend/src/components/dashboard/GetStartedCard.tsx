import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAccounts } from '../../hooks/useAnalytics'
import { fetchBrandIdentity } from '../../api/auth'

/**
 * Get-Started checklist on Home. Non-dismissible by design — users can't
 * skip setup. Auto-disappears once all 3 items complete; reappears if a
 * dependency disappears (e.g. user disconnects their last Instagram account)
 * because completion is fully derived from live React Query data.
 */
export default function GetStartedCard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const accounts = useAccounts()
  const brand = useQuery({
    queryKey: ['auth', 'brand-identity'],
    queryFn: fetchBrandIdentity,
    staleTime: 60_000,
  })

  const instagramDone = (accounts.data?.length ?? 0) > 0
  const businessDone = !!user?.business_profile?.category
  const brandDone = (brand.data?.content_pillars?.length ?? 0) > 0

  // Wait for all probes to settle before deciding visibility, otherwise the
  // card flashes in for a frame on every page load while React Query refetches.
  const stillLoading = accounts.isLoading || brand.isLoading
  if (stillLoading) return null

  if (instagramDone && businessDone && brandDone) return null

  const completedCount = [instagramDone, businessDone, brandDone].filter(Boolean).length

  return (
    <div className="glass rounded-2xl p-6 mb-4 border border-primary/10">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{t('home.getStarted.title')}</h2>
          <p className="text-sm text-foreground/60 mt-1">
            {t('home.getStarted.subtitle', { done: completedCount, total: 3 })}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        <ChecklistItem
          done={instagramDone}
          label={t('home.getStarted.itemInstagram')}
          to="/settings?tab=organization"
          ctaLabel={t('home.getStarted.setUpLink')}
        />
        <ChecklistItem
          done={businessDone}
          label={t('home.getStarted.itemBusiness')}
          to="/settings?tab=organization"
          ctaLabel={t('home.getStarted.setUpLink')}
        />
        <ChecklistItem
          done={brandDone}
          label={t('home.getStarted.itemBrand')}
          to="/settings?tab=brandIdentity"
          ctaLabel={t('home.getStarted.setUpLink')}
        />
      </ul>
    </div>
  )
}

function ChecklistItem({
  done,
  label,
  to,
  ctaLabel,
}: {
  done: boolean
  label: string
  to: string
  ctaLabel: string
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        ) : (
          <Circle className="w-5 h-5 text-foreground/30 shrink-0" />
        )}
        <span className={done ? 'text-foreground/60 line-through' : 'text-foreground'}>
          {label}
        </span>
      </div>
      {!done && (
        <Link
          to={to}
          className="text-sm text-primary font-medium inline-flex items-center gap-1 hover:underline shrink-0"
        >
          {ctaLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </li>
  )
}
