import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import {
  useOverview,
  useSentiment,
  useSegments,
  usePostsBreakdown,
  useInsights,
  useEngagementTimeline,
} from '../hooks/useAnalytics'
import type {
  PostsBreakdownData,
  SentimentData,
  OverviewData,
  InsightAction,
  SegmentsData,
  EngagementTimelineEntry,
} from '../api/analytics'
import { Icon, I } from '../components/redesign/icons'

/* ------------------------------------------------------------------ */
/* Types and helpers                                                  */
/* ------------------------------------------------------------------ */

type DotColor = 'good' | 'warn' | 'bad'

interface Bullet {
  color: DotColor
  textKey: string
  params?: Record<string, string | number>
}

type ActionPriority = 'urgent' | 'today' | 'week'

interface ActionVm {
  pri: ActionPriority
  source: keyof typeof ACTION_SOURCES
  title: string
  why: string
  cta: string
  impact: string
  time: string
}

const ACTION_SOURCES = {
  sentiment: { iconPath: I.heart, bg: 'oklch(0.96 0.05 30)', fg: 'oklch(0.5 0.17 30)' },
  consistency: { iconPath: I.clock, bg: 'oklch(0.96 0.06 60)', fg: 'oklch(0.5 0.13 60)' },
  schedule: { iconPath: I.bolt, bg: 'oklch(0.96 0.06 280)', fg: 'var(--purple-700)' },
  competitor: { iconPath: I.users, bg: 'oklch(0.95 0.05 200)', fg: 'oklch(0.5 0.13 200)' },
  audience: { iconPath: I.wand, bg: 'oklch(0.95 0.06 285)', fg: 'var(--purple-700)' },
  plan: { iconPath: I.calendar, bg: 'var(--ink-100)', fg: 'var(--ink-700)' },
} as const

// Pick a source category from an action's title/finding text. Heuristic — matches
// the design's six categories. Falls back to 'audience'.
function pickSource(action: InsightAction): keyof typeof ACTION_SOURCES {
  const blob = `${action.title} ${action.finding}`.toLowerCase()
  if (/(sentiment|negat|comment|reply|complain)/.test(blob)) return 'sentiment'
  if (/(post|consist|cadence|schedule|frequency|day|week)/.test(blob) && /(stop|pause|gap|miss|skip)/.test(blob))
    return 'consistency'
  if (/(time|hour|window|tuesday|monday|peak|am|pm|morning|evening|night)/.test(blob)) return 'schedule'
  if (/(competit|raid|outperform|rival)/.test(blob)) return 'competitor'
  if (/(plan|calendar|schedule|next week|upcoming)/.test(blob)) return 'plan'
  return 'audience'
}

function priorityToBucket(p: 'high' | 'medium' | 'low'): ActionPriority {
  if (p === 'high') return 'urgent'
  if (p === 'medium') return 'today'
  return 'week'
}

// Compress an EngagementTimelineEntry stream to N evenly-spaced sparkline
// buckets, using a custom field (engagement / reach / posts) to pull the
// numeric value. The backend returns one entry per day for the last 30
// days; we collapse to 12 buckets so each sparkline bar averages ~2.5 days.
function sparkFromTimeline(
  entries: EngagementTimelineEntry[] | undefined,
  field: 'engagement' | 'reach' | 'posts',
  bucketCount = 12,
): number[] {
  if (!entries || entries.length === 0) {
    return Array.from({ length: bucketCount }, () => 0)
  }
  const sliced = entries.slice(-bucketCount * 3)
  if (sliced.length <= bucketCount) {
    return [...Array(bucketCount - sliced.length).fill(0), ...sliced.map((e) => e[field])]
  }
  const buckets = Array<number>(bucketCount).fill(0)
  const counts = Array<number>(bucketCount).fill(0)
  const ratio = sliced.length / bucketCount
  for (let i = 0; i < sliced.length; i++) {
    const idx = Math.min(bucketCount - 1, Math.floor(i / ratio))
    buckets[idx] += sliced[i][field]
    counts[idx] += 1
  }
  return buckets.map((sum, i) => (counts[i] > 0 ? Math.round(sum / counts[i]) : 0))
}

function maxOr1(arr: number[]): number {
  return Math.max(1, ...arr)
}

// Compute the period-over-period delta from a timeline by comparing the first
// half of the window against the second half. Returns the percentage change as
// a signed number (e.g. 17 means +17%). Returns null when we don't have enough
// data or the prior half is zero (avoids divide-by-zero / misleading +∞%).
function periodDelta(
  entries: EngagementTimelineEntry[] | undefined,
  field: 'engagement' | 'reach' | 'posts',
): number | null {
  if (!entries || entries.length < 4) return null
  const half = Math.floor(entries.length / 2)
  const prev = entries.slice(0, half).reduce((s, e) => s + e[field], 0)
  const curr = entries.slice(half).reduce((s, e) => s + e[field], 0)
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(Math.round(n))
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
function toArDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => AR_DIGITS[+d])
}
// Format a number string ("+8", "9.6%", "48.2K", "65") for the active locale.
// Latin → Arabic-Indic mapping when isAr; English passes through unchanged.
function fmt(value: string | number, isAr: boolean): string {
  return isAr ? toArDigits(value) : String(value)
}

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

function Header({ range, setRange }: { range: '7d' | '30d' | '90d'; setRange: (r: '7d' | '30d' | '90d') => void }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  const greetKey =
    hour < 12 ? 'home.greetingMorning' : hour < 18 ? 'home.greetingAfternoon' : 'home.greetingEvening'

  const dateStr = new Date().toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="hm-head">
      <div>
        <div className="hm-crumb">{dateStr}</div>
        <h1 dir="auto">
          {t(greetKey, { name: firstName })} <span className="hm-wave">👋</span>
        </h1>
        <p dir="auto">{t('home.headerSubtitle')}</p>
      </div>
      <div className="hm-head-r">
        <div className="hm-seg">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button key={r} className={range === r ? 'is-on' : ''} onClick={() => setRange(r)}>
              {t(`home.dateRange.${r}` as const)}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* KPI strip                                                          */
/* ------------------------------------------------------------------ */

function GrowthRing({ score, change, isAr }: { score: number; change: number; isAr: boolean }) {
  const r = 50
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100)
  return (
    <div className="hm-kpi-ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="hm-kpi-ring-c">
        <span className="num">{fmt(Math.round(score), isAr)}</span>
        <em>/{fmt(100, isAr)}</em>
      </div>
      {change !== 0 && (
        <div className="hm-kpi-ring-delta">
          {change > 0 ? '↑' : '↓'}{' '}
          <span className="num">{fmt(change > 0 ? `+${change}` : String(change), isAr)}</span>
        </div>
      )}
    </div>
  )
}

// Small "↑ +12%" / "↓ -3%" delta line beneath a KPI value. Renders nothing when
// no data is available — matches the design's pattern of always showing an
// arrow + signed number when data exists.
function DeltaPill({ value, suffix, isAr }: { value: number | null; suffix: string; isAr: boolean }) {
  if (value === null) return null
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→'
  const signed = value > 0 ? `+${value}` : String(value)
  const pctSuffix = suffix === '%' ? (isAr ? '٪' : '%') : ''
  return (
    <div className={`hm-kpi-d ${value >= 0 ? 'up' : 'down'}`}>
      {arrow} <span className="num">{fmt(signed, isAr)}{pctSuffix}</span>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const max = maxOr1(values)
  return (
    <div className="hm-kpi-spark">
      {values.map((v, i) => (
        <div key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </div>
  )
}

function KpiStrip({
  overview,
  sentiment,
  breakdown,
  timeline,
  insightScore,
  insightChange,
  consistencyValue,
  audienceFitValue,
  varietyValue,
  igPerfValue,
  isAr,
}: {
  overview: OverviewData | undefined
  sentiment: SentimentData | undefined
  breakdown: PostsBreakdownData | undefined
  timeline: EngagementTimelineEntry[] | undefined
  insightScore: number | null
  insightChange: number
  consistencyValue: number
  audienceFitValue: number
  varietyValue: number
  igPerfValue: number
  isAr: boolean
}) {
  const { t } = useTranslation()

  // Derive a fallback score when no insights yet — average of bottom-grid bars.
  const score =
    insightScore ?? Math.round(((consistencyValue + audienceFitValue + varietyValue + igPerfValue) / 4) * 100)

  // Prefer the engagement timeline (real per-day totals) over the breakdown's
  // posting-dates aggregate. Falls back to overview totals when the timeline
  // hasn't loaded yet.
  const totalEng = timeline?.length
    ? timeline.reduce((s, e) => s + e.engagement, 0)
    : overview?.total_engagement ?? (sentiment?.positive ?? 0) + (sentiment?.neutral ?? 0) + (sentiment?.negative ?? 0)
  const totalReach = timeline?.length
    ? timeline.reduce((s, e) => s + e.reach, 0)
    : overview
      ? Math.round(overview.total_engagement * 5)
      : 0
  const postsThisMonth = timeline?.length
    ? timeline.reduce((s, e) => s + e.posts, 0)
    : breakdown?.posting_dates?.reduce((s, d) => s + d.count, 0) ?? overview?.total_posts ?? 0

  const engBuckets = sparkFromTimeline(timeline, 'engagement')
  const reachBuckets = sparkFromTimeline(timeline, 'reach')
  const postBuckets = sparkFromTimeline(timeline, 'posts')

  const engDelta = periodDelta(timeline, 'engagement')
  const reachDelta = periodDelta(timeline, 'reach')
  const postDelta = periodDelta(timeline, 'posts')

  return (
    <section className="hm-kpi">
      {/* Hero — growth health ring */}
      <div className="hm-kpi-card hm-kpi--hero">
        <div className="hm-kpi-hero-l">
          <div className="hm-kpi-k">{t('home.kpi.growthHealth')}</div>
          <div className="hm-kpi-d up">
            {insightChange !== 0 && (
              <>
                {insightChange > 0 ? '↑' : '↓'}{' '}
                <span className="num">
                  {fmt(insightChange > 0 ? `+${insightChange}` : String(insightChange), isAr)}
                </span>{' '}
                {t('home.kpi.pointsThisMonth', { value: '' })}
              </>
            )}
            {insightChange === 0 && t('home.growthHealthSubtitle')}
          </div>
        </div>
        <GrowthRing score={score} change={insightChange} isAr={isAr} />
      </div>

      <div className="hm-kpi-card">
        <div className="hm-kpi-k">{t('home.kpi.totalEngagement')}</div>
        <div className="hm-kpi-v num">{fmt(formatCount(totalEng), isAr)}</div>
        <DeltaPill value={engDelta} suffix="%" isAr={isAr} />
        <Sparkline values={engBuckets} />
      </div>
      <div className="hm-kpi-card">
        <div className="hm-kpi-k">{t('home.kpi.reach')}</div>
        <div className="hm-kpi-v num">{fmt(formatCount(totalReach), isAr)}</div>
        <DeltaPill value={reachDelta} suffix="%" isAr={isAr} />
        <Sparkline values={reachBuckets} />
      </div>
      <div className="hm-kpi-card">
        <div className="hm-kpi-k">{t('home.kpi.postsThisMonth')}</div>
        <div className="hm-kpi-v num">{fmt(postsThisMonth, isAr)}</div>
        <DeltaPill value={postDelta} suffix="" isAr={isAr} />
        <Sparkline values={postBuckets} />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* NBA banner                                                         */
/* ------------------------------------------------------------------ */

function NBABanner({ insight, summary }: { insight: InsightAction | null; summary: string }) {
  const { t } = useTranslation()
  return (
    <section className="hm-nba">
      <div className="hm-nba-l">
        <span className="hm-nba-av">✦</span>
        <div>
          <div className="hm-nba-k">{t('home.nba.label')}</div>
          <div className="hm-nba-t" dir="auto">
            {insight ? (
              <>
                <strong>{insight.title}</strong>
                {insight.finding ? <> — {insight.finding}</> : null}
              </>
            ) : (
              summary || t('home.nba.fallback')
            )}
          </div>
        </div>
      </div>
      <button className="hm-nba-btn">
        {t('home.nba.cta')}
        <Icon path={I.chevL} size={12} />
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Today's actions                                                    */
/* ------------------------------------------------------------------ */

function ActionsList({ actions, isAr }: { actions: ActionVm[]; isAr: boolean }) {
  const { t } = useTranslation()
  const buckets = {
    urgent: actions.filter((a) => a.pri === 'urgent').length,
    today: actions.filter((a) => a.pri === 'today').length,
    week: actions.filter((a) => a.pri === 'week').length,
  }

  return (
    <section className="hm-actions">
      <div className="hm-actions-head">
        <div>
          <h3>{t('home.actions.title')}</h3>
          <p dir="auto">{t('home.actions.subtitle')}</p>
        </div>
        <div className="hm-actions-stats">
          <span>
            <b className="num">{fmt(buckets.urgent, isAr)}</b> {t('home.actions.urgentCount')}
          </span>
          <span>
            <b className="num">{fmt(buckets.today, isAr)}</b> {t('home.actions.todayCount')}
          </span>
          <span>
            <b className="num">{fmt(buckets.week, isAr)}</b> {t('home.actions.weekCount')}
          </span>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="hm-actions-empty" dir="auto">
          {t('home.actions.empty')}
        </div>
      ) : (
        <div className="hm-actions-list">
          {actions.map((a, i) => {
            const meta = ACTION_SOURCES[a.source]
            const priLabelKey =
              a.pri === 'urgent'
                ? 'home.actions.priorityUrgent'
                : a.pri === 'today'
                  ? 'home.actions.priorityToday'
                  : 'home.actions.priorityWeek'
            const priColors =
              a.pri === 'urgent'
                ? { bg: 'oklch(0.96 0.05 30)', fg: 'oklch(0.5 0.17 30)' }
                : a.pri === 'today'
                  ? { bg: 'oklch(0.96 0.06 280)', fg: 'var(--purple-700)' }
                  : { bg: 'var(--ink-100)', fg: 'var(--ink-700)' }
            return (
              <article key={i} className={`hm-act hm-act--${a.pri}`}>
                <div className="hm-act-pri" style={{ background: priColors.bg, color: priColors.fg }}>
                  <span className="hm-act-pri-dot" style={{ background: priColors.fg }} />
                  {t(priLabelKey)}
                </div>
                <div className="hm-act-body">
                  <div className="hm-act-title" dir="auto">{a.title}</div>
                  <div className="hm-act-why" dir="auto">
                    <span className="hm-act-src" style={{ color: meta.fg }}>
                      <Icon path={meta.iconPath} size={11} />
                      {t(`home.actions.sources.${a.source}` as const)}
                    </span>
                    {a.why && (
                      <>
                        <span className="hm-act-dot">·</span>
                        {a.why}
                      </>
                    )}
                  </div>
                </div>
                <div className="hm-act-meta">
                  {a.impact && <span className="hm-act-impact" title={a.impact}>{a.impact}</span>}
                  {a.time && <span className="hm-act-time num">⏱ {fmt(a.time, isAr)}</span>}
                </div>
                <button className="hm-act-cta">
                  {t('home.actions.openCta')}
                  <Icon path={I.chevL} size={11} />
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Bottom 2-col grid (What's working + Growth health breakdown)       */
/* ------------------------------------------------------------------ */

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
        const typeKey =
          winner.content_type === 'CAROUSEL_ALBUM' ? 'carousel' : winner.content_type.toLowerCase()
        out.push({
          color: 'good',
          textKey: 'home.bullets.typeWinner',
          params: { type: t(`analytics.${typeKey}`) },
        })
      } else if (winner) {
        out.push({ color: 'warn', textKey: 'home.bullets.noClearWinner' })
      }
    } else {
      out.push({ color: 'warn', textKey: 'home.bullets.noPosts' })
    }

    // 2. Sentiment
    if (sentiment) {
      const total = sentiment.positive + sentiment.neutral + sentiment.negative
      if (total > 0) {
        const posPct = sentiment.positive / total
        const negPct = sentiment.negative / total
        if (posPct >= 0.6) {
          out.push({
            color: 'good',
            textKey: 'home.bullets.sentimentStrong',
            params: { pct: Math.round(posPct * 100) },
          })
        } else if (negPct >= 0.3) {
          out.push({
            color: 'bad',
            textKey: 'home.bullets.sentimentConcern',
            params: { pct: Math.round(negPct * 100) },
          })
        } else {
          out.push({ color: 'warn', textKey: 'home.bullets.sentimentMixed' })
        }
      }
    }

    // 3. Consistency
    if (breakdown?.posting_dates) {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const recent = breakdown.posting_dates.filter((d) => new Date(d.date).getTime() >= weekAgo)
      const postsThisWeek = recent.reduce((s, r) => s + r.count, 0)
      if (postsThisWeek >= 3) {
        out.push({ color: 'good', textKey: 'home.bullets.consistencyGood', params: { n: postsThisWeek } })
      } else if (postsThisWeek >= 1) {
        out.push({ color: 'warn', textKey: 'home.bullets.consistencyUneven', params: { n: postsThisWeek } })
      } else {
        out.push({ color: 'bad', textKey: 'home.bullets.consistencyGap' })
      }
    }

    // 4. Variety
    const types = new Set((breakdown?.by_type ?? []).map((b) => b.content_type))
    if (types.size >= 3) {
      out.push({ color: 'good', textKey: 'home.bullets.varietyGood' })
    } else if (types.size === 2) {
      out.push({ color: 'warn', textKey: 'home.bullets.varietyLow' })
    } else if (types.size === 1) {
      out.push({ color: 'bad', textKey: 'home.bullets.varietyMono' })
    }

    return out.slice(0, 4)
  }, [breakdown, sentiment, t])

  return (
    <section className="hm-card">
      <div className="hm-card-head">
        <div>
          <h3>{t('home.whatsWorkingTitle')}</h3>
          <p>{t('home.whatsWorkingSubtitle')}</p>
        </div>
      </div>
      {bullets.length > 0 ? (
        <ul className="hm-bullets">
          {bullets.map((b, i) => (
            <li key={i}>
              <span className={`hm-dot ${b.color}`} />
              <div dir="auto">{t(b.textKey, b.params)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="hm-empty" dir="auto">
          {t('home.whatsWorkingEmpty')}
        </div>
      )}
    </section>
  )
}

function GrowthHealthBreakdown({
  consistency,
  consistencyHelper,
  audienceFit,
  variety,
  igPerformance,
  displayScore,
  isAr,
}: {
  consistency: number
  consistencyHelper: string
  audienceFit: number
  variety: number
  igPerformance: number
  displayScore: number
  isAr: boolean
}) {
  const { t } = useTranslation()
  const rows: Array<{ k: string; v: number; hint: string; tone: 'good' | 'warn' | 'bad' }> = [
    {
      k: t('home.bar.audienceFit'),
      v: Math.round(audienceFit * 100),
      hint: t('home.bar.audienceFitHint'),
      tone: audienceFit >= 0.7 ? 'good' : audienceFit >= 0.4 ? 'warn' : 'bad',
    },
    {
      k: t('home.bar.instagramPerf'),
      v: Math.round(igPerformance * 100),
      hint: t('home.bar.instagramPerfHint'),
      tone: igPerformance >= 0.7 ? 'good' : igPerformance >= 0.4 ? 'warn' : 'bad',
    },
    {
      k: t('home.bar.consistency'),
      v: Math.round(consistency * 100),
      hint: consistencyHelper,
      tone: consistency >= 0.7 ? 'good' : consistency >= 0.4 ? 'warn' : 'bad',
    },
    {
      k: t('home.bar.variety'),
      v: Math.round(variety * 100),
      hint: t('home.bar.varietyHint'),
      tone: variety >= 0.7 ? 'good' : variety >= 0.4 ? 'warn' : 'bad',
    },
  ]

  return (
    <section className="hm-card">
      <div className="hm-card-head">
        <div>
          <h3>{t('home.growthHealthBreakdown')}</h3>
          <p>{t('home.growthHealthBreakdownSubtitle')}</p>
        </div>
        <div className="hm-score">
          <span className="num">{fmt(displayScore, isAr)}</span>
          <em>/{fmt(100, isAr)}</em>
        </div>
      </div>
      <div className="hm-health">
        {rows.map((row, i) => (
          <div key={i} className="hm-hr">
            <div className="hm-hr-top">
              <div className="hm-hr-k">{row.k}</div>
              <div className={`hm-hr-v num ${row.tone}`}>{fmt(row.v, isAr)}{isAr ? '٪' : '%'}</div>
            </div>
            <div className="hm-hr-track">
              <div className={`hm-hr-fill ${row.tone}`} style={{ width: `${row.v}%` }} />
            </div>
            <div className="hm-hr-hint" dir="auto">
              {row.hint}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const overview = useOverview()
  const sentiment = useSentiment()
  const segments = useSegments()
  const breakdown = usePostsBreakdown()
  const insights = useInsights()
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')
  const timelineDays = range === '7d' ? 7 : range === '90d' ? 90 : 30
  const timeline = useEngagementTimeline(timelineDays)
  const { t, i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar') ?? false

  // Derived values used both by the bottom panel AND by the KPI fallback score.
  const consistency = useMemo(() => {
    const dates = breakdown.data?.posting_dates
    if (!dates) return 0
    const weekAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    const activeDays = new Set(
      dates.filter((d) => new Date(d.date).getTime() >= weekAgo).map((d) => d.date),
    ).size
    return Math.min(1, activeDays / 7)
  }, [breakdown.data])

  const mostRecentPostDate = useMemo(() => {
    const dates = breakdown.data?.posting_dates
    if (!dates?.length) return null
    return [...dates].sort((a, b) => a.date.localeCompare(b.date)).pop()?.date ?? null
  }, [breakdown.data])

  const consistencyHelper = useMemo(() => {
    if (consistency === 0 && mostRecentPostDate) {
      const formatted = new Date(mostRecentPostDate).toLocaleDateString(
        i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' },
      )
      return t('home.bar.consistencyLastPost', { date: formatted })
    }
    return t('home.bar.consistencyHint')
  }, [consistency, mostRecentPostDate, i18n.language, t])

  const audienceFit = useMemo(() => {
    const s = sentiment.data
    if (!s) return 0
    const total = s.positive + s.neutral + s.negative
    return total > 0 ? s.positive / total : 0
  }, [sentiment.data])

  const variety = useMemo(() => {
    const n = new Set((breakdown.data?.by_type ?? []).map((b) => b.content_type)).size
    return Math.min(1, n / 3)
  }, [breakdown.data])

  const igPerformance = useMemo(() => {
    const o = overview.data
    if (!o) return 0
    return Math.min(1, o.avg_engagement_per_post / 100)
  }, [overview.data])

  // Map insights → action list. Gemini returns long sentences for `action` and
  // `expected_impact`, but the design expects short labels. Truncate impact to
  // fit the meta column and keep the CTA button generic ("Open"); the full
  // action text is surfaced as the `why` line below the title so users see it.
  const actions: ActionVm[] = useMemo(() => {
    const data = insights.data
    if (!data?.insights?.length) return []
    const truncate = (s: string, max: number) =>
      s && s.length > max ? `${s.slice(0, max - 1).trim()}…` : s
    return data.insights.slice(0, 6).map<ActionVm>((a) => ({
      pri: priorityToBucket(a.priority),
      source: pickSource(a),
      title: a.title,
      why: a.action || a.finding,
      cta: '',
      impact: truncate(a.expected_impact || '', 20),
      time: truncate(a.timeframe || '', 18),
    }))
  }, [insights.data])

  const insightScore = insights.data?.score ?? null
  const insightChange = insights.data?.score_change ?? 0
  const displayScore =
    insightScore ?? Math.round(((consistency + audienceFit + variety + igPerformance) / 4) * 100)

  // Suppress unused warning for `segments` — kept available so the underlying
  // query stays warm; the segments-derived "Content patterns" section was
  // removed in this redesign and now lives on the My Audience page.
  void segments

  return (
    <div className="rd-canvas">
      <div className="hm-main">
        <Header range={range} setRange={setRange} />

        <KpiStrip
          overview={overview.data}
          sentiment={sentiment.data}
          breakdown={breakdown.data}
          timeline={timeline.data?.timeline}
          insightScore={insightScore}
          insightChange={insightChange}
          consistencyValue={consistency}
          audienceFitValue={audienceFit}
          varietyValue={variety}
          igPerfValue={igPerformance}
          isAr={isAr}
        />

        <NBABanner
          insight={insights.data?.insights?.[0] ?? null}
          summary={insights.data?.summary ?? ''}
        />

        <ActionsList actions={actions} isAr={isAr} />

        <div className="hm-grid">
          <WhatsWorking breakdown={breakdown.data} sentiment={sentiment.data} />
          <GrowthHealthBreakdown
            consistency={consistency}
            consistencyHelper={consistencyHelper}
            audienceFit={audienceFit}
            variety={variety}
            igPerformance={igPerformance}
            displayScore={displayScore}
            isAr={isAr}
          />
        </div>
      </div>

      <style>{HM_STYLES}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Styles (ported from components/HomeApp.jsx)                        */
/* ------------------------------------------------------------------ */

const HM_STYLES = `
.hm-main { display:flex; flex-direction:column; gap:22px; max-width:1520px; margin:0 auto; }

/* Header */
.hm-head { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; }
.hm-crumb { font-size:12px; color:var(--ink-500); font-weight:500; margin-bottom:8px; }
.hm-head h1 { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.025em; line-height:1.2; }
.hm-wave { display:inline-block; animation:hm-wave 2.4s ease-in-out infinite; transform-origin:70% 70%; }
@keyframes hm-wave { 0%,60%,100% { transform:rotate(0); } 10%,30%,50% { transform:rotate(14deg); } 20%,40% { transform:rotate(-8deg); } }
.hm-head p { font-size:13.5px; color:var(--ink-600); max-width:560px; line-height:1.5; margin-top:6px; }
.hm-head-r { display:flex; gap:10px; align-items:center; }
.hm-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.hm-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.hm-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:var(--shadow-sm); }

/* KPI strip */
.hm-kpi { display:grid; grid-template-columns:1.3fr 1fr 1fr 1fr; gap:14px; }
@media (max-width:1024px) { .hm-kpi { grid-template-columns:1fr 1fr; } }
@media (max-width:640px)  { .hm-kpi { grid-template-columns:1fr; } }
.hm-kpi-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:20px 22px; display:flex; flex-direction:column; gap:8px; position:relative; overflow:hidden; }
.hm-kpi--hero { background:linear-gradient(135deg, var(--purple-800), oklch(0.28 0.14 285)); color:#fff; border:none; flex-direction:row; align-items:center; gap:20px; padding:18px 22px; }
.hm-kpi--hero .hm-kpi-k { color:rgba(255,255,255,.92); margin:0 0 6px; font-weight:600; }
.hm-kpi--hero .hm-kpi-d { color:#fff; font-weight:600; }
.hm-kpi--hero .hm-kpi-d.up { color:oklch(0.92 0.18 150); }
.hm-kpi-hero-l { flex:1; }
.hm-kpi-k { font-size:11.5px; color:var(--ink-500); font-weight:500; }
.hm-kpi-v { font-size:28px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
.hm-kpi-d { font-size:12px; font-weight:600; color:var(--ink-600); }
.hm-kpi-d.up { color:oklch(0.5 0.15 155); }
.hm-kpi-d.down { color:oklch(0.6 0.2 30); }
.hm-kpi-spark { display:flex; gap:3px; align-items:flex-end; height:34px; margin-top:auto; }
.hm-kpi-spark > div { flex:1; background:var(--purple-200); border-radius:2px 2px 0 0; min-height:3px; }
.hm-kpi-ring { position:relative; width:92px; height:92px; flex-shrink:0; }
.hm-kpi-ring svg { width:100%; height:100%; }
.hm-kpi-ring-c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1; }
.hm-kpi-ring-c .num { font-size:28px; font-weight:700; letter-spacing:-0.02em; }
.hm-kpi-ring-c em { font-style:normal; font-size:11px; opacity:.85; font-weight:500; margin-top:3px; }
.hm-kpi-ring-delta { position:absolute; bottom:-8px; left:50%; transform:translateX(-50%); font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; background:rgba(255,255,255,.18); color:oklch(0.92 0.18 150); white-space:nowrap; }

/* NBA banner */
.hm-nba { background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:16px; padding:18px 22px; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; }
.hm-nba-l { display:flex; gap:14px; align-items:center; flex:1; min-width:0; }
.hm-nba-av { width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, var(--purple-500), var(--purple-700)); color:#fff; display:grid; place-items:center; font-size:17px; font-weight:700; box-shadow:0 6px 18px -4px rgba(102, 79, 161, .5); flex-shrink:0; }
.hm-nba-k { font-size:11px; font-weight:700; color:var(--purple-700); margin-bottom:4px; letter-spacing:0.02em; }
.hm-nba-t { font-size:13.5px; color:var(--ink-900); line-height:1.55; font-weight:500; }
.hm-nba-t strong { color:var(--ink-950); font-weight:700; }
.hm-nba-btn { padding:10px 16px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:5px; flex-shrink:0; box-shadow:0 6px 16px -6px rgba(102, 79, 161, .5); }
.hm-nba-btn:hover { background:var(--purple-700); }

/* Actions for today */
.hm-actions { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; }
.hm-actions-head { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:14px; flex-wrap:wrap; }
.hm-actions-head h3 { font-size:15px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }
.hm-actions-head p { font-size:12px; color:var(--ink-500); margin-top:3px; }
.hm-actions-stats { display:flex; gap:14px; font-size:11.5px; color:var(--ink-600); font-weight:500; }
.hm-actions-stats span { display:inline-flex; align-items:baseline; gap:4px; }
.hm-actions-stats b { color:var(--ink-950); font-weight:700; font-size:14px; letter-spacing:-0.005em; }
.hm-actions-empty { padding:36px; text-align:center; font-size:13px; color:var(--ink-500); border:1px dashed var(--line); border-radius:12px; }

.hm-actions-list { display:flex; flex-direction:column; gap:6px; }
/* Layout: pri pill | body | meta (left-aligned, divider) | CTA. Matches HomeApp.jsx. */
.hm-act { display:grid; grid-template-columns:72px minmax(0,1fr) 130px 150px; gap:14px; align-items:center; padding:14px 16px; border-radius:12px; border:1px solid var(--line); background:var(--surface); transition:all .15s; min-height:64px; }
@media (max-width:900px) { .hm-act { grid-template-columns:1fr; gap:8px; min-height:0; } .hm-act-meta { padding-inline-start:0; border-inline-start:none; padding-top:8px; border-top:1px solid var(--line); align-items:flex-start; } }
.hm-act:hover { border-color:var(--purple-300); background:var(--ink-50); }
.hm-act--urgent { border-color:oklch(0.88 0.06 30); background:oklch(0.99 0.01 30); }
.hm-act--urgent:hover { border-color:oklch(0.75 0.13 30); background:oklch(0.97 0.03 30); }
.hm-act-pri { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:99px; font-size:10.5px; font-weight:700; letter-spacing:0.01em; justify-self:start; white-space:nowrap; }
.hm-act-pri-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
.hm-act--urgent .hm-act-pri-dot { animation:hm-pulse 1.6s ease-in-out infinite; }
@keyframes hm-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.6; transform:scale(1.3); } }
.hm-act-body { min-width:0; text-align:start; }
.hm-act-title { font-size:13.5px; font-weight:600; color:var(--ink-950); line-height:1.45; margin-bottom:4px; }
.hm-act-why { font-size:11.5px; color:var(--ink-600); line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.hm-act-src { font-weight:600; margin-inline-end:6px; display:inline-flex; align-items:center; gap:4px; }
.hm-act-src svg { flex-shrink:0; }
.hm-act-dot { color:var(--ink-300); margin-inline-end:6px; }
.hm-act-meta { display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:4px; padding-inline-start:14px; border-inline-start:1px solid var(--line); min-width:0; }
.hm-act-impact { font-size:11px; font-weight:600; color:oklch(0.5 0.15 155); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.hm-act-time { font-size:10.5px; color:var(--ink-500); font-weight:500; white-space:nowrap; }
/* Non-urgent CTAs are dark/black; urgent CTAs are purple (brand) per design v2. */
.hm-act-cta { padding:9px 14px; border-radius:9px; background:var(--ink-900); color:#fff; font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:5px; white-space:nowrap; width:100%; }
.hm-act-cta:hover { background:var(--ink-800); }
.hm-act--urgent .hm-act-cta { background:var(--purple-600); }
.hm-act--urgent .hm-act-cta:hover { background:var(--purple-700); }

/* Bottom grid */
.hm-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:flex-start; }
@media (max-width:1024px) { .hm-grid { grid-template-columns:1fr; } }
.hm-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; }
.hm-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px; }
.hm-card-head h3 { font-size:15px; font-weight:700; color:var(--ink-950); margin-bottom:3px; letter-spacing:-0.005em; }
.hm-card-head p { font-size:12px; color:var(--ink-500); }
.hm-empty { font-size:13px; color:var(--ink-500); padding:24px; text-align:center; border:1px dashed var(--line); border-radius:12px; }

/* Bullets */
.hm-bullets { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:4px; }
.hm-bullets li { display:flex; gap:12px; align-items:center; padding:10px 12px; border-radius:10px; font-size:13.5px; color:var(--ink-800); line-height:1.5; }
.hm-bullets li:hover { background:var(--ink-50); }
.hm-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.hm-dot.good { background:oklch(0.65 0.15 155); box-shadow:0 0 0 3px oklch(0.92 0.08 155); }
.hm-dot.warn { background:oklch(0.75 0.15 75);  box-shadow:0 0 0 3px oklch(0.95 0.08 75); }
.hm-dot.bad  { background:oklch(0.65 0.2 30);   box-shadow:0 0 0 3px oklch(0.93 0.08 30); }

/* Health card */
.hm-score { text-align:end; }
.hm-score .num { font-size:26px; font-weight:700; color:var(--purple-700); letter-spacing:-0.015em; }
.hm-score em { font-style:normal; font-size:11px; color:var(--ink-500); font-weight:500; }
.hm-health { display:flex; flex-direction:column; gap:14px; }
.hm-hr-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.hm-hr-k { font-size:13px; font-weight:600; color:var(--ink-900); }
.hm-hr-v { font-size:13px; font-weight:700; letter-spacing:-0.005em; }
.hm-hr-v.good { color:oklch(0.5 0.15 155); }
.hm-hr-v.warn { color:oklch(0.55 0.15 60); }
.hm-hr-v.bad  { color:oklch(0.6 0.2 30); }
.hm-hr-track { height:7px; background:var(--ink-100); border-radius:99px; overflow:hidden; margin-bottom:6px; }
.hm-hr-fill { height:100%; border-radius:99px; transition:width .6s cubic-bezier(.2,.8,.2,1); }
.hm-hr-fill.good { background:oklch(0.65 0.15 155); }
.hm-hr-fill.warn { background:oklch(0.72 0.16 75); }
.hm-hr-fill.bad  { background:oklch(0.65 0.2 30); }
.hm-hr-hint { font-size:11.5px; color:var(--ink-500); line-height:1.5; }

/* RTL flip for chevrons */
[dir="rtl"] .hm-act-cta svg,
[dir="rtl"] .hm-nba-btn svg { transform:scaleX(-1); }
`

// Suppress unused-import warning for SegmentsData; the type is referenced
// via `useSegments()` return type but TS strict mode flags the unused import.
type _Unused = SegmentsData
void (null as unknown as _Unused)
