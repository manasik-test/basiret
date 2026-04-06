import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import {
  Sparkles,
  Camera,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Link2,
  PartyPopper,
  Check,
} from 'lucide-react'
import api from '../api/client'

const STEPS = ['account', 'connect', 'complete'] as const
type Step = (typeof STEPS)[number]

// ── Step indicator ─────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const { t } = useTranslation()
  const labels = [
    t('onboarding.stepAccount'),
    t('onboarding.stepConnect'),
    t('onboarding.stepComplete'),
  ]
  const currentIdx = STEPS.indexOf(current)

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-xs mx-auto mb-6">
      {STEPS.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1 font-medium whitespace-nowrap',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {labels[i]}
              </span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-1 mt-[-14px]',
                  i < currentIdx ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Registration form ──────────────────────────────

function StepAccount({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  const { register } = useAuth()

  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setPasswordError('')

    if (password.length < 8) {
      setPasswordError(t('auth.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      await register(email, password, fullName, orgName)
      onNext()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(typeof msg === 'string' && msg ? msg : t('auth.registerFailed'))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground text-center">
        {t('auth.registerSubtitle')}
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('auth.fullName')}
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('auth.fullNamePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('auth.organizationName')}
          </label>
          <input
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('auth.orgPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('auth.email')}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('auth.password')}
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass w-full rounded-lg px-4 py-2.5 pe-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('auth.passwordPlaceholder')}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordError ? (
            <p className="mt-1 text-xs text-red-600">{passwordError}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="text-primary font-medium hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </div>
  )
}

// ── Step 2: Connect Instagram ──────────────────────────────

function StepConnect({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    setError('')
    setLoading(true)
    try {
      const res = await api.get<unknown, { url: string }>('/instagram/auth-url')
      window.location.href = res.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Instagram connection')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Link2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t('onboarding.connectTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('onboarding.subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Camera className="w-5 h-5" />
        {loading ? t('onboarding.connecting') : t('onboarding.connectButton')}
      </button>

      {/* Permissions info */}
      <div className="glass rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          {t('onboarding.permissionsTitle')}
        </h3>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Eye className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">{t('onboarding.weAccess')}</p>
              <p className="text-xs text-muted-foreground">{t('onboarding.weAccessDetails')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <EyeOff className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">{t('onboarding.weNever')}</p>
              <p className="text-xs text-muted-foreground">{t('onboarding.weNeverDetails')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={onNext}
        className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {t('onboarding.skip')}
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Step 3: All Set ────────────────────────────────────────

function StepComplete() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <PartyPopper className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('onboarding.completeTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-2">{t('onboarding.completeDesc')}</p>
      </div>
      <button
        onClick={() => navigate('/', { replace: true })}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        {t('onboarding.goToDashboard')}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Main wizard ────────────────────────────────────────────

export default function Onboarding({ initialStep = 'account' }: { initialStep?: Step }) {
  const [step, setStep] = useState<Step>(initialStep)

  function next() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="glass-strong rounded-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-primary">Basiret</span>
        </div>

        <StepIndicator current={step} />

        {step === 'account' && <StepAccount onNext={next} />}
        {step === 'connect' && <StepConnect onNext={next} />}
        {step === 'complete' && <StepComplete />}
      </div>
    </div>
  )
}
