import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, X, Check, Sparkles } from 'lucide-react'
import { createCheckout } from '../api/billing'

interface Props {
  children: React.ReactNode
  featureName: string
  locked: boolean
}

export default function LockedFeature({ children, featureName, locked }: Props) {
  const [showModal, setShowModal] = useState(false)

  if (!locked) return <>{children}</>

  return (
    <>
      <div className="relative">
        {/* Blurred content */}
        <div className="blur-sm pointer-events-none select-none opacity-60">{children}</div>

        {/* Overlay */}
        <button
          onClick={() => setShowModal(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/40 backdrop-blur-sm rounded-2xl cursor-pointer hover:bg-white/50 transition-colors"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">{featureName}</p>
          <span className="px-4 py-1.5 rounded-full bg-cta text-cta-foreground text-xs font-semibold">
            Upgrade to unlock
          </span>
        </button>
      </div>

      {showModal && <PricingModal onClose={() => setShowModal(false)} />}
    </>
  )
}

function PricingModal({ onClose }: { onClose: () => void }) {
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

  const insightsFeatures = [
    t('pricing.aiEnAr'),
    t('pricing.sentiment'),
    t('pricing.segmentation'),
    t('pricing.recommendations'),
    t('pricing.threeAccounts'),
    t('pricing.twelveMonths'),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="glass-strong rounded-2xl p-8 w-full max-w-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 end-4 text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center gap-2 mb-6">
          <Sparkles className="w-8 h-8 text-cta" />
          <h2 className="text-xl font-bold text-foreground">{t('pricing.title')}</h2>
          <p className="text-sm text-muted-foreground text-center">{t('pricing.subtitle')}</p>
        </div>

        {/* Plan card */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-foreground">Insights</h3>
            <div>
              <span className="text-3xl font-bold text-primary">$29</span>
              <span className="text-sm text-muted-foreground">/mo</span>
            </div>
          </div>

          <ul className="space-y-2">
            {insightsFeatures.map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full rounded-lg bg-cta text-cta-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? t('pricing.redirecting') : t('pricing.upgradeNow')}
          </button>
        </div>
      </div>
    </div>
  )
}
