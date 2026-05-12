import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StepPreview, PublishingModal, type DraftPost } from '../../pages/PostCreator'
import { useAccounts } from '../../hooks/useAnalytics'
import { useCreatePost } from '../../hooks/useCreator'

export type WizardLanguage = 'en' | 'ar'
export type WizardImageRatio = '1:1' | '4:5' | '16:9'

export interface WizardPreviewStepProps {
  imageUrl: string | null
  caption: string
  language: WizardLanguage
  imageRatio: WizardImageRatio
  refinedPrompt: string
  contentPlanDay: string  // YYYY-MM-DD
  scheduledAt: string | null  // ISO datetime
  aiGeneratedMedia: boolean
  aiGeneratedCaption: boolean
  onChangeScheduledAt: (iso: string | null) => void
  /** Invoked after a successful submit so the wizard can navigate back. */
  onSubmitted: () => void
}

type SubmitKind = 'draft' | 'scheduled' | 'publishing'

interface PublishState {
  postId: string
  status: 'pending' | 'success' | 'failed'
  permalink?: string | null
  errorMessage?: string | null
}

/**
 * Build the StepPreview-compatible draft from wizard state.
 *
 * Fields synthesized (StepPreview only reads `media_urls`, `ratio`,
 * `caption_lang`, `caption_en` / `caption_ar`, `hashtags`):
 *   - media_urls: [imageUrl] when present, else []
 *   - media_type: always 'image' (wizard is image-only this iteration)
 *   - ratio: from state
 *   - caption_lang: from state
 *   - caption_en / caption_ar: caption goes into the active-language slot
 *   - hashtags: [] — captions returned by /generate-caption already embed
 *     their hashtags on the last line, so we don't double-render them
 *   - Other fields: defaults that satisfy the type but aren't read by StepPreview
 */
function buildDraftFromWizard(
  imageUrl: string | null,
  caption: string,
  language: WizardLanguage,
  ratio: WizardImageRatio,
  contentPlanDay: string,
  scheduledAt: string | null,
  aiMedia: boolean,
  aiCaption: boolean,
): DraftPost {
  const [date, time] = (scheduledAt ?? '').split('T')
  return {
    media_urls: imageUrl ? [imageUrl] : [],
    media_type: 'image',
    ratio,
    caption_lang: language,
    caption_en: language === 'en' ? caption : '',
    caption_ar: language === 'ar' ? caption : '',
    hashtags: [],
    scheduled_date: date || contentPlanDay,
    scheduled_time: (time ?? '').slice(0, 5),
    post_now: false,
    ai_generated_caption: aiCaption,
    ai_generated_media: aiMedia,
    original_url: null,
    transformed_url: null,
    is_transformed: false,
    image_analysis: null,
    prefilled_topic: '',
    content_plan_day: contentPlanDay,
  }
}

/** Split an ISO datetime into local <input type=date> / <input type=time> halves. */
function isoToDateTimeParts(iso: string | null, fallbackDate: string): { date: string; time: string } {
  if (!iso) return { date: fallbackDate, time: '09:00' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: fallbackDate, time: '09:00' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function partsToIso(date: string, time: string): string {
  const t = /^\d{2}:\d{2}$/.test(time) ? time : '09:00'
  return `${date}T${t}:00`
}

export default function WizardPreviewStep(props: WizardPreviewStepProps) {
  const {
    imageUrl,
    caption,
    language,
    imageRatio,
    contentPlanDay,
    scheduledAt,
    aiGeneratedMedia,
    aiGeneratedCaption,
    onChangeScheduledAt,
    onSubmitted,
  } = props
  const { t } = useTranslation()

  const accounts = useAccounts()
  const accountUsername = accounts.data?.[0]?.username ?? 'me'

  const createPost = useCreatePost()
  const [error, setError] = useState<string | null>(null)
  const [publishState, setPublishState] = useState<PublishState | null>(null)

  const draft = useMemo(
    () =>
      buildDraftFromWizard(
        imageUrl,
        caption,
        language,
        imageRatio,
        contentPlanDay,
        scheduledAt,
        aiGeneratedMedia,
        aiGeneratedCaption,
      ),
    [
      imageUrl, caption, language, imageRatio, contentPlanDay, scheduledAt,
      aiGeneratedMedia, aiGeneratedCaption,
    ],
  )

  const { date: schedDate, time: schedTime } = isoToDateTimeParts(
    scheduledAt,
    contentPlanDay,
  )

  const submit = useCallback(
    (kind: SubmitKind) => {
      setError(null)
      const body = {
        media_urls: imageUrl ? [imageUrl] : [],
        media_type: 'image' as const,
        caption_en: language === 'en' ? caption : undefined,
        caption_ar: language === 'ar' ? caption : undefined,
        hashtags: [] as string[],
        ratio: imageRatio,
        status: kind,
        content_plan_day: contentPlanDay,
        ai_generated_caption: aiGeneratedCaption,
        ai_generated_media: aiGeneratedMedia,
        ...(kind === 'scheduled' && scheduledAt
          ? { scheduled_at: scheduledAt }
          : {}),
      }

      if (kind === 'publishing') {
        // Mirror PostCreator: "publishing" submits as a status='publishing'
        // request — backend translates that to scheduled+NOW under the hood
        // and kicks off the publisher task. UI surfaces the PublishingModal
        // while the worker runs.
        createPost.mutate(body, {
          onSuccess: (post) => {
            setPublishState({
              postId: post.id,
              status: 'pending',
              permalink: null,
            })
            // Backend's status reflects the publisher's progress; we settle
            // to 'success' optimistically and let the user click through
            // when the modal shows the permalink. A future iteration could
            // poll /creator/posts/:id to flip status → success once the
            // worker reports back.
            requestAnimationFrame(() => {
              setPublishState({
                postId: post.id,
                status: 'success',
                permalink: post.permalink ?? null,
              })
            })
          },
          onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err)
            setPublishState({
              postId: '',
              status: 'failed',
              errorMessage: msg,
            })
          },
        })
        return
      }

      createPost.mutate(body, {
        onSuccess: () => onSubmitted(),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          setError(msg || t('contentPlanCreate.preview.errorSubmit'))
        },
      })
    },
    [
      imageUrl, caption, language, imageRatio, contentPlanDay, scheduledAt,
      aiGeneratedMedia, aiGeneratedCaption, createPost, onSubmitted, t,
    ],
  )

  const closePublishModal = useCallback(() => {
    setPublishState(null)
    onSubmitted()
  }, [onSubmitted])

  return (
    <div className="cpc-preview" data-testid="wizard-step-preview">
      {/* Instagram-style preview lifted from PostCreator */}
      <StepPreview draft={draft} accountUsername={accountUsername} />

      {/* Schedule controls */}
      <div className="cpc-sched">
        <div className="cpc-sched-row">
          <label htmlFor="cpc-sched-date" className="cpc-label">
            {t('contentPlanCreate.preview.dateLabel')}
          </label>
          <input
            id="cpc-sched-date"
            type="date"
            className="cpc-select"
            value={schedDate}
            onChange={(e) =>
              onChangeScheduledAt(partsToIso(e.target.value, schedTime))
            }
            data-testid="preview-date"
          />
        </div>
        <div className="cpc-sched-row">
          <label htmlFor="cpc-sched-time" className="cpc-label">
            {t('contentPlanCreate.preview.timeLabel')}
          </label>
          <input
            id="cpc-sched-time"
            type="time"
            className="cpc-select"
            value={schedTime}
            onChange={(e) =>
              onChangeScheduledAt(partsToIso(schedDate, e.target.value))
            }
            data-testid="preview-time"
          />
        </div>
      </div>

      {/* Inline error */}
      {error && (
        <div
          className="cpc-error"
          role="alert"
          dir="auto"
          data-testid="preview-error"
        >
          <span className="cpc-error-msg">{error}</span>
        </div>
      )}

      {/* Three actions: Save / Schedule (highlight) / Publish now */}
      <div className="cpc-prev-actions">
        <button
          type="button"
          className="cpc-outline"
          onClick={() => submit('draft')}
          disabled={createPost.isPending}
          data-testid="preview-save-draft"
        >
          {t('contentPlanCreate.preview.saveDraft')}
        </button>
        <button
          type="button"
          className="cpc-generate"
          onClick={() => submit('scheduled')}
          disabled={createPost.isPending || !imageUrl || !caption.trim()}
          data-testid="preview-schedule"
        >
          {t('contentPlanCreate.preview.schedule')}
        </button>
        <button
          type="button"
          className="cpc-publish-now"
          onClick={() => submit('publishing')}
          disabled={createPost.isPending || !imageUrl || !caption.trim()}
          data-testid="preview-publish-now"
        >
          {t('contentPlanCreate.preview.publishNow')}
        </button>
      </div>

      {publishState && (
        <PublishingModal state={publishState} onClose={closePublishModal} />
      )}

      <style>{PREVIEW_STYLES}</style>
    </div>
  )
}

const PREVIEW_STYLES = `
.cpc-preview { display:flex; flex-direction:column; gap:18px; }
.cpc-sched { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:14px; background:var(--ink-50); border-radius:12px; }
@media (max-width:560px) { .cpc-sched { grid-template-columns:1fr; } }
.cpc-sched-row { display:flex; flex-direction:column; gap:6px; }
.cpc-prev-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; padding-top:8px; }
@media (max-width:560px) { .cpc-prev-actions { flex-direction:column-reverse; } .cpc-prev-actions button { width:100%; } }
.cpc-publish-now { padding:11px 18px; background:transparent; color:#b45309; border:1px solid #b45309; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; transition:background .12s, color .12s; }
.cpc-publish-now:hover:not(:disabled) { background:#fff7ed; }
.cpc-publish-now:disabled { opacity:.55; cursor:not-allowed; }
`
