import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  usePostsBreakdown,
  usePostsInsights,
  useGenerateCaption,
  useAccounts,
} from '../hooks/useAnalytics'
import { Icon, I, TypeIcon, TypePill, normalizeContentType } from '../components/redesign/icons'

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

function Header({
  range,
  setRange,
}: {
  range: '7d' | '30d' | '90d'
  setRange: (r: '7d' | '30d' | '90d') => void
}) {
  const { t } = useTranslation()
  return (
    <header className="mp-head">
      <div>
        <div className="mp-crumb">
          <span>{t('myPostsPage.breadcrumbDashboard')}</span>
          <Icon path={I.chevL} size={10} className="mp-crumb-arrow" />
          <span>{t('myPostsPage.breadcrumbCurrent')}</span>
        </div>
        <div className="mp-titlerow">
          <h1 dir="auto">{t('myPostsPage.headerTitle')}</h1>
          <span className="mp-badge">
            <span className="mp-dot" />
            {t('myPostsPage.last30days')}
          </span>
        </div>
        <p className="mp-sub" dir="auto">
          {t('myPostsPage.question')}
        </p>
      </div>

      <div className="mp-head-act">
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
        <button className="mp-export">
          <Icon path={I.pencil} size={13} />
          {t('myPostsPage.exportReport')}
        </button>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Two-card hero                                                      */
/* ------------------------------------------------------------------ */

// Split a generated caption on the first hashtag. Anything before the first
// `#` becomes the body; everything from the `#` onward becomes the tag tail
// rendered as a separate purple-toned line. Captions with no hashtags
// degrade to body-only.
function splitCaption(raw: string): { body: string; tags: string } {
  if (!raw) return { body: '', tags: '' }
  const idx = raw.indexOf('#')
  if (idx < 0) return { body: raw.trim(), tags: '' }
  return { body: raw.slice(0, idx).trim(), tags: raw.slice(idx).trim() }
}

function TwoCardHero() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = usePostsInsights()
  const { data: accounts } = useAccounts()
  const generate = useGenerateCaption()
  // Caption language is independent of UI language so users can A/B between
  // an English version and an Arabic version without changing their UI locale.
  const initialLang: 'en' | 'ar' = i18n.language?.startsWith('ar') ? 'ar' : 'en'
  const [captionLang, setCaptionLang] = useState<'en' | 'ar'>(initialLang)
  const [generated, setGenerated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const accountId = accounts?.[0]?.id

  if (isLoading) {
    return <div className="mp-card mp-loading">{t('myPostsPage.loadingInsights')}</div>
  }

  const best = data?.best_post
  const why = (data?.why_it_worked || '').trim() || t('myPostsPage.whyFallback')
  const pattern = (data?.low_performers_pattern || '').trim() || t('myPostsPage.changeFallback')
  const change = (data?.what_to_change || '').trim() || t('myPostsPage.changeFallback')

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
    setGenerated(null) // hide the stale caption while the new one streams in
    if (best) onGenerateCaption(next)
  }

  function copyCaption() {
    if (!generated) return
    void navigator.clipboard.writeText(generated)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const captionParts = splitCaption(generated || '')

  const bestType = normalizeContentType(best?.content_type)
  const typeLabelMap: Record<typeof bestType, string> = {
    video: t('myPostsPage.videoLabel'),
    image: t('myPostsPage.imageLabel'),
    carousel: t('myPostsPage.carouselLabel'),
  }

  return (
    <div className="mp-grid">
      {/* WARN — What to change */}
      <article className="mp-card mp-card--warn">
        <div className="mp-card-head">
          <div className="mp-card-icon mp-card-icon--warn">
            <Icon path={I.warn} size={16} />
          </div>
          <div>
            <h3>{t('myPostsPage.whatToChange')}</h3>
            <div className="mp-card-sub">{t('myPostsPage.whatToChangeSubtitle')}</div>
          </div>
        </div>
        <div className="mp-quote mp-quote--warn">
          <div className="mp-quote-label">{t('myPostsPage.patternInLowPerformers')}</div>
          <p dir="auto">{pattern}</p>
        </div>
        <div className="mp-quote mp-quote--tip">
          <div className="mp-quote-label">{t('myPostsPage.whatToDo')}</div>
          <p dir="auto">{change}</p>
        </div>
      </article>

      {/* GOOD — What worked */}
      <article className="mp-card mp-card--good">
        <div className="mp-card-head">
          <div className="mp-card-icon mp-card-icon--good">
            <Icon path={I.trend} size={16} />
          </div>
          <div>
            <h3>{t('myPostsPage.whatWorked')}</h3>
            <div className="mp-card-sub">{t('myPostsPage.whatWorkedSubtitle')}</div>
          </div>
        </div>

        {best ? (
          <>
            <div className="mp-post-preview">
              <div className="mp-post-meta">
                <TypePill type={bestType} label={typeLabelMap[bestType]} size="sm" />
                <span className="mp-post-stat num">
                  <Icon path={I.heart} size={11} /> {best.likes} {t('myPostsPage.likesUnit')}
                </span>
                <span className="mp-post-stat num">
                  {best.comments} {t('myPostsPage.commentsUnit')}
                </span>
              </div>
              <div className="mp-post-body" dir="auto">
                {best.caption}
              </div>
              {best.ocr_text && (
                <div className="mp-post-ocr" dir="auto">
                  {t('myPostsPage.ocrBadge')}: <span>{best.ocr_text}</span>
                </div>
              )}
            </div>

            <div className="mp-quote mp-quote--good">
              <div className="mp-quote-label">{t('myPostsPage.winnerReason')}</div>
              <p dir="auto">{why}</p>
            </div>

            <button className="mp-cta" onClick={() => onGenerateCaption()} disabled={generate.isPending}>
              <Icon path={I.wand} size={14} />
              {generate.isPending
                ? t('myPostsPage.generating')
                : t('myPostsPage.generateSimilarCaption')}
            </button>

            {generated && (
              <div className="mp-cap-block">
                <div className="mp-cap-head">
                  <span>
                    {t('myPostsPage.suggestedCaptionLabel')}
                  </span>
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
                {best.permalink && (
                  <a
                    className="mp-cap-share"
                    href={best.permalink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{t('myPostsPage.openOnInstagram')}</span>
                    <Icon path={I.share} size={11} />
                  </a>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="mp-empty" dir="auto">
            {t('myPostsPage.bestEmpty')}
          </div>
        )}
      </article>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Engagement-by-type chart                                           */
/* ------------------------------------------------------------------ */

interface ChartRow {
  type: 'video' | 'image' | 'carousel'
  engagement: number
  posts: number
}

function EngagementChart({ rows }: { rows: ChartRow[] }) {
  const { t } = useTranslation()
  const labels = {
    video: t('myPostsPage.videoLabel'),
    image: t('myPostsPage.imageLabel'),
    carousel: t('myPostsPage.carouselLabel'),
  }
  const colors = {
    video: 'var(--video)',
    image: 'var(--image)',
    carousel: 'var(--carousel)',
  }

  const max = Math.max(...rows.map((r) => r.engagement), 0.01)

  return (
    <div className="mp-chart">
      {rows.map((d, i) => {
        const pct = (d.engagement / max) * 100
        return (
          <div key={i} className="mp-bar-row">
            <div className="mp-bar-label">
              <TypeIcon type={d.type} size={13} />
              <span>{labels[d.type]}</span>
            </div>
            <div className="mp-bar-track" dir="ltr">
              <div
                className="mp-bar-fill"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(to right, ${colors[d.type]}, color-mix(in oklch, ${colors[d.type]} 70%, white))`,
                }}
              />
              <span className="mp-bar-val num">{d.engagement.toFixed(1)}%</span>
            </div>
            <div className="mp-bar-posts num">
              {d.posts} {t('myPostsPage.postUnit')}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChartCard() {
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
      .reduce<{ type: 'video' | 'image' | 'carousel'; rawEngagement: number; posts: number }[]>(
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

    // Normalize raw engagement totals to a percentage scale relative to the
    // top performer. Top row = 100%, the rest scaled proportionally. Reads
    // cleanly in the UI ("Video: 100%, Carousel: 67%, Image: 41%") regardless
    // of the absolute likes+comments magnitude.
    const top = Math.max(1, ...merged.map((r) => r.rawEngagement))
    return merged.map((r) => ({
      type: r.type,
      engagement: Math.round((r.rawEngagement / top) * 100 * 10) / 10,
      posts: r.posts,
    }))
  }, [data])

  if (rows.length === 0) {
    return (
      <section className="mp-chart-card">
        <div className="mp-empty">{t('myPostsPage.bestEmpty')}</div>
      </section>
    )
  }

  return (
    <section className="mp-chart-card">
      <div className="mp-chart-head">
        <div>
          <h2 className="mp-chart-title">{t('myPostsPage.engagementByType')}</h2>
          <p className="mp-chart-sub">{t('myPostsPage.engagementByTypeSubtitle')}</p>
        </div>
        <div className="mp-chart-legend">
          {rows.map((r) => {
            const colors = {
              video: 'var(--video)',
              image: 'var(--image)',
              carousel: 'var(--carousel)',
            }
            const labels = {
              video: t('myPostsPage.videoLabel'),
              image: t('myPostsPage.imageLabel'),
              carousel: t('myPostsPage.carouselLabel'),
            }
            return (
              <span key={r.type} className="mp-leg">
                <span className="mp-leg-dot" style={{ background: colors[r.type] }} />
                {labels[r.type]} <span className="mp-leg-n num">{r.posts}</span>
              </span>
            )
          })}
        </div>
      </div>
      <EngagementChart rows={rows} />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function SupportingDataDivider() {
  const { t } = useTranslation()
  return (
    <div className="mp-data-divider">
      <span className="mp-data-label">
        <Icon path={I.bars} size={12} />
        {t('myPostsPage.supportingDataLabel')}
      </span>
      <div className="mp-data-line" />
    </div>
  )
}

export default function Analytics() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')

  return (
    <div className="rd-canvas">
      <div className="mp-main">
        <Header range={range} setRange={setRange} />
        <TwoCardHero />
        <SupportingDataDivider />
        <ChartCard />
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

.mp-head { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; flex-wrap:wrap; }
.mp-crumb { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--ink-500); margin-bottom:10px; font-weight:500; }
.mp-crumb-arrow { color:var(--ink-300); }
.mp-titlerow { display:flex; align-items:center; gap:12px; margin-bottom:6px; flex-wrap:wrap; }
.mp-titlerow h1 { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1.15; }
.mp-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:99px; background:var(--purple-50); color:var(--purple-700); font-size:12px; font-weight:600; }
.mp-dot { width:6px; height:6px; border-radius:50%; background:var(--purple-500); box-shadow:0 0 0 3px rgba(117, 89, 176, .2); }
.mp-sub { font-size:13.5px; color:var(--ink-500); max-width:560px; line-height:1.55; }

.mp-head-act { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.mp-range { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.mp-range button { padding:7px 14px; font-size:12.5px; font-weight:500; border-radius:7px; color:var(--ink-600); }
.mp-range button.is-on { background:var(--surface); color:var(--ink-900); box-shadow:var(--shadow-sm); font-weight:600; }
.mp-export { display:flex; align-items:center; gap:7px; padding:10px 16px; background:var(--surface); border:1px solid var(--line); border-radius:10px; font-size:13px; font-weight:500; color:var(--ink-800); }
.mp-export:hover { border-color:var(--line-strong); }

.mp-loading { padding:48px; text-align:center; color:var(--ink-500); font-size:13px; background:var(--surface); border:1px solid var(--line); border-radius:18px; }
.mp-empty { padding:32px; text-align:center; color:var(--ink-500); font-size:13px; }

/* CARDS */
.mp-grid { display:grid; grid-template-columns:1fr 1.1fr; gap:18px; }
@media (max-width:1024px) { .mp-grid { grid-template-columns:1fr; } }
.mp-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:24px; display:flex; flex-direction:column; gap:16px; position:relative; overflow:hidden; }
.mp-card::before { content:''; position:absolute; top:0; inset-inline:0; height:3px; }
.mp-card--good::before { background:linear-gradient(90deg, oklch(0.7 0.16 155), oklch(0.6 0.18 160)); }
.mp-card--warn::before { background:linear-gradient(90deg, oklch(0.75 0.12 85), oklch(0.7 0.14 55)); }

.mp-card-head { display:flex; gap:12px; align-items:center; }
.mp-card-icon { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; flex-shrink:0; }
.mp-card-icon--good { background:oklch(0.95 0.05 155); color:oklch(0.45 0.15 155); }
.mp-card-icon--warn { background:oklch(0.96 0.05 85); color:oklch(0.55 0.15 60); }
.mp-card-head h3 { font-size:17px; font-weight:700; color:var(--ink-950); margin-bottom:3px; letter-spacing:-0.01em; }
.mp-card-sub { font-size:12px; color:var(--ink-500); font-weight:500; }

.mp-quote { padding:14px 16px; border-radius:12px; font-size:13.5px; line-height:1.7; color:var(--ink-800); }
.mp-quote-label { font-size:10.5px; font-weight:700; letter-spacing:0.02em; margin-bottom:6px; }
.mp-quote--good { background:oklch(0.97 0.025 155); }
.mp-quote--good .mp-quote-label { color:oklch(0.45 0.15 155); }
.mp-quote--warn { background:oklch(0.97 0.025 85); }
.mp-quote--warn .mp-quote-label { color:oklch(0.55 0.15 60); }
.mp-quote--tip { background:var(--ink-50); }
.mp-quote--tip .mp-quote-label { color:var(--ink-700); }

.mp-post-preview { background:var(--ink-50); border:1px solid var(--line); border-radius:12px; padding:14px; }
.mp-post-meta { display:flex; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap; }
.mp-post-stat { font-size:11px; color:var(--ink-500); font-weight:500; display:inline-flex; align-items:center; gap:4px; }
.mp-post-body { font-size:13.5px; color:var(--ink-900); line-height:1.7; font-weight:500; margin-bottom:8px; }
.mp-post-ocr { margin-top:6px; padding:8px 10px; background:var(--surface); border-radius:8px; font-size:12px; color:var(--ink-600); }
.mp-post-ocr span { color:var(--ink-800); font-weight:500; }

.mp-cta { display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; width:100%; background:var(--purple-600); color:#fff; border-radius:10px; font-size:13.5px; font-weight:600; box-shadow:0 6px 16px -6px rgba(102, 79, 161, .55); transition:background 0.12s, transform 0.12s; }
.mp-cta:hover:not(:disabled) { background:var(--purple-700); transform:translateY(-1px); }
.mp-cta:disabled { opacity:.7; cursor:not-allowed; }

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
.mp-cap-share { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:var(--purple-700); margin-top:10px; padding:4px 0; }
.mp-cap-share:hover { color:var(--purple-900); }

/* Data divider */
.mp-data-divider { display:flex; align-items:center; gap:14px; margin-top:10px; }
.mp-data-label { display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:600; color:var(--ink-600); }
.mp-data-line { flex:1; height:1px; background:var(--line); }

/* Chart card */
.mp-chart-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:24px 28px 28px; }
.mp-chart-head { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; margin-bottom:20px; flex-wrap:wrap; }
.mp-chart-title { font-size:18px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; margin-bottom:4px; }
.mp-chart-sub { font-size:12.5px; color:var(--ink-500); }
.mp-chart-legend { display:flex; gap:18px; flex-wrap:wrap; }
.mp-leg { display:inline-flex; align-items:center; gap:7px; font-size:12px; color:var(--ink-700); font-weight:500; }
.mp-leg-dot { width:10px; height:10px; border-radius:3px; }
.mp-leg-n { color:var(--ink-900); font-weight:700; }

.mp-chart { display:flex; flex-direction:column; gap:14px; }
.mp-bar-row { display:grid; grid-template-columns:100px 1fr 90px; align-items:center; gap:16px; }
.mp-bar-label { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--ink-800); }
.mp-bar-label svg { color:var(--ink-600); }
.mp-bar-track { position:relative; height:32px; background:var(--ink-50); border-radius:10px; overflow:hidden; }
.mp-bar-fill { position:absolute; inset:0 auto 0 0; height:100%; border-radius:10px; transition:width 0.4s cubic-bezier(.2,.8,.2,1); }
.mp-bar-val { position:absolute; inset-inline-start:12px; top:50%; transform:translateY(-50%); font-size:12.5px; font-weight:700; color:var(--ink-900); letter-spacing:-0.01em; }
.mp-bar-posts { font-size:11.5px; color:var(--ink-500); font-weight:500; text-align:start; }

[dir="rtl"] .mp-cta svg,
[dir="rtl"] .mp-crumb-arrow,
[dir="rtl"] .mp-cap-share svg { transform:scaleX(-1); }
`
