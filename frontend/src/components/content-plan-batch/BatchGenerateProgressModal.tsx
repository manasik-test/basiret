/**
 * Per-day progress modal for the "Generate all 7 posts" batch flow.
 *
 * Polls /content-plan/batch-progress every 4s while the batch is running
 * (handled by the parent's `useBatchProgress` hook). Renders one row per day
 * showing image/caption sub-status and a counter in the header ("X/7 ready").
 *
 * "Continue in background" and X both call `onClose` — generation keeps running
 * server-side either way. The parent decides whether to show a toast when the
 * batch later completes.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { BatchProgressData, BatchDayStatus } from '../../api/analytics'

export interface BatchGenerateProgressModalProps {
  open: boolean
  progress: BatchProgressData | null
  onClose: () => void
}

const DAY_LABELS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function BatchGenerateProgressModal({
  open,
  progress,
  onClose,
}: BatchGenerateProgressModalProps) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language?.startsWith('ar')

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const dayEntries: [number, BatchDayStatus][] = []
  for (let i = 0; i < 7; i++) {
    const entry = (progress?.per_day_status?.[String(i)] as BatchDayStatus | undefined) ?? {
      status: 'queued',
      scheduled_post_id: null,
      error: null,
      fell_back_to_draft: false,
    }
    dayEntries.push([i, entry])
  }

  const doneCount = dayEntries.filter(([, e]) => e.status === 'done').length
  const failedCount = dayEntries.filter(([, e]) => e.status === 'failed').length
  const totalSettled = doneCount + failedCount
  const headerCounter = `${doneCount}/7`

  return (
    <div
      className="fixed inset-0 z-[55] grid place-items-center p-4"
      style={{ background: 'rgba(20,16,40,.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-progress-title"
      data-testid="batch-progress-modal"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl relative max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir="auto"
      >
        <button
          type="button"
          className="absolute top-3 end-3 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 text-2xl leading-none"
          aria-label={t('contentPlanPage.batch.progress.close')}
          onClick={onClose}
          data-testid="batch-progress-close"
        >
          ×
        </button>

        <div className="flex items-start gap-3 pe-8">
          <div className="flex-1 min-w-0">
            <h3
              id="batch-progress-title"
              className="text-lg font-bold text-slate-900"
              dir="auto"
            >
              {t('contentPlanPage.batch.progress.title')}
            </h3>
            <p className="text-sm text-slate-600 mt-0.5" dir="auto">
              {t('contentPlanPage.batch.progress.subtitle', {
                done: headerCounter,
              })}
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-2">
          {dayEntries.map(([idx, entry]) => (
            <li
              key={idx}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
              data-testid={`batch-day-row-${idx}`}
            >
              <span className="text-xs font-semibold text-slate-700 min-w-[80px]">
                {dayLabel(idx, isAr, t)}
              </span>
              <span className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                <StatusIcon status={entry.status} />
                <span className="text-slate-700" dir="auto">
                  {statusText(entry, t)}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {progress?.error_message && (
          <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3" dir="auto">
            {progress.error_message}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {progress?.status === 'running'
              ? t('contentPlanPage.batch.progress.runningHint')
              : t('contentPlanPage.batch.progress.doneHint', {
                  done: doneCount,
                  failed: failedCount,
                  total: totalSettled,
                })}
          </span>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium"
            onClick={onClose}
            data-testid="batch-progress-continue"
          >
            {progress?.status === 'running'
              ? t('contentPlanPage.batch.progress.continueBackground')
              : t('contentPlanPage.batch.progress.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function dayLabel(
  idx: number,
  isAr: boolean,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  // Days are relative to "today" — day 0 = today's weekday name. Match the
  // existing Content Plan list which uses the dayName i18n keys.
  const today = new Date()
  const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + idx)
  const weekday = DAY_LABELS_EN[(target.getDay() + 6) % 7]! // back-shift so Monday=0
  if (isAr) {
    return t(`contentPlanPage.day.${weekday.toLowerCase()}`)
  }
  return weekday
}

function statusText(
  entry: BatchDayStatus,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (entry.status === 'failed') {
    return entry.error || t('contentPlanPage.batch.progress.failed')
  }
  if (entry.status === 'done') {
    return entry.fell_back_to_draft
      ? t('contentPlanPage.batch.progress.doneFellBack')
      : t('contentPlanPage.batch.progress.done')
  }
  if (entry.status === 'generating_image') {
    return t('contentPlanPage.batch.progress.image')
  }
  if (entry.status === 'generating_caption') {
    return t('contentPlanPage.batch.progress.caption')
  }
  if (entry.status === 'saving') {
    return t('contentPlanPage.batch.progress.saving')
  }
  return t('contentPlanPage.batch.progress.queued')
}

function StatusIcon({ status }: { status: BatchDayStatus['status'] }) {
  if (status === 'done') {
    return <span className="text-emerald-600 text-sm font-bold">✓</span>
  }
  if (status === 'failed') {
    return <span className="text-rose-600 text-sm font-bold">!</span>
  }
  if (status === 'queued') {
    return <span className="text-slate-400 text-sm">·</span>
  }
  return (
    <span className="inline-block w-3 h-3 rounded-full border-2 border-slate-300 border-t-[#5433c2] animate-spin" />
  )
}
