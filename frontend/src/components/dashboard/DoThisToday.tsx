import { useTranslation } from 'react-i18next'
import {
  Sparkles, RefreshCw, ArrowRight, Clock, AlertTriangle, Zap,
  ThumbsUp, ThumbsDown,
} from 'lucide-react'
import {
  useInsights, useGenerateInsights,
  useRecommendationFeedback, useSubmitRecommendationFeedback,
} from '../../hooks/useAnalytics'
import { useIsFeatureLocked } from '../../hooks/useBilling'
import LockedFeature from '../LockedFeature'
import type { InsightAction, RecFeedback } from '../../api/analytics'

const priorityConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  high: { color: '#BF499B', bg: '#BF499B20', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'High' },
  medium: { color: '#664FA1', bg: '#664FA120', icon: <Zap className="w-3.5 h-3.5" />, label: 'Medium' },
  low: { color: '#A5DDEC', bg: '#A5DDEC40', icon: <Clock className="w-3.5 h-3.5" />, label: 'Low' },
}

function InsightCard({
  insight,
  insightResultId,
  currentVote,
}: {
  insight: InsightAction
  insightResultId: string | null
  currentVote: RecFeedback | null
}) {
  const { t } = useTranslation()
  const cfg = priorityConfig[insight.priority] || priorityConfig.medium
  const submit = useSubmitRecommendationFeedback()

  const recommendationText = insight.action || insight.title

  function onVote(feedback: RecFeedback) {
    submit.mutate({
      recommendation_text: recommendationText,
      feedback,
      insight_result_id: insightResultId,
    })
  }

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-foreground leading-tight">{insight.title}</h4>
        <span
          className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.icon}
          {t(`insights.${insight.priority}`)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{insight.action}</p>
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-[10px] text-muted-foreground">{insight.timeframe}</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-primary font-medium">{insight.expected_impact}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onVote('helpful')}
              aria-label={t('insights.feedbackHelpful')}
              title={t('insights.feedbackHelpful')}
              className="p-1 rounded-md transition-colors hover:bg-emerald-50"
            >
              <ThumbsUp
                className={`w-3.5 h-3.5 ${
                  currentVote === 'helpful'
                    ? 'fill-emerald-500 text-emerald-500'
                    : 'text-muted-foreground'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => onVote('not_helpful')}
              aria-label={t('insights.feedbackNotHelpful')}
              title={t('insights.feedbackNotHelpful')}
              className="p-1 rounded-md transition-colors hover:bg-rose-50"
            >
              <ThumbsDown
                className={`w-3.5 h-3.5 ${
                  currentVote === 'not_helpful'
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-muted-foreground'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DoThisTodayContent() {
  const { t } = useTranslation()
  const { data: insight, isLoading } = useInsights()
  const generate = useGenerateInsights()
  const { data: feedbackList } = useRecommendationFeedback()

  const topActions = insight?.insights?.slice(0, 3) ?? []

  const feedbackMap = new Map<string, RecFeedback>(
    (feedbackList?.feedback ?? []).map((f) => [f.recommendation_text, f.feedback]),
  )

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cta/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cta" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{t('insights.doThisToday')}</h3>
            <p className="text-[10px] text-muted-foreground">{t('insights.poweredByAI')}</p>
          </div>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generate.isPending ? 'animate-spin' : ''}`} />
          {generate.isPending ? t('insights.generating') : t('insights.generate')}
        </button>
      </div>

      {/* Score bar */}
      {insight && insight.score != null && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${insight.score}%`,
                backgroundColor: insight.score >= 70 ? '#664FA1' : insight.score >= 40 ? '#A5DDEC' : '#BF499B',
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-foreground">{insight.score}</span>
            {insight.score_change != null && insight.score_change !== 0 && (
              <span className={`text-xs font-semibold ${insight.score_change > 0 ? 'text-green-500' : 'text-red-400'}`}>
                {insight.score_change > 0 ? '+' : ''}{insight.score_change}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {insight?.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed">{insight.summary}</p>
      )}

      {/* Action cards */}
      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">{t('dashboard.loading')}</div>
      ) : topActions.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {topActions.map((action, i) => (
            <InsightCard
              key={i}
              insight={action}
              insightResultId={insight?.id ?? null}
              currentVote={feedbackMap.get(action.action || action.title) ?? null}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-2">{t('insights.noInsights')}</p>
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {t('insights.generateFirst')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Next best time */}
      {insight?.next_best_time && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">
            {t('insights.nextBestTime')}: <strong className="text-foreground">{insight.next_best_time}</strong>
          </span>
        </div>
      )}
    </div>
  )
}

export default function DoThisToday() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('content_recommendations')

  return (
    <LockedFeature locked={isLocked} featureName={t('insights.doThisToday')}>
      <DoThisTodayContent />
    </LockedFeature>
  )
}
