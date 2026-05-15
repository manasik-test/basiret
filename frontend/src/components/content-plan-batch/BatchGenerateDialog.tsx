/**
 * Confirmation dialog for the "Generate all 7 posts" feature.
 *
 * Two-option radio + Remember checkbox. Skipped entirely when the user has
 * already opted into a default action via `batch_generate_remember=true`.
 *
 * The parent (Recommendations.tsx) handles that skip-the-dialog branch — this
 * component only renders when explicitly opened. Tailwind classes only, so it
 * isn't coupled to the ContentPlanCreate page's scoped CSS.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BatchGenerateAction } from '../../api/analytics'

export interface BatchGenerateDialogProps {
  open: boolean
  /** Pre-selected action (e.g. when the user has a saved default but chose
   *  to surface the dialog anyway via the "review choice" path). Defaults to
   *  'drafts' per spec — the recommended option. */
  initialAction?: BatchGenerateAction
  initialRemember?: boolean
  onConfirm: (action: BatchGenerateAction, remember: boolean) => void
  onCancel: () => void
}

export default function BatchGenerateDialog({
  open,
  initialAction = 'drafts',
  initialRemember = false,
  onConfirm,
  onCancel,
}: BatchGenerateDialogProps) {
  const { t } = useTranslation()
  const [action, setAction] = useState<BatchGenerateAction>(initialAction)
  const [remember, setRemember] = useState<boolean>(initialRemember)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Reset on every open so a previous mid-flight selection doesn't leak into
  // a fresh dialog instance.
  useEffect(() => {
    if (open) {
      setAction(initialAction)
      setRemember(initialRemember)
    }
  }, [open, initialAction, initialRemember])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] grid place-items-center p-4"
      style={{ background: 'rgba(20,16,40,.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-dialog-title"
      data-testid="batch-generate-dialog"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        dir="auto"
      >
        <h3
          id="batch-dialog-title"
          className="text-lg font-bold text-slate-900"
          dir="auto"
        >
          {t('contentPlanPage.batch.dialog.title')}
        </h3>
        <p className="text-sm text-slate-600 mt-2" dir="auto">
          {t('contentPlanPage.batch.dialog.body')}
        </p>

        <div className="mt-4 space-y-3">
          <RadioOption
            id="batch-drafts"
            checked={action === 'drafts'}
            onChange={() => setAction('drafts')}
            label={t('contentPlanPage.batch.dialog.draftsTitle')}
            description={t('contentPlanPage.batch.dialog.draftsDesc')}
            recommended
          />
          <RadioOption
            id="batch-schedule"
            checked={action === 'schedule'}
            onChange={() => setAction('schedule')}
            label={t('contentPlanPage.batch.dialog.scheduleTitle')}
            description={t('contentPlanPage.batch.dialog.scheduleDesc')}
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            data-testid="batch-remember-checkbox"
          />
          <span dir="auto">{t('contentPlanPage.batch.dialog.remember')}</span>
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium"
            onClick={onCancel}
            data-testid="batch-cancel-btn"
          >
            {t('contentPlanPage.batch.dialog.cancel')}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-[var(--purple-600)] hover:bg-[var(--purple-700)] text-white text-sm font-semibold shadow"
            style={{ background: '#5433c2' }}
            onClick={() => onConfirm(action, remember)}
            data-testid="batch-confirm-btn"
          >
            {t('contentPlanPage.batch.dialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RadioOption({
  id,
  checked,
  onChange,
  label,
  description,
  recommended,
}: {
  id: string
  checked: boolean
  onChange: () => void
  label: string
  description: string
  recommended?: boolean
}) {
  const { t } = useTranslation()
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
        checked
          ? 'border-[#5433c2] bg-purple-50/40'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <input
        type="radio"
        id={id}
        name="batch-action"
        className="mt-1"
        checked={checked}
        onChange={onChange}
        data-testid={id}
      />
      <span className="flex-1 min-w-0" dir="auto">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 text-sm">{label}</span>
          {recommended && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              {t('contentPlanPage.batch.dialog.recommended')}
            </span>
          )}
        </span>
        <span className="block text-xs text-slate-600 mt-0.5">{description}</span>
      </span>
    </label>
  )
}
