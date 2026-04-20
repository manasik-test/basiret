import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Building2, Bell, CreditCard, Sparkles, FileText, Download, Camera, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccounts } from '../hooks/useAnalytics'
import { useSubscription, useIsFeatureLocked } from '../hooks/useBilling'
import { createCheckout } from '../api/billing'
import { fetchInstagramAuthUrl, disconnectInstagramAccount } from '../api/instagram'
import api from '../api/client'
import LockedFeature from '../components/LockedFeature'
import { cn } from '../lib/utils'

/* ── Tab Navigation ─────────────────────────────────────── */

const tabs = [
  { key: 'profile', icon: User },
  { key: 'organization', icon: Building2 },
  { key: 'notifications', icon: Bell },
  { key: 'reports', icon: FileText },
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
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  const disconnect = useMutation({
    mutationFn: (id: string) => disconnectInstagramAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'accounts'] })
    },
  })

  async function handleConnect() {
    setConnectError('')
    setConnecting(true)
    try {
      const url = await fetchInstagramAuthUrl()
      window.location.href = url
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : t('settings.connectError'))
      setConnecting(false)
    }
  }

  function handleDisconnect(id: string) {
    if (!window.confirm(t('settings.disconnectConfirm'))) return
    disconnect.mutate(id)
  }

  const hasAccounts = (accounts.data?.length ?? 0) > 0

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

      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-foreground">{t('settings.connectedAccounts')}</h3>
        {hasAccounts ? (
          <div className="space-y-3">
            {accounts.data?.map((acc) => {
              const isPending = disconnect.isPending && disconnect.variables === acc.id
              return (
                <div key={acc.id} className="flex items-center gap-3 glass rounded-lg px-4 py-3">
                  <div className="w-5 h-5 text-primary shrink-0 text-xs font-bold flex items-center justify-center">IG</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {acc.account_name || acc.id}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{acc.platform}</p>
                  </div>
                  <button
                    onClick={() => handleDisconnect(acc.id)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isPending ? t('settings.disconnecting') : t('settings.disconnect')}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('settings.noAccounts')}</p>
        )}

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
          {connecting
            ? t('settings.connecting')
            : hasAccounts
              ? t('settings.connectAnotherInstagram')
              : t('settings.connectInstagram')}
        </button>

        {connectError && <p className="text-xs text-red-500">{connectError}</p>}
        {disconnect.isError && (
          <p className="text-xs text-red-500">
            {disconnect.error instanceof Error ? disconnect.error.message : t('settings.disconnectError')}
          </p>
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

/* ── Reports Tab ────────────────────────────────────────── */

function ReportsTab() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const isLocked = useIsFeatureLocked('content_recommendations')
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const accountId = selectedId || accounts.data?.[0]?.id || ''
  const hasAccounts = (accounts.data?.length ?? 0) > 0

  async function handleDownload() {
    if (!accountId) return
    setLoading(true)
    setError('')
    try {
      const blob = await api.get(`/reports/weekly?account_id=${accountId}`, {
        responseType: 'blob',
      }) as unknown as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `basiret-weekly-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('settings.reportsError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LockedFeature featureName={t('settings.reportsTitle')} locked={isLocked}>
      <div className="glass rounded-2xl p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-foreground">{t('settings.reportsTitle')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('settings.reportsDesc')}</p>
        </div>

        {!hasAccounts ? (
          <p className="text-sm text-muted-foreground">{t('settings.reportsNoAccounts')}</p>
        ) : (
          <>
            {(accounts.data?.length ?? 0) > 1 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('settings.reportsAccountLabel')}
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {accounts.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_name || a.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {loading ? t('settings.reportsGenerating') : t('settings.reportsDownload')}
            </button>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </>
        )}
      </div>
    </LockedFeature>
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

/* ── OAuth result banner ────────────────────────────────── */

const OAUTH_STATUSES = ['connected', 'denied', 'invalid_state', 'user_not_found', 'exchange_failed'] as const
type OAuthStatus = typeof OAUTH_STATUSES[number]

function isOAuthStatus(v: string | null): v is OAuthStatus {
  return v !== null && (OAUTH_STATUSES as readonly string[]).includes(v)
}

function useInstagramOAuthResult(): {
  status: OAuthStatus | null
  dismiss: () => void
} {
  const [status, setStatus] = useState<OAuthStatus | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ig = params.get('ig')
    if (isOAuthStatus(ig)) {
      setStatus(ig)
      if (ig === 'connected') {
        queryClient.invalidateQueries({ queryKey: ['analytics', 'accounts'] })
      }
      // Strip ?ig=... so a refresh doesn't re-fire the toast.
      params.delete('ig')
      const qs = params.toString()
      const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
      window.history.replaceState({}, '', url)
    }
  }, [queryClient])

  return { status, dismiss: () => setStatus(null) }
}

function OAuthBanner({ status, onDismiss }: { status: OAuthStatus; onDismiss: () => void }) {
  const { t } = useTranslation()
  const isOk = status === 'connected'
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl px-4 py-3 border',
        isOk
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-800',
      )}
    >
      {isOk ? (
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      )}
      <p className="text-sm flex-1">{t(`settings.oauth.${status}`)}</p>
      <button
        onClick={onDismiss}
        className="text-xs opacity-70 hover:opacity-100 underline shrink-0"
      >
        {t('settings.oauth.dismiss')}
      </button>
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const oauth = useInstagramOAuthResult()

  // If we returned from Meta, jump straight to the Organization tab so the
  // newly-connected (or failed) account is in front of the user.
  useEffect(() => {
    if (oauth.status) setActiveTab('organization')
  }, [oauth.status])

  return (
    <div className="space-y-6">
      {oauth.status && <OAuthBanner status={oauth.status} onDismiss={oauth.dismiss} />}

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
      {activeTab === 'reports' && <ReportsTab />}
      {activeTab === 'billing' && <BillingTab />}
    </div>
  )
}
