import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Calendar, Layers, CheckCircle2, TrendingUp, TrendingDown, Gauge } from 'lucide-react'
import DoThisToday from '../components/dashboard/DoThisToday'
import { useAuth } from '../contexts/AuthContext'
import {
  useOverview,
  useSentiment,
  useSegments,
  usePostsBreakdown,
  useInsights,
} from '../hooks/useAnalytics'
import type { SegmentsData, PostsBreakdownData, SentimentData, OverviewData } from '../api/analytics'

type DotColor = 'green' | 'amber' | 'red'

interface Bullet {
  color: DotColor
  textKey: string
  params?: Record<string, string | number>
}

const dotClass: Record<DotColor, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

function Greeting() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const firstName = user?.full_name.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  const key = hour < 12 ? 'home.greetingMorning' : hour < 18 ? 'home.greetingAfternoon' : 'home.greetingEvening'
  const now = new Date()
  const dateStr = now.toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col gap-1" dir="auto">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground">
        {t(key, { name: firstName })}
      </h2>
      <p className="text-sm text-muted-foreground">{dateStr}</p>
    </div>
  )
}

function PersonaCard({
  primary,
  percent,
  contentType,
  postingTime,
}: {
  primary: string
  percent: number
  contentType?: string
  postingTime?: string
}) {
  const { t } = useTranslation()
  const ctKey =
    contentType === 'CAROUSEL_ALBUM'
      ? 'carousel'
      : contentType
        ? contentType.toLowerCase()
        : undefined
  const timeKey = postingTime?.toLowerCase() as 'morning' | 'afternoon' | 'evening' | undefined

  return (
    <div className="rounded-xl border border-border/60 bg-white/40 p-4 hover:bg-white/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground leading-snug" dir="auto">
          {primary}
        </p>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          {percent}%
        </span>
      </div>
      {(ctKey || timeKey) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {ctKey && (
            <span className="px-2 py-0.5 rounded-md bg-accent/30 text-primary text-[10px] font-semibold">
              {t(`analytics.${ctKey}`)}
            </span>
          )}
          {timeKey && (
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
              {t(`audience.${timeKey}`)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ContentPatterns({ segments }: { segments: SegmentsData | undefined }) {
  const { t } = useTranslation()
  const top3 = useMemo(() => {
    if (!segments?.segments?.length) return []
    const total = segments.segments.reduce((s, x) => s + x.size, 0) || 1
    return [...segments.segments]
      .sort((a, b) => b.size - a.size)
      .slice(0, 3)
      .map((s) => {
        const c = s.characteristics as
          | { persona_description?: string; dominant_content_type?: string; typical_posting_time?: string }
          | undefined
        const desc = c?.persona_description?.trim()
        return {
          id: s.id,
          primary: desc && desc.length > 0 ? desc : s.label,
          percent: Math.round((s.size / total) * 100),
          contentType: c?.dominant_content_type,
          postingTime: c?.typical_posting_time,
        }
      })
  }, [segments])

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <h3 className="text-base font-bold text-foreground">{t('home.patternsTitle')}</h3>
          <p className="text-xs text-muted-foreground" dir="auto">{t('home.patternsSubtitle')}</p>
        </div>
      </div>

      {top3.length > 0 ? (
        <div className="flex flex-col gap-3">
          {top3.map((s) => (
            <PersonaCard
              key={s.id}
              primary={s.primary}
              percent={s.percent}
              contentType={s.contentType}
              postingTime={s.postingTime}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t('home.patternsEmpty')}
        </div>
      )}
    </div>
  )
}

function WhatsWorking({
  breakdown,
  sentiment,
}: {
  breakdown: PostsBreakdownData | undefined
  sentiment: SentimentData | undefined
}) {
  const { t } = useTranslation()

  const bullets = useMemo<Bullet[]>(() => {
    const out: Bullet[] = []

    // 1. Content winner
    if (breakdown?.by_type?.length) {
      const sorted = [...breakdown.by_type].sort((a, b) => (b.avg_likes ?? 0) - (a.avg_likes ?? 0))
      const winner = sorted[0]
      const runnerUp = sorted[1]
      if (winner && (!runnerUp || winner.avg_likes > runnerUp.avg_likes * 1.2)) {
        const typeKey = winner.content_type === 'CAROUSEL_ALBUM' ? 'carousel' : winner.content_type.toLowerCase()
        out.push({
          color: 'green',
          textKey: 'home.bullets.typeWinner',
          params: { type: t(`analytics.${typeKey}`) },
        })
      } else if (winner) {
        out.push({ color: 'amber', textKey: 'home.bullets.noClearWinner' })
      }
    } else {
      out.push({ color: 'amber', textKey: 'home.bullets.noPosts' })
    }

    // 2. Sentiment
    if (sentiment) {
      const total = sentiment.positive + sentiment.neutral + sentiment.negative
      if (total > 0) {
        const posPct = sentiment.positive / total
        const negPct = sentiment.negative / total
        if (posPct >= 0.6) {
          out.push({ color: 'green', textKey: 'home.bullets.sentimentStrong', params: { pct: Math.round(posPct * 100) } })
        } else if (negPct >= 0.3) {
          out.push({ color: 'red', textKey: 'home.bullets.sentimentConcern', params: { pct: Math.round(negPct * 100) } })
        } else {
          out.push({ color: 'amber', textKey: 'home.bullets.sentimentMixed' })
        }
      }
    }

    // 3. Consistency (posts in last 7 days)
    if (breakdown?.posting_dates) {
      const now = Date.now()
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000
      const recent = breakdown.posting_dates.filter((d) => new Date(d.date).getTime() >= weekAgo)
      const postsThisWeek = recent.reduce((s, r) => s + r.count, 0)
      if (postsThisWeek >= 3) {
        out.push({ color: 'green', textKey: 'home.bullets.consistencyGood', params: { n: postsThisWeek } })
      } else if (postsThisWeek >= 1) {
        out.push({ color: 'amber', textKey: 'home.bullets.consistencyUneven', params: { n: postsThisWeek } })
      } else {
        out.push({ color: 'red', textKey: 'home.bullets.consistencyGap' })
      }
    }

    // 4. Variety
    const types = new Set((breakdown?.by_type ?? []).map((b) => b.content_type))
    if (types.size >= 3) {
      out.push({ color: 'green', textKey: 'home.bullets.varietyGood' })
    } else if (types.size === 2) {
      out.push({ color: 'amber', textKey: 'home.bullets.varietyLow' })
    } else if (types.size === 1) {
      out.push({ color: 'red', textKey: 'home.bullets.varietyMono' })
    }

    return out.slice(0, 4)
  }, [breakdown, sentiment, t])

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-cta/10 text-cta flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <h3 className="text-base font-bold text-foreground">{t('home.whatsWorkingTitle')}</h3>
      </div>

      {bullets.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dotClass[b.color]}`} />
              <p className="text-sm text-foreground/85 leading-relaxed" dir="auto">
                {t(b.textKey, b.params)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t('home.whatsWorkingEmpty')}
        </div>
      )}
    </div>
  )
}

function HealthBar({
  label,
  icon,
  value,
  helper,
}: {
  label: string
  icon: React.ReactNode
  value: number
  helper?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <span className="font-medium">{label}</span>
        </div>
        <span className="text-sm font-semibold text-foreground">{pct}%</span>
      </div>
      <div dir="ltr" className="h-2 rounded-full bg-border/60 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {helper && <p className="text-[11px] text-muted-foreground" dir="auto">{helper}</p>}
    </div>
  )
}

function GrowthHealth({
  overview,
  sentiment,
  breakdown,
  aiScore,
  scoreChange,
}: {
  overview: OverviewData | undefined
  sentiment: SentimentData | undefined
  breakdown: PostsBreakdownData | undefined
  aiScore: number | null
  scoreChange: number
}) {
  const { t, i18n } = useTranslation()

  const consistency = useMemo(() => {
    if (!breakdown?.posting_dates) return 0
    const weekAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    const activeDays = new Set(
      breakdown.posting_dates
        .filter((d) => new Date(d.date).getTime() >= weekAgo)
        .map((d) => d.date),
    ).size
    return Math.min(1, activeDays / 7)
  }, [breakdown])

  const mostRecentPostDate = useMemo(() => {
    if (!breakdown?.posting_dates?.length) return null
    const latest = breakdown.posting_dates
      .map((d) => d.date)
      .sort()
      .pop()
    return latest ?? null
  }, [breakdown])

  const consistencyHelper = useMemo(() => {
    if (consistency === 0 && mostRecentPostDate) {
      const formatted = new Date(mostRecentPostDate).toLocaleDateString(
        i18n.language === 'ar' ? 'ar-EG' : 'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' },
      )
      return t('home.bar.consistencyLastPost', { date: formatted })
    }
    return t('home.bar.consistencyHint')
  }, [consistency, mostRecentPostDate, i18n.language, t])

  const audienceFit = useMemo(() => {
    if (!sentiment) return 0
    const total = sentiment.positive + sentiment.neutral + sentiment.negative
    return total > 0 ? sentiment.positive / total : 0
  }, [sentiment])

  const variety = useMemo(() => {
    const n = new Set((breakdown?.by_type ?? []).map((b) => b.content_type)).size
    return Math.min(1, n / 3)
  }, [breakdown])

  const igPerformance = useMemo(() => {
    if (!overview) return 0
    return Math.min(1, overview.avg_engagement_per_post / 100)
  }, [overview])

  const displayScore = aiScore ?? Math.round(((consistency + audienceFit + variety + igPerformance) / 4) * 100)
  const change = scoreChange

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-foreground">{t('home.growthHealthTitle')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t('home.growthHealthSubtitle')}</p>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl md:text-5xl font-black text-primary leading-none">{displayScore}</span>
          <span className="text-sm text-muted-foreground pb-1">/100</span>
          {change !== 0 && (
            <span
              className={`flex items-center gap-0.5 pb-1 text-xs font-semibold ${change > 0 ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {change > 0 ? '+' : ''}{change}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <HealthBar
          label={t('home.bar.consistency')}
          icon={<Calendar className="w-3.5 h-3.5" />}
          value={consistency}
          helper={consistencyHelper}
        />
        <HealthBar
          label={t('home.bar.audienceFit')}
          icon={<Users className="w-3.5 h-3.5" />}
          value={audienceFit}
          helper={t('home.bar.audienceFitHint')}
        />
        <HealthBar
          label={t('home.bar.variety')}
          icon={<Layers className="w-3.5 h-3.5" />}
          value={variety}
          helper={t('home.bar.varietyHint')}
        />
        <HealthBar
          label={t('home.bar.instagramPerf')}
          icon={<Gauge className="w-3.5 h-3.5" />}
          value={igPerformance}
          helper={t('home.bar.instagramPerfHint')}
        />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const overview = useOverview()
  const sentiment = useSentiment()
  const segments = useSegments()
  const breakdown = usePostsBreakdown()
  const insights = useInsights()

  const aiScore = insights.data?.score ?? null
  const scoreChange = insights.data?.score_change ?? 0

  return (
    <div className="space-y-6">
      <Greeting />

      <DoThisToday />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ContentPatterns segments={segments.data} />
        <WhatsWorking breakdown={breakdown.data} sentiment={sentiment.data} />
      </div>

      <GrowthHealth
        overview={overview.data}
        sentiment={sentiment.data}
        breakdown={breakdown.data}
        aiScore={aiScore}
        scoreChange={scoreChange}
      />
    </div>
  )
}
