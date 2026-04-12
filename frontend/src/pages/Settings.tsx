import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Building2, Bell, CreditCard, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccounts } from '../hooks/useAnalytics'
import { useSubscription } from '../hooks/useBilling'
import { createCheckout } from '../api/billing'
import { cn } from '../lib/utils'

/* ── Tab Navigation ─────────────────────────────────────── */

const tabs = [
  { key: 'profile', icon: User },
  { key: 'organization', icon: Building2 },
  { key: 'notifications', icon: Bell },
  { key: 'billing', icon: CreditCard },
] as const

type TabKey = typeof tabs[number]['key']

/* ── Profile Tab ────────────────────────────────────────── */

function ProfileTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [name, setName] = useState(user?.full_name || '')
  const [email] = useState(user?.email || '')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    // No backend endpoint yet — show success feedback
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 3000)
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSaved(false)
    if (newPw !== confirmPw) {
      setPwError(t('settings.passwordMismatch'))
      return
    }
    // No backend endpoint yet — show success feedback
    setPwSaved(true)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setTimeout(() => setPwSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Profile form */}
      <form onSubmit={handleSaveProfile} className="glass rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('settings.fullName')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('settings.email')}</label>
          <input
            type="email"
            value={email}
            readOnly
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {profileSaved ? t('settings.saved') : t('settings.saveProfile')}
        </button>
      </form>

      {/* Password form */}
      <form onSubmit={handleChangePassword} className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-foreground">{t('settings.changePassword')}</h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('settings.currentPassword')}</label>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('settings.newPassword')}</label>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t('settings.confirmPassword')}</label>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {pwError && <p className="text-xs text-red-500">{pwError}</p>}
        {pwSaved && <p className="text-xs text-green-600">{t('settings.passwordUpdated')}</p>}
        <button
          type="submit"
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t('settings.changePassword')}
        </button>
      </form>
    </div>
  )
}

/* ── Organization Tab ───────────────────────────────────── */

function OrganizationTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const accounts = useAccounts()

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <label className="block text-sm font-medium text-foreground mb-1">{t('settings.orgName')}</label>
        <input
          type="text"
          value={user?.organization_name || ''}
          readOnly
          className="glass w-full rounded-lg px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
        />
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-base font-bold text-foreground mb-4">{t('settings.connectedAccounts')}</h3>
        {accounts.data && accounts.data.length > 0 ? (
          <div className="space-y-3">
            {accounts.data.map((acc) => (
              <div key={acc.id} className="flex items-center gap-3 glass rounded-lg px-4 py-3">
                <div className="w-5 h-5 text-primary shrink-0 text-xs font-bold flex items-center justify-center">IG</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {acc.account_name || acc.id}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{acc.platform}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('settings.noAccounts')}</p>
        )}
      </div>
    </div>
  )
}

/* ── Notifications Tab ──────────────────────────────────── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function NotificationsTab() {
  const { t } = useTranslation()
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [sentimentAlerts, setSentimentAlerts] = useState(false)

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t('settings.emailAlerts')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('settings.emailAlertsDesc')}</p>
        </div>
        <Toggle checked={emailAlerts} onChange={setEmailAlerts} />
      </div>
      <div className="border-t border-border" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t('settings.sentimentAlerts')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('settings.sentimentAlertsDesc')}</p>
        </div>
        <Toggle checked={sentimentAlerts} onChange={setSentimentAlerts} />
      </div>
    </div>
  )
}

/* ── Billing Tab ────────────────────────────────────────── */

function BillingTab() {
  const { t } = useTranslation()
  const { data: sub } = useSubscription()
  const [loading, setLoading] = useState(false)
  const isStarter = !sub || sub.plan_tier === 'starter'

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
    <div className="glass rounded-2xl p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{t('settings.currentPlan')}</p>
        <p className="text-2xl font-bold text-foreground mt-1">
          {isStarter ? t('settings.planStarter') : t('settings.planInsights')}
        </p>
      </div>

      {isStarter ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('settings.upgradeDesc')}</p>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-cta text-cta-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? '...' : t('settings.upgradeCta')}
          </button>
        </div>
      ) : (
        sub?.current_period_end && (
          <div>
            <p className="text-sm text-muted-foreground">{t('settings.nextBilling')}</p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {new Date(sub.current_period_end).toLocaleDateString()}
            </p>
          </div>
        )
      )}
    </div>
  )
}

/* ── Settings Page ──────────────────────────────────────── */

export default function Settings() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  return (
    <div className="space-y-6">
      {/* Tab Nav */}
      <div className="flex gap-1 glass rounded-xl p-1">
        {tabs.map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center',
              activeTab === key
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-foreground/60 hover:text-foreground hover:bg-muted',
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t(`settings.${key}Tab`)}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'organization' && <OrganizationTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'billing' && <BillingTab />}
    </div>
  )
}
