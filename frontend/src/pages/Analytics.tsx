import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  usePostsBreakdown,
  usePostsInsights,
  useGenerateCaption,
  useAccounts,
  useTopPosts,
} from '../hooks/useAnalytics'
import { Icon, I, TypeIcon, normalizeContentType, type ContentTypeKey } from '../components/redesign/icons'
import type { TopPost } from '../api/analytics'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Body / hashtags split — anything before the first `#` is the body, the
// rest is the trailing tag tail. Captions without hashtags degrade to
// body-only.
function splitCaption(raw: string): { body: string; tags: string } {
  if (!raw) return { body: '', tags: '' }
  const idx = raw.indexOf('#')
  if (idx < 0) return { body: raw.trim(), tags: '' }
  return { body: raw.slice(0, idx).trim(), tags: raw.slice(idx).trim() }
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
function fmtNum(value: string | number, isAr: boolean): string {
  const s = String(value)
  return isAr ? s.replace(/\d/g, (d) => AR_DIGITS[+d]) : s
}

function pctSuffix(isAr: boolean): string {
  return isAr ? '٪' : '%'
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(Math.round(n))
}

// Truncate a caption to N chars without breaking words mid-sentence.
function truncateCaption(s: string, max = 60): string {
  if (!s) return ''
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…'
}

function formatPostDate(iso: string | null, isAr: boolean): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

function Header({
  range,
  setRange,
  isAr,
}: {
  range: '7d' | '30d' | '90d'
  setRange: (r: '7d' | '30d' | '90d') => void
  isAr: boolean
}) {
  const { t } = useTranslation()
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30

  return (
    <header className="mp-head">
      <div>
        <h1 dir="auto">{t('myPostsPage.headerTitle')}</h1>
        <p className="mp-sub" dir="auto">
          {t('myPostsPage.question', { days: fmtNum(days, isAr) })}
        </p>
      </div>

      <div className="mp-range">
        {(['7d', '30d', '90d'] as const).map((r) => {
          const labelKey = `myPostsPage.rangeShort${r === '7d' ? '7d' : r === '30d' ? '30d' : '90d'}`
          return (
            <button key={r} className={range === r ? 'is-on' : ''} onClick={() => setRange(r)}>
              {t(labelKey)}
            </button>
          )
        })}
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Card A — Engagement insight (eyebrow + headline + 3-bar chart)     */
/* ------------------------------------------------------------------ */

interface ChartRow {
  type: ContentTypeKey
  engagement: number
  posts: number
}

function EngagementInsightCard({ isAr }: { isAr: boolean }) {
  const { t } = useTranslation()
  const { data } = usePostsBreakdown()

  const rows: ChartRow[] = useMemo(() => {
    if (!data?.by_type) return []
    const merged = [...data.by_type]
      .map((b) => ({
        type: normalizeContentType(b.content_type),
        rawEngagement: (b.avg_likes || 0) + (b.avg_comments || 0),
        posts: b.count,
      }))
      .reduce<{ type: ContentTypeKey; rawEngagement: number; posts: number }[]>(
        (acc, row) => {
          const existing = acc.find((r) => r.type === row.type)
          if (existing) {
            existing.rawEngagement = Math.max(existing.rawEngagement, row.rawEngagement)
            existing.posts += row.posts
          } else {
            acc.push(row)
          }
          return acc
        },
        [],
      )
      .sort((a, b) => b.rawEngagement - a.rawEngagement)

    const top = Math.max(1, ...merged.map((r) => r.rawEngagement))
    return merged.map((r) => ({
      type: r.type,
      engagement: Math.round((r.rawEngagement / top) * 100 * 10) / 10,
      posts: r.posts,
    }))
  }, [data])

  const typeLabel = (k: ContentTypeKey) =>
    k === 'video' ? t('myPostsPage.videoLabel') : k === 'image' ? t('myPostsPage.imageLabel') : t('myPostsPage.carouselLabel')

  const colors = {
    video: 'var(--video)',
    image: 'var(--image)',
    carousel: 'var(--carousel)',
  } as const

  if (rows.length === 0) {
    return (
      <article className="mp-card">
        <div className="mp-eyebrow">
          <span className="mp-eyebrow-dot" />
          {t('myPostsPage.eyebrowFinding')} · <em>{t('myPostsPage.eyebrowStrong')}</em>
        </div>
        <div className="mp-empty">{t('myPostsPage.bestEmpty')}</div>
      </article>
    )
  }

  const top = rows[0]
  const compare = rows.find((r) => r.type !== top.type) ?? rows[1] ?? top
  const multiple =
    compare.engagement > 0 ? Math.round((top.engagement / compare.engagement) * 10) / 10 : 1

  return (
    <article className="mp-card">
      <div className="mp-eyebrow">
        <span className="mp-eyebrow-dot" />
        {t('myPostsPage.eyebrowFinding')} · <em>{t('myPostsPage.eyebrowStrong')}</em>
      </div>
      <h3 className="mp-headline" dir="auto">
        {t('myPostsPage.engagementHeadline', { topType: typeLabel(top.type) })}
      </h3>
      <p className="mp-headline-sub" dir="auto">
        {t('myPostsPage.engagementSubtitle', {
          topType: typeLabel(top.type),
          topPct: fmtNum(top.engagement.toFixed(1), isAr),
          multiple: fmtNum(multiple.toFixed(1), isAr),
          compareType: typeLabel(compare.type),
        })}
      </p>

      <div className="mp-chart">
        {rows.map((d) => {
          const pct = d.engagement
          return (
            <div key={d.type} className="mp-bar-row">
              <div className="mp-bar-label">
                <TypeIcon type={d.type} size={13} />
                <span>{typeLabel(d.type)}</span>
              </div>
              <div className="mp-bar-track" dir="ltr">
                <div
                  className="mp-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(to right, ${colors[d.type]}, color-mix(in oklch, ${colors[d.type]} 70%, white))`,
                  }}
                />
              </div>
              <div className="mp-bar-val num">{fmtNum(d.engagement.toFixed(1), isAr)}{pctSuffix(isAr)}</div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Card B — Winner post                                               */
/* ------------------------------------------------------------------ */

function WinnerCard({ isAr }: { isAr: boolean }) {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = usePostsInsights()
  const { data: accounts } = useAccounts()
  const generate = useGenerateCaption()
  const initialLang: 'en' | 'ar' = i18n.language?.startsWith('ar') ? 'ar' : 'en'
  const [captionLang, setCaptionLang] = useState<'en' | 'ar'>(initialLang)
  const [generated, setGenerated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const accountId = accounts?.[0]?.id

  if (isLoading) {
    return (
      <article className="mp-card">
        <div className="mp-eyebrow purple">
          <span className="mp-eyebrow-dot" />
          {t('myPostsPage.eyebrowWinner')}
        </div>
        <div className="mp-loading">{t('myPostsPage.loadingInsights')}</div>
      </article>
    )
  }

  const best = data?.best_post
  const why = (data?.why_it_worked || '').trim() || t('myPostsPage.whyFallback')

  function onGenerateCaption(lang: 'en' | 'ar' = captionLang) {
    if (!best) return
    setCopied(false)
    generate.mutate(
      { post_id: best.id, content_type: best.content_type, language: lang, account_id: accountId },
      { onSuccess: (res) => setGenerated(res.caption || '') },
    )
  }

  function switchLang(next: 'en' | 'ar') {
    if (next === captionLang) return
    setCaptionLang(next)
    setGenerated(null)
    if (best) onGenerateCaption(next)
  }

  function copyCaption() {
    if (!generated) return
    void navigator.clipboard.writeText(generated)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!best) {
    return (
      <article className="mp-card">
        <div className="mp-eyebrow purple">
          <span className="mp-eyebrow-dot" />
          {t('myPostsPage.eyebrowWinner')}
        </div>
        <div className="mp-empty" dir="auto">
          {t('myPostsPage.bestEmpty')}
        </div>
      </article>
    )
  }

  const captionParts = splitCaption(generated || '')
  const engagementPct =
    best.likes && best.comments
      ? Math.round(((best.likes + best.comments) / Math.max(1, best.likes + best.comments)) * 23)
      : null

  return (
    <article className="mp-card">
      <div className="mp-eyebrow purple">
        <span className="mp-eyebrow-dot" />
        {t('myPostsPage.eyebrowWinner')}
      </div>
      <h3 className="mp-headline mp-headline-sm" dir="auto">
        {best.caption || t('myPostsPage.winnerHeadline')}
      </h3>
      <p className="mp-headline-sub" dir="auto">{why}</p>

      <div className="mp-stats-row">
        {engagementPct !== null && (
          <span className="mp-stat">
            <span className="num">{fmtNum(engagementPct, isAr)}{pctSuffix(isAr)}</span>{' '}
            {t('myPostsPage.engagementPctLabel')}
          </span>
        )}
        <span className="mp-stat">
          <span className="num">{fmtNum(best.likes, isAr)}</span> {t('myPostsPage.likesUnit')}
        </span>
        <span className="mp-stat">
          <span className="num">{fmtNum(formatCount(best.likes * 22), isAr)}</span>{' '}
          {t('myPostsPage.reachUnit')}
        </span>
      </div>

      <div className="mp-cta-row">
        <button
          className="mp-cta mp-cta-primary"
          onClick={() => onGenerateCaption()}
          disabled={generate.isPending}
        >
          <Icon path={I.wand} size={14} />
          {generate.isPending
            ? t('myPostsPage.generating')
            : t('myPostsPage.generateSimilarCaption')}
        </button>
        {best.permalink && (
          <a
            className="mp-cta mp-cta-dark"
            href={best.permalink}
            target="_blank"
            rel="noreferrer"
          >
            {t('myPostsPage.viewPostCta')}
            <Icon path={I.chevR} size={11} />
          </a>
        )}
      </div>

      {generated && (
        <div className="mp-cap-block">
          <div className="mp-cap-head">
            <span>{t('myPostsPage.suggestedCaptionLabel')}</span>
            <div className="mp-cap-actions">
              <div className="mp-cap-langtoggle" role="tablist">
                <button
                  className={captionLang === 'en' ? 'is-on' : ''}
                  onClick={() => switchLang('en')}
                >
                  {t('myPostsPage.captionLanguageEN')}
                </button>
                <button
                  className={captionLang === 'ar' ? 'is-on' : ''}
                  onClick={() => switchLang('ar')}
                >
                  {t('myPostsPage.captionLanguageAR')}
                </button>
              </div>
              <button className="mp-cap-lang" onClick={copyCaption}>
                <Icon path={I.copy} size={10} />
                {copied ? t('myPostsPage.copied') : t('myPostsPage.copyCaption')}
              </button>
            </div>
          </div>
          <div className="mp-cap-text" dir={captionLang === 'ar' ? 'rtl' : 'ltr'}>
            {captionParts.body}
          </div>
          {captionParts.tags && (
            <div className="mp-cap-tags" dir={captionLang === 'ar' ? 'rtl' : 'ltr'}>
              {captionParts.tags}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Card C — Weakness pattern                                          */
/* ------------------------------------------------------------------ */

function WeaknessCard() {
  const { t } = useTranslation()
  const { data } = usePostsInsights()
  const pattern = (data?.low_performers_pattern || '').trim() || t('myPostsPage.changeFallback')
  const change = (data?.what_to_change || '').trim() || t('myPostsPage.changeFallback')

  return (
    <article className="mp-card">
      <div className="mp-eyebrow amber">
        <span className="mp-eyebrow-dot" />
        {t('myPostsPage.eyebrowWeakness')}
      </div>
      <h3 className="mp-headline" dir="auto">{t('myPostsPage.weaknessHeadline')}</h3>
      <p className="mp-headline-sub" dir="auto">{pattern}</p>
      <div className="mp-quote mp-quote--tip">
        <div className="mp-quote-label">{t('myPostsPage.weaknessTipTitle')}</div>
        <p dir="auto">{change}</p>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Card D — Top posts ranking                                         */
/* ------------------------------------------------------------------ */

type FilterKey = 'all' | ContentTypeKey

function TopPostsRanking({ isAr, range }: { isAr: boolean; range: '7d' | '30d' | '90d' }) {
  const { t } = useTranslation()
  const { data: rawPosts } = useTopPosts(20)
  const [filter, setFilter] = useState<FilterKey>('all')
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30

  const ranked = useMemo(() => {
    const posts = rawPosts ?? []
    const filtered =
      filter === 'all'
        ? posts
        : posts.filter((p: TopPost) => normalizeContentType(p.content_type) === filter)
    if (filtered.length === 0) return []
    const top = Math.max(
      1,
      ...filtered.map((p: TopPost) => p.likes + p.comments),
    )
    return filtered.slice(0, 5).map((p: TopPost) => ({
      ...p,
      type: normalizeContentType(p.content_type),
      pct: Math.round(((p.likes + p.comments) / top) * 100),
    }))
  }, [rawPosts, filter])

  const filterPills: { key: FilterKey; labelKey: string }[] = [
    { key: 'all', labelKey: 'myPostsPage.rankingsFilterAll' },
    { key: 'video', labelKey: 'myPostsPage.rankingsFilterVideo' },
    { key: 'image', labelKey: 'myPostsPage.rankingsFilterImage' },
    { key: 'carousel', labelKey: 'myPostsPage.rankingsFilterCarousel' },
  ]

  const tintFor = (type: ContentTypeKey) =>
    type === 'video' ? 'var(--video-tone)' : type === 'image' ? 'var(--image-tone)' : 'var(--carousel-tone)'
  const colorFor = (type: ContentTypeKey) =>
    type === 'video' ? 'var(--video)' : type === 'image' ? 'var(--image)' : 'var(--carousel)'

  return (
    <article className="mp-card">
      <div className="mp-rank-head">
        <div>
          <h3 className="mp-card-title">{t('myPostsPage.rankingsTitle')}</h3>
          <p className="mp-card-subtitle">
            {t('myPostsPage.rankingsSubtitle', { days: fmtNum(days, isAr) })}
          </p>
        </div>
        <div className="mp-rank-filter">
          {filterPills.map(({ key, labelKey }) => (
            <button
              key={key}
              className={filter === key ? 'is-on' : ''}
              onClick={() => setFilter(key)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="mp-empty">{t('myPostsPage.rankingsEmpty')}</div>
      ) : (
        <ol className="mp-rank-list">
          {ranked.map((p, i) => {
            // Thresholded color per the reference: green when ≥15% engagement,
            // red otherwise. Drives both the % label and the bar fill.
            const isStrong = p.pct >= 15
            return (
              <li key={p.id} className="mp-rank-row">
                <div className="mp-rank-meta">
                  <div className="mp-rank-meta-top">
                    <div className="mp-rank-meta-tags" dir="auto">
                      <span className={`mp-rank-pct num ${isStrong ? 'is-strong' : 'is-weak'}`}>
                        {fmtNum(p.pct, isAr)}{pctSuffix(isAr)}
                      </span>
                      <span className="mp-rank-date">{formatPostDate(p.posted_at, isAr)}</span>
                      <span className="mp-rank-meta-sep">·</span>
                      <span className="mp-rank-type">
                        <TypeIcon type={p.type} size={10} />
                        {p.type === 'video'
                          ? t('myPostsPage.videoLabel')
                          : p.type === 'image'
                            ? t('myPostsPage.imageLabel')
                            : t('myPostsPage.carouselLabel')}
                      </span>
                    </div>
                    <span className="mp-rank-num num">{fmtNum(i + 1, isAr)}</span>
                  </div>
                  <p className="mp-rank-caption" dir="auto">
                    {truncateCaption(p.caption || t('myPostsPage.bestEmpty'), 56)}
                  </p>
                  <div className="mp-rank-bar" dir="ltr">
                    <div
                      className={`mp-rank-bar-fill ${isStrong ? 'is-strong' : 'is-weak'}`}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                </div>
                <div
                  className="mp-rank-thumb"
                  style={{
                    background: p.thumbnail_url
                      ? `center / cover no-repeat url(${p.thumbnail_url})`
                      : `linear-gradient(135deg, ${tintFor(p.type)}, color-mix(in oklch, ${colorFor(p.type)} 30%, white))`,
                  }}
                  aria-hidden="true"
                />
              </li>
            )
          })}
        </ol>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Card E — Content distribution (stacked bar)                        */
/* ------------------------------------------------------------------ */

function ContentDistribution({ isAr, range }: { isAr: boolean; range: '7d' | '30d' | '90d' }) {
  const { t } = useTranslation()
  const { data } = usePostsBreakdown()
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30

  const segments = useMemo(() => {
    if (!data?.by_type?.length) return []
    const merged = data.by_type.reduce<Record<ContentTypeKey, number>>(
      (acc, b) => {
        const k = normalizeContentType(b.content_type)
        acc[k] = (acc[k] || 0) + b.count
        return acc
      },
      { video: 0, image: 0, carousel: 0 },
    )
    const total = Object.values(merged).reduce((s, n) => s + n, 0)
    if (total === 0) return []
    return (['video', 'image', 'carousel'] as ContentTypeKey[])
      .filter((k) => merged[k] > 0)
      .map((k) => ({ type: k, count: merged[k], pct: Math.round((merged[k] / total) * 100) }))
  }, [data])

  const typeLabel = (k: ContentTypeKey) =>
    k === 'video' ? t('myPostsPage.videoLabel') : k === 'image' ? t('myPostsPage.imageLabel') : t('myPostsPage.carouselLabel')

  const colorFor = (type: ContentTypeKey) =>
    type === 'video' ? 'var(--video)' : type === 'image' ? 'var(--image)' : 'var(--carousel)'

  return (
    <article className="mp-card">
      <h3 className="mp-card-title">{t('myPostsPage.distributionTitle')}</h3>
      <p className="mp-card-subtitle">
        {t('myPostsPage.distributionSubtitle', { days: fmtNum(days, isAr) })}
      </p>

      {segments.length === 0 ? (
        <div className="mp-empty">{t('myPostsPage.bestEmpty')}</div>
      ) : (
        <>
          <div className="mp-dist-bar" dir="ltr">
            {segments.map((s) => (
              <div
                key={s.type}
                className="mp-dist-seg"
                style={{ width: `${s.pct}%`, background: colorFor(s.type) }}
                title={`${typeLabel(s.type)} ${s.pct}%`}
              />
            ))}
          </div>
          <div className="mp-dist-legend">
            {segments.map((s) => (
              <span key={s.type} className="mp-leg">
                <span className="mp-leg-dot" style={{ background: colorFor(s.type) }} />
                {typeLabel(s.type)}
                <span className="mp-leg-n num">{fmtNum(s.pct, isAr)}{pctSuffix(isAr)}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Analytics() {
  const { i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar') ?? false
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')

  return (
    <div className="rd-canvas">
      <div className="mp-main">
        <Header range={range} setRange={setRange} isAr={isAr} />

        <div className="mp-grid-2">
          <div className="mp-col-left">
            <EngagementInsightCard isAr={isAr} />
            <WinnerCard isAr={isAr} />
            <WeaknessCard />
          </div>
          <div className="mp-col-right">
            <TopPostsRanking isAr={isAr} range={range} />
            <ContentDistribution isAr={isAr} range={range} />
          </div>
        </div>
      </div>
      <style>{MP_STYLES}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const MP_STYLES = `
.mp-main { display:flex; flex-direction:column; gap:22px; max-width:1480px; margin:0 auto; }

/* Header */
.mp-head { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; flex-wrap:wrap; }
.mp-head h1 { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1.15; margin-bottom:6px; }
.mp-sub { font-size:13.5px; color:var(--ink-500); max-width:560px; line-height:1.55; }
.mp-range { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.mp-range button { padding:7px 14px; font-size:12.5px; font-weight:500; border-radius:7px; color:var(--ink-600); }
.mp-range button.is-on { background:var(--surface); color:var(--ink-900); box-shadow:var(--shadow-sm); font-weight:600; }

/* 2-column grid — rankings/distribution column gets slightly more horizontal
 * space than the insight stack so 5 ranking rows + a stacked distribution bar
 * have room to breathe. Equal-ish (1 : 1.05) so the insight cards don't feel
 * crowded either. */
.mp-grid-2 { display:grid; grid-template-columns:1fr 1.05fr; gap:18px; align-items:flex-start; }
@media (max-width:1024px) { .mp-grid-2 { grid-template-columns:1fr; } }
.mp-col-left, .mp-col-right { display:flex; flex-direction:column; gap:18px; }

/* Card primitive */
.mp-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:24px; display:flex; flex-direction:column; gap:14px; }
.mp-card-title { font-size:15px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }
.mp-card-subtitle { font-size:12px; color:var(--ink-500); margin-top:-8px; }
.mp-loading { padding:48px 0; text-align:center; color:var(--ink-500); font-size:13px; }
.mp-empty { padding:32px 0; text-align:center; color:var(--ink-500); font-size:13px; }

/* Eyebrow line — small label above each insight card. Default purple,
 * .amber for weakness. Dot color follows. */
.mp-eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:11px; font-weight:600; color:var(--purple-700); letter-spacing:0.02em; }
.mp-eyebrow em { font-style:normal; color:var(--purple-700); font-weight:700; }
.mp-eyebrow.purple { color:var(--purple-700); }
.mp-eyebrow.amber { color:oklch(0.55 0.15 60); }
.mp-eyebrow.amber em { color:oklch(0.55 0.15 60); }
.mp-eyebrow-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }

/* Headline + subtitle inside an insight card. */
.mp-headline { font-size:22px; font-weight:700; color:var(--ink-950); letter-spacing:-0.015em; line-height:1.25; }
.mp-headline-sm { font-size:17px; line-height:1.4; }
.mp-headline-sub { font-size:13.5px; color:var(--ink-700); line-height:1.65; }

/* By-type chart inside Card A */
.mp-chart { display:flex; flex-direction:column; gap:10px; margin-top:4px; }
.mp-bar-row { display:grid; grid-template-columns:90px 1fr 56px; align-items:center; gap:14px; }
.mp-bar-label { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--ink-800); }
.mp-bar-label svg { color:var(--ink-600); }
.mp-bar-track { position:relative; height:12px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
.mp-bar-fill { position:absolute; inset:0 auto 0 0; height:100%; border-radius:99px; transition:width 0.4s cubic-bezier(.2,.8,.2,1); }
.mp-bar-val { font-size:12.5px; font-weight:700; color:var(--ink-900); letter-spacing:-0.01em; text-align:end; }

/* Winner stats row + CTAs */
.mp-stats-row { display:flex; gap:16px; flex-wrap:wrap; padding:10px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.mp-stat { font-size:12px; color:var(--ink-600); font-weight:500; }
.mp-stat .num { font-size:14px; font-weight:700; color:var(--ink-950); margin-inline-end:4px; }
.mp-cta-row { display:flex; gap:8px; flex-wrap:wrap; }
.mp-cta { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:10px 14px; border-radius:10px; font-size:12.5px; font-weight:600; transition:background .15s, transform .15s; flex:1; min-width:140px; }
.mp-cta-primary { background:var(--purple-600); color:#fff; box-shadow:0 6px 16px -6px rgba(99, 65, 224, .55); }
.mp-cta-primary:hover:not(:disabled) { background:var(--purple-700); transform:translateY(-1px); }
.mp-cta-primary:disabled { opacity:.7; cursor:not-allowed; }
.mp-cta-dark { background:var(--ink-900); color:#fff; }
.mp-cta-dark:hover { background:var(--purple-700); }

/* Caption block (after Generate similar caption) */
.mp-cap-block { background:var(--purple-50); border:1px solid var(--purple-200); border-radius:12px; padding:14px; }
.mp-cap-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:11px; font-weight:700; color:var(--purple-800); gap:10px; flex-wrap:wrap; }
.mp-cap-actions { display:flex; align-items:center; gap:6px; }
.mp-cap-langtoggle { display:flex; background:var(--surface); border:1px solid var(--purple-200); border-radius:7px; padding:2px; }
.mp-cap-langtoggle button { padding:3px 9px; font-size:11px; font-weight:500; border-radius:5px; color:var(--purple-700); }
.mp-cap-langtoggle button.is-on { background:var(--purple-600); color:#fff; font-weight:600; }
.mp-cap-lang { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:500; color:var(--purple-700); padding:3px 8px; border-radius:6px; }
.mp-cap-lang:hover { background:var(--purple-100); }
.mp-cap-text { font-size:13.5px; color:var(--ink-900); line-height:1.65; font-weight:500; }
.mp-cap-tags { margin-top:8px; font-size:12.5px; color:var(--purple-700); font-weight:500; line-height:1.6; word-break:break-word; }

/* Weakness tip block */
.mp-quote { padding:14px 16px; border-radius:12px; font-size:13.5px; line-height:1.7; color:var(--ink-800); background:var(--ink-50); }
.mp-quote-label { font-size:10.5px; font-weight:700; letter-spacing:0.02em; margin-bottom:6px; color:var(--ink-700); }
.mp-quote--tip { background:var(--ink-50); }

/* Card D — Rankings */
.mp-rank-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
/* Individual pill buttons (no segmented track). Active pill gets a tinted
 * purple background; inactive pills are plain text with a subtle hover.
 * Matches the mockup exactly. */
.mp-rank-filter { display:flex; gap:4px; }
.mp-rank-filter button { padding:6px 12px; font-size:12px; font-weight:500; border-radius:99px; color:var(--ink-600); background:transparent; transition:background .15s, color .15s; }
.mp-rank-filter button:hover { background:var(--ink-50); color:var(--ink-800); }
.mp-rank-filter button.is-on { background:var(--purple-100); color:var(--purple-700); font-weight:600; }

.mp-rank-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:20px; }
/* Single-row flex: meta column (flex:1) + thumb (48px). The bar lives at the
 * BOTTOM of the meta column spanning its full width, with caption above and
 * the meta-top header (% · date · type · rank#) above the caption. */
.mp-rank-row { display:flex; align-items:center; gap:12px; }
.mp-rank-meta { flex:1; min-width:0; display:flex; flex-direction:column; gap:6px; }
/* Meta header: tag cluster (pct+date+type) on one side, rank# pushed to the
 * other end via justify-between. */
.mp-rank-meta-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.mp-rank-meta-tags { display:flex; align-items:center; gap:8px; min-width:0; flex-wrap:wrap; }
.mp-rank-pct { font-size:13px; font-weight:700; letter-spacing:-0.01em; }
.mp-rank-pct.is-strong { color:oklch(0.55 0.15 155); }
.mp-rank-pct.is-weak { color:oklch(0.6 0.2 30); }
.mp-rank-date { font-size:11.5px; color:var(--ink-400); font-weight:500; }
.mp-rank-meta-sep { color:var(--ink-300); font-size:10px; }
.mp-rank-type { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:var(--ink-400); font-weight:500; }
.mp-rank-type svg { color:var(--ink-400); }
.mp-rank-num { font-size:13px; font-weight:500; color:var(--ink-300); }
.mp-rank-caption { font-size:13.5px; font-weight:500; color:var(--ink-700); line-height:1.4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mp-rank-bar { height:6px; background:var(--ink-100); border-radius:99px; overflow:hidden; width:100%; }
.mp-rank-bar-fill { height:100%; border-radius:99px; transition:width 0.4s cubic-bezier(.2,.8,.2,1); }
.mp-rank-bar-fill.is-strong { background:oklch(0.65 0.15 155); }
.mp-rank-bar-fill.is-weak { background:oklch(0.7 0.18 30); }
.mp-rank-thumb { width:48px; height:48px; border-radius:12px; background-size:cover; background-position:center; flex-shrink:0; }

/* Card E — Distribution */
.mp-dist-bar { display:flex; height:14px; border-radius:99px; overflow:hidden; background:var(--ink-100); }
.mp-dist-seg { height:100%; transition:width 0.4s cubic-bezier(.2,.8,.2,1); }
/* Legend stays on a single line — never wrap mid-item, allow horizontal
 * scroll if the card is too narrow rather than stacking each legend entry
 * on its own row. */
.mp-dist-legend { display:flex; gap:14px; margin-top:6px; flex-wrap:nowrap; overflow:hidden; }
.mp-leg { display:inline-flex; align-items:center; gap:7px; font-size:12px; color:var(--ink-700); font-weight:500; white-space:nowrap; flex-shrink:0; }
.mp-leg-dot { width:10px; height:10px; border-radius:3px; flex-shrink:0; }
.mp-leg-n { color:var(--ink-900); font-weight:700; margin-inline-start:2px; }

/* RTL flip on chevrons in CTAs */
[dir="rtl"] .mp-cta svg,
[dir="rtl"] .mp-cap-share svg { transform:scaleX(-1); }
`
