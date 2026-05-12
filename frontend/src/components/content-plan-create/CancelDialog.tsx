import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export interface CancelDialogProps {
  open: boolean
  /** "Update the suggestion (until next refresh)" — PATCH the topic into ai_page_cache. */
  onUpdateSuggestion: () => void
  /** "Save as draft" — POST a draft scheduled_post with whatever fields exist. */
  onSaveDraft: () => void
  /** "Discard" — abandon the wizard, no save. */
  onDiscard: () => void
  /**
   * Invoked when the user closes via X / ESC / backdrop. By contract this MUST
   * resolve to a save-as-draft (the caller passes the same callback used for
   * the explicit Save-as-draft button) so closing the dialog never silently
   * loses work.
   */
  onDefaultClose: () => void
}

/**
 * Three-choice cancel dialog for the Content Plan create wizard.
 *
 * Default-on-close (X / ESC / backdrop) is implemented as a separate `onDefaultClose`
 * prop rather than aliased to one of the action callbacks. Callers are expected
 * to pass the same function they use for `onSaveDraft` so the "never lose work"
 * contract is unmissable at the call site, not buried in this component.
 */
export default function CancelDialog({
  open,
  onUpdateSuggestion,
  onSaveDraft,
  onDiscard,
  onDefaultClose,
}: CancelDialogProps) {
  const { t } = useTranslation()
  const lastFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement as HTMLElement | null
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onDefaultClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (lastFocus.current) lastFocus.current.focus()
    }
  }, [open, onDefaultClose])

  if (!open) return null

  return (
    <div
      className="cpc-modal-back"
      onClick={onDefaultClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpc-cancel-title"
      data-testid="cancel-dialog"
    >
      <div
        className="cpc-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="cpc-modal-x"
          aria-label={t('contentPlanCreate.cancel.close')}
          onClick={onDefaultClose}
          data-testid="cancel-dialog-x"
        >
          ×
        </button>
        <h3 id="cpc-cancel-title" className="cpc-modal-title" dir="auto">
          {t('contentPlanCreate.cancel.title')}
        </h3>
        <p className="cpc-modal-body" dir="auto">
          {t('contentPlanCreate.cancel.body')}
        </p>
        <div className="cpc-modal-actions">
          <button
            type="button"
            className="cpc-modal-secondary"
            onClick={onUpdateSuggestion}
            data-testid="cancel-action-update-suggestion"
          >
            {t('contentPlanCreate.cancel.updateSuggestion')}
          </button>
          <button
            type="button"
            className="cpc-modal-primary"
            onClick={onSaveDraft}
            data-testid="cancel-action-save-draft"
          >
            {t('contentPlanCreate.cancel.saveDraft')}
          </button>
          <button
            type="button"
            className="cpc-modal-danger"
            onClick={onDiscard}
            data-testid="cancel-action-discard"
          >
            {t('contentPlanCreate.cancel.discard')}
          </button>
        </div>
      </div>
    </div>
  )
}
