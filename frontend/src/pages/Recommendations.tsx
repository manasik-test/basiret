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
      <div className="cp">
        <div className="cp-loading">{t('contentPlanPage.loading')}</div>
        <style>{CP_STYLES}</style>
      </div>
    )
  }
  if (!sel || days.length === 0) {
    return (
      <div className="cp">
        <div className="cp-loading">{t('contentPlanPage.empty')}</div>
        <style>{CP_STYLES}</style>
      </div>
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
    <div className="cp">
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
    </div>
  )
}

export default function Recommendations() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('content_recommendations')

  return (
    <LockedFeature locked={isLocked} featureName={t('nav.contentPlan')}>
      <ContentPlanContent />
    </LockedFeature>
  )
}

/* ---------------- styles (translated from OptionCApp) ---------------- */

const CP_STYLES = `
.cp { display:flex; flex-direction:column; gap:22px; max-width:1480px; margin:0 auto; }
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
`
