import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useContentPlan,
  useGenerateCaption,
  useAccounts,
} from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import { Icon, I, TypeIcon, normalizeContentType } from '../components/redesign/icons'
import type { ContentPlanDay } from '../api/analytics'

/* ---------------- helpers ---------------- */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
function toArDigits(s: string | number): string {
  return String(s)
    .split('')
    .map((d) => (d >= '0' && d <= '9' ? AR_DIGITS[+d]! : d))
    .join('')
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const TYPE_COLOR: Record<string, string> = {
  video: 'oklch(0.55 0.2 25)',
  image: 'oklch(0.55 0.18 155)',
  carousel: 'oklch(0.5 0.2 295)',
  reel: 'oklch(0.55 0.2 25)',
}

const TYPE_THUMB_BG: Record<string, string> = {
  video: 'linear-gradient(135deg, oklch(0.92 0.06 25), oklch(0.85 0.09 25))',
  image: 'linear-gradient(135deg, oklch(0.92 0.06 155), oklch(0.85 0.09 155))',
  carousel: 'linear-gradient(135deg, var(--purple-100), var(--purple-200))',
  reel: 'linear-gradient(135deg, oklch(0.92 0.06 25), oklch(0.85 0.09 25))',
}

/* ---------------- main page ---------------- */

function ContentPlanContent() {
  const { t, i18n } = useTranslation()
  const isAr = !!i18n.language?.startsWith('ar')
  const { data, isLoading } = useContentPlan()
  const { data: accounts } = useAccounts()
  const accountId = accounts?.[0]?.id
  const generate = useGenerateCaption()

  const [selectedIdx, setSelectedIdx] = useState(0)
  const [filter, setFilter] = useState<'all' | 'video' | 'image' | 'carousel'>('all')
  const [captions, setCaptions] = useState<Record<number, string>>({})
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null)

  const days: ContentPlanDay[] = data?.days ?? []
  const filtered = useMemo(
    () =>
      filter === 'all'
        ? days
        : days.filter((d) => normalizeContentType(d.content_type) === filter),
    [days, filter],
  )

  const typeCounts = useMemo(
    () => ({
      all: days.length,
      video: days.filter((d) => normalizeContentType(d.content_type) === 'video').length,
      image: days.filter((d) => normalizeContentType(d.content_type) === 'image').length,
      carousel: days.filter((d) => normalizeContentType(d.content_type) === 'carousel').length,
    }),
    [days],
  )

  // Keep selection inside the current filter — if the selected row gets
  // filtered out, jump to the first row in view.
  useEffect(() => {
    if (filtered.length === 0) return
    const stillVisible = filtered.some((d) => days.indexOf(d) === selectedIdx)
    if (!stillVisible) setSelectedIdx(days.indexOf(filtered[0]!))
  }, [filter, filtered, days, selectedIdx])

  const sel = days[selectedIdx]
  const selCaption = captions[selectedIdx]

  // Keyboard navigation through the filtered list.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'j' && e.key !== 'k') return
      const cur = filtered.findIndex((d) => days.indexOf(d) === selectedIdx)
      if (cur < 0) return
      e.preventDefault()
      const dir = e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1
      const next = filtered[Math.max(0, Math.min(filtered.length - 1, cur + dir))]
      if (next) setSelectedIdx(days.indexOf(next))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [days, filtered, selectedIdx])

  function handleGenerate() {
    if (!sel) return
    setGeneratingIdx(selectedIdx)
    generate.mutate(
      {
        content_type: sel.content_type,
        topic: sel.topic,
        language: isAr ? 'ar' : 'en',
        account_id: accountId,
      },
      {
        onSuccess: (res) => {
          setCaptions((c) => ({ ...c, [selectedIdx]: res.caption || '' }))
          setGeneratingIdx(null)
        },
        onError: () => {
          setCaptions((c) => ({ ...c, [selectedIdx]: t('contentPlanPage.captionError') }))
          setGeneratingIdx(null)
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="rd-canvas"><div className="cp">
        <div className="cp-loading">{t('contentPlanPage.loading')}</div>
        <style>{CP_STYLES}</style>
      </div></div>
    )
  }
  if (!sel || days.length === 0) {
    return (
      <div className="rd-canvas"><div className="cp">
        <div className="cp-loading">{t('contentPlanPage.empty')}</div>
        <style>{CP_STYLES}</style>
      </div></div>
    )
  }

  // Header derived bits
  const firstDate = new Date(days[0]!.date + 'T00:00:00')
  const lastDate = new Date(days[days.length - 1]!.date + 'T00:00:00')
  const weekNum = isoWeek(firstDate)
  const dateLocale = isAr ? 'ar-EG-u-ca-gregory' : 'en-US'
  const monthShort = (d: Date) =>
    d.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })
  const weekRange = `${monthShort(firstDate)} — ${monthShort(lastDate)}`

  // Selected day formatted bits
  const selDate = new Date(sel.date + 'T00:00:00')
  const selDayName = t(`contentPlanPage.day.${sel.day_label.toLowerCase()}`)
  const selMonthDay = monthShort(selDate)
  const selType = normalizeContentType(sel.content_type)

  return (
    <div className="rd-canvas"><div className="cp">
      {/* Page header */}
      <header className="cp-head">
        <div>
          <div className="cp-titlerow">
            <h1 className="cp-title" dir="auto">{t('contentPlanPage.title')}</h1>
            <span className="cp-badge">
              <span className="cp-dot" />
              {isAr ? toArDigits(days.length) : days.length} {t('contentPlanPage.daysBadge')}
            </span>
          </div>
          <p className="cp-sub" dir="auto">{t('contentPlanPage.subtitle')}</p>
        </div>

        <div className="cp-head-act">
          <div className="cp-search">
            <Icon path={I.search} size={14} />
            <span>{t('contentPlanPage.searchPlaceholder')}</span>
            <kbd>⌘K</kbd>
          </div>
          <button className="cp-regen">
            <Icon path={I.spark} size={14} />
            <span>{t('contentPlanPage.regeneratePlan')}</span>
          </button>
          <button
            className="cp-create"
            type="button"
            // No-op until Sprint 3 lands the Post Creator. The button is
            // already rendered + styled so the layout doesn't shift when
            // the handler is wired up.
            onClick={() => undefined}
          >
            <Icon path={I.spark} size={14} />
            <span>{t('contentPlanPage.createPost')}</span>
          </button>
        </div>
      </header>

      {/* Split: list + sticky preview */}
      <div className="cp-split">
        {/* LIST */}
        <section className="cp-list">
          <div className="cp-list-head">
            <div className="cp-week">
              <button className="cp-nav" aria-label="prev week">
                <Icon path={I.chevR} size={14} />
              </button>
              <div className="cp-week-txt">
                <div className="cp-week-label">
                  {t('contentPlanPage.weekLabel', { n: isAr ? toArDigits(weekNum) : weekNum })}
                </div>
                <div className="cp-week-range num" dir="auto">{weekRange}</div>
              </div>
              <button className="cp-nav" aria-label="next week">
                <Icon path={I.chevL} size={14} />
              </button>
            </div>

            <div className="cp-filters">
              {(['all', 'video', 'image', 'carousel'] as const).map((k) => {
                const lbl = t(
                  `contentPlanPage.filter${k.charAt(0).toUpperCase() + k.slice(1)}` as
                    | 'contentPlanPage.filterAll'
                    | 'contentPlanPage.filterVideo'
                    | 'contentPlanPage.filterImage'
                    | 'contentPlanPage.filterCarousel',
                )
                const c = typeCounts[k]
                return (
                  <button
                    key={k}
                    className={`cp-filter ${filter === k ? 'is-on' : ''}`}
                    onClick={() => setFilter(k)}
                  >
                    {lbl} <span className="num">· {isAr ? toArDigits(c) : c}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="cp-rows">
            {filtered.map((d) => {
              const realIdx = days.indexOf(d)
              const tNorm = normalizeContentType(d.content_type)
              const color = TYPE_COLOR[tNorm] || TYPE_COLOR.image!
              const dayName = t(`contentPlanPage.day.${d.day_label.toLowerCase()}`)
              const md = monthShort(new Date(d.date + 'T00:00:00'))
              const hasCaption = !!captions[realIdx]
              const typeLabel = t(`contentPlanPage.filter${tNorm.charAt(0).toUpperCase() + tNorm.slice(1)}` as 'contentPlanPage.filterVideo')
              return (
                <button
                  key={realIdx}
                  className={`cp-row ${realIdx === selectedIdx ? 'is-on' : ''}`}
                  onClick={() => setSelectedIdx(realIdx)}
                >
                  <div className="cp-row-date">
                    <div className="cp-row-day">{dayName}</div>
                    <div className="cp-row-num num" dir="auto">{md}</div>
                  </div>

                  <div className="cp-row-tline" style={{ background: color }} />

                  <div className="cp-row-body">
                    <div className="cp-row-top">
                      <span className="cp-row-type" style={{ color }}>
                        <TypeIcon type={tNorm} size={12} /> {typeLabel}
                      </span>
                      {hasCaption && (
                        <span className="cp-row-done">
                          <Icon path={I.check} size={10} /> {t('contentPlanPage.readyTag')}
                        </span>
                      )}
                    </div>
                    <div className="cp-row-topic" dir="auto">
                      {d.topic || t('contentPlanPage.topicEmpty')}
                    </div>
                  </div>

                  <div className="cp-row-meta">
                    <div className="cp-row-time num" dir="auto">
                      <Icon path={I.clock} size={11} />
                      {d.best_time}
                    </div>
                    <div className="cp-row-eng num">
                      {t('contentPlanPage.reachLabel', {
                        n: isAr ? toArDigits(d.estimated_reach) : d.estimated_reach,
                      })}
                    </div>
                  </div>

                  <div className="cp-row-chev">
                    <Icon path={I.chevL} size={14} />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="cp-list-foot">
            <span className="cp-foot-hint">
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              {t('contentPlanPage.navHint')}
            </span>
            <span className="num cp-foot-count">
              {t('contentPlanPage.captionsReady', {
                n: isAr ? toArDigits(Object.keys(captions).length) : Object.keys(captions).length,
                total: isAr ? toArDigits(days.length) : days.length,
              })}
            </span>
          </div>
        </section>

        {/* PREVIEW */}
        <aside className="cp-preview">
          <div className="cp-prev-head">
            <div>
              <div className="cp-prev-day">
                <span dir="auto">
                  {selDayName}, {selMonthDay}
                </span>
                <span className="cp-prev-dot">·</span>
                <span className="num" dir="auto">{sel.best_time}</span>
              </div>
              <h2 className="cp-prev-topic" dir="auto">
                {sel.topic || t('contentPlanPage.topicEmpty')}
              </h2>
            </div>
            <button className="cp-prev-more" aria-label="more">
              <Icon path={I.more} size={16} />
            </button>
          </div>

          <div className="cp-thumb" style={{ background: TYPE_THUMB_BG[selType] || TYPE_THUMB_BG.image }}>
            <span className="cp-thumb-pill">
              <TypeIcon type={selType} size={11} />
              {t(`contentPlanPage.filter${selType.charAt(0).toUpperCase() + selType.slice(1)}` as 'contentPlanPage.filterVideo')}
            </span>
            <span className="cp-thumb-tag">{t('contentPlanPage.suggestedBadge')}</span>
          </div>

          <div className="cp-prev-stats">
            <div>
              <div className="cp-prev-lbl">{t('contentPlanPage.typeLabel')}</div>
              <div className="cp-prev-val">
                {t(`contentPlanPage.filter${selType.charAt(0).toUpperCase() + selType.slice(1)}` as 'contentPlanPage.filterVideo')}
              </div>
            </div>
            <div className="cp-prev-sep" />
            <div>
              <div className="cp-prev-lbl">{t('contentPlanPage.expectedEngagement')}</div>
              <div className="cp-prev-val num" style={{ color: 'var(--purple-700)' }} dir="auto">
                {isAr ? toArDigits(sel.estimated_reach) : sel.estimated_reach}
              </div>
            </div>
            <div className="cp-prev-sep" />
            <div>
              <div className="cp-prev-lbl">{t('contentPlanPage.platformLabel')}</div>
              <div className="cp-prev-val">{t('contentPlanPage.platformValue')}</div>
            </div>
          </div>

          <div
            className={`cp-cap ${selCaption ? 'has-cap' : ''} ${
              generatingIdx === selectedIdx ? 'is-gen' : ''
            }`}
          >
            <div className="cp-cap-head">
              <span className="cp-cap-title">
                <Icon path={I.wand} size={13} />
                {t('contentPlanPage.captionTitle')}
              </span>
              {selCaption ? (
                <button className="cp-cap-regen" onClick={handleGenerate}>
                  {t('contentPlanPage.captionRegenSmall')}
                </button>
              ) : (
                <span className="cp-cap-empty">{t('contentPlanPage.captionEmpty')}</span>
              )}
            </div>
            {generatingIdx === selectedIdx ? (
              <div className="cp-cap-loading">
                <div className="cp-loader" />
                <span>{t('contentPlanPage.captionLoading')}</span>
              </div>
            ) : selCaption ? (
              <div className="cp-cap-text" dir="auto">{selCaption}</div>
            ) : (
              <div className="cp-cap-placeholder" dir="auto">
                {t('contentPlanPage.captionPlaceholder')}
              </div>
            )}
          </div>

          <div className="cp-prev-actions">
            <button className="cp-ghost">
              <Icon path={I.pencil} size={14} />
              {t('contentPlanPage.editAction')}
            </button>
            <button
              className="cp-cta"
              onClick={handleGenerate}
              disabled={generatingIdx === selectedIdx}
            >
              <Icon path={I.wand} size={14} />
              {selCaption
                ? t('contentPlanPage.regenCaptionCta')
                : t('contentPlanPage.createCaptionCta')}
            </button>
          </div>
        </aside>
      </div>

      <style>{CP_STYLES}</style>
    </div></div>
  )
}

type ContentPlanTab = 'ai' | 'calendar' | 'drafts' | 'published'

export default function Recommendations() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('content_recommendations')
  const [tab, setTab] = useState<ContentPlanTab>('ai')

  // Tab bar lives INSIDE the LockedFeature wrapper so all four tabs share
  // the same Pro-tier gate as the AI plan. Starter users see the blurred
  // overlay across the entire surface (consistent with the rest of the
  // pricing model).
  return (
    <LockedFeature locked={isLocked} featureName={t('nav.contentPlan')}>
      <div className="rd-canvas">
        <div className="cp-shell">
          <div className="cp-tabs" role="tablist">
            {(
              [
                { key: 'ai', labelKey: 'contentPlanPage.tabs.ai' },
                { key: 'calendar', labelKey: 'contentPlanPage.tabs.calendar' },
                { key: 'drafts', labelKey: 'contentPlanPage.tabs.drafts' },
                { key: 'published', labelKey: 'contentPlanPage.tabs.published' },
              ] as const
            ).map(({ key, labelKey }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? 'cp-tab is-on' : 'cp-tab'}
                onClick={() => setTab(key)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          {tab === 'ai' && <ContentPlanContent />}
          {tab === 'calendar' && <CalendarTab />}
          {tab === 'drafts' && <DraftsTab />}
          {tab === 'published' && <PublishedTab />}
        </div>
        <style>{CP_TAB_STYLES}</style>
      </div>
    </LockedFeature>
  )
}

/* ---------------- Calendar tab ---------------- */

type CalendarFilter = 'all' | 'scheduled' | 'published' | 'draft'

function CalendarTab() {
  const { t, i18n } = useTranslation()
  const isAr = !!i18n.language?.startsWith('ar')
  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [filter, setFilter] = useState<CalendarFilter>('all')

  const today = new Date()
  const todayY = today.getFullYear()
  const todayM = today.getMonth()
  const todayD = today.getDate()

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const monthLabel = cursor.toLocaleDateString(
    isAr ? 'ar-EG-u-ca-gregory' : 'en-US',
    { month: 'long', year: 'numeric' },
  )

  // Build a Sunday-first 6×7 grid covering the displayed month.
  // First-of-month's weekday tells us how many leading blanks to render.
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ day: number | null; isToday: boolean }> = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, isToday: false })
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isToday: year === todayY && month === todayM && d === todayD,
    })
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, isToday: false })

  // Localized weekday header. Use a fixed Sunday in 2024 (a known Sun) +
  // increment, so the labels respect the active locale and show as
  // "Sun Mon Tue …" / "أحد إثنين ثلاثاء …".
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i) // Jan 7 2024 was a Sunday
    return d.toLocaleDateString(
      isAr ? 'ar-EG-u-ca-gregory' : 'en-US',
      { weekday: 'short' },
    )
  })

  const filterKeys: CalendarFilter[] = ['all', 'scheduled', 'published', 'draft']
  void filter // filter is wired to the pills today; counts/data hook up in Sprint 3.

  return (
    <div className="cp-cal">
      <div className="cp-cal-head">
        <div className="cp-cal-nav">
          <button
            type="button"
            className="cp-nav"
            aria-label={t('contentPlanPage.calendar.prev')}
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <Icon path={I.chevR} size={14} />
          </button>
          <div className="cp-cal-month" dir="auto">{monthLabel}</div>
          <button
            type="button"
            className="cp-nav"
            aria-label={t('contentPlanPage.calendar.next')}
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <Icon path={I.chevL} size={14} />
          </button>
        </div>
        <div className="cp-cal-filters" role="tablist">
          {filterKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'cp-filter is-on' : 'cp-filter'}
              onClick={() => setFilter(key)}
            >
              {t(`contentPlanPage.calendar.filter.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-cal-grid-wrap">
        <div className="cp-cal-grid cp-cal-weekdays">
          {weekdayLabels.map((w, i) => (
            <div key={i} className="cp-cal-weekday">{w}</div>
          ))}
        </div>
        <div className="cp-cal-grid cp-cal-days">
          {cells.map((cell, i) =>
            cell.day === null ? (
              <div key={i} className="cp-cal-cell is-blank" aria-hidden />
            ) : (
              <button
                key={i}
                type="button"
                className={cell.isToday ? 'cp-cal-cell is-today' : 'cp-cal-cell'}
                // No-op until Sprint 3 — clicking a day will open the
                // Post Creator pre-filled with that date.
                onClick={() => undefined}
                aria-label={t('contentPlanPage.calendar.dayLabel', { d: cell.day })}
              >
                <span className="cp-cal-num num">{cell.day}</span>
              </button>
            ),
          )}
        </div>
        <div className="cp-cal-empty" aria-live="polite">
          {t('contentPlanPage.calendar.empty')}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Drafts / Published tabs ---------------- */

function DraftsTab() {
  const { t } = useTranslation()
  return (
    <EmptyListTab
      iconPath={I.pencil}
      title={t('contentPlanPage.drafts.title')}
      body={t('contentPlanPage.drafts.body')}
      cta={t('contentPlanPage.createPost')}
    />
  )
}

function PublishedTab() {
  const { t } = useTranslation()
  return (
    <EmptyListTab
      iconPath={I.trend}
      title={t('contentPlanPage.published.title')}
      body={t('contentPlanPage.published.body')}
      cta={t('contentPlanPage.createPost')}
    />
  )
}

function EmptyListTab({
  iconPath,
  title,
  body,
  cta,
}: {
  iconPath: React.ReactNode
  title: string
  body: string
  cta: string
}) {
  return (
    <div className="cp-empty-card">
      <div className="cp-empty-icon">
        <Icon path={iconPath} size={32} />
      </div>
      <h2 className="cp-empty-title" dir="auto">{title}</h2>
      <p className="cp-empty-body" dir="auto">{body}</p>
      <button
        type="button"
        className="cp-create"
        // No-op for now; Sprint 3 wires the Post Creator.
        onClick={() => undefined}
      >
        <Icon path={I.spark} size={14} />
        <span>{cta}</span>
      </button>
    </div>
  )
}

/* ---------------- styles (translated from OptionCApp) ---------------- */

const CP_STYLES = `
.cp { display:flex; flex-direction:column; gap:22px; max-width:1480px; margin:0 auto; padding-top:18px; }
.cp-loading { padding:48px; text-align:center; color:var(--ink-500); font-size:13px; background:var(--surface); border:1px dashed var(--line); border-radius:18px; }

/* Page header */
.cp-head { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; flex-wrap:wrap; }
.cp-titlerow { display:flex; align-items:center; gap:12px; margin-bottom:6px; }
.cp-title { font-size:30px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1.15; }
.cp-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:99px; background:var(--purple-50); color:var(--purple-700); font-size:12px; font-weight:600; }
.cp-dot { width:6px; height:6px; border-radius:50%; background:var(--purple-500); box-shadow:0 0 0 3px rgba(84,51,194,.18); }
.cp-sub { font-size:13.5px; color:var(--ink-500); max-width:560px; line-height:1.55; }

.cp-head-act { display:flex; gap:10px; align-items:center; flex-shrink:0; }
.cp-search { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--surface); border:1px solid var(--line); border-radius:10px; font-size:13px; color:var(--ink-500); min-width:260px; }
.cp-search kbd { margin-inline-start:auto; font-size:10.5px; background:var(--ink-100); padding:2px 6px; border-radius:4px; color:var(--ink-600); }
.cp-regen { display:flex; align-items:center; gap:8px; padding:11px 18px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:13px; font-weight:600; box-shadow:0 6px 16px -6px rgba(84,51,194,.55), inset 0 1px 0 rgba(255,255,255,.15); transition:background .12s, transform .12s; }
.cp-regen:hover { background:var(--purple-700); transform:translateY(-1px); }

/* Split */
.cp-split { display:grid; grid-template-columns:1.35fr 1fr; gap:18px; min-height:0; }
@media (max-width:1100px) { .cp-split { grid-template-columns:1fr; } .cp-preview { position:relative !important; top:0 !important; } }

/* List */
.cp-list { background:var(--surface); border:1px solid var(--line); border-radius:18px; display:flex; flex-direction:column; overflow:hidden; }
.cp-list-head { padding:18px 22px 14px; border-bottom:1px solid var(--line); display:flex; flex-direction:column; gap:14px; }
.cp-week { display:flex; align-items:center; gap:14px; }
.cp-week-txt { flex:1; }
.cp-week-label { font-size:11px; color:var(--ink-500); font-weight:500; margin-bottom:2px; }
.cp-week-range { font-size:14.5px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; }
.cp-nav { width:30px; height:30px; border-radius:8px; display:grid; place-items:center; color:var(--ink-600); background:var(--ink-100); transition:background .12s, color .12s; }
.cp-nav:hover { background:var(--ink-150); color:var(--ink-900); }

.cp-filters { display:flex; gap:6px; flex-wrap:wrap; }
.cp-filter { padding:6px 12px; border-radius:99px; background:transparent; border:1px solid var(--line); font-size:12px; color:var(--ink-600); font-weight:500; transition:all .12s; }
.cp-filter:hover { border-color:var(--line-strong); color:var(--ink-900); }
.cp-filter.is-on { background:var(--ink-900); color:#fff; border-color:var(--ink-900); }
.cp-filter .num { opacity:.7; font-size:11px; }

.cp-rows { padding:6px 10px; display:flex; flex-direction:column; flex:1; overflow:auto; max-height:560px; }
.cp-row { display:grid; grid-template-columns:68px 3px 1fr auto 18px; align-items:center; gap:14px; padding:16px 14px; border-radius:12px; text-align:start; transition:background .1s; position:relative; width:100%; background:transparent; border:none; cursor:pointer; }
.cp-row + .cp-row::before { content:''; position:absolute; top:0; inset-inline:14px; height:1px; background:var(--line); }
.cp-row:hover { background:var(--ink-50); }
.cp-row:hover::before, .cp-row:hover + .cp-row::before { opacity:0; }
.cp-row.is-on { background:var(--purple-50); }
.cp-row.is-on::before, .cp-row.is-on + .cp-row::before { opacity:0; }
.cp-row.is-on .cp-row-topic { color:var(--purple-900); }
.cp-row.is-on .cp-row-num { color:var(--purple-800); }

.cp-row-date { text-align:start; }
.cp-row-day { font-size:11px; color:var(--ink-500); font-weight:500; }
.cp-row-num { font-size:14.5px; font-weight:700; color:var(--ink-900); letter-spacing:-0.01em; margin-top:2px; }
.cp-row-tline { width:3px; height:36px; border-radius:3px; }

.cp-row-top { display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap; }
.cp-row-type { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; }
.cp-row-done { display:inline-flex; align-items:center; gap:3px; font-size:10px; font-weight:700; color:oklch(0.5 0.15 155); background:oklch(0.95 0.05 155); padding:2px 7px; border-radius:99px; }
.cp-row-topic { font-size:14px; font-weight:600; color:var(--ink-900); line-height:1.4; letter-spacing:-0.005em; }

.cp-row-meta { display:flex; flex-direction:column; align-items:flex-end; gap:3px; }
.cp-row-time { font-size:12px; color:var(--ink-700); font-weight:600; display:inline-flex; align-items:center; gap:4px; }
.cp-row-eng { font-size:11px; color:var(--ink-400); font-weight:500; }
.cp-row-chev { color:var(--ink-300); transition:color .12s, transform .12s; }
.cp-row.is-on .cp-row-chev { color:var(--purple-600); }

.cp-list-foot { border-top:1px solid var(--line); padding:12px 22px; display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--ink-500); }
.cp-foot-hint { display:inline-flex; align-items:center; gap:6px; }
.cp-foot-hint kbd { font-size:10px; font-weight:600; background:var(--ink-100); color:var(--ink-700); padding:1px 5px; border-radius:4px; box-shadow:0 1px 0 var(--ink-200); }
.cp-foot-count { font-weight:600; color:var(--ink-700); }

/* Preview */
.cp-preview { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:18px; position:sticky; top:24px; align-self:flex-start; max-height:calc(100vh - 48px); overflow:auto; }
.cp-prev-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.cp-prev-day { font-size:12px; color:var(--ink-500); font-weight:500; margin-bottom:6px; display:inline-flex; align-items:center; gap:6px; }
.cp-prev-dot { color:var(--ink-300); }
.cp-prev-topic { font-size:22px; font-weight:700; color:var(--ink-950); letter-spacing:-0.02em; line-height:1.25; }
.cp-prev-more { width:32px; height:32px; border-radius:8px; display:grid; place-items:center; color:var(--ink-500); flex-shrink:0; }
.cp-prev-more:hover { background:var(--ink-100); color:var(--ink-900); }

.cp-thumb { height:200px; border-radius:14px; position:relative; overflow:hidden; }
.cp-thumb-pill { position:absolute; bottom:12px; inset-inline-end:12px; display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:99px; background:rgba(255,255,255,.92); backdrop-filter:blur(8px); font-size:11px; font-weight:700; color:var(--ink-900); }
.cp-thumb-tag { position:absolute; top:12px; inset-inline-start:12px; padding:4px 10px; border-radius:99px; background:rgba(255,255,255,.92); backdrop-filter:blur(8px); font-size:11px; font-weight:700; color:var(--purple-700); }

.cp-prev-stats { display:flex; padding:14px 18px; background:var(--ink-50); border-radius:14px; align-items:center; gap:16px; }
.cp-prev-stats > div:not(.cp-prev-sep) { flex:1; }
.cp-prev-sep { width:1px; height:28px; background:var(--line); flex-shrink:0; }
.cp-prev-lbl { font-size:10.5px; color:var(--ink-500); margin-bottom:4px; font-weight:500; letter-spacing:0.01em; }
.cp-prev-val { font-size:14px; font-weight:700; color:var(--ink-900); letter-spacing:-0.005em; }

/* Caption block */
.cp-cap { background:var(--ink-50); border-radius:14px; padding:16px; border:1px dashed var(--ink-200); transition:background .15s, border-color .15s; }
.cp-cap.has-cap { background:var(--purple-50); border:1px solid var(--purple-200); border-style:solid; }
.cp-cap.is-gen { background:var(--purple-50); border-color:var(--purple-300); border-style:solid; }
.cp-cap-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.cp-cap-title { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; color:var(--ink-800); letter-spacing:0.02em; }
.cp-cap.has-cap .cp-cap-title, .cp-cap.is-gen .cp-cap-title { color:var(--purple-800); }
.cp-cap-empty { font-weight:500; color:var(--ink-400); font-size:11px; }
.cp-cap-regen { font-size:11px; font-weight:600; color:var(--purple-700); padding:3px 8px; border-radius:6px; }
.cp-cap-regen:hover { background:var(--purple-100); }
.cp-cap-placeholder { font-size:13px; color:var(--ink-500); line-height:1.6; }
.cp-cap-text { font-size:13.5px; color:var(--ink-900); line-height:1.7; white-space:pre-wrap; font-weight:500; }
.cp-cap-loading { display:flex; align-items:center; gap:10px; font-size:12.5px; color:var(--purple-800); padding:4px 0; }
.cp-loader { width:14px; height:14px; border:2px solid var(--purple-200); border-top-color:var(--purple-600); border-radius:50%; animation:cp-spin .7s linear infinite; }
@keyframes cp-spin { to { transform:rotate(360deg); } }

.cp-prev-actions { display:flex; gap:10px; margin-top:auto; }
.cp-ghost { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:12px; background:var(--ink-100); color:var(--ink-800); border-radius:10px; font-size:13px; font-weight:600; transition:background .12s; }
.cp-ghost:hover { background:var(--ink-150); }
.cp-cta { flex:1.4; display:flex; align-items:center; justify-content:center; gap:7px; padding:12px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:13px; font-weight:600; box-shadow:0 6px 16px -6px rgba(84,51,194,.55), inset 0 1px 0 rgba(255,255,255,.15); transition:background .12s, transform .12s; }
.cp-cta:hover:not(:disabled) { background:var(--purple-700); transform:translateY(-1px); }
.cp-cta:disabled { opacity:.7; cursor:not-allowed; }

/* Magenta "Create post" CTA shared by AI Plan header + empty-state tabs.
   Uses the brand CTA color (#BF499B) so it's visually distinct from the
   primary purple regenerate button next to it. */
.cp-create { display:inline-flex; align-items:center; gap:8px; padding:11px 18px; background:#BF499B; color:#fff; border-radius:10px; font-size:13px; font-weight:600; box-shadow:0 6px 16px -6px rgba(191,73,155,.55), inset 0 1px 0 rgba(255,255,255,.15); transition:background .12s, transform .12s; }
.cp-create:hover { background:#A83B85; transform:translateY(-1px); }
`

/* Styles for the Sprint-2 tab bar + Calendar tab + empty-state tabs.
   Kept separate from CP_STYLES so the AI-Plan view stays untouched and
   the new shell can evolve independently. */
const CP_TAB_STYLES = `
.cp-shell { display:flex; flex-direction:column; gap:18px; max-width:1480px; margin:0 auto; padding-top:18px; }

/* Tab bar */
.cp-tabs { display:flex; gap:4px; padding:4px; background:var(--surface); border:1px solid var(--line); border-radius:12px; align-self:flex-start; }
.cp-tab { padding:8px 18px; border-radius:8px; font-size:13px; font-weight:600; color:var(--ink-600); transition:background .12s, color .12s; background:transparent; border:none; cursor:pointer; }
.cp-tab:hover { color:var(--ink-900); background:var(--ink-50); }
.cp-tab.is-on { background:var(--purple-600); color:#fff; box-shadow:0 4px 12px -4px rgba(84,51,194,.45); }
.cp-tab.is-on:hover { background:var(--purple-700); color:#fff; }

/* Override: when an "AI Plan" tab is active, the existing .cp container
   already provides its own padding-top — strip the shell's top padding
   so we don't double up. */
.cp-shell > .rd-canvas:first-of-type, .cp-shell > .cp { padding-top:0; }

/* Calendar */
.cp-cal { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:18px; }
.cp-cal-head { display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; }
.cp-cal-nav { display:flex; align-items:center; gap:14px; }
.cp-cal-month { font-size:18px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; min-width:180px; text-align:center; }
.cp-cal-filters { display:flex; gap:6px; flex-wrap:wrap; }

.cp-cal-grid-wrap { position:relative; }
.cp-cal-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; }
.cp-cal-weekdays { margin-bottom:6px; }
.cp-cal-weekday { text-align:center; font-size:11px; font-weight:600; color:var(--ink-500); text-transform:uppercase; letter-spacing:0.04em; padding:6px 0; }

.cp-cal-cell { aspect-ratio:1.05; border-radius:10px; background:var(--ink-50); border:1px solid transparent; display:flex; align-items:flex-start; justify-content:flex-start; padding:8px 10px; color:var(--ink-700); font-size:13px; font-weight:600; transition:background .12s, border-color .12s, color .12s; cursor:pointer; }
.cp-cal-cell:hover { background:var(--purple-50); border-color:var(--purple-200); color:var(--purple-900); }
.cp-cal-cell.is-blank { background:transparent; cursor:default; pointer-events:none; }
.cp-cal-cell.is-today { background:var(--purple-100); border-color:var(--purple-300); color:var(--purple-900); }
.cp-cal-cell.is-today:hover { background:var(--purple-200); }
.cp-cal-num { font-variant-numeric:tabular-nums; }

/* Empty-state overlay sits centered on top of the empty grid so the
   month structure stays visible behind it. pointer-events:none lets day
   clicks pass through. */
.cp-cal-empty { position:absolute; inset:50% 0 auto 0; transform:translateY(-50%); text-align:center; font-size:13px; color:var(--ink-500); padding:0 18px; pointer-events:none; }

/* Empty-state cards for Drafts + Published */
.cp-empty-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:64px 24px; display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; }
.cp-empty-icon { width:64px; height:64px; border-radius:16px; background:var(--purple-50); color:var(--purple-700); display:grid; place-items:center; }
.cp-empty-title { font-size:18px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; }
.cp-empty-body { font-size:13.5px; color:var(--ink-500); max-width:420px; line-height:1.6; }
`
