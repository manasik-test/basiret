import { useTranslation } from 'react-i18next'
import {
  Smile, Meh, Frown,
  TrendingUp, TrendingDown, Minus,
  Sparkles, AlertTriangle, ExternalLink,
  MessageSquare, Quote,
} from 'lucide-react'
import { useSentimentSummary } from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import type {
  SentimentKey, Keyword, NeedsAttentionPost, SampleComment, SentimentSummaryData,
} from '../api/analytics'

const sentimentStyle: Record<SentimentKey, { dot: string; bg: string; text: string; ring: string; border: string }> = {
  positive: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    border: 'border-emerald-200',
  },
  neutral: {
    dot: 'bg-slate-400',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    ring: 'ring-slate-200',
    border: 'border-slate-200',
  },
  negative: {
    dot: 'bg-rose-500',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
    border: 'border-rose-200',
  },
}

const iconFor: Record<SentimentKey, React.ComponentType<{ className?: string }>> = {
  positive: Smile,
  neutral: Meh,
  negative: Frown,
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function WoWDelta({ change, kind }: { change: number; kind: SentimentKey }) {
  const { t } = useTranslation()
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" /> 0pp
      </span>
    )
  }
  // For positive sentiment: up is good (green), down is bad (red)
  // For negative sentiment: up is bad (red), down is good (green)
  // For neutral: stay colour-neutral, just show direction
  const isUp = change > 0
  const isGood =
    kind === 'positive' ? isUp :
    kind === 'negative' ? !isUp :
    null
  const color =
    isGood === true ? 'text-emerald-600' :
    isGood === false ? 'text-rose-600' :
    'text-muted-foreground'
  const Arrow = isUp ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`} title={t('sentimentPage.wowTitle')}>
      <Arrow className="w-3 h-3" />
      {change > 0 ? '+' : ''}{change}pp
    </span>
  )
}

function ScoreCard({
  kind, count, total, change,
}: {
  kind: SentimentKey; count: number; total: number; change: number
}) {
  const { t } = useTranslation()
  const style = sentimentStyle[kind]
  const Icon = iconFor[kind]
  const label = t(`dashboard.${kind}`)
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl ${style.bg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${style.text}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{pct(count, total)}%</span>
            <span className="text-xs text-muted-foreground">({count})</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
        <span className="text-[11px] text-muted-foreground">{t('sentimentPage.vsLastWeek')}</span>
        <WoWDelta change={change} kind={kind} />
      </div>
    </div>
  )
}

function KeywordsPanel({ keywords }: { keywords: Keyword[] }) {
  const { t } = useTranslation()
  if (keywords.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        {t('sentimentPage.keywordsEmpty')}
      </div>
    )
  }
  const maxCount = Math.max(...keywords.map((k) => k.count))
  return (
    <ul className="space-y-2.5">
      {keywords.map((kw) => {
        const style = sentimentStyle[kw.sentiment]
        const width = Math.max(10, Math.round((kw.count / maxCount) * 100))
        return (
          <li key={kw.term} className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-32 shrink-0">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span dir="auto" className="text-sm font-medium text-foreground truncate">
                {kw.term}
              </span>
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${style.dot} opacity-60`}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="w-10 text-end text-xs text-muted-foreground tabular-nums">
              {kw.count}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function HighlightsPanel({ text, totalWeek }: { text: string; totalWeek: number }) {
  const { t } = useTranslation()
  const isEmpty = !text || text.length === 0
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('sentimentPage.highlightsTitle')}</h2>
          <p className="text-[11px] text-muted-foreground">{t('sentimentPage.highlightsSubtitle')}</p>
        </div>
      </div>
      <p dir="auto" className="text-sm text-foreground/85 leading-relaxed">
        {isEmpty
          ? (totalWeek === 0
              ? t('sentimentPage.highlightsEmptyNoData')
              : t('sentimentPage.highlightsEmptyFallback'))
          : text}
      </p>
    </div>
  )
}

function NeedsAttention({ posts }: { posts: NeedsAttentionPost[] }) {
  const { t } = useTranslation()
  if (posts.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
        {t('sentimentPage.attentionEmpty')}
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {posts.map((p) => (
        <li
          key={p.post_id}
          className="glass rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 border border-rose-200/50"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p dir="auto" className="text-sm text-foreground/90 line-clamp-2">
              {p.caption || t('sentimentPage.noCaption')}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-rose-700 font-medium">
              <span className="inline-flex items-center gap-1">
                <Frown className="w-3 h-3" />
                {t('sentimentPage.negativeComments', { count: p.negative_count })}
              </span>
            </div>
          </div>
          {p.permalink ? (
            <a
              href={p.permalink}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
            >
              {t('sentimentPage.viewPost')}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function SampleCommentCard({
  kind, sample,
}: {
  kind: SentimentKey; sample: SampleComment | null
}) {
  const { t } = useTranslation()
  const style = sentimentStyle[kind]
  const label = t(`dashboard.${kind}`)

  if (!sample) {
    return (
      <div className={`glass rounded-2xl p-4 ring-1 ${style.ring} flex flex-col gap-2 opacity-60`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          <span className={`text-xs font-semibold ${style.text}`}>{label}</span>
        </div>
        <p className="text-sm text-muted-foreground italic">
          {t('sentimentPage.sampleEmpty')}
        </p>
      </div>
    )
  }
  const isAr = sample.language === 'ar'
  const dir: 'rtl' | 'auto' = isAr ? 'rtl' : 'auto'
  const align = isAr ? 'text-right' : 'text-left'

  return (
    <div className={`glass rounded-2xl p-4 ring-1 ${style.ring} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          <span className={`text-xs font-semibold ${style.text}`}>{label}</span>
        </div>
        <span className="text-[11px] text-muted-foreground truncate">
          @{sample.author_username || 'unknown'}
        </span>
      </div>
      <Quote className="w-4 h-4 text-muted-foreground/60 shrink-0" />
      <p
        dir={dir}
        className={`text-sm text-foreground/90 leading-relaxed ${align} whitespace-pre-wrap line-clamp-4`}
      >
        {sample.text}
      </p>
    </div>
  )
}

function SentimentContent() {
  const { t } = useTranslation()
  const { data, isLoading } = useSentimentSummary()

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
        {t('dashboard.loading')}
      </div>
    )
  }

  const summary: SentimentSummaryData = data ?? {
    total_week: 0,
    total_prev_week: 0,
    current_counts: { positive: 0, neutral: 0, negative: 0 },
    previous_counts: { positive: 0, neutral: 0, negative: 0 },
    wow_change: { positive: 0, neutral: 0, negative: 0 },
    keywords: [],
    highlights: '',
    needs_attention: [],
    samples: { positive: null, neutral: null, negative: null },
  }

  const totalWeek = summary.total_week

  return (
    <div className="space-y-6">
      {/* Week label + total */}
      <div>
        <p className="text-sm text-muted-foreground">{t('sentimentPage.subtitle')}</p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          {t('sentimentPage.thisWeekCount', { count: totalWeek })}
        </p>
      </div>

      {/* 1. Score cards w/ WoW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['positive', 'neutral', 'negative'] as const).map((kind) => (
          <ScoreCard
            key={kind}
            kind={kind}
            count={summary.current_counts[kind]}
            total={totalWeek}
            change={summary.wow_change[kind]}
          />
        ))}
      </div>

      {/* 2. Highlights + 3. What people are saying — two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HighlightsPanel text={summary.highlights} totalWeek={totalWeek} />
        <div className="glass rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{t('sentimentPage.keywordsTitle')}</h2>
              <p className="text-[11px] text-muted-foreground">{t('sentimentPage.keywordsSubtitle')}</p>
            </div>
          </div>
          <KeywordsPanel keywords={summary.keywords} />
        </div>
      </div>

      {/* 4. Needs attention */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <h2 className="text-base font-semibold text-foreground">{t('sentimentPage.attentionTitle')}</h2>
          <span className="text-[11px] text-muted-foreground">{t('sentimentPage.attentionSubtitle')}</span>
        </div>
        <NeedsAttention posts={summary.needs_attention} />
      </div>

      {/* 5. Samples */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Quote className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{t('sentimentPage.samplesTitle')}</h2>
          <span className="text-[11px] text-muted-foreground">{t('sentimentPage.samplesSubtitle')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SampleCommentCard kind="positive" sample={summary.samples.positive} />
          <SampleCommentCard kind="neutral" sample={summary.samples.neutral} />
          <SampleCommentCard kind="negative" sample={summary.samples.negative} />
        </div>
      </div>
    </div>
  )
}

export default function Sentiment() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('sentiment_analysis')

  return (
    <LockedFeature locked={isLocked} featureName={t('nav.sentiment')}>
      <SentimentContent />
    </LockedFeature>
  )
}
