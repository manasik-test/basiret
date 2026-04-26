import { useMemo, useState, type FormEvent } from 'react'
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
  X,
  Building2,
} from 'lucide-react'
import api from '../api/client'
import {
  saveBusinessProfile,
  type AudienceLanguage,
  type BusinessCategory,
  type BusinessCountry,
} from '../api/auth'

const STEPS = ['account', 'business', 'connect', 'complete'] as const
type Step = (typeof STEPS)[number]

// ── Password validation ────────────────────────────────────

interface PasswordRules {
  length: boolean
  number: boolean
  upper: boolean
  special: boolean
}

function evaluatePassword(pw: string): PasswordRules {
  return {
    length: pw.length >= 8,
    number: /\d/.test(pw),
    upper: /[A-Z]/.test(pw),
    special: /[!@#$%^&*()_\-+={}[\]|\\:;"'<>,.?/~`]/.test(pw),
  }
}

function passwordScore(rules: PasswordRules): number {
  return Object.values(rules).filter(Boolean).length
}

function PasswordChecklist({ rules }: { rules: PasswordRules }) {
  const { t } = useTranslation()
  const items: Array<{ key: keyof PasswordRules; label: string }> = [
    { key: 'length', label: t('auth.passwordRuleLength') },
    { key: 'number', label: t('auth.passwordRuleNumber') },
    { key: 'upper', label: t('auth.passwordRuleUpper') },
    { key: 'special', label: t('auth.passwordRuleSpecial') },
  ]
  return (
    <ul className="mt-2 space-y-1">
      {items.map(({ key, label }) => {
        const ok = rules[key]
        return (
          <li
            key={key}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              ok ? 'text-emerald-700' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                ok ? 'bg-emerald-100' : 'bg-muted',
              )}
            >
              {ok ? (
                <Check className="w-3 h-3 text-emerald-700" />
              ) : (
                <X className="w-2.5 h-2.5 text-muted-foreground" />
              )}
            </span>
            <span>{label}</span>
          </li>
        )
      })}
    </ul>
  )
}

function PasswordStrengthBar({ score }: { score: number }) {
  const { t } = useTranslation()
  // 0-1 = weak (red), 2-3 = medium (amber), 4 = strong (emerald)
  const tier = score >= 4 ? 'strong' : score >= 2 ? 'medium' : 'weak'
  const color =
    tier === 'strong' ? 'bg-emerald-500' : tier === 'medium' ? 'bg-amber-500' : 'bg-red-500'
  const label =
    tier === 'strong'
      ? t('auth.passwordStrengthStrong')
      : tier === 'medium'
        ? t('auth.passwordStrengthMedium')
        : t('auth.passwordStrengthWeak')
  const widthPct = Math.max(15, (score / 4) * 100)
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-200', color)}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {t('auth.passwordStrength')}: <span className="font-medium">{label}</span>
      </p>
    </div>
  )
}

// ── Step indicator ─────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const { t } = useTranslation()
  const labels = [
    t('onboarding.stepAccount'),
    t('onboarding.stepBusiness'),
    t('onboarding.stepConnect'),
    t('onboarding.stepComplete'),
  ]
  const currentIdx = STEPS.indexOf(current)

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto mb-6">
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
  const [loading, setLoading] = useState(false)

  const rules = useMemo(() => evaluatePassword(password), [password])
  const score = passwordScore(rules)
  const allRulesPass = score === 4
  const submitDisabled = loading || !allRulesPass

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    // Defensive — button is already disabled, but cover programmatic submit.
    if (!allRulesPass) return

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
          {password.length > 0 && <PasswordStrengthBar score={score} />}
          <PasswordChecklist rules={rules} />
        </div>

        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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

// ── Step 2: Business profile ───────────────────────────────

const CATEGORY_OPTIONS: Array<{ value: BusinessCategory; key: string }> = [
  { value: 'restaurant_cafe', key: 'onboarding.categoryRestaurantCafe' },
  { value: 'fashion_clothing', key: 'onboarding.categoryFashionClothing' },
  { value: 'beauty_salon', key: 'onboarding.categoryBeautySalon' },
  { value: 'fitness_gym', key: 'onboarding.categoryFitnessGym' },
  { value: 'real_estate', key: 'onboarding.categoryRealEstate' },
  { value: 'retail_shop', key: 'onboarding.categoryRetailShop' },
  { value: 'services', key: 'onboarding.categoryServices' },
  { value: 'other', key: 'onboarding.categoryOther' },
]

const COUNTRY_OPTIONS: Array<{ value: BusinessCountry; key: string }> = [
  { value: 'AE', key: 'onboarding.countryAE' },
  { value: 'SA', key: 'onboarding.countrySA' },
  { value: 'EG', key: 'onboarding.countryEG' },
  { value: 'JO', key: 'onboarding.countryJO' },
  { value: 'KW', key: 'onboarding.countryKW' },
  { value: 'QA', key: 'onboarding.countryQA' },
  { value: 'BH', key: 'onboarding.countryBH' },
  { value: 'OM', key: 'onboarding.countryOM' },
  { value: 'TR', key: 'onboarding.countryTR' },
  { value: 'SD', key: 'onboarding.countrySD' },
  { value: 'OTHER', key: 'onboarding.countryOTHER' },
]

function StepBusiness({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  const [category, setCategory] = useState<BusinessCategory | ''>('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState<BusinessCountry | ''>('')
  const [audienceLanguage, setAudienceLanguage] = useState<AudienceLanguage>('both')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = !!category && !!country && city.trim().length > 0 && !loading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      await saveBusinessProfile({
        category: category as BusinessCategory,
        city: city.trim(),
        country: country as BusinessCountry,
        audience_language: audienceLanguage,
      })
      onNext()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || t('onboarding.businessError'))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t('onboarding.businessTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('onboarding.businessSubtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('onboarding.businessCategory')}
          </label>
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as BusinessCategory)}
            className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              {t('onboarding.businessCategoryPlaceholder')}
            </option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.key)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('onboarding.businessCity')}
            </label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('onboarding.businessCityPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('onboarding.businessCountry')}
            </label>
            <select
              required
              value={country}
              onChange={(e) => setCountry(e.target.value as BusinessCountry)}
              className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>
                {t('onboarding.businessCountryPlaceholder')}
              </option>
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('onboarding.businessAudienceLanguage')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: 'ar', label: t('onboarding.businessAudienceArabic') },
                { value: 'en', label: t('onboarding.businessAudienceEnglish') },
                { value: 'both', label: t('onboarding.businessAudienceBoth') },
              ] as const
            ).map((opt) => {
              const selected = audienceLanguage === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAudienceLanguage(opt.value)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'glass text-foreground border-transparent hover:bg-muted/40',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('onboarding.businessSaving') : t('onboarding.businessSave')}
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('onboarding.businessSkip')}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  )
}

// ── Step 3: Connect Instagram ──────────────────────────────

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

// ── Step 4: All Set ────────────────────────────────────────

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
        onClick={() => navigate('/dashboard', { replace: true })}
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
        {step === 'business' && <StepBusiness onNext={next} />}
        {step === 'connect' && <StepConnect onNext={next} />}
        {step === 'complete' && <StepComplete />}
      </div>
    </div>
  )
}
