import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useSentimentSummary,
  useSentimentResponses,
  useCommentsAnalytics,
  useSentimentTimeline,
} from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import { Icon, I } from '../components/redesign/icons'
import type {
  CommentSentimentEntry,
  NeedsAttentionPost,
  SentimentSummaryData,
  SentimentTimelineEntry,
} from '../api/analytics'

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const MOOD = {
  pos: { bg: 'oklch(0.95 0.06 155)', fg: 'oklch(0.42 0.13 155)', solid: 'oklch(0.62 0.13 155)' },
  neu: { bg: 'var(--ink-100)', fg: 'var(--ink-600)', solid: 'var(--ink-400)' },
  neg: { bg: 'oklch(0.96 0.05 30)', fg: 'oklch(0.5 0.17 30)', solid: 'oklch(0.65 0.17 30)' },
} as const

type Mood = keyof typeof MOOD
type Filter = 'all' | 'neg' | 'neu' | 'pos'

function moodFromSentiment(s: 'positive' | 'neutral' | 'negative' | null): Mood {
  if (s === 'positive') return 'pos'
  if (s === 'negative') return 'neg'
  return 'neu'
}

function urgencyOf(comment: CommentSentimentEntry): 'high' | 'mid' | 'low' {
  const ageHours = comment.created_at
    ? (Date.now() - new Date(comment.created_at).getTime()) / (1000 * 60 * 60)
    : Number.POSITIVE_INFINITY
  if (comment.sentiment === 'negative' && ageHours < 24) return 'high'
  if (comment.sentiment === 'negative') return 'mid'
  if (comment.sentiment === 'neutral') return 'mid'
  return 'low'
}

// Format a relative time without external deps. Returns localised label.
function formatRelative(iso: string | null, t: (key: string, opts?: Record<string, string | number>) => string): string {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const diffMs = Date.now() - ts
  const minutes = Math.floor(diffMs / (1000 * 60))
  if (minutes < 1) return t('sentimentPage.justNow')
  if (minutes < 60) return t('sentimentPage.minutesAgo', { value: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('sentimentPage.hoursAgo', { value: hours })
  const days = Math.floor(hours / 24)
  return t('sentimentPage.daysAgo', { value: days })
}

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

function SentHero({ summary }: { summary: SentimentSummaryData | undefined }) {
  const { t } = useTranslation()
  const counts = summary?.current_counts ?? { positive: 0, neutral: 0, negative: 0 }
  const total = (counts.positive + counts.neutral + counts.negative) || 1
  const data = [
    {
      key: 'positive' as const,
      mood: 'pos' as const,
      pct: Math.round((counts.positive / total) * 100),
      label: t('sentimentPage.ringPositive'),
    },
    {
      key: 'neutral' as const,
      mood: 'neu' as const,
      pct: Math.round((counts.neutral / total) * 100),
      label: t('sentimentPage.ringNeutral'),
    },
    {
      key: 'negative' as const,
      mood: 'neg' as const,
      pct: Math.round((counts.negative / total) * 100),
      label: t('sentimentPage.ringNegative'),
    },
  ]
  const headline = summary?.highlights?.trim() || t('sentimentPage.heroFallback')

  return (
    <section className="snt-hero">
      <div className="snt-hero-l">
        <div className="snt-hero-k">{t('sentimentPage.heroEyebrow')}</div>
        <h2 dir="auto">{headline}</h2>
        <div className="snt-hero-acts">
          <button className="snt-hero-btn primary">
            <Icon path={I.wand} size={13} />
            {t('sentimentPage.heroCta1')}
          </button>
          <button className="snt-hero-btn ghost">{t('sentimentPage.heroCta2')}</button>
        </div>
      </div>

      <div className="snt-hero-r">
        <div className="snt-hero-rings">
          {data.map((d) => {
            const m = MOOD[d.mood]
            return (
              <div key={d.key} className="snt-ring">
                <div
                  className="snt-ring-svg"
                  style={
                    {
                      ['--p' as string]: d.pct.toString(),
                      ['--c' as string]: m.solid,
                    } as React.CSSProperties
                  }
                >
                  <div className="snt-ring-c">
                    <div className="num">{d.pct}%</div>
                  </div>
                </div>
                <div className="snt-ring-l" style={{ color: m.fg }}>
                  {d.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Triage list                                                        */
/* ------------------------------------------------------------------ */

interface CommentVm {
  id: string
  postId: string
  authorUsername: string | null
  text: string
  language: 'en' | 'ar' | 'unknown' | null
  createdAt: string | null
  mood: Mood
  urgency: 'high' | 'mid' | 'low'
  postCaption: string
  postPermalink: string | null
  responseTemplate: string | null
}

function TriageList({
  filter,
  setFilter,
  items,
  onCopyReply,
  copyState,
}: {
  filter: Filter
  setFilter: (f: Filter) => void
  items: CommentVm[]
  onCopyReply: (id: string, text: string) => void
  copyState: Record<string, boolean>
}) {
  const { t } = useTranslation()
  const filtered = items.filter((c) =>
    filter === 'all' ? true
    : filter === 'neg' ? c.mood === 'neg'
    : filter === 'neu' ? c.mood === 'neu'
    : c.mood === 'pos',
  )

  return (
    <section className="snt-panel">
      <div className="snt-panel-head">
        <div>
          <h3>{t('sentimentPage.needsReply')}</h3>
          <p className="snt-panel-s">{t('sentimentPage.needsReplyCount', { count: filtered.length })}</p>
        </div>
        <div className="snt-filter">
          {(
            [
              ['all', 'sentimentPage.filterAll'],
              ['neg', 'sentimentPage.filterNegative'],
              ['neu', 'sentimentPage.filterQuestion'],
              ['pos', 'sentimentPage.filterPositive'],
            ] as const
          ).map(([v, k]) => (
            <button key={v} className={filter === v ? 'is-on' : ''} onClick={() => setFilter(v)}>
              {t(k)}
            </button>
          ))}
        </div>
      </div>

      <div className="snt-inbox">
        {filtered.length === 0 ? (
          <div className="snt-inbox-empty" dir="auto">
            {t('sentimentPage.inboxEmpty')}
          </div>
        ) : (
          filtered.map((c) => {
            const m = MOOD[c.mood]
            const urgencyMeta =
              c.urgency === 'high'
                ? { lbl: t('sentimentPage.urgencyHigh'), bg: MOOD.neg.bg, fg: MOOD.neg.fg }
                : c.urgency === 'mid'
                  ? { lbl: t('sentimentPage.urgencyMid'), bg: 'oklch(0.97 0.05 60)', fg: 'oklch(0.5 0.13 60)' }
                  : { lbl: t('sentimentPage.urgencyLow'), bg: 'var(--ink-100)', fg: 'var(--ink-600)' }
            const moodLbl =
              c.mood === 'pos'
                ? t('sentimentPage.moodPositive')
                : c.mood === 'neg'
                  ? t('sentimentPage.moodNegative')
                  : t('sentimentPage.moodNeutral')
            const isAr = c.language === 'ar'
            const initial = (c.authorUsername || '@').slice(1, 2).toUpperCase() || '?'
            const isCopied = !!copyState[c.id]
            return (
              <article key={c.id} className="snt-comment" style={{ ['--m' as string]: m.solid } as React.CSSProperties}>
                <div className="snt-c-bar" />
                <div className="snt-c-av" style={{ background: m.bg, color: m.fg }}>
                  {initial}
                </div>
                <div className="snt-c-body">
                  <div className="snt-c-meta">
                    <span className="snt-c-au">{c.authorUsername || '@unknown'}</span>
                    <span className="snt-c-mood" style={{ background: m.bg, color: m.fg }}>
                      {moodLbl}
                    </span>
                    <span
                      className="snt-c-urge"
                      style={{ background: urgencyMeta.bg, color: urgencyMeta.fg }}
                    >
                      {urgencyMeta.lbl}
                    </span>
                    <span className="snt-c-dot">·</span>
                    <span className="snt-c-time">{formatRelative(c.createdAt, t)}</span>
                    {c.postCaption && (
                      <>
                        <span className="snt-c-dot">·</span>
                        <span className="snt-c-post">
                          {t('sentimentPage.onPost', {
                            post: c.postCaption.slice(0, 30) + (c.postCaption.length > 30 ? '…' : ''),
                          })}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="snt-c-text" dir={isAr ? 'rtl' : 'auto'}>
                    {c.text}
                  </p>
                  <div className="snt-c-acts">
                    {c.responseTemplate && (
                      <button
                        className="snt-c-btn primary"
                        onClick={() => onCopyReply(c.id, c.responseTemplate!)}
                      >
                        <Icon path={I.wand} size={11} />
                        {isCopied ? t('sentimentPage.replyCopied' as never) || 'Copied!' : t('sentimentPage.suggestReply')}
                      </button>
                    )}
                    {c.postPermalink && (
                      <a
                        className="snt-c-btn ghost"
                        href={c.postPermalink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('sentimentPage.replyManually')}
                      </a>
                    )}
                    <button className="snt-c-btn ghost">{t('sentimentPage.dismiss')}</button>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Right panel — trend, keywords, driving posts                       */
/* ------------------------------------------------------------------ */

function WeekTrend({ timeline }: { timeline: SentimentTimelineEntry[] | undefined }) {
  const { t, i18n } = useTranslation()
  // Take last 7 entries; if fewer, show what we have.
  const data = (timeline ?? []).slice(-7)

  // If no timeline data, show empty bars labelled by weekday.
  const empty = data.length === 0
  const days = empty
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return { date: d.toISOString().slice(0, 10), positive: 0, neutral: 0, negative: 0 }
      })
    : data

  const dayLabels = days.map((d) => {
    return new Date(d.date).toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US', {
      weekday: 'short',
    })
  })

  return (
    <section className="snt-mini">
      <h3>{t('sentimentPage.weekTrend')}</h3>
      <p className="snt-mini-s">{t('sentimentPage.weekTrendSubtitle')}</p>
      <div className="snt-trend">
        {days.map((d, i) => {
          const total = d.positive + d.neutral + d.negative || 1
          const pos = (d.positive / total) * 100
          const neu = (d.neutral / total) * 100
          const neg = (d.negative / total) * 100
          return (
            <div key={d.date} className="snt-trend-c">
              <div className="snt-trend-stack">
                <div style={{ height: `${pos}%`, background: MOOD.pos.solid }} />
                <div style={{ height: `${neu}%`, background: MOOD.neu.solid }} />
                <div style={{ height: `${neg}%`, background: MOOD.neg.solid }} />
              </div>
              <div className="snt-trend-l">{dayLabels[i]}</div>
            </div>
          )
        })}
      </div>
      <div className="snt-trend-leg">
        <span>
          <i style={{ background: MOOD.pos.solid }} /> {t('sentimentPage.moodPositive')}
        </span>
        <span>
          <i style={{ background: MOOD.neu.solid }} /> {t('sentimentPage.moodNeutral')}
        </span>
        <span>
          <i style={{ background: MOOD.neg.solid }} /> {t('sentimentPage.moodNegative')}
        </span>
      </div>
    </section>
  )
}

function MostMentioned({ keywords }: { keywords: SentimentSummaryData['keywords'] | undefined }) {
  const { t } = useTranslation()
  const list = keywords ?? []
  return (
    <section className="snt-mini">
      <h3>{t('sentimentPage.mostMentioned')}</h3>
      <p className="snt-mini-s">{t('sentimentPage.mostMentionedSubtitle')}</p>
      {list.length === 0 ? (
        <div className="snt-mini-empty">{t('sentimentPage.keywordsEmpty')}</div>
      ) : (
        <div className="snt-cloud">
          {list.map((kw) => {
            const moodKey: Mood =
              kw.sentiment === 'positive' ? 'pos' : kw.sentiment === 'negative' ? 'neg' : 'neu'
            const m = MOOD[moodKey]
            return (
              <span
                key={kw.term}
                className="snt-tag"
                style={{ background: m.bg, color: m.fg, fontSize: `${11 + Math.min(kw.count, 16) / 4}px` }}
              >
                {kw.term} <b className="num">{kw.count}</b>
              </span>
            )
          })}
        </div>
      )}
    </section>
  )
}

function DrivingPosts({ posts }: { posts: NeedsAttentionPost[] | undefined }) {
  const { t } = useTranslation()
  const list = (posts ?? []).slice(0, 3)
  return (
    <section className="snt-mini">
      <h3>{t('sentimentPage.drivingPosts')}</h3>
      <p className="snt-mini-s">{t('sentimentPage.drivingPostsSubtitle')}</p>
      {list.length === 0 ? (
        <div className="snt-mini-empty">{t('sentimentPage.attentionEmpty')}</div>
      ) : (
        <div className="snt-drv">
          {list.map((p) => {
            // We don't have per-post sentiment breakdown — use the negative_count
            // and approximate the bar accordingly.
            const total = Math.max(p.negative_count, 5)
            const negPct = Math.round((p.negative_count / total) * 100)
            const posPct = Math.max(0, 100 - negPct - 20)
            const neuPct = Math.max(0, 100 - posPct - negPct)
            const caption = p.caption || t('sentimentPage.noCaption')
            return (
              <div key={p.post_id} className="snt-drv-row">
                <div className="snt-drv-meta">
                  <span className="snt-drv-t" dir="auto">
                    {caption.slice(0, 40)}
                    {caption.length > 40 ? '…' : ''}
                  </span>
                  <span className="snt-drv-n num">
                    {t('sentimentPage.negativeComments', { count: p.negative_count })}
                  </span>
                </div>
                <div className="snt-drv-bar">
                  <div style={{ width: `${posPct}%`, background: MOOD.pos.solid }} />
                  <div style={{ width: `${neuPct}%`, background: MOOD.neu.solid }} />
                  <div style={{ width: `${negPct}%`, background: MOOD.neg.solid }} />
                </div>
                <div className="snt-drv-pcts">
                  <span className="num" style={{ color: MOOD.pos.fg }}>
                    {posPct}%
                  </span>
                  <span className="num" style={{ color: MOOD.neu.fg }}>
                    {neuPct}%
                  </span>
                  <span className="num" style={{ color: MOOD.neg.fg }}>
                    {negPct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function SentimentContent() {
  const { t } = useTranslation()
  const summary = useSentimentSummary()
  const responses = useSentimentResponses()
  const comments = useCommentsAnalytics()
  const timeline = useSentimentTimeline()
  const [filter, setFilter] = useState<Filter>('all')
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')
  const [copyState, setCopyState] = useState<Record<string, boolean>>({})

  // Map response templates by post_id for cheap lookup.
  const replyByPostId = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of responses.data?.templates ?? []) m.set(r.post_id, r.response_template)
    return m
  }, [responses.data])

  // Map needs_attention post captions for the "on {post}" badge.
  const captionByPostId = useMemo(() => {
    const m = new Map<string, { caption: string; permalink: string | null }>()
    for (const p of summary.data?.needs_attention ?? []) {
      m.set(p.post_id, { caption: p.caption, permalink: p.permalink })
    }
    return m
  }, [summary.data])

  // Build the comment view-models. Prioritize negative + recent.
  const items: CommentVm[] = useMemo(() => {
    const list = comments.data?.comments ?? []
    const vms = list
      .filter((c) => !!c.text)
      .slice(0, 50) // cap for perf — backend already returns ≤200
      .map<CommentVm>((c) => ({
        id: c.id,
        postId: c.post_id,
        authorUsername: c.author_username,
        text: c.text || '',
        language: c.language,
        createdAt: c.created_at,
        mood: moodFromSentiment(c.sentiment),
        urgency: urgencyOf(c),
        postCaption: captionByPostId.get(c.post_id)?.caption ?? '',
        postPermalink: captionByPostId.get(c.post_id)?.permalink ?? null,
        responseTemplate: replyByPostId.get(c.post_id) ?? null,
      }))
    // Sort: high urgency first, then recency.
    const ord = { high: 0, mid: 1, low: 2 } as const
    return vms.sort((a, b) => {
      if (ord[a.urgency] !== ord[b.urgency]) return ord[a.urgency] - ord[b.urgency]
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })
  }, [comments.data, replyByPostId, captionByPostId])

  function handleCopy(id: string, text: string) {
    void navigator.clipboard.writeText(text)
    setCopyState((s) => ({ ...s, [id]: true }))
    setTimeout(() => setCopyState((s) => ({ ...s, [id]: false })), 1500)
  }

  return (
    <div className="rd-canvas">
      <div className="snt-main">
        <header className="snt-head">
          <div>
            <h1 dir="auto">{t('sentimentPage.headerTitle')}</h1>
            <p dir="auto">{t('sentimentPage.question')}</p>
          </div>
          <div className="snt-seg">
            {(['today', '7d', '30d'] as const).map((r) => (
              <button key={r} className={range === r ? 'is-on' : ''} onClick={() => setRange(r)}>
                {t(`sentimentPage.range${r === 'today' ? 'Today' : r === '7d' ? '7d' : '30d'}` as never)}
              </button>
            ))}
          </div>
        </header>

        <SentHero summary={summary.data} />

        <div className="snt-grid">
          <TriageList
            filter={filter}
            setFilter={setFilter}
            items={items}
            onCopyReply={handleCopy}
            copyState={copyState}
          />
          <aside className="snt-cock">
            <WeekTrend timeline={timeline.data?.timeline} />
            <MostMentioned keywords={summary.data?.keywords} />
            <DrivingPosts posts={summary.data?.needs_attention} />
          </aside>
        </div>
      </div>
      <style>{SNT_STYLES}</style>
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

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const SNT_STYLES = `
.snt-main { display:flex; flex-direction:column; gap:22px; max-width:1480px; margin:0 auto; }
.snt-head { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; }
.snt-head h1 { font-size:26px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; margin-bottom:3px; }
.snt-head p { font-size:12.5px; color:var(--ink-500); max-width:560px; }
.snt-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.snt-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.snt-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:var(--shadow-sm); }

/* Hero */
.snt-hero { display:grid; grid-template-columns:1.4fr 1fr; gap:28px; background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:20px; padding:26px 30px; align-items:center; }
@media (max-width:1024px) { .snt-hero { grid-template-columns:1fr; } }
.snt-hero-k { font-size:11px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:10px; }
.snt-hero h2 { font-size:21px; font-weight:700; color:var(--ink-950); margin-bottom:14px; letter-spacing:-0.015em; line-height:1.4; }
.snt-hero-acts { display:flex; gap:8px; flex-wrap:wrap; }
.snt-hero-btn { padding:9px 14px; border-radius:10px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
.snt-hero-btn.primary { background:var(--purple-600); color:#fff; }
.snt-hero-btn.primary:hover { background:var(--purple-700); }
.snt-hero-btn.ghost { background:transparent; color:var(--purple-800); }

.snt-hero-rings { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.snt-ring { background:var(--surface); border-radius:14px; padding:14px 8px; text-align:center; }
.snt-ring-svg { width:80px; height:80px; margin:0 auto 6px; border-radius:50%; background:conic-gradient(var(--c) calc(var(--p) * 1%), var(--ink-100) 0); display:grid; place-items:center; }
.snt-ring-c { width:60px; height:60px; background:var(--surface); border-radius:50%; display:grid; place-items:center; }
.snt-ring-c .num { font-size:17px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; }
.snt-ring-l { font-size:12px; font-weight:600; }

/* Grid */
.snt-grid { display:grid; grid-template-columns:1.55fr 1fr; gap:20px; align-items:flex-start; }
@media (max-width:1024px) { .snt-grid { grid-template-columns:1fr; } }
.snt-cock { display:flex; flex-direction:column; gap:14px; }
@media (min-width:1024px) { .snt-cock { position:sticky; top:28px; } }
.snt-panel, .snt-mini { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; }
.snt-panel h3, .snt-mini h3 { font-size:14px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }
.snt-panel-s, .snt-mini-s { font-size:11.5px; color:var(--ink-500); font-weight:500; margin:2px 0 14px; }
.snt-mini-empty { padding:18px; text-align:center; font-size:12px; color:var(--ink-500); border:1px dashed var(--line); border-radius:10px; }
.snt-inbox-empty { padding:36px; text-align:center; font-size:13px; color:var(--ink-500); border:1px dashed var(--line); border-radius:12px; }

.snt-panel-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
.snt-panel-head h3 { margin-bottom:2px; }
.snt-filter { display:flex; gap:4px; flex-shrink:0; flex-wrap:wrap; }
.snt-filter button { padding:6px 11px; font-size:11.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.snt-filter button.is-on { background:var(--purple-100); color:var(--purple-800); font-weight:600; }

/* Inbox */
.snt-inbox { display:flex; flex-direction:column; gap:10px; max-height:720px; overflow-y:auto; padding-inline-end:4px; }
.snt-comment { display:grid; grid-template-columns:3px 38px 1fr; gap:12px; padding:14px 14px 14px 0; border:1px solid var(--line); border-radius:12px; background:var(--surface); position:relative; overflow:hidden; }
.snt-c-bar { background:var(--m); border-radius:0 3px 3px 0; }
.snt-c-av { width:38px; height:38px; border-radius:50%; display:grid; place-items:center; font-weight:700; font-size:13px; }
.snt-c-meta { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:11px; color:var(--ink-500); margin-bottom:6px; }
.snt-c-au { font-weight:700; color:var(--ink-900); font-size:12px; }
.snt-c-mood, .snt-c-urge { padding:2px 8px; border-radius:99px; font-size:10.5px; font-weight:600; }
.snt-c-dot { color:var(--ink-300); }
.snt-c-post { font-style:italic; }
.snt-c-text { font-size:13.5px; color:var(--ink-900); line-height:1.6; margin:0 12px 10px 0; }
.snt-c-acts { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.snt-c-btn { padding:6px 12px; border-radius:8px; font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; gap:4px; text-decoration:none; }
.snt-c-btn.primary { background:var(--ink-900); color:#fff; }
.snt-c-btn.primary:hover { background:var(--purple-700); }
.snt-c-btn.ghost { color:var(--ink-700); border:1px solid var(--line-strong); background:transparent; }
.snt-c-btn.ghost:hover { background:var(--ink-50); }

/* Trend */
.snt-trend { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; align-items:end; height:120px; }
.snt-trend-c { display:flex; flex-direction:column; gap:6px; align-items:center; height:100%; }
.snt-trend-stack { width:100%; max-width:36px; display:flex; flex-direction:column; border-radius:6px; overflow:hidden; flex:1; min-height:0; }
.snt-trend-stack > div { width:100%; }
.snt-trend-l { font-size:10.5px; color:var(--ink-500); font-weight:500; }
.snt-trend-leg { display:flex; gap:14px; flex-wrap:wrap; font-size:11px; color:var(--ink-600); margin-top:10px; }
.snt-trend-leg span { display:inline-flex; align-items:center; gap:5px; font-weight:500; }
.snt-trend-leg i { width:9px; height:9px; border-radius:2px; display:inline-block; }

/* Cloud */
.snt-cloud { display:flex; flex-wrap:wrap; gap:6px; }
.snt-tag { padding:5px 11px; border-radius:99px; font-weight:500; line-height:1.4; display:inline-flex; align-items:center; gap:5px; }
.snt-tag b { font-weight:700; opacity:.7; }

/* Driving posts */
.snt-drv { display:flex; flex-direction:column; gap:14px; }
.snt-drv-row { display:flex; flex-direction:column; gap:6px; }
.snt-drv-meta { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
.snt-drv-t { font-size:12px; font-weight:600; color:var(--ink-900); }
.snt-drv-n { font-size:10.5px; color:var(--ink-500); font-weight:500; }
.snt-drv-bar { display:flex; height:8px; border-radius:99px; overflow:hidden; background:var(--ink-100); }
.snt-drv-bar > div { height:100%; }
.snt-drv-pcts { display:flex; gap:10px; font-size:10.5px; font-weight:600; }
`
