import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useGenerateImage, useUploadMedia, useAnalyzeImage } from '../../hooks/useCreator'
import { useAccounts } from '../../hooks/useAnalytics'
import type { GenerateImageRequest } from '../../api/creator'
import type { ImageAnalysis } from '../../api/analytics'

export type WizardStyle = 'photographic' | 'illustration' | 'lifestyle'
export type WizardRatio = '1:1' | '4:5' | '16:9'

export interface WizardImageStepProps {
  topic: string
  refinedPrompt: string
  style: WizardStyle
  ratio: WizardRatio
  imageUrl: string | null
  onChangePrompt: (next: string) => void
  onChangeStyle: (next: WizardStyle) => void
  onChangeRatio: (next: WizardRatio) => void
  /** Called when an image is ready (either AI-generated or user-uploaded). */
  onImageReady: (imageUrl: string) => void
  /** Called when the background GPT-4o Vision analysis completes. */
  onAnalysisReady: (analysis: ImageAnalysis) => void
}

/**
 * Style → prompt-prefix map.
 *
 * Style is prepended to the user's prompt client-side; the backend
 * `/creator/generate-image` endpoint does not accept a style enum yet.
 * Promote to a server param if a richer style taxonomy is needed later.
 */
const STYLE_PREFIX: Record<WizardStyle, string> = {
  photographic: 'Photographic style',
  illustration: 'Illustration style',
  lifestyle: 'Lifestyle photography',
}

/** Match the backend's MAX_UPLOAD_BYTES (posts_creator.py:59) so the inline
 *  error message fires before the request leaves the browser. Not a security
 *  check — the server still enforces 413. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export default function WizardImageStep(props: WizardImageStepProps) {
  const {
    topic,
    refinedPrompt,
    style,
    ratio,
    imageUrl,
    onChangePrompt,
    onChangeStyle,
    onChangeRatio,
    onImageReady,
    onAnalysisReady,
  } = props
  const { t } = useTranslation()
  const promptRef = useRef<HTMLTextAreaElement | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const accounts = useAccounts()
  const accountId = accounts.data?.[0]?.id
  const generate = useGenerateImage()
  const upload = useUploadMedia()
  const analyze = useAnalyzeImage()

  const [error, setError] = useState<string | null>(null)

  const promptIsEmpty = !refinedPrompt.trim()
  const isGenerating = generate.isPending
  const isUploading = upload.isPending
  const isBusy = isGenerating || isUploading

  /**
   * Background image analysis. Runs after `onImageReady` so the caption step
   * can lean on it later, but failures are swallowed — the caption endpoint
   * works without analysis, it just produces richer copy with it.
   */
  const runAnalysis = useCallback(
    (url: string) => {
      analyze.mutate(url, {
        onSuccess: (result) => onAnalysisReady(result),
        onError: (err) => {
          console.warn('Image analysis failed (non-blocking):', err)
        },
      })
    },
    [analyze, onAnalysisReady],
  )

  const fireGenerate = useCallback(() => {
    if (promptIsEmpty || isBusy) return
    setError(null)
    const description = `${STYLE_PREFIX[style]}: ${refinedPrompt.trim()}`
    const req: GenerateImageRequest = {
      description,
      ratio,
      ...(accountId ? { account_id: accountId } : {}),
    }
    generate.mutate(req, {
      onSuccess: (data) => {
        onImageReady(data.url)
        // Scroll to the new result card so the user notices it without
        // having to hunt below the fold.
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
        runAnalysis(data.url)
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg || t('contentPlanCreate.image.errorGenerate'))
      },
    })
  }, [
    promptIsEmpty, isBusy, style, refinedPrompt, ratio, accountId,
    generate, onImageReady, runAnalysis, t,
  ])

  const onUploadClick = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const onFileChosen = useCallback(
    (file: File | null) => {
      if (!file) return
      setError(null)
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(t('contentPlanCreate.image.errorTooBig'))
        return
      }
      if (!file.type.startsWith('image/')) {
        setError(t('contentPlanCreate.image.errorNotImage'))
        return
      }
      upload.mutate(file, {
        onSuccess: (data) => {
          onImageReady(data.url)
          requestAnimationFrame(() => {
            resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          })
          runAnalysis(data.url)
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          setError(msg || t('contentPlanCreate.image.errorUpload'))
        },
      })
    },
    [upload, onImageReady, runAnalysis, t],
  )

  const focusPrompt = useCallback(() => {
    const ta = promptRef.current
    if (!ta) return
    ta.focus()
    ta.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Place caret at end so editing flows naturally
    const end = ta.value.length
    ta.setSelectionRange(end, end)
  }, [])

  // Auto-resize the textarea so longer refined prompts don't get squeezed.
  useEffect(() => {
    const ta = promptRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(220, Math.max(72, ta.scrollHeight))}px`
  }, [refinedPrompt])

  return (
    <div className="cpc-image" data-testid="wizard-step-image">
      {/* Suggestion — read-only chip */}
      <div className="cpc-section">
        <div className="cpc-label cpc-label-muted">
          {t('contentPlanCreate.image.suggestionLabel')}
        </div>
        <div className="cpc-suggestion" dir="auto" data-testid="image-suggestion">
          “{topic}”
        </div>
      </div>

      {/* Prompt textarea */}
      <div className="cpc-section">
        <label htmlFor="cpc-prompt" className="cpc-label">
          {t('contentPlanCreate.image.promptLabel')}
        </label>
        <textarea
          id="cpc-prompt"
          ref={promptRef}
          className="cpc-textarea"
          dir="auto"
          value={refinedPrompt}
          onChange={(e) => onChangePrompt(e.target.value)}
          placeholder={t('contentPlanCreate.image.promptPlaceholder')}
          data-testid="image-prompt"
        />
      </div>

      {/* Style picker */}
      <div className="cpc-section">
        <div className="cpc-label">{t('contentPlanCreate.image.styleLabel')}</div>
        <div className="cpc-style-grid" role="radiogroup" aria-label={t('contentPlanCreate.image.styleLabel')}>
          {(['photographic', 'illustration', 'lifestyle'] as WizardStyle[]).map((s) => {
            const active = style === s
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                className={`cpc-style-card ${active ? 'is-on' : ''}`}
                onClick={() => onChangeStyle(s)}
                data-testid={`image-style-${s}`}
              >
                <div className="cpc-style-title">
                  {t(`contentPlanCreate.image.style.${s}.title`)}
                </div>
                <div className="cpc-style-desc">
                  {t(`contentPlanCreate.image.style.${s}.desc`)}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Aspect ratio */}
      <div className="cpc-section cpc-ratio-row">
        <label htmlFor="cpc-ratio" className="cpc-label">
          {t('contentPlanCreate.image.ratioLabel')}
        </label>
        <select
          id="cpc-ratio"
          className="cpc-select"
          value={ratio}
          onChange={(e) => onChangeRatio(e.target.value as WizardRatio)}
          data-testid="image-ratio"
        >
          <option value="1:1">{t('contentPlanCreate.image.ratio.1x1')}</option>
          <option value="4:5">{t('contentPlanCreate.image.ratio.4x5')}</option>
          <option value="16:9">{t('contentPlanCreate.image.ratio.16x9')}</option>
        </select>
      </div>

      {/* Generate / regenerate primary action */}
      <button
        type="button"
        className="cpc-generate"
        onClick={fireGenerate}
        disabled={promptIsEmpty || isBusy}
        data-testid="image-generate"
      >
        {isGenerating
          ? t('contentPlanCreate.image.generating')
          : imageUrl
          ? t('contentPlanCreate.image.regenerate')
          : t('contentPlanCreate.image.generate')}
      </button>

      {/* Inline error */}
      {error && (
        <div
          className="cpc-error"
          role="alert"
          data-testid="image-error"
          dir="auto"
        >
          <span className="cpc-error-msg">{error}</span>
          <button
            type="button"
            className="cpc-error-retry"
            onClick={fireGenerate}
            data-testid="image-error-retry"
          >
            {t('contentPlanCreate.image.retry')}
          </button>
        </div>
      )}

      {/* Result area — loading / image / empty */}
      <div className="cpc-result" ref={resultRef}>
        {(isGenerating || isUploading) ? (
          <div className="cpc-loading" data-testid="image-loading">
            <div className="cpc-spinner" aria-hidden />
            <p className="cpc-loading-msg" dir="auto">
              {isUploading
                ? t('contentPlanCreate.image.uploading')
                : t('contentPlanCreate.image.loadingMessage')}
            </p>
          </div>
        ) : imageUrl ? (
          <div className="cpc-image-card">
            <img
              src={imageUrl}
              alt={t('contentPlanCreate.image.altText')}
              className="cpc-image-img"
              data-testid="image-result"
            />
            <div className="cpc-image-actions">
              <button
                type="button"
                className="cpc-outline"
                onClick={fireGenerate}
                disabled={isBusy}
                data-testid="image-action-regenerate"
              >
                {t('contentPlanCreate.image.regenerate')}
              </button>
              <button
                type="button"
                className="cpc-outline"
                onClick={focusPrompt}
                data-testid="image-action-edit-prompt"
              >
                {t('contentPlanCreate.image.editPrompt')}
              </button>
              <button
                type="button"
                className="cpc-outline"
                onClick={onUploadClick}
                disabled={isUploading}
                data-testid="image-action-upload"
              >
                {t('contentPlanCreate.image.uploadOwn')}
              </button>
            </div>
          </div>
        ) : (
          <div className="cpc-empty" dir="auto">
            <p>{t('contentPlanCreate.image.emptyHint')}</p>
            <button
              type="button"
              className="cpc-link"
              onClick={onUploadClick}
              data-testid="image-empty-upload"
            >
              {t('contentPlanCreate.image.uploadOwn')}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
        data-testid="image-file-input"
      />

      <style>{IMAGE_STYLES}</style>
    </div>
  )
}

const IMAGE_STYLES = `
.cpc-image { display:flex; flex-direction:column; gap:18px; }
.cpc-section { display:flex; flex-direction:column; gap:8px; }
.cpc-label { font-size:12px; font-weight:600; color:var(--ink-700); letter-spacing:.02em; text-transform:uppercase; }
.cpc-label-muted { color:var(--ink-500); text-transform:none; letter-spacing:0; }
.cpc-suggestion { font-size:14px; color:var(--ink-700); font-style:italic; line-height:1.5; padding:10px 14px; background:var(--ink-50); border-radius:10px; border-inline-start:3px solid var(--purple-400); }

.cpc-textarea { width:100%; min-height:72px; resize:vertical; padding:12px 14px; border-radius:12px; border:1px solid var(--line); background:var(--surface); font-size:14px; line-height:1.55; color:var(--ink-900); transition:border-color .12s, box-shadow .12s; font-family:inherit; }
.cpc-textarea:focus { outline:none; border-color:var(--purple-500); box-shadow:0 0 0 3px rgba(84,51,194,.15); }

.cpc-style-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
@media (max-width:640px) { .cpc-style-grid { grid-template-columns:1fr; } }
.cpc-style-card { display:flex; flex-direction:column; gap:4px; align-items:flex-start; padding:12px 14px; border-radius:12px; background:var(--surface); border:1px solid var(--line); cursor:pointer; transition:all .12s; text-align:start; }
.cpc-style-card:hover { border-color:var(--purple-300); background:var(--purple-50); }
.cpc-style-card.is-on { border-color:var(--purple-600); background:var(--purple-50); box-shadow:0 0 0 3px rgba(84,51,194,.12); }
.cpc-style-title { font-size:13px; font-weight:700; color:var(--ink-900); }
.cpc-style-card.is-on .cpc-style-title { color:var(--purple-800); }
.cpc-style-desc { font-size:11.5px; color:var(--ink-500); line-height:1.4; }

.cpc-ratio-row { flex-direction:row; align-items:center; gap:14px; }
.cpc-ratio-row .cpc-label { margin:0; }
.cpc-select { padding:9px 12px; border-radius:10px; border:1px solid var(--line); background:var(--surface); font-size:13px; color:var(--ink-900); cursor:pointer; min-width:180px; }
.cpc-select:focus { outline:none; border-color:var(--purple-500); box-shadow:0 0 0 3px rgba(84,51,194,.15); }

.cpc-generate { padding:13px 22px; background:var(--purple-600); color:#fff; border-radius:12px; font-size:14px; font-weight:600; border:none; cursor:pointer; transition:background .12s, transform .12s; box-shadow:0 8px 20px -8px rgba(84,51,194,.55); }
.cpc-generate:hover:not(:disabled) { background:var(--purple-700); transform:translateY(-1px); }
.cpc-generate:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }

.cpc-error { display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:10px; background:rgba(220,38,38,.06); border:1px solid rgba(220,38,38,.25); color:#b91c1c; font-size:13px; }
.cpc-error-msg { flex:1; line-height:1.4; }
.cpc-error-retry { padding:6px 12px; border-radius:8px; background:#fff; color:#b91c1c; border:1px solid #b91c1c; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .12s; }
.cpc-error-retry:hover { background:rgba(220,38,38,.08); }

.cpc-result { display:flex; flex-direction:column; align-items:center; gap:14px; min-height:80px; }
.cpc-loading { display:flex; flex-direction:column; align-items:center; gap:14px; padding:36px 18px; text-align:center; color:var(--ink-700); }
.cpc-spinner { width:36px; height:36px; border-radius:50%; border:3px solid var(--purple-100); border-top-color:var(--purple-600); animation:cpc-spin .8s linear infinite; }
@keyframes cpc-spin { to { transform:rotate(360deg); } }
.cpc-loading-msg { font-size:13.5px; color:var(--ink-600); line-height:1.55; max-width:380px; }

.cpc-image-card { display:flex; flex-direction:column; gap:12px; width:100%; align-items:center; }
.cpc-image-img { max-width:100%; max-height:480px; border-radius:14px; box-shadow:0 12px 32px -16px rgba(20,16,40,.25); }
.cpc-image-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
.cpc-outline { padding:9px 14px; border-radius:10px; background:var(--surface); color:var(--ink-800); border:1px solid var(--line); font-size:12.5px; font-weight:600; cursor:pointer; transition:background .12s, border-color .12s, color .12s; }
.cpc-outline:hover:not(:disabled) { background:var(--purple-50); border-color:var(--purple-300); color:var(--purple-800); }
.cpc-outline:disabled { opacity:.55; cursor:not-allowed; }

.cpc-empty { display:flex; flex-direction:column; align-items:center; gap:6px; padding:28px 18px; color:var(--ink-500); font-size:13px; text-align:center; }
.cpc-link { background:transparent; color:var(--purple-700); font-size:13px; font-weight:600; cursor:pointer; border:none; padding:4px 8px; border-radius:6px; }
.cpc-link:hover { background:var(--purple-50); }
`
