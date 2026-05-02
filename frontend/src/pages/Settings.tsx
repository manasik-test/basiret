import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { User, Building2, Bell, CreditCard, Sparkles, FileText, Download, Camera, Trash2, CheckCircle2, AlertCircle, AlertTriangle, X, Palette, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccounts, useOverview } from '../hooks/useAnalytics'
import { useSubscription, useIsFeatureLocked } from '../hooks/useBilling'
import { createCheckout } from '../api/billing'
import { fetchInstagramAuthUrl, disconnectInstagramAccount } from '../api/instagram'
import {
  updateProfile as apiUpdateProfile,
  changePassword as apiChangePassword,
  deleteAccount as apiDeleteAccount,
  fetchBrandIdentity,
  saveBrandIdentity,
  detectBrandIdentity,
  type BrandIdentity,
  type BrandTone,
  type BrandLanguageStyle,
  type BrandEmojiUsage,
  type BrandCaptionLength,
  type DetectedBrandIdentity,
} from '../api/auth'
import api from '../api/client'
import LockedFeature from '../components/LockedFeature'
import { cn } from '../lib/utils'

/* ── Tab Navigation ─────────────────────────────────────── */

const tabs = [
  { key: 'profile', icon: User },
  { key: 'organization', icon: Building2 },
  { key: 'brandIdentity', icon: Palette },
  { key: 'notifications', icon: Bell },
  { key: 'reports', icon: FileText },
  { key: 'billing', icon: CreditCard },
  { key: 'danger', icon: AlertTriangle },
] as const

type TabKey = typeof tabs[number]['key']

/* ── Profile Tab ────────────────────────────────────────── */

function ProfileTab() {
  const { t, i18n } = useTranslation()
  const { user, updateUser } = useAuth()
  const isAr = i18n.language === 'ar'

  function setLanguage(next: 'en' | 'ar') {
    if (next === i18n.language) return
    i18n.changeLanguage(next)
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = next
  }

  const [name, setName] = useState(user?.full_name || '')
  const [email] = useState(user?.email || '')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSaved(false)

    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setProfileError(t('settings.nameTooShort'))
      return
    }

    setProfileSaving(true)
    try {
      const updated = await apiUpdateProfile(trimmed)
      updateUser(updated)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : t('settings.profileSaveError'),
      )
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSaved(false)
    if (newPw !== confirmPw) {
      setPwError(t('settings.passwordMismatch'))
      return
    }
    if (newPw.length < 8) {
      setPwError(t('auth.passwordTooShort'))
      return
    }

    setPwSaving(true)
    try {
      await apiChangePassword(currentPw, newPw)
      setPwSaved(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) {
      setPwError(
        err instanceof Error ? err.message : t('settings.passwordChangeError'),
      )
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Language preference */}
      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-base font-bold text-foreground">{t('settings.languageTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('settings.languageDesc')}</p>
        <div className="inline-flex bg-muted rounded-lg p-1">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              !isAr
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('ar')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              isAr
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            العربية
          </button>
        </div>
      </div>

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
        {profileError && <p className="text-xs text-red-500">{profileError}</p>}
        {profileSaved && (
          <p className="text-xs text-green-600">{t('settings.profileUpdated')}</p>
        )}
        <button
          type="submit"
          disabled={profileSaving}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {profileSaving
            ? t('settings.saving')
            : profileSaved
            ? t('settings.saved')
            : t('settings.saveProfile')}
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
          disabled={pwSaving}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pwSaving ? t('settings.saving') : t('settings.changePassword')}
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

/* ── Danger Zone Tab ────────────────────────────────────── */

function DangerZoneTab() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // We don't know whether the user is the last admin until the request runs
  // (it's a server-side check). So we soften the messaging both ways.
  const orgName = user?.organization_name || ''

  async function handleConfirmDelete() {
    if (!password) {
      setError(t('settings.dangerError'))
      return
    }
    setError('')
    setDeleting(true)
    try {
      await apiDeleteAccount(password)
      // Account is gone. Navigate FIRST so we leave the protected /settings
      // subtree before clearing the session — otherwise ProtectedRoute sees
      // user=null and redirects to /login, racing our /-redirect. Then clear
      // in-memory state. We deliberately do NOT call POST /auth/logout (the
      // user row no longer exists; the call would 401 and bounce through the
      // refresh interceptor).
      navigate('/', { replace: true })
      logout({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.dangerError'))
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-red-900">{t('settings.dangerTitle')}</h3>
            <p className="text-sm text-red-800">{t('settings.dangerWarning')}</p>
          </div>
        </div>

        <div className="text-sm text-foreground/80 space-y-2">
          <p>{t('settings.dangerListIntro')}</p>
          <ul className="list-disc ms-5 space-y-1 text-foreground/70">
            <li>{t('settings.dangerListProfile')}</li>
            <li>{t('settings.dangerListPosts')}</li>
            <li>{t('settings.dangerListSegments')}</li>
            <li>{t('settings.dangerListSubscription')}</li>
          </ul>
          <p className="pt-2 text-xs text-foreground/60">
            {t('settings.dangerLastAdminNote', { org: orgName })}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError('')
            setPassword('')
            setModalOpen(true)
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          {t('settings.dangerCta')}
        </button>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => !deleting && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {t('settings.dangerModalTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !deleting && setModalOpen(false)}
                className="text-foreground/40 hover:text-foreground/70"
                aria-label={t('settings.dangerModalCancel')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-foreground/70">{t('settings.dangerModalDesc')}</p>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('settings.dangerModalPasswordLabel')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={deleting}
                autoFocus
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {t('settings.dangerModalCancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting || !password}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? t('settings.dangerModalDeleting') : t('settings.dangerModalConfirm')}
              </button>
            </div>
          </div>
        </div>
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

/* ── Brand Identity Tab ─────────────────────────────────── */

const TONE_OPTIONS: BrandTone[] = ['professional', 'friendly', 'luxurious', 'playful', 'inspiring']
const LANGUAGE_STYLE_OPTIONS: BrandLanguageStyle[] = ['formal_arabic', 'casual_dialect', 'bilingual']
const EMOJI_OPTIONS: BrandEmojiUsage[] = ['never', 'occasionally', 'frequently']
const LENGTH_OPTIONS: BrandCaptionLength[] = ['short', 'medium', 'long']
const PILLAR_SUGGESTIONS = [
  'Behind the scenes',
  'Product showcase',
  'Customer stories',
  'Tips & Education',
  'Promotions',
]
const TONE_EMOJI: Record<BrandTone, string> = {
  professional: '💼',
  friendly: '😊',
  luxurious: '✨',
  playful: '🎉',
  inspiring: '🚀',
}
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

function BrandIdentityTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const overview = useOverview()
  const totalPosts = overview.data?.total_posts ?? 0

  const { data, isLoading } = useQuery<BrandIdentity>({
    queryKey: ['auth', 'brand-identity'],
    queryFn: fetchBrandIdentity,
    staleTime: 60_000,
  })

  // Local working copy. We only commit on Save so users can edit freely
  // without thrashing the server.
  const [form, setForm] = useState<BrandIdentity | null>(null)
  useEffect(() => {
    if (data && !form) setForm(data)
  }, [data, form])

  const [pillarDraft, setPillarDraft] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string>('')

  const saveMutation = useMutation({
    mutationFn: (payload: BrandIdentity) => saveBrandIdentity(payload),
    onSuccess: (saved) => {
      setForm(saved)
      setSavedAt(Date.now())
      setSaveError('')
      queryClient.invalidateQueries({ queryKey: ['auth', 'brand-identity'] })
      // Brand voice change busts AI caches server-side; tell React Query to
      // refetch the surfaces that show those caches so the user sees fresh
      // output without a manual reload.
      queryClient.invalidateQueries({ queryKey: ['ai-pages'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', 'insights'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', 'sentiment-summary'] })
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : t('brandIdentity.saveError'))
    },
  })

  const detectMutation = useMutation({
    mutationFn: () => detectBrandIdentity(),
  })

  if (isLoading || !form) {
    return <div className="glass rounded-2xl p-6 text-sm text-foreground/60">…</div>
  }

  function update<K extends keyof BrandIdentity>(key: K, value: BrandIdentity[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function addPillar(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed || !form) return
    if (form.content_pillars.includes(trimmed)) return
    if (form.content_pillars.length >= 5) return
    update('content_pillars', [...form.content_pillars, trimmed].slice(0, 5))
  }

  function removePillar(idx: number) {
    if (!form) return
    update(
      'content_pillars',
      form.content_pillars.filter((_, i) => i !== idx),
    )
  }

  function applyDetected(preview: DetectedBrandIdentity) {
    if (!form) return
    setForm({
      ...form,
      tone: preview.tone,
      language_style: preview.language_style,
      emoji_usage: preview.emoji_usage,
      caption_length: preview.caption_length,
      content_pillars: preview.content_pillars,
      image_style: preview.image_style,
      detected_from_posts: preview.detected_from_posts,
    })
    detectMutation.reset()
  }

  function handleSave() {
    if (!form) return
    if (!HEX_RE.test(form.primary_color) || !HEX_RE.test(form.secondary_color)) {
      setSaveError(t('brandIdentity.invalidColor'))
      return
    }
    saveMutation.mutate(form)
  }

  const detected = detectMutation.data
  const showDetectBanner = totalPosts > 0

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">{t('brandIdentity.title')}</h2>
          <p className="text-sm text-foreground/60 mt-1">{t('brandIdentity.subtitle')}</p>
        </div>

        {/* Visual Identity */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t('brandIdentity.sectionVisual')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField
              label={t('brandIdentity.primaryColor')}
              value={form.primary_color}
              onChange={(v) => update('primary_color', v)}
            />
            <ColorField
              label={t('brandIdentity.secondaryColor')}
              value={form.secondary_color}
              onChange={(v) => update('secondary_color', v)}
            />
          </div>
        </section>

        {/* Voice & Tone */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t('brandIdentity.sectionVoice')}
          </h3>

          <div>
            <label className="block text-sm font-medium mb-2">{t('brandIdentity.toneLabel')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TONE_OPTIONS.map((tone) => (
                <SelectableCard
                  key={tone}
                  selected={form.tone === tone}
                  onClick={() => update('tone', tone)}
                >
                  <div className="text-2xl mb-1">{TONE_EMOJI[tone]}</div>
                  <div className="text-sm font-medium">{t(`brandIdentity.tone.${tone}`)}</div>
                </SelectableCard>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t('brandIdentity.languageStyleLabel')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LANGUAGE_STYLE_OPTIONS.map((style) => (
                <SelectableCard
                  key={style}
                  selected={form.language_style === style}
                  onClick={() => update('language_style', style)}
                >
                  <div className="text-sm font-medium">
                    {t(`brandIdentity.languageStyle.${style}`)}
                  </div>
                </SelectableCard>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t('brandIdentity.emojiUsageLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {EMOJI_OPTIONS.map((opt) => (
                <SelectableCard
                  key={opt}
                  selected={form.emoji_usage === opt}
                  onClick={() => update('emoji_usage', opt)}
                >
                  <div className="text-sm font-medium">
                    {t(`brandIdentity.emojiUsage.${opt}`)}
                  </div>
                </SelectableCard>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t('brandIdentity.captionLengthLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LENGTH_OPTIONS.map((opt) => (
                <SelectableCard
                  key={opt}
                  selected={form.caption_length === opt}
                  onClick={() => update('caption_length', opt)}
                >
                  <div className="text-sm font-medium">
                    {t(`brandIdentity.captionLength.${opt}`)}
                  </div>
                </SelectableCard>
              ))}
            </div>
          </div>
        </section>

        {/* Content pillars */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
            {t('brandIdentity.sectionPillars')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {form.content_pillars.map((p, i) => (
              <span
                key={`${p}-${i}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm border border-primary/20"
              >
                {p}
                <button
                  type="button"
                  onClick={() => removePillar(i)}
                  className="hover:bg-primary/10 rounded-full p-0.5"
                  aria-label={`remove ${p}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {form.content_pillars.length === 0 && (
              <span className="text-sm text-foreground/50">
                {t('brandIdentity.noPillars')}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={pillarDraft}
              onChange={(e) => setPillarDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addPillar(pillarDraft)
                  setPillarDraft('')
                }
              }}
              placeholder={t('brandIdentity.pillarPlaceholder')}
              maxLength={60}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              disabled={form.content_pillars.length >= 5}
            />
            <button
              type="button"
              onClick={() => {
                addPillar(pillarDraft)
                setPillarDraft('')
              }}
              disabled={form.content_pillars.length >= 5 || !pillarDraft.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              {t('brandIdentity.addPillar')}
            </button>
          </div>
          <div>
            <p className="text-xs text-foreground/50 mb-2">{t('brandIdentity.suggestionLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {PILLAR_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addPillar(s)}
                  disabled={form.content_pillars.includes(s) || form.content_pillars.length >= 5}
                  className="px-3 py-1 rounded-full text-xs border border-border bg-background hover:bg-muted disabled:opacity-40"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Auto-detect banner */}
      {showDetectBanner && (
        <div className="glass rounded-2xl p-6 border border-primary/20 bg-primary/5 space-y-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold">{t('brandIdentity.detectTitle')}</h3>
              <p className="text-sm text-foreground/70 mt-1">{t('brandIdentity.detectBody')}</p>
            </div>
            <button
              type="button"
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {detectMutation.isPending ? t('brandIdentity.detecting') : t('brandIdentity.detectButton')}
            </button>
          </div>
          {detectMutation.isError && (
            <p className="text-sm text-red-600">{t('brandIdentity.detectError')}</p>
          )}
          {detected && (
            <div className="rounded-xl bg-background border border-border p-4 space-y-3">
              <h4 className="font-medium text-sm">{t('brandIdentity.detectPreviewTitle')}</h4>
              <ul className="text-sm space-y-1 text-foreground/80">
                <li>{t('brandIdentity.toneLabel')}: {t(`brandIdentity.tone.${detected.tone}`)}</li>
                <li>{t('brandIdentity.languageStyleLabel')}: {t(`brandIdentity.languageStyle.${detected.language_style}`)}</li>
                <li>{t('brandIdentity.emojiUsageLabel')}: {t(`brandIdentity.emojiUsage.${detected.emoji_usage}`)}</li>
                <li>{t('brandIdentity.captionLengthLabel')}: {t(`brandIdentity.captionLength.${detected.caption_length}`)}</li>
                <li>{t('brandIdentity.sectionPillars')}: {detected.content_pillars.join(', ') || '—'}</li>
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => applyDetected(detected)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                  {t('brandIdentity.applyDetected')}
                </button>
                <button
                  type="button"
                  onClick={() => detectMutation.reset()}
                  className="px-4 py-2 rounded-lg border border-border text-sm"
                >
                  {t('brandIdentity.dismissDetected')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
        >
          {saveMutation.isPending ? t('brandIdentity.saving') : t('brandIdentity.save')}
        </button>
        {savedAt && Date.now() - savedAt < 4000 && (
          <span className="text-sm text-emerald-600 inline-flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> {t('brandIdentity.savedToast')}
          </span>
        )}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
      </div>
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-2">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_RE.test(value) ? value : '#664FA1'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-12 h-10 rounded-lg border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
          placeholder="#RRGGBB"
          maxLength={7}
        />
      </div>
    </label>
  )
}

function SelectableCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-center transition-colors',
        selected
          ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
          : 'border-border bg-background hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const oauth = useInstagramOAuthResult()

  // Read ?tab= on mount so the Get Started checklist on Home can deep-link
  // straight to the right tab. Stripped from the URL so refresh doesn't keep
  // forcing the same tab.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const requested = params.get('tab')
    const validKeys = tabs.map((t) => t.key) as readonly string[]
    if (requested && validKeys.includes(requested)) {
      setActiveTab(requested as TabKey)
      params.delete('tab')
      const qs = params.toString()
      const url =
        window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
      window.history.replaceState({}, '', url)
    }
  }, [])

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
      {activeTab === 'brandIdentity' && <BrandIdentityTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'reports' && <ReportsTab />}
      {activeTab === 'billing' && <BillingTab />}
      {activeTab === 'danger' && <DangerZoneTab />}
    </div>
  )
}
