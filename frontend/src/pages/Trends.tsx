import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, I } from '../components/redesign/icons'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import { useHashtagTrends } from '../hooks/useAnalytics'

/* ------------------------------------------------------------------ */
/* Mock data                                                          */
/* ------------------------------------------------------------------ */

type Phase = 'rising' | 'peaking' | 'fading' | 'steady'
type Category = 'topic' | 'cultural' | 'macro' | 'format'

interface Trend {
  id: string
  cat: Category
  phase: Phase
  titleKey: string
  subKey: string
  whyKey: string
  volume: number
  momentum: string
  daysIn: number
  spark: number[]
  examples: number
  angleKeys: string[]
  windowKey: string
  tagKey: string
}

const TRENDS: Trend[] = [
  {
    id: 't1',
    cat: 'topic',
    phase: 'rising',
    titleKey: 't1Title',
    subKey: 't1Sub',
    whyKey: 't1Why',
    volume: 12400,
    momentum: '+182%',
    daysIn: 3,
    spark: [2, 3, 3, 5, 8, 11, 18],
    examples: 12,
    angleKeys: ['t1Angle1', 't1Angle2', 't1Angle3'],
    windowKey: 't1Window',
    tagKey: 't1Tag',
  },
  {
    id: 't2',
    cat: 'topic',
    phase: 'peaking',
    titleKey: 't2Title',
    subKey: 't2Sub',
    whyKey: 't2Why',
    volume: 28800,
    momentum: '+64%',
    daysIn: 11,
    spark: [5, 8, 12, 18, 22, 24, 23],
    examples: 24,
    angleKeys: ['t2Angle1', 't2Angle2', 't2Angle3'],
    windowKey: 't2Window',
    tagKey: 't2Tag',
  },
  {
    id: 't3',
    cat: 'topic',
    phase: 'rising',
    titleKey: 't3Title',
    subKey: 't3Sub',
    whyKey: 't3Why',
    volume: 4900,
    momentum: '+340%',
    daysIn: 5,
    spark: [1, 1, 2, 3, 5, 9, 14],
    examples: 7,
    angleKeys: ['t3Angle1', 't3Angle2'],
    windowKey: 't3Window',
    tagKey: 't3Tag',
  },
  {
    id: 't4',
    cat: 'topic',
    phase: 'fading',
    titleKey: 't4Title',
    subKey: 't4Sub',
    whyKey: 't4Why',
    volume: 7200,
    momentum: '-42%',
    daysIn: 38,
    spark: [22, 20, 18, 15, 12, 9, 7],
    examples: 18,
    angleKeys: [],
    windowKey: 't4Window',
    tagKey: 't4Tag',
  },
  {
    id: 'c1',
    cat: 'cultural',
    phase: 'rising',
    titleKey: 'c1Title',
    subKey: 'c1Sub',
    whyKey: 'c1Why',
    volume: 184000,
    momentum: '+95%',
    daysIn: 14,
    spark: [8, 10, 14, 18, 24, 30, 38],
    examples: 0,
    angleKeys: ['c1Angle1', 'c1Angle2', 'c1Angle3'],
    windowKey: 'c1Window',
    tagKey: 'c1Tag',
  },
  {
    id: 'c2',
    cat: 'cultural',
    phase: 'rising',
    titleKey: 'c2Title',
    subKey: 'c2Sub',
    whyKey: 'c2Why',
    volume: 92000,
    momentum: '+38%',
    daysIn: 21,
    spark: [12, 14, 16, 19, 22, 26, 32],
    examples: 0,
    angleKeys: ['c2Angle1', 'c2Angle2'],
    windowKey: 'c2Window',
    tagKey: 'c2Tag',
  },
  {
    id: 'c3',
    cat: 'cultural',
    phase: 'peaking',
    titleKey: 'c3Title',
    subKey: 'c3Sub',
    whyKey: 'c3Why',
    volume: 61000,
    momentum: '+22%',
    daysIn: 10,
    spark: [18, 20, 22, 24, 25, 26, 26],
    examples: 32,
    angleKeys: ['c3Angle1', 'c3Angle2'],
    windowKey: 'c3Window',
    tagKey: 'c3Tag',
  },
  {
    id: 'm1',
    cat: 'macro',
    phase: 'rising',
    titleKey: 'm1Title',
    subKey: 'm1Sub',
    whyKey: 'm1Why',
    volume: 8400,
    momentum: '+86%',
    daysIn: 4,
    spark: [1, 2, 3, 5, 8, 11, 15],
    examples: 3,
    angleKeys: ['m1Angle1', 'm1Angle2'],
    windowKey: 'm1Window',
    tagKey: 'm1Tag',
  },
  {
    id: 'm2',
    cat: 'macro',
    phase: 'rising',
    titleKey: 'm2Title',
    subKey: 'm2Sub',
    whyKey: 'm2Why',
    volume: 5600,
    momentum: '+44%',
    daysIn: 9,
    spark: [2, 3, 4, 6, 8, 9, 11],
    examples: 6,
    angleKeys: ['m2Angle1', 'm2Angle2'],
    windowKey: 'm2Window',
    tagKey: 'm2Tag',
  },
  {
    id: 'm3',
    cat: 'macro',
    phase: 'steady',
    titleKey: 'm3Title',
    subKey: 'm3Sub',
    whyKey: 'm3Why',
    volume: 3200,
    momentum: '+12%',
    daysIn: 90,
    spark: [8, 9, 9, 10, 10, 11, 11],
    examples: 22,
    angleKeys: ['m3Angle1', 'm3Angle2'],
    windowKey: 'm3Window',
    tagKey: 'm3Tag',
  },
]

interface CalEntry {
  dateKey: 'today' | 'in10' | 'in28' | 'in45' | 'in60' | 'in72'
  labelKey: 'labelHeat' | 'labelMatch' | 'labelND' | 'labelRiyadh' | 'labelRule' | 'labelWinter'
  weight: 'huge' | 'med' | 'low'
}

const CULTURAL_CALENDAR: CalEntry[] = [
  { dateKey: 'today', labelKey: 'labelHeat', weight: 'med' },
  { dateKey: 'in10', labelKey: 'labelMatch', weight: 'med' },
  { dateKey: 'in28', labelKey: 'labelND', weight: 'huge' },
  { dateKey: 'in45', labelKey: 'labelRiyadh', weight: 'huge' },
  { dateKey: 'in60', labelKey: 'labelRule', weight: 'med' },
  { dateKey: 'in72', labelKey: 'labelWinter', weight: 'med' },
]

const PHASE_META: Record<Phase, { fg: string; bg: string; dot: string }> = {
  rising: { fg: '#0d8a5b', bg: '#e6f5ee', dot: '#10a065' },
  peaking: { fg: '#b8731a', bg: '#fbf1e0', dot: '#d4881e' },
  fading: { fg: '#9b9aa6', bg: '#eeeef3', dot: '#9b9aa6' },
  steady: { fg: '#5b5e75', bg: '#eeeef3', dot: '#7c7f95' },
}

const CAT_META: Record<Category, { color: string; tint: string }> = {
  topic: { color: '#7c5cef', tint: '#ede8ff' },
  cultural: { color: '#d4881e', tint: '#fbf1e0' },
  macro: { color: '#0e7c8a', tint: '#dff0f2' },
  format: { color: '#c44a8a', tint: '#fae3ee' },
}

/* ------------------------------------------------------------------ */
/* Components                                                         */
/* ------------------------------------------------------------------ */

function PhaseDot({ phase, label }: { phase: Phase; label: string }) {
  const p = PHASE_META[phase]
  return (
    <span className="tra-phase" style={{ background: p.bg, color: p.fg }}>
      <i style={{ background: p.dot }} />
      {label}
    </span>
  )
}

function Spark({ data, color, height = 40, width = 110 }: { data: number[]; color: string; height?: number; width?: number }) {
  const max = Math.max(...data, 1)
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 4) - 2}`)
    .join(' ')
  const area = `0,${height} ${points} ${width},${height}`
  const id = `tra-g-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) =>
        i === data.length - 1 ? (
          <circle
            key={i}
            cx={(i / (data.length - 1)) * width}
            cy={height - (v / max) * (height - 4) - 2}
            r="3"
            fill={color}
            stroke="#fff"
            strokeWidth="1.5"
          />
        ) : null,
      )}
    </svg>
  )
}

function HeroTrend() {
  const { t } = useTranslation()
  const top = TRENDS.find((x) => x.id === 't3')!
  const phaseLabelKey = `trendsPage.phase${top.phase.charAt(0).toUpperCase()}${top.phase.slice(1)}` as never

  return (
    <section className="tra-hero">
      <div className="tra-hero-l">
        <div className="tra-hero-k">
          <span className="tra-hero-spark-icon">✦</span>
          {t('trendsPage.heroEyebrow')}
        </div>
        <h2 dir="auto">{t(`trendsPage.trends.${top.titleKey}`)}</h2>
        <p className="tra-hero-sub" dir="auto">
          {t(`trendsPage.trends.${top.subKey}`)}
        </p>
        <p className="tra-hero-why" dir="auto">
          {t(`trendsPage.trends.${top.whyKey}`)}
        </p>
        <div className="tra-hero-acts">
          <button className="tra-btn primary">{t('trendsPage.heroCta1')}</button>
          <button className="tra-btn ghost">{t('trendsPage.heroCta2')}</button>
        </div>
      </div>
      <div className="tra-hero-r">
        <div className="tra-hero-stat">
          <span className="tra-hero-stat-k">{t('trendsPage.heroStat7d')}</span>
          <div className="tra-hero-stat-row">
            <span className="tra-hero-stat-v num">{top.momentum}</span>
            <Spark data={top.spark} color={CAT_META[top.cat].color} width={120} height={44} />
          </div>
        </div>
        <div className="tra-hero-meta">
          <div>
            <span className="tra-hero-meta-k">{t('trendsPage.heroPhase')}</span>
            <PhaseDot phase={top.phase} label={t(phaseLabelKey)} />
          </div>
          <div>
            <span className="tra-hero-meta-k">{t('trendsPage.heroActWindow')}</span>
            <span className="tra-hero-meta-v">{t(`trendsPage.trends.${top.windowKey}`)}</span>
          </div>
          <div>
            <span className="tra-hero-meta-k">{t('trendsPage.heroExamples')}</span>
            <span className="tra-hero-meta-v num">{top.examples}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function SummaryChips() {
  const { t } = useTranslation()
  const counts = {
    rising: TRENDS.filter((x) => x.phase === 'rising').length,
    peaking: TRENDS.filter((x) => x.phase === 'peaking').length,
    fading: TRENDS.filter((x) => x.phase === 'fading').length,
    seasons: CULTURAL_CALENDAR.length,
  }
  return (
    <div className="tra-chips">
      <div className="tra-chip">
        <div className="tra-chip-v num" style={{ color: PHASE_META.rising.fg }}>
          {counts.rising}
        </div>
        <div className="tra-chip-l">{t('trendsPage.summaryRising')}</div>
      </div>
      <div className="tra-chip">
        <div className="tra-chip-v num" style={{ color: PHASE_META.peaking.fg }}>
          {counts.peaking}
        </div>
        <div className="tra-chip-l">{t('trendsPage.summaryPeaking')}</div>
      </div>
      <div className="tra-chip">
        <div className="tra-chip-v num" style={{ color: PHASE_META.fading.fg }}>
          {counts.fading}
        </div>
        <div className="tra-chip-l">{t('trendsPage.summaryFading')}</div>
      </div>
      <div className="tra-chip">
        <div className="tra-chip-v num" style={{ color: CAT_META.cultural.color }}>
          {counts.seasons}
        </div>
        <div className="tra-chip-l">{t('trendsPage.summarySeasons')}</div>
      </div>
    </div>
  )
}

function TrendCard({ trend }: { trend: Trend }) {
  const { t } = useTranslation()
  const cat = CAT_META[trend.cat]
  const catLabel = t(
    `trendsPage.category${trend.cat.charAt(0).toUpperCase()}${trend.cat.slice(1)}` as never,
  )
  const phaseLabel = t(
    `trendsPage.phase${trend.phase.charAt(0).toUpperCase()}${trend.phase.slice(1)}` as never,
  )
  return (
    <article
      className="tra-card"
      style={
        {
          ['--accent' as string]: cat.color,
          ['--accent-tint' as string]: cat.tint,
        } as React.CSSProperties
      }
    >
      <header className="tra-card-h">
        <div className="tra-card-h-l">
          <span className="tra-cat-dot" style={{ background: cat.color }} />
          <span className="tra-cat-l">{catLabel}</span>
          <span className="tra-card-tag">{t(`trendsPage.trends.${trend.tagKey}`)}</span>
          <PhaseDot phase={trend.phase} label={phaseLabel} />
        </div>
      </header>
      <h3 className="tra-card-t" dir="auto">
        {t(`trendsPage.trends.${trend.titleKey}`)}
      </h3>
      <p className="tra-card-s" dir="auto">
        {t(`trendsPage.trends.${trend.subKey}`)}
      </p>

      <div className="tra-card-stats">
        <div>
          <span className="tra-stat-k">{t('trendsPage.cardMomentum')}</span>
          <span
            className="tra-stat-v num"
            style={{
              color: trend.phase === 'fading' ? PHASE_META.fading.fg : PHASE_META.rising.fg,
            }}
          >
            {trend.momentum}
          </span>
        </div>
        <div>
          <span className="tra-stat-k">{t('trendsPage.cardVolume')}</span>
          <span className="tra-stat-v num">{trend.volume.toLocaleString()}</span>
        </div>
        <div>
          <span className="tra-stat-k">{t('trendsPage.cardDaysIn')}</span>
          <span className="tra-stat-v num">
            {trend.daysIn} {t('trendsPage.cardDaysInUnit')}
          </span>
        </div>
      </div>

      <p className="tra-card-why" dir="auto">
        {t(`trendsPage.trends.${trend.whyKey}`)}
      </p>

      {trend.angleKeys.length > 0 && (
        <div className="tra-card-angles">
          <div className="tra-card-angles-h">{t('trendsPage.cardSuggested')}</div>
          <ul>
            {trend.angleKeys.map((aKey, i) => (
              <li key={i} dir="auto">
                <span className="tra-bul">✦</span>
                {t(`trendsPage.trends.${aKey}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="tra-card-f">
        <div className="tra-card-time">
          <Icon path={I.clock} size={13} />
          <span>
            {t('trendsPage.cardActWindow')} <strong>{t(`trendsPage.trends.${trend.windowKey}`)}</strong>
          </span>
        </div>
        <div className="tra-card-acts">
          <button className="tra-btn ghost-sm">{t('trendsPage.cardViewExamples')}</button>
          <button className="tra-btn primary-sm">{t('trendsPage.cardCreate')}</button>
        </div>
      </footer>
    </article>
  )
}

function CalendarStrip() {
  const { t } = useTranslation()
  return (
    <section className="tra-cal">
      <header className="tra-cal-h">
        <h3>{t('trendsPage.calendarTitle')}</h3>
        <p>{t('trendsPage.calendarSubtitle')}</p>
      </header>
      <ol className="tra-cal-list">
        {CULTURAL_CALENDAR.map((c, i) => {
          const big = c.weight === 'huge'
          const med = c.weight === 'med'
          return (
            <li key={i} className={`tra-cal-i ${big ? 'is-big' : med ? 'is-med' : ''}`}>
              <div className="tra-cal-rail">
                <span className="tra-cal-mark" />
                {i < CULTURAL_CALENDAR.length - 1 && <span className="tra-cal-line" />}
              </div>
              <div className="tra-cal-body">
                <div className="tra-cal-d">{t(`trendsPage.calendar.${c.dateKey}`)}</div>
                <div className="tra-cal-t" dir="auto">
                  {t(`trendsPage.calendar.${c.labelKey}`)}
                </div>
                {big && <div className="tra-cal-tag">{t('trendsPage.calendarTagBig')}</div>}
                {med && <div className="tra-cal-tag tra-cal-tag--med">{t('trendsPage.calendarTagMed')}</div>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function MacroSignals() {
  const { t } = useTranslation()
  const macros = TRENDS.filter((x) => x.cat === 'macro')
  return (
    <section className="tra-macro">
      <header className="tra-macro-h">
        <h3>{t('trendsPage.macroTitle')}</h3>
        <p>{t('trendsPage.macroSubtitle')}</p>
      </header>
      <ul className="tra-macro-list">
        {macros.map((m) => (
          <li key={m.id} className="tra-macro-i">
            <div className="tra-macro-row">
              <span
                className="tra-macro-tag"
                style={{ background: CAT_META.macro.tint, color: CAT_META.macro.color }}
              >
                {t(`trendsPage.trends.${m.tagKey}`)}
              </span>
              <span className="tra-macro-mom num" style={{ color: PHASE_META.rising.fg }}>
                {m.momentum}
              </span>
            </div>
            <div className="tra-macro-t" dir="auto">
              {t(`trendsPage.trends.${m.titleKey}`)}
            </div>
            <p className="tra-macro-s" dir="auto">
              {t(`trendsPage.trends.${m.subKey}`)}
            </p>
            <p className="tra-macro-w" dir="auto">
              {t(`trendsPage.trends.${m.whyKey}`)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

// Heatmap reused from the Competitors page — mock posting density on a
// 7-day × 10-hour grid. Higher cells = more activity at that slot.
const HEATMAP = [
  [0, 0, 1, 2, 1, 3, 2, 1, 0, 0],
  [1, 2, 3, 5, 3, 4, 2, 1, 0, 0],
  [0, 1, 2, 3, 4, 5, 4, 3, 1, 0],
  [1, 1, 2, 4, 5, 6, 4, 2, 1, 0],
  [0, 1, 3, 4, 5, 7, 5, 3, 2, 1],
  [2, 3, 4, 5, 6, 7, 6, 4, 3, 2],
  [1, 2, 3, 4, 4, 5, 3, 2, 1, 0],
]
const HOUR_LABELS = ['6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p', '12a']

function HashtagsSection() {
  const { t } = useTranslation()
  const { data } = useHashtagTrends()
  const tags = data?.hashtags ?? []
  if (tags.length === 0) return null

  return (
    <section className="tra-card-flat">
      <header className="tra-sec-h" style={{ marginBottom: 12 }}>
        <h2>{t('trendsPage.hashtagsTitle')}</h2>
        <span className="tra-sec-sub">{t('trendsPage.hashtagsSubtitle')}</span>
      </header>
      <div className="tra-hashtags">
        {tags.map((h) => {
          const phaseColor =
            h.phase === 'rising'
              ? PHASE_META.rising.fg
              : h.phase === 'fading'
                ? PHASE_META.fading.fg
                : PHASE_META.peaking.fg
          return (
            <div key={h.tag} className="tra-hashtag-chip">
              <span className="tra-hashtag-tag">{h.tag}</span>
              <span className="tra-hashtag-vol num">
                {h.volume.toLocaleString()}
              </span>
              <span className="tra-hashtag-mom num" style={{ color: phaseColor }}>
                {h.momentum}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FormatTrendsSection() {
  const { t } = useTranslation()
  const formats = [
    {
      titleKey: 'formatVideoTitle',
      bodyKey: 'formatVideoBody',
      momentum: '+2.1×',
      momentumKey: 'formatVideoMomentum',
      phase: 'rising' as const,
    },
    {
      titleKey: 'formatCarouselTitle',
      bodyKey: 'formatCarouselBody',
      momentum: '-18%',
      momentumKey: 'formatCarouselMomentum',
      phase: 'fading' as const,
    },
  ]
  return (
    <section className="tra-card-flat">
      <header className="tra-sec-h" style={{ marginBottom: 12 }}>
        <h2>{t('trendsPage.formatTrendsTitle')}</h2>
        <span className="tra-sec-sub">{t('trendsPage.formatTrendsSubtitle')}</span>
      </header>
      <div className="tra-format-grid">
        {formats.map((f) => {
          const phaseColor = f.phase === 'rising' ? PHASE_META.rising.fg : PHASE_META.fading.fg
          const phaseBg = f.phase === 'rising' ? PHASE_META.rising.bg : PHASE_META.fading.bg
          return (
            <article key={f.titleKey} className="tra-format-card">
              <div className="tra-format-h">
                <h3 dir="auto">{t(`trendsPage.${f.titleKey}` as never)}</h3>
                <span className="tra-format-mom" style={{ color: phaseColor, background: phaseBg }}>
                  {f.momentum}
                </span>
              </div>
              <p dir="auto">{t(`trendsPage.${f.bodyKey}` as never)}</p>
              <div className="tra-format-foot">
                <span>{t(`trendsPage.${f.momentumKey}` as never)}</span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PostingHeatmap() {
  const { t } = useTranslation()
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  return (
    <section className="tra-card-flat">
      <header className="tra-sec-h" style={{ marginBottom: 12 }}>
        <h2>{t('trendsPage.heatmapTitle')}</h2>
        <span className="tra-sec-sub">{t('trendsPage.heatmapSubtitle')}</span>
      </header>
      <div className="tra-heat" dir="ltr">
        <div className="tra-heat-cols">
          <span />
          {HOUR_LABELS.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="tra-heat-grid">
          {HEATMAP.map((row, r) => (
            <div key={r} className="tra-heat-row">
              <span className="tra-heat-day">
                {t(`trendsPage.heatmapDays.${dayKeys[r]}` as never)}
              </span>
              {row.map((v, c) => (
                <div
                  key={c}
                  className="tra-heat-cell"
                  style={{
                    background:
                      v === 0
                        ? 'var(--ink-100)'
                        : `oklch(0.62 0.18 285 / ${0.18 + v * 0.11})`,
                    borderColor: v >= 5 ? 'var(--purple-700)' : 'transparent',
                  }}
                  title={String(v)}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="tra-heat-hint">
          {t('trendsPage.heatmapPeak', { slot: t('trendsPage.heatmapPeakSlot') })}
        </p>
      </div>
    </section>
  )
}

function TrendsContent() {
  const { t } = useTranslation()
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d')
  const rising = TRENDS.filter((x) => x.cat === 'topic' || x.cat === 'cultural')

  return (
    <div className="rd-canvas">
      <div className="tra">
        <header className="tra-head">
          <div>
            <div className="tra-eyebrow">
              <span className="tra-loc-dot" />
              {t('trendsPage.eyebrowFocusOn', {
                industry: t('trendsPage.industry'),
                city: t('trendsPage.city'),
              })}
              <button className="tra-loc-edit">{t('trendsPage.eyebrowEdit')} ✎</button>
            </div>
            <h1 dir="auto">{t('trendsPage.headerTitle')}</h1>
            <p dir="auto">{t('trendsPage.headerSubtitle')}</p>
          </div>
          <div className="tra-head-r">
            <div className="tra-seg">
              {(['today', '7d', '30d'] as const).map((r) => (
                <button key={r} className={range === r ? 'is-on' : ''} onClick={() => setRange(r)}>
                  {t(`trendsPage.range${r === 'today' ? 'Today' : r === '7d' ? '7d' : '30d'}` as never)}
                </button>
              ))}
            </div>
            <button className="tra-add">{t('trendsPage.generatePlanCta')}</button>
          </div>
        </header>

        <HeroTrend />
        <SummaryChips />
        <HashtagsSection />
        <FormatTrendsSection />
        <PostingHeatmap />

        <div className="tra-grid">
          <div className="tra-col-main">
            <header className="tra-sec-h">
              <h2>{t('trendsPage.sectionTitle')}</h2>
              <div className="tra-sort">
                <span>{t('trendsPage.sortBy')}</span>
                <button className="is-on">{t('trendsPage.sortMomentum')}</button>
                <button>{t('trendsPage.sortVolume')}</button>
                <button>{t('trendsPage.sortRecency')}</button>
              </div>
            </header>
            <div className="tra-stack">
              {rising.map((tr) => (
                <TrendCard key={tr.id} trend={tr} />
              ))}
            </div>
          </div>
          <aside className="tra-col-side">
            <CalendarStrip />
            <MacroSignals />
          </aside>
        </div>
      </div>
      <style>{TRA_STYLES}</style>
    </div>
  )
}

export default function Trends() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('content_recommendations')
  return (
    <LockedFeature locked={isLocked} featureName={t('nav.trends')}>
      <TrendsContent />
    </LockedFeature>
  )
}

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const TRA_STYLES = `
.tra { max-width:1480px; margin:0 auto; }
.tra .num { font-family:'Inter', system-ui, sans-serif; font-feature-settings:'tnum'; }

.tra-head { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.tra-eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:12px; color:var(--ink-600); margin-bottom:8px; padding:5px 11px; background:var(--surface); border:1px solid var(--line); border-radius:99px; }
.tra-eyebrow strong { color:var(--ink-900); font-weight:600; }
.tra-loc-dot { width:6px; height:6px; border-radius:50%; background:var(--purple-500); box-shadow:0 0 0 3px rgba(124,92,239,0.18); }
.tra-loc-edit { font-size:11px; color:var(--purple-700); padding:0 0 0 4px; border-inline-start:1px solid var(--line); margin-inline-start:6px; }
.tra h1 { font-size:28px; font-weight:700; color:var(--ink-950); margin-bottom:4px; letter-spacing:-0.02em; }
.tra-head > div > p { font-size:13.5px; color:var(--ink-500); }
.tra-head-r { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.tra-seg { display:flex; background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:3px; }
.tra-seg button { padding:6px 12px; font-size:12.5px; color:var(--ink-600); border-radius:7px; font-weight:500; }
.tra-seg button.is-on { background:var(--ink-900); color:#fff; font-weight:600; }
.tra-add { padding:9px 14px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:12.5px; font-weight:600; }
.tra-add:hover { background:var(--purple-700); }

.tra-hero { display:grid; grid-template-columns:1.5fr 1fr; gap:22px; background:linear-gradient(135deg, var(--purple-50), oklch(0.97 0.03 280)); border:1px solid var(--purple-200); border-radius:18px; padding:22px 24px; margin-bottom:22px; }
@media (max-width:1024px) { .tra-hero { grid-template-columns:1fr; } }
.tra-hero-k { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; color:var(--purple-700); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:8px; }
.tra-hero-spark-icon { color:var(--purple-500); font-size:13px; }
.tra-hero h2 { font-size:22px; font-weight:700; color:var(--ink-950); margin-bottom:6px; letter-spacing:-0.015em; line-height:1.35; }
.tra-hero-sub { font-size:13px; color:var(--ink-600); margin-bottom:12px; font-weight:500; }
.tra-hero-why { font-size:13px; color:var(--ink-700); line-height:1.7; margin-bottom:14px; max-width:560px; }
.tra-hero-acts { display:flex; gap:8px; flex-wrap:wrap; }
.tra-btn { padding:8px 14px; border-radius:9px; font-size:12.5px; font-weight:600; transition:all .15s; }
.tra-btn.primary { background:var(--purple-600); color:#fff; }
.tra-btn.primary:hover { background:var(--purple-700); }
.tra-btn.ghost { background:transparent; color:var(--purple-800); }
.tra-btn.ghost:hover { background:rgba(124,92,239,0.08); }
.tra-btn.primary-sm { padding:6px 11px; border-radius:7px; font-size:11.5px; background:var(--purple-600); color:#fff; }
.tra-btn.primary-sm:hover { background:var(--purple-700); }
.tra-btn.ghost-sm { padding:6px 11px; border-radius:7px; font-size:11.5px; color:var(--ink-700); background:var(--ink-100); }
.tra-btn.ghost-sm:hover { background:var(--ink-150); }

.tra-hero-r { display:flex; flex-direction:column; gap:10px; }
.tra-hero-stat { background:var(--surface); border-radius:12px; padding:12px 14px; }
.tra-hero-stat-k { font-size:11px; color:var(--ink-500); font-weight:500; }
.tra-hero-stat-row { display:flex; align-items:center; justify-content:space-between; margin-top:4px; gap:10px; }
.tra-hero-stat-v { font-size:22px; font-weight:700; color:var(--purple-700); letter-spacing:-0.015em; }
.tra-hero-meta { background:var(--surface); border-radius:12px; padding:10px 14px; display:flex; flex-direction:column; gap:6px; }
.tra-hero-meta > div { display:flex; justify-content:space-between; align-items:center; font-size:12px; gap:10px; }
.tra-hero-meta-k { color:var(--ink-500); }
.tra-hero-meta-v { color:var(--ink-900); font-weight:600; }

.tra-phase { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:99px; font-size:11px; font-weight:600; }
.tra-phase i { width:5px; height:5px; border-radius:50%; }

.tra-chips { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:22px; }
@media (max-width:768px) { .tra-chips { grid-template-columns:repeat(2,1fr); } }
.tra-chip { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
.tra-chip-v { font-size:22px; font-weight:700; letter-spacing:-0.015em; line-height:1; }
.tra-chip-l { font-size:11.5px; color:var(--ink-500); margin-top:4px; font-weight:500; }

/* Flat secondary cards used by the new hashtag/format/heatmap sections */
.tra-card-flat { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin-bottom:14px; }
.tra-card-flat .tra-sec-h { padding:0; }
.tra-sec-sub { font-size:12px; color:var(--ink-500); font-weight:500; }

/* Hashtags */
.tra-hashtags { display:flex; flex-wrap:wrap; gap:8px; }
.tra-hashtag-chip { display:inline-flex; align-items:center; gap:8px; padding:6px 12px; background:var(--ink-50); border:1px solid var(--line); border-radius:99px; font-size:12px; }
.tra-hashtag-tag { color:var(--ink-900); font-weight:600; }
.tra-hashtag-vol { color:var(--ink-500); font-weight:500; font-size:11px; }
.tra-hashtag-mom { font-weight:700; font-size:11.5px; }

/* Format trends */
.tra-format-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:768px) { .tra-format-grid { grid-template-columns:1fr; } }
.tra-format-card { padding:14px 16px; border-radius:12px; border:1px solid var(--line); background:var(--surface); }
.tra-format-h { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:6px; }
.tra-format-card h3 { font-size:14px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; margin:0; }
.tra-format-mom { font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:99px; }
.tra-format-card p { font-size:12.5px; color:var(--ink-700); line-height:1.55; margin:0 0 8px; }
.tra-format-foot { font-size:11px; color:var(--ink-500); }

/* Heatmap (mirrors Competitors heatmap) */
.tra-heat { display:flex; flex-direction:column; gap:3px; }
.tra-heat-cols { display:grid; grid-template-columns:24px repeat(10,1fr); gap:3px; font-size:9.5px; color:var(--ink-400); margin-bottom:4px; padding-inline-start:3px; }
.tra-heat-cols span { text-align:center; font-weight:500; }
.tra-heat-grid { display:flex; flex-direction:column; gap:3px; }
.tra-heat-row { display:grid; grid-template-columns:24px repeat(10,1fr); gap:3px; }
.tra-heat-day { font-size:10px; color:var(--ink-500); display:grid; place-items:center; font-weight:600; }
.tra-heat-cell { aspect-ratio:1; min-height:22px; border-radius:4px; border:1.5px solid; transition:transform .12s; }
.tra-heat-cell:hover { transform:scale(1.15); }
.tra-heat-hint { font-size:11px; color:var(--ink-600); margin-top:10px; }

.tra-grid { display:grid; grid-template-columns:1.7fr 1fr; gap:18px; align-items:start; }
@media (max-width:1024px) { .tra-grid { grid-template-columns:1fr; } }
.tra-col-main { display:flex; flex-direction:column; gap:14px; }
.tra-col-side { display:flex; flex-direction:column; gap:14px; }
@media (min-width:1024px) { .tra-col-side { position:sticky; top:16px; } }
.tra-sec-h { display:flex; justify-content:space-between; align-items:center; padding:0 4px; flex-wrap:wrap; gap:10px; }
.tra-sec-h h2 { font-size:16px; font-weight:700; color:var(--ink-900); letter-spacing:-0.01em; }
.tra-sort { display:flex; align-items:center; gap:4px; font-size:11.5px; color:var(--ink-500); }
.tra-sort button { padding:4px 9px; border-radius:6px; color:var(--ink-600); font-weight:500; }
.tra-sort button.is-on { background:var(--ink-100); color:var(--ink-900); font-weight:600; }
.tra-stack { display:flex; flex-direction:column; gap:10px; }

.tra-card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:16px 18px; position:relative; transition:border-color .15s, box-shadow .15s; }
.tra-card::before { content:''; position:absolute; top:14px; bottom:14px; inset-inline-start:0; width:3px; border-radius:0 3px 3px 0; background:var(--accent); opacity:.85; }
.tra-card:hover { border-color:var(--line-strong); box-shadow:0 1px 0 rgba(28,26,40,0.04); }
.tra-card-h { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.tra-card-h-l { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.tra-cat-dot { width:6px; height:6px; border-radius:50%; }
.tra-cat-l { font-size:11px; color:var(--ink-500); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
.tra-card-tag { font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:99px; background:var(--accent-tint); color:var(--accent); }
.tra-card-t { font-size:17px; font-weight:700; color:var(--ink-950); margin-bottom:3px; letter-spacing:-0.012em; line-height:1.35; }
.tra-card-s { font-size:12.5px; color:var(--ink-500); margin-bottom:12px; }
.tra-card-stats { display:grid; grid-template-columns:repeat(3, max-content); gap:28px; align-items:center; padding:10px 14px; background:var(--ink-50); border-radius:10px; margin-bottom:12px; }
@media (max-width:600px) { .tra-card-stats { grid-template-columns:1fr 1fr 1fr; gap:16px; } }
.tra-stat-k { font-size:10.5px; color:var(--ink-500); font-weight:500; display:block; margin-bottom:2px; }
.tra-stat-v { font-size:14px; font-weight:700; color:var(--ink-950); letter-spacing:-0.005em; }
.tra-card-why { font-size:12.5px; color:var(--ink-700); line-height:1.65; margin-bottom:12px; }
.tra-card-angles { background:var(--purple-50); border:1px solid var(--purple-200); border-radius:10px; padding:10px 12px; margin-bottom:12px; }
.tra-card-angles-h { font-size:11px; font-weight:700; color:var(--purple-700); margin-bottom:6px; letter-spacing:0.03em; text-transform:uppercase; }
.tra-card-angles ul { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:4px; }
.tra-card-angles li { font-size:12.5px; color:var(--ink-800); display:flex; align-items:flex-start; gap:7px; line-height:1.55; }
.tra-bul { color:var(--purple-500); font-weight:700; flex-shrink:0; margin-top:1px; }
.tra-card-f { display:flex; justify-content:space-between; align-items:center; padding-top:4px; flex-wrap:wrap; gap:10px; }
.tra-card-time { display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--ink-500); }
.tra-card-time strong { color:var(--ink-800); font-weight:600; }
.tra-card-acts { display:flex; gap:6px; flex-wrap:wrap; }

.tra-cal, .tra-macro { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:16px 18px; }
.tra-cal-h h3, .tra-macro-h h3, .tra-sec-h h2 { font-size:15px; font-weight:700; color:var(--ink-900); letter-spacing:-0.005em; }
.tra-cal-h p, .tra-macro-h p { font-size:12px; color:var(--ink-500); margin:3px 0 14px; }
.tra-cal-list { list-style:none; margin:0; padding:0; }
.tra-cal-i { display:flex; gap:12px; padding-bottom:12px; }
.tra-cal-rail { width:14px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; padding-top:4px; }
.tra-cal-mark { width:9px; height:9px; border-radius:50%; background:var(--ink-200); border:2px solid var(--surface); box-shadow:0 0 0 1px var(--ink-300); }
.tra-cal-i.is-med .tra-cal-mark { background:#d4881e; box-shadow:0 0 0 1px #d4881e; }
.tra-cal-i.is-big .tra-cal-mark { background:#d4881e; box-shadow:0 0 0 1px #d4881e, 0 0 0 5px #fbf1e0; width:11px; height:11px; }
.tra-cal-line { flex:1; width:1.5px; background:var(--ink-200); margin-top:4px; }
.tra-cal-d { font-size:11px; color:var(--ink-500); font-weight:500; }
.tra-cal-t { font-size:13.5px; font-weight:600; color:var(--ink-900); margin:1px 0 3px; }
.tra-cal-tag { font-size:10.5px; font-weight:600; padding:2px 7px; border-radius:99px; background:#fbf1e0; color:#d4881e; display:inline-block; }
.tra-cal-tag--med { background:var(--ink-100); color:var(--ink-700); }

.tra-macro-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px; }
.tra-macro-i { padding:12px; background:var(--ink-50); border-radius:10px; border:1px solid transparent; }
.tra-macro-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px; flex-wrap:wrap; }
.tra-macro-tag { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:99px; }
.tra-macro-mom { font-size:12.5px; font-weight:700; }
.tra-macro-t { font-size:13.5px; font-weight:700; color:var(--ink-900); margin-bottom:2px; line-height:1.35; }
.tra-macro-s { font-size:11.5px; color:var(--ink-500); margin-bottom:6px; }
.tra-macro-w { font-size:11.5px; color:var(--ink-700); line-height:1.6; }
`
