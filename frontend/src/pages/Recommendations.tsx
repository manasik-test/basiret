import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  useContentPlan,
  useGenerateCaption,
  useAccounts,
} from '../hooks/useAnalytics'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import { Icon, I, TypeIcon, normalizeContentType } from '../components/redesign/icons'
import type { ContentPlanDay } from '../api/analytics'
import { usePosts, useCalendar, useDeletePost } from '../hooks/useCreator'
import type { ScheduledPost } from '../api/creator'
import { cn } from '../lib/utils'

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
  const navigate = useNavigate()
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
            onClick={() => navigate('/create')}
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
            <button
              className="cp-ghost"
              onClick={() => {
                // Pre-fill the wizard from this AI Plan day so the user
                // doesn't have to retype topic / type / time.
                const params = new URLSearchParams({
                  date: sel.date,
                  topic: sel.topic ?? '',
                  time: sel.best_time ?? '',
                  type: normalizeContentType(sel.content_type),
                })
                navigate(`/create?${params.toString()}`)
              }}
            >
              <Icon path={I.spark} size={14} />
              {t('contentPlanPage.createFromDay')}
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

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8',       // slate
  scheduled: '#5433c2',   // primary purple
  publishing: '#f59e0b',  // amber
  published: '#10b981',   // emerald
  failed: '#ef4444',      // red
  cancelled: '#9ca3af',   // gray
}

function CalendarTab() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isAr = !!i18n.language?.startsWith('ar')
  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [filter, setFilter] = useState<CalendarFilter>('all')
  const [openPost, setOpenPost] = useState<ScheduledPost | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ScheduledPost | null>(null)

  const accountsQ = useAccounts()
  const accountId = accountsQ.data?.[0]?.id
  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
  const calendar = useCalendar(monthKey, accountId)
  const deleteMut = useDeletePost()

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
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  type Cell = { day: number | null; isToday: boolean; iso: string | null }
  const cells: Cell[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, isToday: false, iso: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({
      day: d,
      isToday: year === todayY && month === todayM && d === todayD,
      iso,
    })
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, isToday: false, iso: null })

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i)
    return d.toLocaleDateString(
      isAr ? 'ar-EG-u-ca-gregory' : 'en-US',
      { weekday: 'short' },
    )
  })

  const filterKeys: CalendarFilter[] = ['all', 'scheduled', 'published', 'draft']
  function filterPosts(posts: ScheduledPost[]): ScheduledPost[] {
    if (filter === 'all') return posts
    return posts.filter((p) => p.status === filter)
  }

  function dayPosts(iso: string | null): ScheduledPost[] {
    if (!iso || !calendar.data) return []
    return filterPosts(calendar.data[iso]?.posts ?? [])
  }

  // Show the centered empty-state hint only when the visible month is
  // entirely empty after filtering — once the user has any posts, we let
  // the cards speak for themselves.
  const monthHasContent = calendar.data
    ? Object.values(calendar.data).some((d) => filterPosts(d.posts ?? []).length > 0)
    : false

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
          {cells.map((cell, i) => {
            if (cell.day === null) {
              return <div key={i} className="cp-cal-cell is-blank" aria-hidden />
            }
            const posts = dayPosts(cell.iso)
            return (
              <button
                key={i}
                type="button"
                className={cn(
                  'cp-cal-cell',
                  cell.isToday && 'is-today',
                  posts.length > 0 && 'has-posts',
                )}
                onClick={() => {
                  if (posts.length === 0) {
                    navigate(`/create?date=${cell.iso}`)
                  } else {
                    // Open the most recent post; multi-post days could
                    // surface a stacked picker in a follow-up.
                    setOpenPost(posts[0]!)
                  }
                }}
                aria-label={t('contentPlanPage.calendar.dayLabel', { d: cell.day })}
              >
                <span className="cp-cal-num num">{cell.day}</span>
                {posts.slice(0, 2).map((p) => (
                  <span
                    key={p.id}
                    className="cp-cal-card"
                    style={{ borderInlineStartColor: STATUS_COLOR[p.status] ?? '#94a3b8' }}
                    dir="auto"
                  >
                    {(p.caption_en || p.caption_ar || t('contentPlanPage.calendar.noCaption'))
                      .split(/\s+/)
                      .slice(0, 3)
                      .join(' ')}
                  </span>
                ))}
                {posts.length > 2 && (
                  <span className="cp-cal-more">+{posts.length - 2}</span>
                )}
              </button>
            )
          })}
        </div>
        {!monthHasContent && (
          <div className="cp-cal-empty" aria-live="polite">
            {t('contentPlanPage.calendar.empty')}
          </div>
        )}
      </div>

      {openPost && (
        <PostDetailPanel
          post={openPost}
          onClose={() => setOpenPost(null)}
          onEdit={(p) => {
            // Edit mode: load the saved post into the wizard so the user
            // picks up where they left off instead of starting blank.
            navigate(`/create?edit=${p.id}`)
          }}
          onDelete={(p) => setConfirmDelete(p)}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteDialog
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const id = confirmDelete.id
            setConfirmDelete(null)
            setOpenPost(null)
            await deleteMut.mutateAsync(id)
          }}
        />
      )}
    </div>
  )
}

/* ---------------- Drafts / Published tabs ---------------- */

function DraftsTab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const list = usePosts('draft')
  const deleteMut = useDeletePost()
  const [confirmDelete, setConfirmDelete] = useState<ScheduledPost | null>(null)

  if (list.isLoading) {
    return <div className="cp-loading">{t('contentPlanPage.loading')}</div>
  }
  if (!list.data || list.data.length === 0) {
    return (
      <EmptyListTab
        iconPath={I.pencil}
        title={t('contentPlanPage.drafts.title')}
        body={t('contentPlanPage.drafts.body')}
        cta={t('contentPlanPage.createPost')}
        onCta={() => navigate('/create')}
      />
    )
  }

  return (
    <>
      <div className="cp-list-card">
        {list.data.map((p) => (
          <PostRow
            key={p.id}
            post={p}
            mode="draft"
            onEdit={() => navigate(`/create?edit=${p.id}`)}
            onDelete={() => setConfirmDelete(p)}
          />
        ))}
      </div>
      {confirmDelete && (
        <ConfirmDeleteDialog
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const id = confirmDelete.id
            setConfirmDelete(null)
            await deleteMut.mutateAsync(id)
          }}
        />
      )}
    </>
  )
}

function PublishedTab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const list = usePosts('published')
  const deleteMut = useDeletePost()
  const [confirmDelete, setConfirmDelete] = useState<ScheduledPost | null>(null)

  if (list.isLoading) {
    return <div className="cp-loading">{t('contentPlanPage.loading')}</div>
  }
  if (!list.data || list.data.length === 0) {
    return (
      <EmptyListTab
        iconPath={I.trend}
        title={t('contentPlanPage.published.title')}
        body={t('contentPlanPage.published.body')}
        cta={t('contentPlanPage.createPost')}
        onCta={() => navigate('/create')}
      />
    )
  }

  return (
    <>
      <div className="cp-list-card">
        {list.data.map((p) => (
          <PostRow
            key={p.id}
            post={p}
            mode="published"
            onEdit={() => navigate(`/create?edit=${p.id}`)}
            onDelete={() => setConfirmDelete(p)}
          />
        ))}
      </div>
      {confirmDelete && (
        <ConfirmDeleteDialog
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const id = confirmDelete.id
            setConfirmDelete(null)
            await deleteMut.mutateAsync(id)
          }}
        />
      )}
    </>
  )
}

function EmptyListTab({
  iconPath,
  title,
  body,
  cta,
  onCta,
}: {
  iconPath: React.ReactNode
  title: string
  body: string
  cta: string
  onCta?: () => void
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
        onClick={() => onCta?.()}
      >
        <Icon path={I.spark} size={14} />
        <span>{cta}</span>
      </button>
    </div>
  )
}

/* ---------------- Shared row + panel + delete dialog ---------------- */

function PostRow({
  post,
  mode,
  onEdit,
  onDelete,
}: {
  post: ScheduledPost
  mode: 'draft' | 'published'
  onEdit: () => void
  onDelete: () => void
}) {
  const { t, i18n } = useTranslation()
  const isAr = !!i18n.language?.startsWith('ar')
  const caption = post.caption_en || post.caption_ar || t('contentPlanPage.calendar.noCaption')
  const captionShort = caption.length > 80 ? `${caption.slice(0, 80).trim()}…` : caption
  const thumb = post.media_urls?.[0] ?? null

  let helper: string = ''
  let helperTone = ''
  if (mode === 'draft' && post.draft_expires_at) {
    const days = Math.max(
      0,
      Math.ceil(
        (new Date(post.draft_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    )
    helper = t('contentPlanPage.drafts.expiresIn', { n: days })
    helperTone = days <= 2 ? 'is-bad' : days <= 5 ? 'is-warn' : ''
  } else if (mode === 'published' && post.published_at) {
    helper = new Date(post.published_at).toLocaleDateString(
      isAr ? 'ar-EG-u-ca-gregory' : 'en-US',
      { month: 'short', day: 'numeric', year: 'numeric' },
    )
  }

  return (
    <div className="cp-row-card">
      <div className="cp-row-thumb">
        {thumb ? <img src={thumb} alt="" /> : <Icon path={I.calendar} size={20} />}
      </div>
      <div className="cp-row-body">
        <p className="cp-row-cap" dir="auto">{captionShort}</p>
        {helper && <span className={cn('cp-row-helper', helperTone)}>{helper}</span>}
      </div>
      <div className="cp-row-actions">
        <button onClick={onEdit} className="cp-ghost">
          <Icon path={I.pencil} size={14} />
          {t('contentPlanPage.editAction')}
        </button>
        <button onClick={onDelete} className="cp-row-delete" aria-label={t('contentPlanPage.delete.action')}>
          <Icon path={I.warn} size={14} />
        </button>
      </div>
    </div>
  )
}

function PostDetailPanel({
  post,
  onClose,
  onEdit,
  onDelete,
}: {
  post: ScheduledPost
  onClose: () => void
  onEdit: (post: ScheduledPost) => void
  onDelete: (post: ScheduledPost) => void
}) {
  const { t } = useTranslation()
  const caption = post.caption_en || post.caption_ar || ''
  return (
    <div className="cp-panel-back" onClick={onClose}>
      <aside className="cp-panel" onClick={(e) => e.stopPropagation()} dir="auto">
        <div className="cp-panel-head">
          <h3 className="cp-panel-title">{t('contentPlanPage.calendar.detailTitle')}</h3>
          <button onClick={onClose} aria-label="close" className="cp-panel-close">
            <Icon path={I.chevR} size={16} />
          </button>
        </div>
        {post.media_urls?.[0] && (
          <img src={post.media_urls[0]} alt="" className="cp-panel-img" />
        )}
        <div className="cp-panel-meta">
          <span
            className="cp-panel-status"
            style={{ background: STATUS_COLOR[post.status] ?? '#94a3b8' }}
          >
            {t(`contentPlanPage.calendar.filter.${post.status === 'published' ? 'published' : post.status === 'scheduled' ? 'scheduled' : 'draft'}`)}
          </span>
          {post.scheduled_at && (
            <span className="cp-panel-time num">
              {new Date(post.scheduled_at).toLocaleString()}
            </span>
          )}
        </div>
        <p className="cp-panel-caption" dir="auto">{caption || t('contentPlanPage.calendar.noCaption')}</p>
        {post.hashtags?.length > 0 && (
          <p className="cp-panel-tags" dir="auto">
            {post.hashtags.map((h) => `#${h}`).join(' ')}
          </p>
        )}
        <div className="cp-panel-actions">
          <button onClick={() => onEdit(post)} className="cp-ghost">
            <Icon path={I.pencil} size={14} />
            {t('contentPlanPage.editAction')}
          </button>
          <button onClick={() => onDelete(post)} className="cp-row-delete">
            <Icon path={I.warn} size={14} />
            {t('contentPlanPage.delete.action')}
          </button>
        </div>
      </aside>
    </div>
  )
}

function ConfirmDeleteDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <div className="cp-modal-back" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="cp-modal-title">{t('contentPlanPage.delete.confirmTitle')}</h3>
        <p className="cp-modal-body">{t('contentPlanPage.delete.confirmBody')}</p>
        <div className="cp-modal-actions">
          <button onClick={onCancel} className="cp-ghost">
            {t('contentPlanPage.delete.cancel')}
          </button>
          <button onClick={() => onConfirm()} className="cp-modal-danger">
            {t('contentPlanPage.delete.confirm')}
          </button>
        </div>
      </div>
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

/* Calendar day-cell post chips */
.cp-cal-cell.has-posts { background:var(--surface); border-color:var(--line); }
.cp-cal-cell { flex-direction:column; align-items:stretch; gap:4px; }
.cp-cal-card { font-size:10.5px; font-weight:500; color:var(--ink-700); padding:3px 6px; border-inline-start:3px solid #94a3b8; background:var(--ink-50); border-radius:4px; line-height:1.3; text-align:start; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cp-cal-more { font-size:10.5px; color:var(--ink-500); font-weight:600; padding:0 6px; }

/* Drafts + Published list rows */
.cp-list-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; overflow:hidden; }
.cp-row-card { display:flex; align-items:center; gap:14px; padding:14px 18px; border-bottom:1px solid var(--line); transition:background .1s; }
.cp-row-card:last-child { border-bottom:0; }
.cp-row-card:hover { background:var(--ink-50); }
.cp-row-thumb { width:56px; height:56px; border-radius:10px; background:var(--ink-100); display:grid; place-items:center; color:var(--ink-500); flex-shrink:0; overflow:hidden; }
.cp-row-thumb img { width:100%; height:100%; object-fit:cover; }
.cp-row-body { flex:1; display:flex; flex-direction:column; gap:4px; min-width:0; }
.cp-row-cap { font-size:13.5px; color:var(--ink-900); font-weight:500; line-height:1.4; overflow:hidden; text-overflow:ellipsis; }
.cp-row-helper { font-size:11.5px; color:var(--ink-500); font-weight:500; }
.cp-row-helper.is-warn { color:#b45309; }
.cp-row-helper.is-bad { color:#b91c1c; }
.cp-row-actions { display:flex; gap:6px; flex-shrink:0; }
.cp-row-delete { display:inline-flex; align-items:center; gap:5px; padding:8px 10px; background:transparent; color:#b91c1c; border-radius:8px; font-size:12px; font-weight:600; transition:background .12s; }
.cp-row-delete:hover { background:rgba(185, 28, 28, 0.08); }

/* Slide-in detail panel for Calendar */
.cp-panel-back { position:fixed; inset:0; background:rgba(20,16,40,.4); z-index:50; display:flex; justify-content:flex-end; }
.cp-panel { width:min(420px, 92vw); height:100%; background:var(--surface); padding:22px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }
.cp-panel-head { display:flex; align-items:center; justify-content:space-between; }
.cp-panel-title { font-size:15px; font-weight:700; color:var(--ink-950); }
.cp-panel-close { width:30px; height:30px; border-radius:8px; display:grid; place-items:center; background:var(--ink-100); color:var(--ink-700); }
.cp-panel-img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:12px; background:var(--ink-100); }
.cp-panel-meta { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.cp-panel-status { padding:3px 10px; border-radius:99px; color:#fff; font-size:11px; font-weight:600; text-transform:capitalize; }
.cp-panel-time { font-size:12px; color:var(--ink-600); font-variant-numeric:tabular-nums; }
.cp-panel-caption { font-size:13.5px; color:var(--ink-900); line-height:1.55; white-space:pre-wrap; }
.cp-panel-tags { font-size:12.5px; color:var(--purple-700); font-weight:500; }
.cp-panel-actions { display:flex; gap:8px; padding-top:14px; border-top:1px solid var(--line); }

/* Delete confirmation modal */
.cp-modal-back { position:fixed; inset:0; background:rgba(20,16,40,.45); z-index:60; display:grid; place-items:center; padding:18px; }
.cp-modal { background:var(--surface); border-radius:14px; padding:22px; max-width:380px; width:100%; display:flex; flex-direction:column; gap:12px; }
.cp-modal-title { font-size:16px; font-weight:700; color:var(--ink-950); }
.cp-modal-body { font-size:13.5px; color:var(--ink-600); line-height:1.55; }
.cp-modal-actions { display:flex; gap:8px; justify-content:flex-end; padding-top:6px; }
.cp-modal-danger { padding:9px 16px; background:#dc2626; color:#fff; border-radius:8px; font-size:13px; font-weight:600; transition:background .12s; }
.cp-modal-danger:hover { background:#b91c1c; }
`
