import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useSegments,
  useRegenerateSegments,
  useAudienceInsights,
} from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import { Icon, I, TypeIcon, normalizeContentType } from '../components/redesign/icons'
import type { SegmentCharacteristics, SegmentsData } from '../api/analytics'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const PALETTES = [
  { bg: 'oklch(0.95 0.04 285)', fg: 'var(--purple-700)', solid: 'var(--purple-500)', emoji: '🎥' },
  { bg: 'oklch(0.95 0.04 230)', fg: 'oklch(0.45 0.15 230)', solid: 'oklch(0.68 0.14 230)', emoji: '☀️' },
  { bg: 'oklch(0.95 0.04 170)', fg: 'oklch(0.42 0.13 170)', solid: 'oklch(0.65 0.13 170)', emoji: '☕' },
  { bg: 'oklch(0.95 0.04 50)', fg: 'oklch(0.48 0.14 45)', solid: 'oklch(0.72 0.14 55)', emoji: '📚' },
  { bg: 'oklch(0.95 0.04 320)', fg: 'oklch(0.48 0.14 320)', solid: 'oklch(0.7 0.14 320)', emoji: '✨' },
] as const

function pickEmoji(contentType: string | undefined): string {
  const t = normalizeContentType(contentType)
  if (t === 'video') return '🎥'
  if (t === 'carousel') return '📚'
  return '📷'
}

function deriveName(c: SegmentCharacteristics | undefined, fallback: string): { name: string; persona: string } {
  // Prefer the new structured fields populated by the updated Gemini persona
  // prompt — name + tagline are short, designed to fit the card hierarchy.
  const structuredName = c?.persona_name?.trim()
  const structuredTagline = c?.persona_tagline?.trim()
  if (structuredName) {
    return { name: structuredName, persona: structuredTagline || c?.persona_description || '' }
  }

  // Backwards compat: older personas stored the whole prose in
  // `persona_description`. Take the first sentence as the name and the rest
  // as the description body.
  const desc = c?.persona_description?.trim()
  if (!desc) {
    return { name: fallback, persona: '' }
  }
  const sentences = desc.split(/[.!؟]/).filter((s: string) => s.trim().length > 0)
  if (sentences.length === 0) return { name: fallback, persona: desc }
  const name = sentences[0]!.trim().slice(0, 60)
  const rest = sentences.slice(1).join('. ').trim()
  return {
    name: name.length > 0 ? name : fallback,
    persona: rest || desc,
  }
}

const REGEN_COOLDOWN_SECONDS = 30

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

function AudHero({ segments }: { segments: SegmentsData | undefined }) {
  const { t } = useTranslation()
  const insights = useAudienceInsights()
  const totalSize = useMemo(
    () => segments?.segments?.reduce((s, x) => s + x.size, 0) ?? 0,
    [segments],
  )

  const headlineText = insights.data?.behavior_summary?.trim() || t('myAudiencePage.audHeroFallback')
  // Split first sentence as headline, the rest as body.
  const sentences = headlineText.split(/[.!؟]/).filter((s: string) => s.trim().length > 0)
  const headline = sentences[0]?.trim() || headlineText
  const body = sentences.slice(1).join('. ').trim()

  const segs = segments?.segments ?? []

  return (
    <section className="aud-hero">
      <div className="aud-hero-l">
        <div className="aud-hero-k">{t('myAudiencePage.audHeroEyebrow')}</div>
        <h2 dir="auto">{headline}</h2>
        {body && <p dir="auto">{body}</p>}
        <div className="aud-hero-acts">
          <button className="aud-hero-btn primary">
            <Icon path={I.wand} size={13} />
            {t('myAudiencePage.audHeroCta1')}
          </button>
          <button className="aud-hero-btn ghost">{t('myAudiencePage.audHeroCta2')}</button>
        </div>
      </div>
      <div className="aud-hero-r">
        <div className="aud-hero-num">
          <div className="num">{totalSize}</div>
          <div>{t('myAudiencePage.audHeroTotalLabel')}</div>
        </div>
        {segs.length > 0 && (
          <>
            <div className="aud-hero-segs">
              {segs.map((s, i) => {
                const palette = PALETTES[i % PALETTES.length]
                const pct = totalSize > 0 ? (s.size / totalSize) * 100 : 0
                return (
                  <div
                    key={s.id}
                    className="aud-hero-seg"
                    style={{ width: `${pct}%`, background: palette.solid }}
                    title={s.label}
                  />
                )
              })}
            </div>
            <div className="aud-hero-legend">
              {segs.map((s, i) => {
                const palette = PALETTES[i % PALETTES.length]
                const pct = totalSize > 0 ? Math.round((s.size / totalSize) * 100) : 0
                return (
                  <div key={s.id} className="aud-hero-l-i">
                    <span style={{ background: palette.solid }} />
                    <span className="num">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Persona card                                                       */
/* ------------------------------------------------------------------ */

interface PersonaCardProps {
  index: number
  size: number
  pct: number
  name: string
  persona: string
  contentType: 'video' | 'image' | 'carousel'
  postingTime: string | undefined
  avgEngagement: number
  emoji: string
  contentTypeBreakdown: { video: number; image: number; carousel: number }
  topTopics: string[]
  bestDayHour: { day: string; hour: number } | null | undefined
}

// Format a "Tuesday 4pm" style chip from a {day, hour} object, localised.
function formatBestDayHour(
  v: { day: string; hour: number } | null | undefined,
  isAr: boolean,
): string {
  if (!v) return ''
  const dayMap: Record<string, { en: string; ar: string }> = {
    Monday: { en: 'Mon', ar: 'الإثنين' },
    Tuesday: { en: 'Tue', ar: 'الثلاثاء' },
    Wednesday: { en: 'Wed', ar: 'الأربعاء' },
    Thursday: { en: 'Thu', ar: 'الخميس' },
    Friday: { en: 'Fri', ar: 'الجمعة' },
    Saturday: { en: 'Sat', ar: 'السبت' },
    Sunday: { en: 'Sun', ar: 'الأحد' },
  }
  const d = dayMap[v.day]?.[isAr ? 'ar' : 'en'] ?? v.day
  const h = v.hour
  const hour12 = ((h + 11) % 12) + 1
  const suffix = h < 12 ? (isAr ? 'ص' : 'am') : isAr ? 'م' : 'pm'
  return `${d} ${hour12}${suffix}`
}

function PersonaCard({
  index,
  size,
  pct,
  name,
  persona,
  postingTime,
  avgEngagement,
  emoji,
  contentTypeBreakdown,
  topTopics,
  bestDayHour,
}: PersonaCardProps) {
  const { t, i18n } = useTranslation()
  const p = PALETTES[index % PALETTES.length]
  const timeLabelMap: Record<string, string> = {
    morning: t('myAudiencePage.morningLabel'),
    afternoon: t('myAudiencePage.afternoonLabel'),
    evening: t('myAudiencePage.eveningLabel'),
  }
  const timeKey = postingTime?.toLowerCase()
  const fallbackTimeLabel = timeKey && timeLabelMap[timeKey] ? timeLabelMap[timeKey] : postingTime || '—'
  const isAr = i18n.language?.startsWith('ar')
  // Prefer the day+hour chip from the new computed field; fall back to the
  // broad bucket label when it's missing (e.g. older segment rows).
  const bestTimeLabel = formatBestDayHour(bestDayHour, !!isAr) || fallbackTimeLabel

  const contentTypeLabels = {
    video: t('myPostsPage.videoLabel'),
    image: t('myPostsPage.imageLabel'),
    carousel: t('myPostsPage.carouselLabel'),
  }

  const engBucket =
    avgEngagement >= 4
      ? t('myAudiencePage.engagementHigh')
      : avgEngagement >= 2
        ? t('myAudiencePage.engagementMedium')
        : t('myAudiencePage.engagementLow')

  // Sort the breakdown so the dominant type appears first — matches the
  // design's "yiprefer" ordering.
  const breakdownEntries = (['video', 'image', 'carousel'] as const)
    .map((k) => ({ type: k, pct: contentTypeBreakdown[k] || 0 }))
    .sort((a, b) => b.pct - a.pct)

  return (
    <article
      className="aud-card"
      style={
        {
          ['--acc-bg' as string]: p.bg,
          ['--acc-fg' as string]: p.fg,
          ['--acc' as string]: p.solid,
        } as React.CSSProperties
      }
    >
      <div className="aud-card-top">
        <div className="aud-avatar" style={{ background: p.bg, color: p.fg }}>
          {emoji}
        </div>
        <div className="aud-card-t">
          <div className="aud-card-n" dir="auto">
            {name}
          </div>
          {persona && (
            <div className="aud-card-p" dir="auto">
              {persona}
            </div>
          )}
        </div>
        <div className="aud-card-size">
          <div className="num">{size}</div>
          <em>{pct}%</em>
        </div>
      </div>

      {/* Real content-type breakdown from segmentation.py:_compute_segment_extras */}
      <div className="aud-card-row">
        <div className="aud-card-k">{t('myAudiencePage.prefersHeader')}</div>
        <div className="aud-card-bars">
          {breakdownEntries.map((entry) => (
            <div key={entry.type} className="aud-pref">
              <div className="aud-pref-lbl">
                <TypeIcon type={entry.type} size={11} /> {contentTypeLabels[entry.type]}
              </div>
              <div className="aud-pref-bar">
                <div
                  style={{
                    width: `${entry.pct}%`,
                    background: `var(--${entry.type})`,
                  }}
                />
              </div>
              <div className="num aud-pref-p">{entry.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="aud-card-row aud-card-row--grid">
        <div>
          <div className="aud-card-k">{t('myAudiencePage.bestTimeHeader')}</div>
          <div className="aud-card-v">{bestTimeLabel}</div>
        </div>
        <div>
          <div className="aud-card-k">{t('myAudiencePage.engagementHeader')}</div>
          <div className="aud-card-v">{engBucket}</div>
        </div>
      </div>

      {topTopics.length > 0 && (
        <div className="aud-card-row">
          <div className="aud-card-k">{t('myAudiencePage.topicsHeader')}</div>
          <div className="aud-topics">
            {topTopics.slice(0, 3).map((topic) => (
              <span key={topic} dir="auto">{topic}</span>
            ))}
          </div>
        </div>
      )}

      <button className="aud-card-cta">
        <Icon path={I.wand} size={12} />
        {t('myAudiencePage.createForCta', { name: name.split(/[—\-]/)[0]?.trim() || name })}
      </button>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

function AudienceContent() {
  const { t } = useTranslation()
  const segments = useSegments()
  const regenerate = useRegenerateSegments()
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    if (cooldownLeft <= 0) return
    const id = window.setInterval(() => {
      setCooldownLeft((v) => (v > 0 ? v - 1 : 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldownLeft])

  function handleRegenerate() {
    if (regenerate.isPending || cooldownLeft > 0) return
    setCooldownLeft(REGEN_COOLDOWN_SECONDS)
    regenerate.mutate()
  }

  const buttonDisabled = regenerate.isPending || cooldownLeft > 0

  const segs = segments.data?.segments ?? []
  const totalSize = segs.reduce((s, x) => s + x.size, 0) || 1

  // Sort by size desc, take all (or up to 6 for visual cleanliness).
  const sorted = useMemo(
    () => [...segs].sort((a, b) => b.size - a.size).slice(0, 6),
    [segs],
  )

  return (
    <div className="rd-canvas">
      <div className="aud-main">
        <header className="aud-head">
          <div>
            <h1 dir="auto">{t('myAudiencePage.headerTitle')}</h1>
            <p dir="auto">{t('myAudiencePage.headerSubtitle')}</p>
          </div>
          <div className="aud-seg">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button key={r} className={range === r ? 'is-on' : ''} onClick={() => setRange(r)}>
                {t(`home.dateRange.${r}` as const)}
              </button>
            ))}
          </div>
        </header>

        <AudHero segments={segments.data} />

        <div className="aud-sec-head">
          <div>
            <h3>{t('myAudiencePage.personasTitle')}</h3>
            <span className="aud-sec-s">{t('myAudiencePage.personasSortedBySize')}</span>
          </div>
          <button onClick={handleRegenerate} disabled={buttonDisabled} className="aud-regen-btn">
            <Icon
              path={
                <>
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  <path d="M3 21v-5h5" />
                </>
              }
              size={12}
              className={regenerate.isPending ? 'aud-spin' : undefined}
            />
            {regenerate.isPending
              ? t('myAudiencePage.regeneratingLabel')
              : cooldownLeft > 0
                ? t('myAudiencePage.regenerateCooldownLabel', { seconds: cooldownLeft })
                : t('myAudiencePage.regenerateCta')}
          </button>
        </div>

        {sorted.length > 0 ? (
          <section className="aud-grid">
            {sorted.map((seg, i) => {
              const c = seg.characteristics
              const { name, persona } = deriveName(c, seg.label)
              const pct = Math.round((seg.size / totalSize) * 100)
              const contentType = normalizeContentType(c?.dominant_content_type)
              // avg_engagement may be a number (legacy) or an object {likes,comments,engagement_rate}.
              const rawEng = c?.avg_engagement
              const avgEng = typeof rawEng === 'number'
                ? rawEng
                : (rawEng?.likes ?? 0) + (rawEng?.comments ?? 0)
              return (
                <PersonaCard
                  key={seg.id}
                  index={i}
                  size={seg.size}
                  pct={pct}
                  name={name}
                  persona={persona}
                  contentType={contentType}
                  postingTime={c?.typical_posting_time}
                  avgEngagement={avgEng}
                  emoji={pickEmoji(c?.dominant_content_type)}
                  contentTypeBreakdown={c?.content_type_breakdown ?? { video: 0, image: 0, carousel: 0 }}
                  topTopics={c?.top_topics ?? []}
                  bestDayHour={c?.best_day_hour ?? null}
                />
              )
            })}
          </section>
        ) : (
          <div className="aud-empty">{t('myAudiencePage.noSegments')}</div>
        )}
      </div>
      <style>{AUD_STYLES}</style>
    </div>
  )
}

export default function Audience() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('audience_segmentation')

  return (
    <LockedFeature locked={isLocked} featureName={t('nav.myAudience')}>
      <AudienceContent />
    </LockedFeature>
  )
}

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const AUD_STYLES = `
.aud-main { display:flex; flex-direction:column; gap:22px; max-width:1480px; margin:0 auto; }
.aud-head { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; }
.aud-head h1 { font-size:26px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; margin-bottom:3px; }
.aud-head p { font-size:12.5px; color:var(--ink-500); }
.aud-seg { display:flex; background:var(--ink-100); border-radius:10px; padding:3px; }
.aud-seg button { padding:7px 14px; font-size:12.5px; border-radius:7px; color:var(--ink-600); font-weight:500; }
.aud-seg button.is-on { background:var(--surface); color:var(--ink-900); font-weight:600; box-shadow:var(--shadow-sm); }

/* Hero */
.aud-hero { display:grid; grid-template-columns:1.3fr 1fr; gap:28px; background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:20px; padding:26px 30px; align-items:center; }
@media (max-width:1024px) { .aud-hero { grid-template-columns:1fr; gap:18px; } }
.aud-hero-k { font-size:11px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:10px; }
.aud-hero h2 { font-size:22px; font-weight:700; color:var(--ink-950); margin-bottom:10px; letter-spacing:-0.015em; line-height:1.35; }
.aud-hero p { font-size:13.5px; color:var(--ink-700); line-height:1.7; margin-bottom:16px; max-width:540px; }
.aud-hero-acts { display:flex; gap:8px; flex-wrap:wrap; }
.aud-hero-btn { padding:9px 14px; border-radius:10px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
.aud-hero-btn.primary { background:var(--purple-600); color:#fff; }
.aud-hero-btn.primary:hover { background:var(--purple-700); }
.aud-hero-btn.ghost { background:transparent; color:var(--purple-800); }
.aud-hero-r { background:var(--surface); border-radius:14px; padding:18px; }
.aud-hero-num { text-align:start; margin-bottom:14px; }
.aud-hero-num .num { font-size:28px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
.aud-hero-num > div:last-child { font-size:11.5px; color:var(--ink-500); font-weight:500; margin-top:4px; }
.aud-hero-segs { display:flex; gap:3px; height:14px; margin-bottom:10px; border-radius:4px; overflow:hidden; }
.aud-hero-seg { border-radius:3px; transition:opacity .15s; }
.aud-hero-seg:hover { opacity:.8; }
.aud-hero-legend { display:flex; gap:12px; justify-content:space-between; flex-wrap:wrap; }
.aud-hero-l-i { display:flex; gap:5px; align-items:center; font-size:11px; color:var(--ink-600); font-weight:500; }
.aud-hero-l-i span:first-child { width:8px; height:8px; border-radius:2px; }

/* Section header */
.aud-sec-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:6px; flex-wrap:wrap; }
.aud-sec-head h3 { font-size:16px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; }
.aud-sec-s { font-size:12px; color:var(--ink-500); font-weight:500; margin-inline-start:8px; }
.aud-regen-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 14px; background:var(--surface); border:1px solid var(--line); border-radius:9px; font-size:12.5px; font-weight:500; color:var(--ink-700); }
.aud-regen-btn:hover:not(:disabled) { border-color:var(--line-strong); background:var(--ink-50); }
.aud-regen-btn:disabled { opacity:.6; cursor:not-allowed; }
.aud-spin { animation:aud-spin 1s linear infinite; }
@keyframes aud-spin { to { transform:rotate(360deg); } }

.aud-empty { padding:48px; text-align:center; color:var(--ink-500); font-size:13px; background:var(--surface); border:1px dashed var(--line); border-radius:18px; }

/* Cards grid */
.aud-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:16px; }
@media (max-width:768px) { .aud-grid { grid-template-columns:1fr; } }
.aud-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:16px; position:relative; overflow:hidden; }
.aud-card::before { content:''; position:absolute; top:0; inset-inline-start:0; height:3px; width:100%; background:var(--acc); }
.aud-card-top { display:flex; gap:14px; align-items:center; }
.aud-avatar { width:52px; height:52px; border-radius:14px; display:grid; place-items:center; font-size:22px; flex-shrink:0; }
.aud-card-t { flex:1; min-width:0; }
.aud-card-n { font-size:15px; font-weight:700; color:var(--ink-950); margin-bottom:2px; letter-spacing:-0.005em; }
.aud-card-p { font-size:12px; color:var(--ink-600); line-height:1.45; }
.aud-card-size { text-align:center; flex-shrink:0; padding-inline-start:12px; border-inline-start:1px solid var(--line); }
.aud-card-size .num { font-size:24px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1; }
.aud-card-size em { font-style:normal; font-size:11px; color:var(--ink-500); font-weight:500; display:block; margin-top:4px; }

.aud-card-row { display:flex; flex-direction:column; gap:8px; }
.aud-card-row--grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.aud-card-k { font-size:11px; font-weight:600; color:var(--ink-500); letter-spacing:0.02em; }
.aud-card-v { font-size:13.5px; font-weight:600; color:var(--ink-950); display:flex; align-items:center; gap:8px; }

.aud-card-bars { display:flex; flex-direction:column; gap:6px; }
.aud-pref { display:grid; grid-template-columns:90px 1fr 40px; align-items:center; gap:10px; font-size:11.5px; color:var(--ink-700); }
.aud-pref-lbl { display:inline-flex; align-items:center; gap:5px; font-weight:500; }
.aud-pref-bar { height:6px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
.aud-pref-bar > div { height:100%; border-radius:99px; transition:width .5s; }
.aud-pref-p { font-weight:700; color:var(--ink-900); text-align:start; letter-spacing:-0.005em; }

.aud-topics { display:flex; flex-wrap:wrap; gap:6px; }
.aud-topics span { padding:4px 10px; background:var(--acc-bg); color:var(--acc-fg); border-radius:99px; font-size:11.5px; font-weight:500; }

.aud-card-cta { padding:11px; background:var(--ink-900); color:#fff; border-radius:10px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:6px; margin-top:auto; }
.aud-card-cta:hover { background:var(--ink-800); }
`
