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
  const { t, i18n } = useTranslation()
  const isAr = !!i18n.language?.startsWith('ar')
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

  // Sort by size desc to match the persona list below (Audience.tsx:336).
  // Both halves of the hero (stacked bar + legend) and the persona cards use
  // PALETTES[i % PALETTES.length], so identical ordering = identical colors
  // row-by-row between bar and list. Without this sort, the bar showed
  // source-order colors while the list showed sorted-order colors, breaking
  // the visual link between the two surfaces.
  const segs = useMemo(
    () => [...(segments?.segments ?? [])].sort((a, b) => b.size - a.size),
    [segments],
  )

  const CONFIDENCE_THRESHOLD = 100
  const fmtCount = (n: number) => (isAr ? toArDigits(n) : String(n))

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
          <div className="num">{fmtCount(totalSize)}</div>
          <div>{t('myAudiencePage.audHeroTotalLabel')}</div>
        </div>
        <div className="aud-hero-note" dir="auto">
          {t('myAudiencePage.confidenceNote', {
            count: fmtCount(totalSize),
            threshold: fmtCount(CONFIDENCE_THRESHOLD),
          })}
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
/* Persona row (editorial list)                                       */
/* ------------------------------------------------------------------ */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
function toArDigits(n: number): string {
  return String(n)
    .split('')
    .map((d) => (d >= '0' && d <= '9' ? AR_DIGITS[+d]! : d))
    .join('')
}

interface PersonaRowProps {
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
  isOpen: boolean
  onToggle: () => void
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

function PersonaRow({
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
  isOpen,
  onToggle,
}: PersonaRowProps) {
  const { t, i18n } = useTranslation()
  const p = PALETTES[index % PALETTES.length]!
  const timeLabelMap: Record<string, string> = {
    morning: t('myAudiencePage.morningLabel'),
    afternoon: t('myAudiencePage.afternoonLabel'),
    evening: t('myAudiencePage.eveningLabel'),
  }
  const timeKey = postingTime?.toLowerCase()
  const fallbackTimeLabel = timeKey && timeLabelMap[timeKey] ? timeLabelMap[timeKey] : postingTime || '—'
  const isAr = !!i18n.language?.startsWith('ar')
  const bestTimeLabel = formatBestDayHour(bestDayHour, isAr) || fallbackTimeLabel

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

  const breakdownEntries = (['video', 'image', 'carousel'] as const)
    .map((k) => ({ type: k, pct: contentTypeBreakdown[k] || 0 }))
    .sort((a, b) => b.pct - a.pct)

  const rankLabel = isAr ? toArDigits(index + 1) : String(index + 1)
  const sizeLabel = isAr ? toArDigits(size) : String(size)
  const pctLabel = isAr ? toArDigits(pct) : String(pct)

  return (
    <article
      className="aud-row"
      data-open={isOpen ? '' : undefined}
      onClick={onToggle}
      style={
        {
          ['--acc-bg' as string]: p.bg,
          ['--acc-fg' as string]: p.fg,
          ['--acc' as string]: p.solid,
        } as React.CSSProperties
      }
    >
      <div className="aud-row-rank num">{rankLabel}</div>
      <div className="aud-row-avatar" style={{ background: p.bg, color: p.fg }}>
        {emoji}
      </div>
      <div className="aud-row-ident">
        <div className="aud-row-n" dir="auto">{name}</div>
        {persona && (
          <div className="aud-row-p" dir="auto">{persona}</div>
        )}
      </div>
      <div className="aud-row-size">
        <div className="aud-row-sv num">{sizeLabel}</div>
        <div className="aud-row-sp">
          <div className="aud-row-sb">
            <div style={{ width: `${pct}%`, background: p.solid }} />
          </div>
          <span className="num">{pctLabel}%</span>
        </div>
      </div>
      <div className="aud-row-prefs">
        <div className="aud-row-k">{t('myAudiencePage.prefersHeader')}</div>
        <div className="aud-row-pf">
          {breakdownEntries.map((entry) => (
            <div key={entry.type} className="aud-row-pi">
              <TypeIcon type={entry.type} size={10} />
              <span>{contentTypeLabels[entry.type]}</span>
              <b className="num">{isAr ? toArDigits(entry.pct) : entry.pct}%</b>
            </div>
          ))}
        </div>
      </div>
      <div className="aud-row-when">
        <div className="aud-row-k">{t('myAudiencePage.bestTimeHeader')}</div>
        <div className="aud-row-wv num">{bestTimeLabel}</div>
      </div>
      <div className="aud-row-eng">
        <div className="aud-row-k">{t('myAudiencePage.engagementHeader')}</div>
        <div className="aud-row-ev">{engBucket}</div>
      </div>
      <button className="aud-row-cta" onClick={(e) => e.stopPropagation()}>
        {t('myAudiencePage.createForRowCta')}
        <Icon path={I.wand} size={11} />
      </button>
      {isOpen && topTopics.length > 0 && (
        <div className="aud-row-ex">
          <div className="aud-row-k">{t('myAudiencePage.topicsHeader')}</div>
          <div className="aud-topics">
            {topTopics.slice(0, 6).map((topic) => (
              <span key={topic} dir="auto">{topic}</span>
            ))}
          </div>
        </div>
      )}
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
  const [openId, setOpenId] = useState<string | null>(null)

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
            <span className="aud-sec-s">{t('myAudiencePage.personasClickHint')}</span>
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
          <section className="aud-list">
            {sorted.map((seg, i) => {
              const c = seg.characteristics
              const { name, persona } = deriveName(c, seg.label)
              const pct = Math.round((seg.size / totalSize) * 100)
              const contentType = normalizeContentType(c?.dominant_content_type)
              const rawEng = c?.avg_engagement
              const avgEng = typeof rawEng === 'number'
                ? rawEng
                : (rawEng?.likes ?? 0) + (rawEng?.comments ?? 0)
              return (
                <PersonaRow
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
                  isOpen={openId === seg.id}
                  onToggle={() => setOpenId(openId === seg.id ? null : seg.id)}
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
.aud-hero-note { font-size:11.5px; color:var(--ink-500); line-height:1.55; margin:0 0 14px; padding:8px 10px; background:var(--ink-50); border-radius:8px; }
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

/* Editorial list */
.aud-list { display:flex; flex-direction:column; gap:10px; }
.aud-row { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:18px 22px; display:grid; grid-template-columns:28px 52px 1.4fr 1fr 1.3fr 0.9fr 0.8fr auto; gap:22px; align-items:center; position:relative; overflow:hidden; cursor:pointer; transition:border-color .15s, box-shadow .15s; }
.aud-row:hover { border-color:var(--acc); box-shadow:0 2px 12px -6px var(--acc); }
.aud-row[data-open] { border-color:var(--acc); box-shadow:0 4px 20px -10px var(--acc); }
.aud-row::before { content:''; position:absolute; top:0; bottom:0; inset-inline-start:0; width:3px; background:var(--acc); }
.aud-row-rank { font-size:15px; font-weight:700; color:var(--ink-400); text-align:center; letter-spacing:-0.01em; }
.aud-row-avatar { width:48px; height:48px; border-radius:12px; display:grid; place-items:center; font-size:20px; flex-shrink:0; }
.aud-row-ident { min-width:0; }
.aud-row-n { font-size:14px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.aud-row-p { font-size:11.5px; color:var(--ink-600); line-height:1.4; }

.aud-row-size { display:flex; flex-direction:column; gap:6px; }
.aud-row-sv { font-size:20px; font-weight:700; color:var(--ink-950); letter-spacing:-0.015em; line-height:1; }
.aud-row-sp { display:flex; align-items:center; gap:8px; }
.aud-row-sb { flex:1; height:5px; background:var(--ink-100); border-radius:99px; overflow:hidden; }
.aud-row-sb > div { height:100%; border-radius:99px; }
.aud-row-sp .num { font-size:11px; color:var(--ink-600); font-weight:600; }

.aud-row-k { font-size:10.5px; font-weight:600; color:var(--ink-500); letter-spacing:0.02em; margin-bottom:6px; }
.aud-row-pf { display:flex; flex-direction:column; gap:4px; }
.aud-row-pi { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--ink-700); }
.aud-row-pi b { color:var(--ink-950); font-weight:700; margin-inline-start:auto; font-size:11.5px; }

.aud-row-wv { font-size:13px; font-weight:600; color:var(--ink-950); letter-spacing:-0.005em; }
.aud-row-ev { font-size:12.5px; font-weight:600; color:var(--ink-950); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }

.aud-row-cta { padding:9px 14px; background:var(--ink-900); color:#fff; border-radius:9px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
.aud-row-cta:hover { background:var(--ink-800); }

.aud-row-ex { grid-column:1 / -1; border-top:1px dashed var(--line); padding-top:14px; margin-top:4px; display:flex; flex-direction:column; gap:8px; animation:audfade .2s ease-out; }
@keyframes audfade { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }

.aud-topics { display:flex; flex-wrap:wrap; gap:6px; }
.aud-topics span { padding:4px 10px; background:var(--acc-bg); color:var(--acc-fg); border-radius:99px; font-size:11.5px; font-weight:500; }

@media (max-width:1100px) {
  .aud-row { grid-template-columns:28px 48px 1fr auto; gap:14px; }
  .aud-row-prefs, .aud-row-when, .aud-row-eng { display:none; }
}
`
