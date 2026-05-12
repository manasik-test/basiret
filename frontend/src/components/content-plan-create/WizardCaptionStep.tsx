import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useGenerateCaption, useAccounts } from '../../hooks/useAnalytics'
import type {
  GenerateCaptionRequest,
  ImageAnalysis,
} from '../../api/analytics'

export type WizardLanguage = 'en' | 'ar'
export type WizardImageRatio = '1:1' | '4:5' | '16:9'

export interface WizardCaptionStepProps {
  imageUrl: string | null
  imageRatio: WizardImageRatio
  imageAnalysis: ImageAnalysis | null
  topic: string
  refinedPrompt: string
  language: WizardLanguage
  caption: string
  onChangeLanguage: (next: WizardLanguage) => void
  onChangeCaption: (next: string) => void
}

/**
 * Generation request. The backend's `/ai-pages/generate-caption` endpoint
 * doesn't accept an `image_url` field — image content reaches the prompt via
 * the `image_analysis` block instead (already populated in the background by
 * the image step's `useAnalyzeImage` call). Spec said "pass image_url" but
 * the API doesn't take one; the practical equivalent is `image_analysis`,
 * which carries the same downstream signal.
 */
function buildCaptionRequest(
  refinedPrompt: string,
  imageRatio: WizardImageRatio,
  language: WizardLanguage,
  imageAnalysis: ImageAnalysis | null,
  accountId: string | undefined,
): GenerateCaptionRequest {
  return {
    content_type: 'image',
    topic: refinedPrompt,
    language,
    image_ratio: imageRatio,
    ...(imageAnalysis ? { image_analysis: imageAnalysis } : {}),
    ...(accountId ? { account_id: accountId } : {}),
  }
}

export default function WizardCaptionStep(props: WizardCaptionStepProps) {
  const {
    imageUrl,
    imageRatio,
    imageAnalysis,
    topic,
    refinedPrompt,
    language,
    caption,
    onChangeLanguage,
    onChangeCaption,
  } = props
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const accounts = useAccounts()
  const accountId = accounts.data?.[0]?.id
  const generate = useGenerateCaption()

  /** The caption text that was last produced by an AI generation. Used to
   *  detect whether the user has edited the caption since generation — the
   *  Regenerate path warns before clobbering manual edits. */
  const [lastGeneratedCaption, setLastGeneratedCaption] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const isGenerating = generate.isPending
  const hasImage = !!imageUrl
  const hasCaption = caption.trim().length > 0
  const userEdited = hasCaption && caption !== lastGeneratedCaption

  const doGenerate = useCallback(() => {
    if (!hasImage || isGenerating) return
    setError(null)
    const req = buildCaptionRequest(
      refinedPrompt,
      imageRatio,
      language,
      imageAnalysis,
      accountId,
    )
    generate.mutate(req, {
      onSuccess: (data) => {
        const next = data.caption ?? ''
        onChangeCaption(next)
        setLastGeneratedCaption(next)
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg || t('contentPlanCreate.caption.errorGenerate'))
      },
    })
  }, [
    hasImage, isGenerating, refinedPrompt, imageRatio, language,
    imageAnalysis, accountId, generate, onChangeCaption, t,
  ])

  /** Regenerate entry point — warns first if the user has edited the
   *  current caption since the last AI generation. */
  const onRegenerateClick = useCallback(() => {
    if (userEdited) {
      setConfirmReplace(true)
    } else {
      doGenerate()
    }
  }, [userEdited, doGenerate])

  const onConfirmReplace = useCallback(() => {
    setConfirmReplace(false)
    doGenerate()
  }, [doGenerate])

  const onCancelReplace = useCallback(() => {
    setConfirmReplace(false)
  }, [])

  // Auto-resize textarea so longer captions don't get cramped.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(360, Math.max(140, ta.scrollHeight))}px`
  }, [caption])

  return (
    <div className="cpc-caption" data-testid="wizard-step-caption">
      {/* Image + topic summary header */}
      <div className="cpc-cap-header">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={t('contentPlanCreate.caption.thumbAlt')}
            className="cpc-cap-thumb"
            data-testid="caption-thumb"
          />
        ) : (
          <div className="cpc-cap-thumb cpc-cap-thumb-empty" aria-hidden />
        )}
        <div className="cpc-cap-meta">
          <div className="cpc-label cpc-label-muted">
            {t('contentPlanCreate.caption.topicLabel')}
          </div>
          <div className="cpc-cap-topic" dir="auto" data-testid="caption-topic">
            {topic}
          </div>
          {refinedPrompt && refinedPrompt !== topic && (
            <div
              className="cpc-cap-prompt"
              dir="auto"
              data-testid="caption-refined-prompt"
            >
              {refinedPrompt}
            </div>
          )}
        </div>
      </div>

      {/* Language pill switcher */}
      <div className="cpc-section">
        <div className="cpc-label">
          {t('contentPlanCreate.caption.languageLabel')}
        </div>
        <div
          className="cpc-lang-toggle"
          role="radiogroup"
          aria-label={t('contentPlanCreate.caption.languageLabel')}
        >
          {(['en', 'ar'] as WizardLanguage[]).map((lng) => {
            const active = language === lng
            return (
              <button
                key={lng}
                type="button"
                role="radio"
                aria-checked={active}
                className={`cpc-lang ${active ? 'is-on' : ''}`}
                onClick={() => onChangeLanguage(lng)}
                data-testid={`caption-lang-${lng}`}
              >
                {t(`contentPlanCreate.caption.lang.${lng}`)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Primary action — generate / regenerate */}
      <button
        type="button"
        className="cpc-generate"
        onClick={hasCaption ? onRegenerateClick : doGenerate}
        disabled={!hasImage || isGenerating}
        data-testid="caption-generate"
      >
        {isGenerating
          ? t('contentPlanCreate.caption.generating')
          : hasCaption
          ? t('contentPlanCreate.caption.regenerate')
          : t('contentPlanCreate.caption.generate')}
      </button>

      {/* No-image guard */}
      {!hasImage && (
        <p className="cpc-cap-noimage" dir="auto" data-testid="caption-no-image">
          {t('contentPlanCreate.caption.noImageHint')}
        </p>
      )}

      {/* Inline error */}
      {error && (
        <div
          className="cpc-error"
          role="alert"
          dir="auto"
          data-testid="caption-error"
        >
          <span className="cpc-error-msg">{error}</span>
          <button
            type="button"
            className="cpc-error-retry"
            onClick={doGenerate}
            data-testid="caption-error-retry"
          >
            {t('contentPlanCreate.caption.retry')}
          </button>
        </div>
      )}

      {/* Result area: loading / editable caption */}
      <div className="cpc-cap-result">
        {isGenerating ? (
          <div className="cpc-loading" data-testid="caption-loading">
            <div className="cpc-spinner" aria-hidden />
            <p className="cpc-loading-msg" dir="auto">
              {t('contentPlanCreate.caption.loadingMessage')}
            </p>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            id="cpc-caption"
            className="cpc-cap-textarea"
            dir={language === 'ar' ? 'rtl' : 'auto'}
            value={caption}
            onChange={(e) => onChangeCaption(e.target.value)}
            placeholder={t('contentPlanCreate.caption.placeholder')}
            rows={6}
            data-testid="caption-textarea"
          />
        )}
        {hasCaption && userEdited && (
          <div className="cpc-cap-edited-tag" dir="auto">
            {t('contentPlanCreate.caption.editedTag')}
          </div>
        )}
      </div>

      {/* Replace-edited-caption confirm dialog */}
      {confirmReplace && (
        <div
          className="cpc-modal-back"
          role="dialog"
          aria-modal="true"
          onClick={onCancelReplace}
          data-testid="caption-confirm-replace"
        >
          <div className="cpc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cpc-modal-title" dir="auto">
              {t('contentPlanCreate.caption.replaceTitle')}
            </h3>
            <p className="cpc-modal-body" dir="auto">
              {t('contentPlanCreate.caption.replaceBody')}
            </p>
            <div className="cpc-modal-actions">
              <button
                type="button"
                className="cpc-modal-secondary"
                onClick={onCancelReplace}
                data-testid="caption-confirm-keep"
              >
                {t('contentPlanCreate.caption.keepEdited')}
              </button>
              <button
                type="button"
                className="cpc-modal-primary"
                onClick={onConfirmReplace}
                data-testid="caption-confirm-replace-go"
              >
                {t('contentPlanCreate.caption.replaceConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{CAPTION_STYLES}</style>
    </div>
  )
}

const CAPTION_STYLES = `
.cpc-caption { display:flex; flex-direction:column; gap:18px; }
.cpc-cap-header { display:flex; gap:14px; align-items:flex-start; padding:14px; background:var(--ink-50); border-radius:12px; }
.cpc-cap-thumb { width:96px; height:96px; border-radius:10px; object-fit:cover; background:var(--ink-100); flex-shrink:0; }
.cpc-cap-thumb-empty { background:linear-gradient(135deg, var(--ink-100), var(--ink-150)); }
.cpc-cap-meta { display:flex; flex-direction:column; gap:4px; min-width:0; flex:1; }
.cpc-cap-topic { font-size:14px; font-weight:700; color:var(--ink-950); line-height:1.4; letter-spacing:-0.005em; }
.cpc-cap-prompt { font-size:12.5px; color:var(--ink-600); line-height:1.5; font-style:italic; }

.cpc-lang-toggle { display:inline-flex; padding:3px; background:var(--ink-100); border-radius:10px; gap:0; align-self:flex-start; }
.cpc-lang { padding:7px 16px; font-size:13px; font-weight:600; color:var(--ink-600); border-radius:8px; background:transparent; border:none; cursor:pointer; transition:all .12s; }
.cpc-lang.is-on { background:#fff; color:var(--ink-950); box-shadow:0 1px 3px rgba(0,0,0,.08); }
.cpc-lang:hover:not(.is-on) { color:var(--ink-900); }

.cpc-cap-noimage { font-size:13px; color:var(--ink-500); padding:10px 14px; background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.25); border-radius:10px; }

.cpc-cap-result { display:flex; flex-direction:column; gap:8px; }
.cpc-cap-textarea { width:100%; padding:14px 16px; border:1px solid var(--line); border-radius:12px; font-size:14px; line-height:1.6; resize:vertical; background:var(--surface); color:var(--ink-900); font-family:inherit; min-height:140px; }
.cpc-cap-textarea:focus { outline:none; border-color:var(--purple-500); box-shadow:0 0 0 3px rgba(84,51,194,.15); }
.cpc-cap-edited-tag { align-self:flex-end; font-size:11px; color:var(--purple-700); background:var(--purple-50); padding:3px 8px; border-radius:99px; font-weight:600; }
`
