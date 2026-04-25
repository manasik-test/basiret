import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Target, Plus, Trash2, X, Loader2 } from 'lucide-react'
import { useGoals, useCreateGoal, useDeleteGoal } from '../hooks/useGoals'
import type { Goal, GoalMetric, GoalPeriod } from '../api/goals'

const MAX_GOALS = 4

const METRIC_ORDER: GoalMetric[] = [
  'avg_engagement_rate',
  'posts_per_week',
  'positive_sentiment_pct',
  'follower_growth_pct',
]

function statusFor(pct: number): 'onTrack' | 'inProgress' | 'needsWork' {
  if (pct >= 80) return 'onTrack'
  if (pct >= 50) return 'inProgress'
  return 'needsWork'
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const { t } = useTranslation()
  const current = goal.current_value
  const target = goal.target_value
  const pct =
    current === null || target === 0
      ? 0
      : Math.min(100, Math.round((current / target) * 100))

  const metricLabel = t(`myGoalsPage.metrics.${goal.metric}`)
  const periodLabel =
    goal.period === 'weekly' ? t('myGoalsPage.weekly') : t('myGoalsPage.monthly')

  // Status badge + bar color
  const s = current === null ? 'inProgress' : statusFor(pct)
  const statusCopy =
    s === 'onTrack'
      ? t('myGoalsPage.statusOnTrack')
      : s === 'inProgress'
      ? t('myGoalsPage.statusInProgress')
      : t('myGoalsPage.statusNeedsWork')
  const badgeClass =
    s === 'onTrack'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : s === 'inProgress'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-rose-50 text-rose-700 border-rose-200'
  const barClass =
    s === 'onTrack'
      ? 'bg-emerald-500'
      : s === 'inProgress'
      ? 'bg-amber-500'
      : 'bg-rose-500'

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {periodLabel}
          </p>
          <h3 className="text-base font-semibold text-foreground mt-0.5">
            {metricLabel}
          </h3>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('myGoalsPage.deleteGoal')}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="text-3xl font-bold text-foreground">
          {current === null ? '—' : current}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('myGoalsPage.of')} {target}
        </span>
      </div>

      {/* Progress bar */}
      <div dir="ltr" className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${barClass} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}
        >
          {statusCopy}
        </span>
        {goal.metric === 'follower_growth_pct' && current === null ? (
          <span className="text-[11px] text-muted-foreground max-w-[60%] text-right">
            {t('myGoalsPage.followerGrowthHint')}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function AddGoalModal({
  onClose,
  onSave,
  isSaving,
  error,
  existingMetrics,
}: {
  onClose: () => void
  onSave: (metric: GoalMetric, target: number, period: GoalPeriod) => void
  isSaving: boolean
  error: string | null
  existingMetrics: GoalMetric[]
}) {
  const { t } = useTranslation()

  // Default to the first metric not already set, or avg_engagement_rate as fallback.
  const available = METRIC_ORDER.filter((m) => !existingMetrics.includes(m))
  const [metric, setMetric] = useState<GoalMetric>(available[0] ?? 'avg_engagement_rate')
  const [target, setTarget] = useState<string>('')
  const [period, setPeriod] = useState<GoalPeriod>('weekly')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(target)
    if (!Number.isFinite(n) || n <= 0) return
    onSave(metric, n, period)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {t('myGoalsPage.modalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('myGoalsPage.cancel')}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('myGoalsPage.metric')}
            </label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as GoalMetric)}
              className="glass w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {METRIC_ORDER.map((m) => (
                <option key={m} value={m} disabled={existingMetrics.includes(m)}>
                  {t(`myGoalsPage.metrics.${m}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('myGoalsPage.targetValue')}
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              className="glass w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('myGoalsPage.period')}
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
              className="glass w-full rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="weekly">{t('myGoalsPage.weekly')}</option>
              <option value="monthly">{t('myGoalsPage.monthly')}</option>
            </select>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex items-center gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:bg-muted"
            >
              {t('myGoalsPage.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('myGoalsPage.saving')}
                </>
              ) : (
                t('myGoalsPage.save')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MyGoals() {
  const { t } = useTranslation()
  const { data, isLoading } = useGoals()
  const createMut = useCreateGoal()
  const deleteMut = useDeleteGoal()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const goals = data?.goals ?? []
  const existingMetrics = useMemo(() => goals.map((g) => g.metric), [goals])
  const atMax = goals.length >= MAX_GOALS

  async function handleSave(metric: GoalMetric, target: number, period: GoalPeriod) {
    setModalError(null)
    try {
      await createMut.mutateAsync({ metric, target_value: target, period })
      setModalOpen(false)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t('myGoalsPage.saveError'))
    }
  }

  async function handleDelete(goalId: string) {
    const ok = window.confirm(t('myGoalsPage.deleteConfirm'))
    if (!ok) return
    await deleteMut.mutateAsync(goalId)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">
              {t('myGoalsPage.title')}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t('myGoalsPage.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setModalError(null)
            setModalOpen(true)
          }}
          disabled={atMax}
          title={atMax ? t('myGoalsPage.maxGoalsReached') : undefined}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cta text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {t('myGoalsPage.addGoal')}
        </button>
      </div>

      {atMax && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t('myGoalsPage.maxGoalsReached')}
        </p>
      )}

      {/* Goal cards */}
      {isLoading ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          …
        </div>
      ) : goals.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center space-y-3">
          <div className="inline-flex w-12 h-12 rounded-full bg-primary/10 items-center justify-center mx-auto">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {t('myGoalsPage.emptyTitle')}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t('myGoalsPage.emptySubtitle')}
          </p>
          <button
            type="button"
            onClick={() => {
              setModalError(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cta text-white text-sm font-semibold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            {t('myGoalsPage.addGoal')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onDelete={() => handleDelete(g.id)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <AddGoalModal
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          isSaving={createMut.isPending}
          error={modalError}
          existingMetrics={existingMetrics}
        />
      )}
    </div>
  )
}
