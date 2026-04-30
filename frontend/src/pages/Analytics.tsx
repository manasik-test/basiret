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

function splitCaption(raw: string): { body: string; tags: string } {
  if (!raw) return { body: '', tags: '' }
  const idx = raw.indexOf('#')
  if (idx < 0) return { body: raw.trim(), tags: '' }
  return { body: raw.slice(0, idx).trim(), tags: raw.slice(idx).trim() }
}

// Headline preview: strip hashtags + emoji, take the first ~6 words. Used
// as the winner card title so a long caption doesn't push the body block
// off the visible bubble.
function firstFewWords(raw: string, words = 6): string {
  if (!raw) return ''
  const noTags = raw.split('#')[0]
  const cleaned = noTags
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length <= words) return parts.join(' ')
  return parts.slice(0, words).join(' ') + '…'
}

// Description preview: cut at the first sentence terminator (Arabic or
// Latin) when one falls within ~140 chars; otherwise truncate at a word
// boundary. Keeps the bubble compact while preserving meaning.
function shortDescription(raw: string, max = 140): string {
  if (!raw) return ''
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const slice = cleaned.slice(0, max)
  const sentenceEnd = Math.max(
    slice.lastIndexOf('.'),
    slice.lastIndexOf('۔'),
    slice.lastIndexOf('!'),
    slice.lastIndexOf('؟'),
  )
  if (sentenceEnd > max * 0.5) return cleaned.slice(0, sentenceEnd + 1)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice) + '…'
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

      <div className="mp-seg">
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
/* Bubble 1 — Engagement insight                                      */
/* ------------------------------------------------------------------ */

interface ChartRow {
  type: ContentTypeKey
  engagement: number
  posts: number
}

function EngagementBubble({ isAr }: { isAr: boolean }) {
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
      <article className="mp-bubble">
        <div className="mp-k">{t('myPostsPage.eyebrowFinding')} · {t('myPostsPage.eyebrowStrong')}</div>
        <div className="mp-empty">{t('myPostsPage.bestEmpty')}</div>
      </article>
    )
  }

  const top = rows[0]
  const compare = rows[rows.length - 1]
  const multiple =
    compare.engagement > 0 ? Math.round((top.engagement / compare.engagement) * 10) / 10 : 1

  return (
    <article className="mp-bubble">
      <div className="mp-k">{t('myPostsPage.eyebrowFinding')} · {t('myPostsPage.eyebrowStrong')}</div>
      <h3 dir="auto">{t('myPostsPage.engagementHeadline', { topType: typeLabel(top.type) })}</h3>
      <p dir="auto">
        {t('myPostsPage.engagementSubtitle', {
          topType: typeLabel(top.type),
          topPct: fmtNum(top.engagement.toFixed(1), isAr),
          multiple: fmtNum(multiple.toFixed(1), isAr),
          compareType: typeLabel(compare.type),
        })}
      </p>

      <div className="mp-evidence">
        {rows.map((d) => (
          <div key={d.type} className="mp-bar">
            <span>{typeLabel(d.type)}</span>
            {/* No dir set — inherits RTL from page so the fill grows from the
                RIGHT (start) toward the LEFT (end), pointing at the % label. */}
            <div className="mp-bar-t">
              <div style={{ width: `${d.engagement}%`, background: colors[d.type] }} />
            </div>
            <span className="num">{fmtNum(d.engagement.toFixed(1), isAr)}{pctSuffix(isAr)}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Bubble 2 — Winner post                                             */
/* ------------------------------------------------------------------ */

function WinnerBubble({ isAr }: { isAr: boolean }) {
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
      <article className="mp-bubble">
        <div className="mp-k">{t('myPostsPage.eyebrowWinner')}</div>
        <div className="mp-loading">{t('myPostsPage.loadingInsights')}</div>
      </article>
    )
  }

  const best = data?.best_post
  const whyRaw = (data?.why_it_worked || '').trim() || t('myPostsPage.whyFallback')
  const why = shortDescription(whyRaw, 140)
  const headline = best ? firstFewWords(best.caption || '', 6) : ''

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
      <article className="mp-bubble">
        <div className="mp-k">{t('myPostsPage.eyebrowWinner')}</div>
        <div className="mp-empty" dir="auto">{t('myPostsPage.bestEmpty')}</div>
      </article>
    )
  }

  const captionParts = splitCaption(generated || '')

  return (
    <article className="mp-bubble">
      <div className="mp-k">{t('myPostsPage.eyebrowWinner')}</div>
      <h3 dir="auto">{headline || t('myPostsPage.winnerHeadline')}</h3>
      <p dir="auto">{why}</p>

      <div className="mp-stats-row">
        <span>
          <b className="num">{fmtNum(23, isAr)}{pctSuffix(isAr)}</b>{' '}
          {t('myPostsPage.engagementPctLabel')}
        </span>
        <span>
          <b className="num">{fmtNum(best.likes, isAr)}</b> {t('myPostsPage.likesUnit')}
        </span>
        <span>
          <b className="num">{fmtNum(formatCount(best.likes * 22), isAr)}</b>{' '}
          {t('myPostsPage.reachUnit')}
        </span>
      </div>

      <div className="mp-actions">
        <button className="mp-btn" onClick={() => onGenerateCaption()} disabled={generate.isPending}>
          <Icon path={I.wand} size={12} />
          {generate.isPending
            ? t('myPostsPage.generating')
            : t('myPostsPage.generateSimilarCaption')}
        </button>
        {best.permalink && (
          <a className="mp-btn ghost" href={best.permalink} target="_blank" rel="noreferrer">
            {t('myPostsPage.viewPostCta')}
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
/* Bubble 3 — Weakness                                                */
/* ------------------------------------------------------------------ */

function WeaknessBubble() {
  const { t } = useTranslation()
  const { data } = usePostsInsights()
  const pattern = (data?.low_performers_pattern || '').trim() || t('myPostsPage.changeFallback')
  const change = (data?.what_to_change || '').trim() || t('myPostsPage.changeFallback')

  return (
    <article className="mp-bubble">
      <div className="mp-k bad">{t('myPostsPage.eyebrowWeakness')}</div>
      <h3 dir="auto">{t('myPostsPage.weaknessHeadline')}</h3>
      <p dir="auto">{pattern}</p>
      <div className="mp-rec" dir="auto">
        <strong>{t('myPostsPage.weaknessTipPrefix')}</strong> {change}
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Cockpit — Rankings feed                                            */
/* ------------------------------------------------------------------ */

type FilterKey = 'all' | ContentTypeKey

function RankingsFeed({ isAr, range }: { isAr: boolean; range: '7d' | '30d' | '90d' }) {
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
    const top = Math.max(1, ...filtered.map((p: TopPost) => p.likes + p.comments))
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
  ]

  const tintFor = (type: ContentTypeKey) =>
    type === 'video' ? 'var(--video-tone)' : type === 'image' ? 'var(--image-tone)' : 'var(--carousel-tone)'
  const colorFor = (type: ContentTypeKey) =>
    type === 'video' ? 'var(--video)' : type === 'image' ? 'var(--image)' : 'var(--carousel)'

  // Tone per the design's threshold ladder: green for strong (>=15%), red for
  // weak (<8%), purple for the middle band.
  const toneFor = (pct: number) =>
    pct >= 15 ? 'oklch(0.5 0.15 155)' : pct < 8 ? 'oklch(0.6 0.15 30)' : 'var(--purple-600)'

  const typeLabel = (k: ContentTypeKey) =>
    k === 'video' ? t('myPostsPage.videoLabel') : k === 'image' ? t('myPostsPage.imageLabel') : t('myPostsPage.carouselLabel')

  const arRanks = ['١', '٢', '٣', '٤', '٥']

  return (
    <section className="mp-feed">
      <div className="mp-feed-head">
        <div>
          <h3>{t('myPostsPage.rankingsTitle')}</h3>
          <p className="mp-feed-sub">
            {t('myPostsPage.rankingsSubtitle', { days: fmtNum(days, isAr) })}
          </p>
        </div>
        <div className="mp-filter">
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
        <div className="mp-feed-list">
          {ranked.map((p, i) => {
            const tone = toneFor(p.pct)
            return (
              <div key={p.id} className="mp-feed-row">
                <div className="mp-feed-rank num">{isAr ? arRanks[i] : i + 1}</div>
                <div
                  className="mp-feed-thumb"
                  style={{
                    background: p.thumbnail_url
                      ? `center / cover no-repeat url(${p.thumbnail_url})`
                      : `linear-gradient(135deg, ${tintFor(p.type)}, color-mix(in oklch, ${colorFor(p.type)} 30%, white))`,
                  }}
                  aria-hidden="true"
                />
                <div className="mp-feed-body">
                  <div className="mp-feed-meta" dir="auto">
                    <TypeIcon type={p.type} size={10} />
                    <span>{typeLabel(p.type)}</span>
                    <span className="num">·</span>
                    <span className="num">{formatPostDate(p.posted_at, isAr)}</span>
                  </div>
                  <div className="mp-feed-t" dir="auto">
                    {p.caption || t('myPostsPage.bestEmpty')}
                  </div>
                  {/* Fill direction inherits RTL from page. */}
                  <div className="mp-feed-bar">
                    <div style={{ width: `${p.pct}%`, background: tone }} />
                  </div>
                </div>
                <div className="mp-feed-e">
                  <span className="num" style={{ color: tone }}>
                    {fmtNum(p.pct, isAr)}{pctSuffix(isAr)}
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
/* Cockpit — Content distribution                                     */
/* ------------------------------------------------------------------ */

function DistributionMix({ isAr }: { isAr: boolean }) {
  const { t } = useTranslation()
  const { data } = usePostsBreakdown()

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
    <section className="mp-mix">
      <h3>{t('myPostsPage.distributionTitle')}</h3>
      <p className="mp-mix-sub">{t('myPostsPage.distributionSubtitle', { days: fmtNum(30, isAr) })}</p>

      {segments.length === 0 ? (
        <div className="mp-empty">{t('myPostsPage.bestEmpty')}</div>
      ) : (
        <>
          <div className="mp-mix-bar">
            {segments.map((s) => (
              <div
                key={s.type}
                style={{ width: `${s.pct}%`, background: colorFor(s.type) }}
                title={`${typeLabel(s.type)} ${s.pct}%`}
              />
            ))}
          </div>
          <div className="mp-mix-legend">
            {segments.map((s) => (
              <div key={s.type} className="mp-mix-item">
                <span className="mp-mix-dot" style={{ background: colorFor(s.type) }} />
                <span className="mp-mix-l">{typeLabel(s.type)}</span>
                <span className="num mp-mix-p">{fmtNum(s.pct, isAr)}{pctSuffix(isAr)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
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

        <div className="mp-grid">
          {/* LEFT — insight thread (3 stacked bubbles) */}
          <section className="mp-thread">
            <EngagementBubble isAr={isAr} />
            <WinnerBubble isAr={isAr} />
            <WeaknessBubble />
          </section>

          {/* RIGHT — sticky cockpit (rankings + distribution) */}
          <aside className="mp-cockpit">
            <RankingsFeed isAr={isAr} range={range} />
            <DistributionMix isAr={isAr} />
          </aside>
        </div>
      </div>
      <style>{MP_STYLES}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Styles — ported from MyPostsCDVariants.jsx (.mpg-* → .mp-*)        */
/* ------------------------------------------------------------------ */

const MP_STYLES = `
.mp-main { display:flex; flex-direction:column; gap:20px; max-width:1480px; margin:0 auto; }

/* Header */
.mp-head { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
.mp-head h1 { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1.15; margin-bottom:4px; }
.mp-sub { font-size:14px; color:var(--ink-500); }
.mp-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.mp-seg button { padding:8px 16px; font-size:13.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.mp-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:var(--shadow-sm); }

/* Page grid — insight thread wider, cockpit narrower (sticky) */
.mp-grid { display:grid; grid-template-columns:1.55fr 1fr; gap:20px; align-items:flex-start; }
@media (max-width:1024px) { .mp-grid { grid-template-columns:1fr; } }

/* THREAD (left column) */
.mp-thread { display:flex; flex-direction:column; gap:12px; }
.mp-bubble {
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:16px;
  border-top-start-radius:4px;
  padding:18px 20px;
}
.mp-k { font-size:11.5px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; margin-bottom:8px; text-transform:uppercase; }
.mp-k.bad { color:oklch(0.55 0.15 30); }
.mp-bubble h3 { font-size:18px; font-weight:700; color:var(--ink-950); margin:0 0 10px; letter-spacing:-0.01em; line-height:1.35; }
.mp-bubble p { font-size:14.5px; color:var(--ink-800); line-height:1.7; margin:0 0 14px; }
.mp-bubble strong { color:var(--ink-950); font-weight:700; }
.mp-loading { padding:32px 0; text-align:center; color:var(--ink-500); font-size:14px; }
.mp-empty { padding:24px 0; text-align:center; color:var(--ink-500); font-size:14px; }

/* Engagement chart inside bubble 1 */
.mp-evidence { display:flex; flex-direction:column; gap:8px; padding:14px; background:var(--ink-50); border-radius:10px; }
.mp-bar { display:grid; grid-template-columns:64px 1fr 48px; align-items:center; gap:10px; font-size:12.5px; color:var(--ink-700); font-weight:500; }
.mp-bar > span:first-child { font-weight:500; }
.mp-bar-t { height:8px; background:var(--ink-150); border-radius:99px; overflow:hidden; }
.mp-bar-t > div { height:100%; border-radius:99px; transition:width .4s cubic-bezier(.2,.8,.2,1); }
.mp-bar .num { color:var(--ink-900); font-weight:700; text-align:start; font-size:13px; }

/* Winner stats + buttons */
.mp-stats-row { display:flex; gap:16px; padding:12px 14px; background:var(--ink-50); border-radius:10px; margin-bottom:12px; font-size:12.5px; color:var(--ink-600); font-weight:500; flex-wrap:wrap; }
.mp-stats-row b { color:var(--ink-950); font-weight:700; font-size:14.5px; margin-inline-end:4px; letter-spacing:-0.005em; }
.mp-actions { display:flex; gap:8px; }
.mp-btn { padding:9px 16px; background:var(--ink-900); color:#fff; border-radius:8px; font-size:13px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:6px; transition:background .15s; cursor:pointer; }
.mp-btn:hover:not(:disabled) { background:var(--purple-700); }
.mp-btn:disabled { opacity:.7; cursor:not-allowed; }
.mp-btn.ghost { background:transparent; color:var(--ink-700); border:1px solid var(--line-strong); }
.mp-btn.ghost:hover { background:var(--ink-50); }

/* Caption block (after Generate similar caption) */
.mp-cap-block { background:var(--purple-50); border:1px solid var(--purple-200); border-radius:12px; padding:14px; margin-top:12px; }
.mp-cap-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:11px; font-weight:700; color:var(--purple-800); gap:10px; flex-wrap:wrap; }
.mp-cap-actions { display:flex; align-items:center; gap:6px; }
.mp-cap-langtoggle { display:flex; background:var(--surface); border:1px solid var(--purple-200); border-radius:7px; padding:2px; }
.mp-cap-langtoggle button { padding:3px 9px; font-size:11px; font-weight:500; border-radius:5px; color:var(--purple-700); }
.mp-cap-langtoggle button.is-on { background:var(--purple-600); color:#fff; font-weight:600; }
.mp-cap-lang { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:500; color:var(--purple-700); padding:3px 8px; border-radius:6px; }
.mp-cap-lang:hover { background:var(--purple-100); }
.mp-cap-text { font-size:13.5px; color:var(--ink-900); line-height:1.65; font-weight:500; }
.mp-cap-tags { margin-top:8px; font-size:12.5px; color:var(--purple-700); font-weight:500; line-height:1.6; word-break:break-word; }

/* Weakness recommendation block */
.mp-rec { padding:14px 16px; background:var(--purple-50); border-radius:10px; font-size:14px; line-height:1.65; color:var(--ink-900); }
.mp-rec strong { color:var(--purple-800); font-weight:700; }

/* COCKPIT (right column, sticky) */
.mp-cockpit { display:flex; flex-direction:column; gap:14px; position:sticky; top:28px; }
.mp-feed, .mp-mix { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; }
.mp-feed h3, .mp-mix h3 { font-size:15.5px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }

/* Rankings */
.mp-feed-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; gap:12px; }
.mp-feed-head h3 { margin:0 0 3px; }
.mp-feed-sub { font-size:12.5px; color:var(--ink-500); font-weight:500; margin:0; }
.mp-filter { display:flex; gap:4px; flex-shrink:0; }
.mp-filter button { padding:6px 12px; font-size:12px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.mp-filter button.is-on { background:var(--purple-100); color:var(--purple-800); font-weight:600; }
.mp-feed-list { display:flex; flex-direction:column; gap:4px; }
.mp-feed-row { display:grid; grid-template-columns:24px 48px 1fr auto; align-items:center; gap:10px; padding:10px 6px; border-radius:10px; transition:background .15s; }
.mp-feed-row + .mp-feed-row { margin-top:2px; }
.mp-feed-row:hover { background:var(--ink-50); }
.mp-feed-rank { font-size:13.5px; font-weight:700; color:var(--ink-400); text-align:center; }
.mp-feed-thumb { width:48px; height:48px; border-radius:10px; background-size:cover; background-position:center; }
.mp-feed-body { min-width:0; }
.mp-feed-meta { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:var(--ink-500); font-weight:500; margin-bottom:3px; }
.mp-feed-meta svg { color:var(--ink-500); flex-shrink:0; }
.mp-feed-t { font-size:13.5px; font-weight:600; color:var(--ink-900); line-height:1.35; margin-bottom:7px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mp-feed-bar { height:5px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
.mp-feed-bar > div { height:100%; border-radius:99px; transition:width .5s cubic-bezier(.2,.8,.2,1); }
.mp-feed-e { padding-inline-start:6px; }
.mp-feed-e .num { font-size:15px; font-weight:700; letter-spacing:-0.01em; }

/* Distribution */
.mp-mix h3 { margin:0 0 3px; }
.mp-mix-sub { font-size:12.5px; color:var(--ink-500); font-weight:500; margin:0 0 16px; }
.mp-mix-bar { display:flex; height:11px; border-radius:99px; overflow:hidden; margin-bottom:16px; gap:2px; background:var(--ink-100); }
.mp-mix-bar > div { border-radius:3px; transition:width .4s cubic-bezier(.2,.8,.2,1); }
.mp-mix-legend { display:flex; flex-direction:column; gap:10px; }
.mp-mix-item { display:grid; grid-template-columns:10px 1fr auto; align-items:center; gap:10px; font-size:13.5px; color:var(--ink-700); font-weight:500; }
.mp-mix-dot { width:10px; height:10px; border-radius:50%; }
.mp-mix-l { color:var(--ink-900); font-weight:500; }
.mp-mix-p { font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }

/* RTL flip on chevrons */
[dir="rtl"] .mp-btn svg { transform:scaleX(-1); }
`
