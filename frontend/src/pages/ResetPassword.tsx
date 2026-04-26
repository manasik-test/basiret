import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, Eye, EyeOff } from 'lucide-react'
import { resetPassword } from '../api/auth'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) {
      const id = setTimeout(() => navigate('/login', { replace: true }), 2500)
      return () => clearTimeout(id)
    }
  }, [done, navigate])

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="glass-strong rounded-2xl p-8 w-full max-w-md space-y-4 text-center">
          <p className="text-sm text-red-600">{t('auth.resetMissingToken')}</p>
          <Link to="/forgot-password" className="text-primary text-sm font-medium hover:underline">
            {t('auth.requestNewLink')}
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('settings.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="glass-strong rounded-2xl p-8 w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Basiret</h1>
          <p className="text-muted-foreground text-sm text-center">
            {t('auth.resetSubtitle')}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {done ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm">
            {t('auth.resetSuccess')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('settings.newPassword')}
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass w-full rounded-lg px-4 py-2.5 pe-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('settings.confirmPassword')}
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="glass w-full rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? t('auth.resetting') : t('auth.resetPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
