/**
 * Post Creator — 4-step wizard for drafting / scheduling Instagram posts.
 *
 * Steps: Media → Caption → Preview → Schedule.
 *
 * Wizard state lives in this component (a single `draft` object) so going
 * Back from later steps doesn't lose data. Query params on mount can
 * pre-fill the topic / date / time / content type when the user navigates
 * here from Content Plan.
 *
 * Pro-gated via LockedFeature; starter users see the upgrade modal.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronUp,
  ChevronDown,
  Clock,
  Globe,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  ScanEye,
  Sparkles,
  UploadCloud,
  Wand2,
  X,
} from 'lucide-react'

import { useAccounts, useAudienceInsights, useGenerateCaption, usePostsBreakdown } from '../hooks/useAnalytics'
import { useAnalyzeImage, useCreatePost, useGenerateImage, useUploadMedia } from '../hooks/useCreator'
import { fetchBrandIdentity, type BrandIdentity, type BrandImageStyle } from '../api/auth'
import { useIsFeatureLocked } from '../hooks/useBilling'
import LockedFeature from '../components/LockedFeature'
import type { CreatePostBody, ImageRatio, MediaType, PostStatus } from '../api/creator'
import type { ImageAnalysis } from '../api/analytics'
import { cn } from '../lib/utils'

const MAX_AI_IMAGE_GENERATIONS = 3

const STEPS = ['media', 'caption', 'preview', 'schedule'] as const
type Step = (typeof STEPS)[number]

interface DraftPost {
  media_urls: string[]
  media_type: MediaType | null
  ratio: ImageRatio
  caption_lang: 'en' | 'ar'
  caption_en: string
  caption_ar: string
  hashtags: string[]
  scheduled_date: string  // YYYY-MM-DD
  scheduled_time: string  // HH:MM
  post_now: boolean
  ai_generated_caption: boolean
  ai_generated_media: boolean
  // The user's ORIGINAL uploaded image, set on upload and preserved after a
  // Transform-with-AI run so the "Use original" revert button can restore it.
  // null when the user is in generate-from-scratch mode.
  original_url: string | null
  // The AI-transformed version of `original_url`. Kept around even after the
  // user reverts to original so the side-by-side comparison view can let them
  // toggle back without burning another generation. null until the first
  // Transform-with-AI run on this draft.
  transformed_url: string | null
  // True when the current `media_urls[0]` is a Transform-with-AI output of
  // `original_url`. Drives the badge ("Transformed" vs "AI generated") and
  // shows the "Use original" button.
  is_transformed: boolean
  // GPT-4o Vision analysis of the ORIGINAL uploaded image (NOT the transformed
  // version). Set automatically when the user moves from Step 1 to Step 2.
  // Captioning uses this to write product-specific copy.
  image_analysis: ImageAnalysis | null
  // Pre-fill metadata from the URL (read-only after mount).
  prefilled_topic: string
  content_plan_day: string | null
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function nextDateForWeekday(targetDow: number): string {
  const today = new Date()
  const todayDow = today.getDay()
  const diff = (targetDow - todayDow + 7) % 7 || 7
  const next = new Date(today)
  next.setDate(today.getDate() + diff)
  return next.toISOString().slice(0, 10)
}

function defaultIsoTime(audienceTime: string | undefined): string {
  // Parse "16:00" / "4 PM" / "" — fall back to 18:00.
  if (!audienceTime) return '18:00'
  const m = audienceTime.match(/(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(am|pm)?/i)
  if (!m) return '18:00'
  let hour = parseInt(m[1] ?? '18', 10)
  const minute = parseInt(m[2] ?? '0', 10)
  const ampm = (m[3] ?? '').toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/* ─────────────────── Page wrapper ─────────────────── */

export default function PostCreator() {
  const { t } = useTranslation()
  const isLocked = useIsFeatureLocked('content_recommendations')
  return (
    <LockedFeature locked={isLocked} featureName={t('creator.title')}>
      <PostCreatorBody />
    </LockedFeature>
  )
}

function PostCreatorBody() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const isAr = i18n.language?.startsWith('ar') ?? false
  const audience = useAudienceInsights()
  const accounts = useAccounts()

  const [step, setStep] = useState<Step>('media')

  // Initialize from URL once.
  const initialDraft = useMemo<DraftPost>(() => {
    const date = params.get('date') ?? ''
    const topic = params.get('topic') ?? ''
    const time = params.get('time') ?? ''
    return {
      media_urls: [],
      media_type: null,
      ratio: '1:1',
      caption_lang: isAr ? 'ar' : 'en',
      caption_en: '',
      caption_ar: '',
      hashtags: [],
      scheduled_date: date,
      scheduled_time: time,
      post_now: false,
      ai_generated_caption: false,
      ai_generated_media: false,
      original_url: null,
      transformed_url: null,
      is_transformed: false,
      image_analysis: null,
      prefilled_topic: topic,
      content_plan_day: date || null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [draft, setDraft] = useState<DraftPost>(initialDraft)
  const analyzeImage = useAnalyzeImage()

  // Once audience insights load, fill in the schedule defaults — but only
  // when the user hasn't typed anything (don't clobber a deep-link).
  useEffect(() => {
    if (!audience.data) return
    const day = audience.data.best_time?.day?.toLowerCase() ?? ''
    const dow = DAY_NAME_TO_INDEX[day]
    setDraft((prev) => ({
      ...prev,
      scheduled_date: prev.scheduled_date
        || (dow !== undefined ? nextDateForWeekday(dow) : prev.scheduled_date),
      scheduled_time: prev.scheduled_time
        || defaultIsoTime(audience.data?.best_time?.time),
    }))
  }, [audience.data])

  function patch(p: Partial<DraftPost>) {
    setDraft((prev) => ({ ...prev, ...p }))
  }

  function next() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!)
    // When leaving the Media step into Caption, trigger a background image
    // analysis (if not already done). The Caption step shows a
    // "Analyzing your image…" hint while it runs.
    //
    // Important: when the user transformed an upload via AI, analyze the
    // ORIGINAL upload (which still has the real product packaging + label
    // text on it), NOT the AI-transformed version (which may have stylized
    // away the brand mark). Only the original tells us what the product
    // actually IS — and that's what we need for product-specific captions.
    if (step === 'media' && !draft.image_analysis && !analyzeImage.isPending) {
      const urlToAnalyze = draft.original_url || draft.media_urls[0]
      const isImage = draft.media_type !== 'video'
      if (urlToAnalyze && isImage) {
        analyzeImage.mutate(urlToAnalyze, {
          onSuccess: (result) => {
            setDraft((d) => ({ ...d, image_analysis: result }))
          },
        })
      }
    }
  }
  function prev() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1]!)
  }

  const accountId = accounts.data?.[0]?.id

  return (
    <div className="rd-canvas">
      <div className="creator">
        <header className="creator-head">
          <button className="creator-back" onClick={() => navigate(-1)} aria-label={t('creator.back')}>
            <ArrowLeft className="w-4 h-4" />
            <span>{t('creator.back')}</span>
          </button>
          <h1 className="creator-title" dir="auto">{t('creator.title')}</h1>
          <div style={{ width: 80 }} />
        </header>

        <StepIndicator step={step} />

        <div className="creator-body">
          {step === 'media' && (
            <StepMedia draft={draft} patch={patch} />
          )}
          {step === 'caption' && (
            <StepCaption
              draft={draft}
              patch={patch}
              analyzing={analyzeImage.isPending}
            />
          )}
          {step === 'preview' && (
            <StepPreview draft={draft} accountUsername={accounts.data?.[0]?.account_name ?? 'your_handle'} />
          )}
          {step === 'schedule' && (
            <StepSchedule
              draft={draft}
              patch={patch}
              accountId={accountId}
              onPosted={(status) => {
                navigate(
                  status === 'draft' ? '/content-plan?tab=drafts'
                  : status === 'scheduled' ? '/content-plan?tab=calendar'
                  : '/content-plan?tab=published',
                )
              }}
            />
          )}
        </div>

        <footer className="creator-foot">
          {step !== 'media' && (
            <button className="creator-btn-ghost" onClick={prev}>
              <ArrowLeft className="w-4 h-4" />
              {t('creator.back')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step !== 'schedule' && (
            <button
              className="creator-btn-primary"
              onClick={next}
              disabled={step === 'media' && draft.media_urls.length === 0}
            >
              {t('creator.next')}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </footer>

        <style>{CREATOR_STYLES}</style>
      </div>
    </div>
  )
}

/* ─────────────────── Step indicator ─────────────────── */

function StepIndicator({ step }: { step: Step }) {
  const { t } = useTranslation()
  const idx = STEPS.indexOf(step)
  return (
    <div className="creator-steps">
      {STEPS.map((s, i) => (
        <div key={s} className={cn('creator-step', i === idx && 'is-on', i < idx && 'is-done')}>
          <div className="creator-step-dot">
            {i < idx ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          <span className="creator-step-label">{t(`creator.steps.${s}`)}</span>
          {i < STEPS.length - 1 && <div className="creator-step-line" />}
        </div>
      ))}
    </div>
  )
}

/* ─────────────────── Step 1: Media ─────────────────── */

function StepMedia({ draft, patch }: { draft: DraftPost; patch: (p: Partial<DraftPost>) => void }) {
  const { t } = useTranslation()
  const upload = useUploadMedia()
  const generate = useGenerateImage()
  const accounts = useAccounts()
  const brand = useQuery<BrandIdentity>({
    queryKey: ['auth', 'brand-identity'],
    queryFn: fetchBrandIdentity,
    staleTime: 60_000,
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const [aiDescription, setAiDescription] = useState<string>('')
  const [aiStyle, setAiStyle] = useState<BrandImageStyle>('clean')
  const [aiCount, setAiCount] = useState<number>(0)
  const [aiError, setAiError] = useState<string>('')
  // Full-size image lightbox: any image thumbnail in this step opens it.
  // null = closed. Single state value works because we never need more than
  // one image in view at a time.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Default the AI style selector to the brand's image_style on first load.
  useEffect(() => {
    if (brand.data?.image_style) {
      setAiStyle(brand.data.image_style)
    }
  }, [brand.data?.image_style])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')
    for (const f of Array.from(files)) {
      if (draft.media_urls.length >= 10) {
        setError(t('creator.media.maxItems'))
        break
      }
      try {
        const result = await upload.mutateAsync(f)
        const updated = [...draft.media_urls, result.url]
        const isFirstImage =
          updated.length === 1 && (result.media_type as MediaType) === 'image'
        patch({
          media_urls: updated,
          media_type: updated.length > 1
            ? 'carousel'
            : (result.media_type as MediaType),
          // A user-uploaded image clears any prior AI flag — analyze runs
          // on Next, fresh per upload. Capture the upload as `original_url`
          // so a later Transform-with-AI run can revert to it.
          ai_generated_media: false,
          original_url: isFirstImage ? result.url : draft.original_url,
          // Fresh upload as the first image discards any prior transformed
          // version — the user has chosen a new source photo.
          transformed_url: isFirstImage ? null : draft.transformed_url,
          is_transformed: false,
          image_analysis: null,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : t('creator.media.uploadError'))
      }
    }
  }

  // Transform mode: GPT-Image-1 edits the user's uploaded photo into a
  // professional Instagram-ready version. Original is preserved so the
  // user can revert with "Use original" — and so the captioning step
  // analyzes the original (where the brand mark is still readable).
  async function handleTransform() {
    setAiError('')
    if (!draft.original_url) {
      setAiError(t('creator.media.aiNoSource'))
      return
    }
    if (aiCount >= MAX_AI_IMAGE_GENERATIONS) {
      setAiError(t('creator.media.aiLimit', { n: MAX_AI_IMAGE_GENERATIONS }))
      return
    }
    const description =
      aiDescription.trim() || t('creator.media.transformDefaultDescription')
    try {
      const styledDescription = `${description}. Style: ${aiStyle}.`
      const result = await generate.mutateAsync({
        description: styledDescription,
        ratio: draft.ratio,
        account_id: accounts.data?.[0]?.id,
        source_image_url: draft.original_url,
      })
      patch({
        media_urls: [result.url],
        media_type: 'image',
        ai_generated_media: true,
        is_transformed: true,
        // Cache the transformed URL so the side-by-side comparison view can
        // restore it after a "Use original" revert without burning another
        // generation. A subsequent Transform-again call will overwrite it.
        transformed_url: result.url,
        // Keep image_analysis null so Step-2's auto-analyze re-runs against
        // the ORIGINAL (which still has the brand/label readable).
        image_analysis: null,
      })
      setAiCount((c) => c + 1)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('creator.media.aiError'))
    }
  }

  // Generate-from-scratch mode: no source image, Gemini-or-DALL-E creates
  // a new image. Used when the user has not uploaded anything.
  async function handleGenerate() {
    setAiError('')
    if (!aiDescription.trim()) {
      setAiError(t('creator.media.aiDescriptionRequired'))
      return
    }
    if (aiCount >= MAX_AI_IMAGE_GENERATIONS) {
      setAiError(t('creator.media.aiLimit', { n: MAX_AI_IMAGE_GENERATIONS }))
      return
    }
    try {
      const styledDescription = `${aiDescription.trim()}. Style: ${aiStyle}.`
      const result = await generate.mutateAsync({
        description: styledDescription,
        ratio: draft.ratio,
        account_id: accounts.data?.[0]?.id,
      })
      patch({
        media_urls: [result.url],
        media_type: 'image',
        ai_generated_media: true,
        // No upload → no original to revert to, no comparison view.
        original_url: null,
        transformed_url: null,
        is_transformed: false,
        image_analysis: null,  // re-analyze on Next.
      })
      setAiCount((c) => c + 1)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('creator.media.aiError'))
    }
  }

  // Restore the user's original upload (after a Transform-with-AI run).
  // Keeps `transformed_url` populated so the side-by-side picker can flip
  // back to the AI version without re-running generation.
  function handleUseOriginal() {
    if (!draft.original_url) return
    patch({
      media_urls: [draft.original_url],
      media_type: 'image',
      ai_generated_media: false,
      is_transformed: false,
      image_analysis: null,  // re-analyze the original on Next.
    })
  }

  // Pick which side of the side-by-side comparison is the active image.
  // Both URLs already exist in state — this is just a swap of `media_urls[0]`
  // and the badge/source-image flags. No new AI call.
  function selectComparison(which: 'original' | 'transformed') {
    if (which === 'original' && draft.original_url) {
      patch({
        media_urls: [draft.original_url],
        media_type: 'image',
        ai_generated_media: false,
        is_transformed: false,
        image_analysis: null,
      })
    } else if (which === 'transformed' && draft.transformed_url) {
      patch({
        media_urls: [draft.transformed_url],
        media_type: 'image',
        ai_generated_media: true,
        is_transformed: true,
        image_analysis: null,
      })
    }
  }

  function removeAt(i: number) {
    const remaining = draft.media_urls.filter((_, idx) => idx !== i)
    patch({
      media_urls: remaining,
      media_type: remaining.length === 0 ? null
        : remaining.length === 1 ? draft.media_type === 'video' ? 'video' : 'image'
        : 'carousel',
      // Clearing the deck wipes the original-upload reference, the cached
      // transformed version, and any prior vision-analysis state — the next
      // upload starts fresh.
      ...(remaining.length === 0 && {
        original_url: null,
        transformed_url: null,
        is_transformed: false,
        ai_generated_media: false,
        image_analysis: null,
      }),
    })
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= draft.media_urls.length) return
    const next = [...draft.media_urls]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    patch({ media_urls: next })
  }

  return (
    <div className="creator-grid">
      {/* Upload */}
      <section className="creator-card">
        <h3>{t('creator.media.uploadTitle')}</h3>
        <p className="creator-sub">{t('creator.media.uploadSubtitle')}</p>
        <div
          className={cn('creator-drop', dragOver && 'is-over')}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <UploadCloud className="w-8 h-8 text-foreground/40" />
          <p className="creator-drop-title">{t('creator.media.dropHere')}</p>
          <p className="creator-drop-sub">{t('creator.media.allowedTypes')}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {upload.isPending && (
          <div className="creator-uploading">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('creator.media.uploading')}
          </div>
        )}
        {error && <p className="creator-error">{error}</p>}

        {/* Side-by-side comparison: only when an upload AND an AI transform
         *   both exist. Picking one swaps `media_urls[0]` (no new AI call).
         *   The thumbnail body selects; the corner zoom button opens the
         *   lightbox so the user can inspect either at full size. */}
        {draft.original_url && draft.transformed_url && draft.media_urls.length === 1 ? (
          <div className="creator-compare">
            {([
              { which: 'original' as const, url: draft.original_url, label: t('creator.media.compareOriginal') },
              { which: 'transformed' as const, url: draft.transformed_url, label: t('creator.media.compareTransformed') },
            ]).map(({ which, url, label }) => {
              const active = draft.media_urls[0] === url
              return (
                <button
                  type="button"
                  key={which}
                  className={cn('creator-compare-card', active && 'is-on')}
                  onClick={() => selectComparison(which)}
                  aria-pressed={active}
                >
                  <div className="creator-compare-media">
                    <img src={url} alt={label} />
                    {active && (
                      <span className="creator-compare-check" aria-hidden>
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      className="creator-compare-zoom"
                      onClick={(e) => {
                        e.stopPropagation()
                        setLightboxUrl(url)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          setLightboxUrl(url)
                        }
                      }}
                      aria-label={t('creator.media.lightboxOpen')}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="creator-compare-label">
                    <span>{label}</span>
                    {active && <em>{t('creator.media.compareSelected')}</em>}
                  </div>
                </button>
              )
            })}
          </div>
        ) : draft.media_urls.length > 0 && (
          <div className="creator-thumbs">
            {draft.media_urls.map((url, i) => (
              <div className="creator-thumb" key={`${url}-${i}`}>
                <button
                  type="button"
                  className="creator-thumb-trigger"
                  onClick={() => setLightboxUrl(url)}
                  aria-label={t('creator.media.lightboxOpen')}
                >
                  <img src={url} alt="" />
                </button>
                {i === 0 && draft.ai_generated_media && (
                  <span className="creator-thumb-aibadge">
                    <Sparkles className="w-3 h-3" />
                    {draft.is_transformed
                      ? t('creator.media.transformedBadge')
                      : t('creator.media.aiBadge')}
                  </span>
                )}
                <div className="creator-thumb-actions">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="up">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === draft.media_urls.length - 1}
                    aria-label="down"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeAt(i)} aria-label="remove">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {/* AI panel — bifurcates by upload state.
        *   No upload  → Generate-from-scratch (Gemini → DALL-E)
        *   Upload set → Transform-with-AI (GPT-Image-1 edits the photo
        *                while keeping the product recognizable)
        * Sharing the same description/style/ratio inputs and the same
        * remaining-generations counter so the user's mental model is
        * "I get N AI tries per post, period". */}
      {draft.original_url ? (
        <section className="creator-card">
          <div className="creator-ai-head">
            <h3>{t('creator.media.transformTitle')}</h3>
            <span className="creator-ai-counter">
              {t('creator.media.aiRemaining', {
                n: Math.max(0, MAX_AI_IMAGE_GENERATIONS - aiCount),
              })}
            </span>
          </div>
          <p className="creator-sub">{t('creator.media.transformSubtitle')}</p>

          <label className="creator-label">{t('creator.media.transformDescriptionLabel')}</label>
          <textarea
            className="creator-textarea"
            rows={3}
            placeholder={t('creator.media.transformDescriptionPlaceholder')}
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            dir="auto"
          />

          <label className="creator-label">{t('creator.media.aiStyleLabel')}</label>
          <div className="creator-ratio">
            {(['clean', 'vibrant', 'minimal', 'luxurious', 'playful'] as const).map((s) => (
              <button
                key={s}
                className={cn('creator-ratio-btn', aiStyle === s && 'is-on')}
                onClick={() => setAiStyle(s)}
                type="button"
              >
                {t(`brandIdentity.imageStyle.${s}`, { defaultValue: s })}
              </button>
            ))}
          </div>

          <div className="creator-ai-actions">
            <button
              className="creator-btn-primary"
              onClick={handleTransform}
              disabled={generate.isPending || aiCount >= MAX_AI_IMAGE_GENERATIONS}
              type="button"
            >
              {generate.isPending ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  {t('creator.media.transforming')}
                </>
              ) : draft.is_transformed ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t('creator.media.transformAgain')}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  {t('creator.media.transformGo')}
                </>
              )}
            </button>
            {draft.is_transformed && (
              <button
                className="creator-btn-ghost"
                onClick={handleUseOriginal}
                type="button"
              >
                {t('creator.media.useOriginal')}
              </button>
            )}
          </div>
          {aiError && <p className="creator-error">{aiError}</p>}
        </section>
      ) : (
        <section className="creator-card">
          <div className="creator-ai-head">
            <h3>{t('creator.media.aiTitle')}</h3>
            <span className="creator-ai-counter">
              {t('creator.media.aiRemaining', {
                n: Math.max(0, MAX_AI_IMAGE_GENERATIONS - aiCount),
              })}
            </span>
          </div>
          <p className="creator-sub">{t('creator.media.aiSubtitle')}</p>

          <label className="creator-label">{t('creator.media.aiDescriptionLabel')}</label>
          <textarea
            className="creator-textarea"
            rows={3}
            placeholder={t('creator.media.aiDescriptionPlaceholder')}
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            dir="auto"
          />

          <label className="creator-label">{t('creator.media.aiStyleLabel')}</label>
          <div className="creator-ratio">
            {(['clean', 'vibrant', 'minimal', 'luxurious', 'playful'] as const).map((s) => (
              <button
                key={s}
                className={cn('creator-ratio-btn', aiStyle === s && 'is-on')}
                onClick={() => setAiStyle(s)}
                type="button"
              >
                {t(`brandIdentity.imageStyle.${s}`, { defaultValue: s })}
              </button>
            ))}
          </div>

          <button
            className="creator-btn-primary creator-ai-go"
            onClick={handleGenerate}
            disabled={generate.isPending || aiCount >= MAX_AI_IMAGE_GENERATIONS || !aiDescription.trim()}
            type="button"
          >
            {generate.isPending ? (
              <>
                <Sparkles className="w-4 h-4 animate-pulse" />
                {t('creator.media.aiGenerating')}
              </>
            ) : aiCount > 0 ? (
              <>
                <RefreshCw className="w-4 h-4" />
                {t('creator.media.aiRegenerate')}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                {t('creator.media.aiGenerate')}
              </>
            )}
          </button>
          {aiError && <p className="creator-error">{aiError}</p>}
        </section>
      )}

      {/* Ratio selector — applies to both columns */}
      <section className="creator-card creator-card-full">
        <h3>{t('creator.media.ratioTitle')}</h3>
        <div className="creator-ratio">
          {(['1:1', '4:5', '16:9'] as const).map((r) => (
            <button
              key={r}
              className={cn('creator-ratio-btn', draft.ratio === r && 'is-on')}
              onClick={() => patch({ ratio: r })}
            >
              <ImageIcon className="w-4 h-4" /> {r}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ─────────────────── Image Lightbox ─────────────────── */

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation()
  // Escape closes — listener attached at the document level so focus inside
  // any nested element still triggers it.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="creator-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t('creator.media.lightboxLabel')}
      onClick={onClose}
    >
      <button
        type="button"
        className="creator-lightbox-close"
        onClick={onClose}
        aria-label={t('creator.media.lightboxClose')}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={url}
        alt=""
        className="creator-lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

/* ─────────────────── Step 2: Caption ─────────────────── */

function StepCaption({
  draft,
  patch,
  analyzing,
}: {
  draft: DraftPost
  patch: (p: Partial<DraftPost>) => void
  analyzing: boolean
}) {
  const { t } = useTranslation()
  const generate = useGenerateCaption()
  const accounts = useAccounts()
  const brand = useQuery<BrandIdentity>({
    queryKey: ['auth', 'brand-identity'],
    queryFn: fetchBrandIdentity,
    staleTime: 60_000,
  })

  const captionField = draft.caption_lang === 'ar' ? 'caption_ar' : 'caption_en'
  const captionValue = draft[captionField]

  async function regenerate() {
    const accountId = accounts.data?.[0]?.id
    const result = await generate.mutateAsync({
      content_type: draft.media_type ?? 'image',
      topic: draft.prefilled_topic || undefined,
      language: draft.caption_lang,
      image_ratio: draft.ratio,
      account_id: accountId,
      image_analysis: draft.image_analysis ?? undefined,
    })
    const text = result?.caption ?? ''
    // Extract hashtags so they live in the dedicated chip editor — keeps
    // the textarea clean.
    const tags = Array.from(text.matchAll(/#(\w+)/g)).map((m) => m[1] ?? '')
    const captionWithoutTags = text.replace(/(#\w+)/g, '').replace(/\s+/g, ' ').trim()
    patch({
      [captionField]: captionWithoutTags,
      hashtags: tags.length > 0 ? tags : draft.hashtags,
      ai_generated_caption: true,
    } as Partial<DraftPost>)
  }

  function setCaption(v: string) {
    patch({ [captionField]: v } as Partial<DraftPost>)
  }

  function addHashtag(raw: string) {
    const cleaned = raw.replace(/^#/, '').trim()
    if (!cleaned || draft.hashtags.includes(cleaned)) return
    patch({ hashtags: [...draft.hashtags, cleaned] })
  }

  function removeHashtag(idx: number) {
    patch({ hashtags: draft.hashtags.filter((_, i) => i !== idx) })
  }

  const tonePill = brand.data?.tone
    ? t('creator.caption.tonePill', { tone: t(`brandIdentity.tone.${brand.data.tone}`) })
    : null

  return (
    <div className="creator-grid">
      <section className="creator-card creator-card-wide">
        <div className="creator-caption-head">
          <h3>{t('creator.caption.title')}</h3>
          <div className="creator-caption-meta">
            {draft.image_analysis?.product_description && (
              <span
                className="creator-detected-pill"
                title={draft.image_analysis.product_description}
              >
                <ScanEye className="w-3.5 h-3.5" />
                {t('creator.caption.detectedPill', {
                  desc: draft.image_analysis.product_description,
                })}
              </span>
            )}
            {analyzing && !draft.image_analysis && (
              <span className="creator-analyzing-pill">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('creator.caption.analyzing')}
              </span>
            )}
            {draft.ai_generated_media && (
              <span className="creator-aigen-pill">
                <Sparkles className="w-3.5 h-3.5" />
                {t('creator.media.aiBadge')}
              </span>
            )}
            <div className="creator-lang-toggle">
              <button
                className={cn('creator-lang', draft.caption_lang === 'en' && 'is-on')}
                onClick={() => patch({ caption_lang: 'en' })}
              >EN</button>
              <button
                className={cn('creator-lang', draft.caption_lang === 'ar' && 'is-on')}
                onClick={() => patch({ caption_lang: 'ar' })}
              >AR</button>
            </div>
          </div>
        </div>

        {draft.image_analysis?.product_description && (
          <p className="creator-context-line" dir="auto">
            {t('creator.caption.basedOn', {
              desc: draft.image_analysis.product_description,
            })}
          </p>
        )}

        <textarea
          dir={draft.caption_lang === 'ar' ? 'rtl' : 'auto'}
          value={captionValue}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t('creator.caption.placeholder')}
          rows={8}
          className="creator-textarea"
        />

        <div className="creator-hashtags">
          <label className="creator-label">{t('creator.caption.hashtagsLabel')}</label>
          <div className="creator-hashtag-row">
            {draft.hashtags.map((h, i) => (
              <span key={`${h}-${i}`} className="creator-hashtag">
                #{h}
                <button onClick={() => removeHashtag(i)} aria-label="remove">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder={t('creator.caption.hashtagPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addHashtag((e.target as HTMLInputElement).value)
                  ;(e.target as HTMLInputElement).value = ''
                }
              }}
              className="creator-hashtag-input"
            />
          </div>
        </div>
      </section>

      <aside className="creator-card">
        <h3>{t('creator.caption.aiTitle')}</h3>
        <p className="creator-sub">{t('creator.caption.aiSubtitle')}</p>
        <button
          className="creator-btn-primary"
          onClick={regenerate}
          disabled={generate.isPending}
        >
          <Sparkles className="w-4 h-4" />
          {generate.isPending ? t('creator.caption.generating') : t('creator.caption.generate')}
        </button>
        {tonePill && (
          <div className="creator-tone-pill">
            <Globe className="w-3.5 h-3.5" />
            {tonePill}
          </div>
        )}
        {generate.isError && (
          <p className="creator-error">{t('creator.caption.aiError')}</p>
        )}
      </aside>
    </div>
  )
}

/* ─────────────────── Step 3: Preview ─────────────────── */

function StepPreview({ draft, accountUsername }: { draft: DraftPost; accountUsername: string }) {
  const { t } = useTranslation()
  const [view, setView] = useState<'feed' | 'story'>('feed')
  const [expanded, setExpanded] = useState(false)
  const captionField = draft.caption_lang === 'ar' ? 'caption_ar' : 'caption_en'
  const fullCaption = draft[captionField] || t('creator.preview.noCaption')
  const showMore = fullCaption.length > 125 && !expanded
  const renderedCaption = showMore ? fullCaption.slice(0, 125) + '…' : fullCaption

  const aspect = view === 'story'
    ? '9 / 16'
    : draft.ratio === '1:1' ? '1 / 1'
    : draft.ratio === '4:5' ? '4 / 5'
    : '16 / 9'

  return (
    <div className="creator-preview-wrap">
      <div className="creator-preview-toggle">
        {(['feed', 'story'] as const).map((v) => (
          <button
            key={v}
            className={cn('creator-preview-tab', view === v && 'is-on')}
            onClick={() => setView(v)}
          >
            {t(`creator.preview.${v}`)}
          </button>
        ))}
      </div>
      <div className="creator-phone">
        <div className="creator-phone-head">
          <div className="creator-avatar">{accountUsername.slice(0, 1).toUpperCase()}</div>
          <span className="creator-phone-handle" dir="auto">@{accountUsername}</span>
        </div>
        <div className="creator-phone-media" style={{ aspectRatio: aspect }}>
          {draft.media_urls[0] ? (
            <img src={draft.media_urls[0]} alt="" />
          ) : (
            <div className="creator-phone-placeholder">
              <ImageIcon className="w-10 h-10 text-foreground/30" />
            </div>
          )}
        </div>
        {view === 'feed' && (
          <div className="creator-phone-foot">
            <div className="creator-phone-actions">
              <span>♡</span><span>💬</span><span>↗</span>
            </div>
            <p
              className="creator-phone-caption"
              dir={draft.caption_lang === 'ar' ? 'rtl' : 'auto'}
            >
              <strong>@{accountUsername}</strong> {renderedCaption}
              {showMore && (
                <button onClick={() => setExpanded(true)} className="creator-phone-more">
                  {t('creator.preview.more')}
                </button>
              )}
            </p>
            {draft.hashtags.length > 0 && (
              <p className="creator-phone-tags" dir="auto">
                {draft.hashtags.map((h) => `#${h}`).join(' ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────── Step 4: Schedule ─────────────────── */

function StepSchedule({
  draft,
  patch,
  accountId,
  onPosted,
}: {
  draft: DraftPost
  patch: (p: Partial<DraftPost>) => void
  accountId: string | undefined
  onPosted: (status: 'draft' | 'scheduled' | 'publishing') => void
}) {
  const { t } = useTranslation()
  const create = useCreatePost()
  const breakdown = usePostsBreakdown()
  const [error, setError] = useState<string>('')

  // Estimated reach: average reach across posts on the same weekday.
  // Falls back to the per-post average when day-specific data is sparse.
  const estimatedReach = useMemo(() => {
    if (!draft.scheduled_date) return null
    const dow = new Date(draft.scheduled_date + 'T00:00:00').getDay()
    const dates = breakdown.data?.posting_dates ?? []
    const sameDow = dates.filter((d) => new Date(d.date + 'T00:00:00').getDay() === dow)
    if (sameDow.length === 0) return null
    const avg = sameDow.reduce((s, x) => s + x.count, 0) / sameDow.length
    return Math.round(avg * 100) // very rough proxy for reach
  }, [draft.scheduled_date, breakdown.data])

  async function submit(status: PostStatus) {
    setError('')
    if (!accountId) {
      setError(t('creator.schedule.noAccount'))
      return
    }
    if (status === 'scheduled' && (!draft.scheduled_date || !draft.scheduled_time)) {
      setError(t('creator.schedule.dateRequired'))
      return
    }

    const scheduledIso = status === 'scheduled' && draft.scheduled_date && draft.scheduled_time
      ? new Date(`${draft.scheduled_date}T${draft.scheduled_time}:00`).toISOString()
      : undefined

    const body: CreatePostBody = {
      social_account_id: accountId,
      media_urls: draft.media_urls,
      media_type: draft.media_type ?? 'image',
      caption_ar: draft.caption_ar || undefined,
      caption_en: draft.caption_en || undefined,
      hashtags: draft.hashtags,
      ratio: draft.ratio,
      status,
      scheduled_at: scheduledIso,
      content_plan_day: draft.content_plan_day ?? undefined,
      ai_generated_caption: draft.ai_generated_caption,
      ai_generated_media: draft.ai_generated_media,
      // Persist the original-upload URL when the user transformed it via AI
      // so the saved post still has a pointer back to what they uploaded.
      source_image_url: draft.is_transformed
        ? (draft.original_url ?? undefined)
        : undefined,
      image_analysis: draft.image_analysis ?? undefined,
    }
    try {
      await create.mutateAsync(body)
      onPosted(status === 'publishing' ? 'publishing' : status === 'scheduled' ? 'scheduled' : 'draft')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creator.schedule.saveError'))
    }
  }

  return (
    <div className="creator-card creator-schedule">
      <div className="creator-schedule-toggle">
        <label className="creator-postnow">
          <input
            type="checkbox"
            checked={draft.post_now}
            onChange={(e) => patch({ post_now: e.target.checked })}
          />
          <span>{t('creator.schedule.postNow')}</span>
        </label>
      </div>

      {!draft.post_now && (
        <div className="creator-schedule-row">
          <label className="creator-field">
            <span>{t('creator.schedule.date')}</span>
            <input
              type="date"
              value={draft.scheduled_date}
              onChange={(e) => patch({ scheduled_date: e.target.value })}
              min={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="creator-field">
            <span>{t('creator.schedule.time')}</span>
            <input
              type="time"
              value={draft.scheduled_time}
              onChange={(e) => patch({ scheduled_time: e.target.value })}
            />
          </label>
        </div>
      )}

      {!draft.post_now && estimatedReach !== null && (
        <div className="creator-est-reach">
          <Clock className="w-4 h-4 text-primary" />
          {t('creator.schedule.estReach', { n: estimatedReach })}
        </div>
      )}

      {error && <p className="creator-error">{error}</p>}

      <div className="creator-schedule-actions">
        <button
          className="creator-btn-ghost"
          onClick={() => submit('draft')}
          disabled={create.isPending}
        >
          {t('creator.schedule.saveDraft')}
        </button>
        {!draft.post_now && (
          <button
            className="creator-btn-primary"
            onClick={() => submit('scheduled')}
            disabled={create.isPending || !draft.scheduled_date || !draft.scheduled_time}
          >
            {t('creator.schedule.schedule')}
          </button>
        )}
        {draft.post_now && (
          <button
            className="creator-btn-cta"
            onClick={() => submit('publishing')}
            disabled={create.isPending}
          >
            {t('creator.schedule.postNowAction')}
          </button>
        )}
      </div>
    </div>
  )
}

/* ─────────────────── Styles ─────────────────── */

const CREATOR_STYLES = `
.creator { display:flex; flex-direction:column; gap:22px; max-width:1100px; margin:0 auto; padding-top:18px; }

.creator-head { display:flex; justify-content:space-between; align-items:center; gap:18px; }
.creator-back { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; background:transparent; color:var(--ink-700); font-size:13px; font-weight:500; transition:background .12s; }
.creator-back:hover { background:var(--ink-100); }
.creator-title { font-size:24px; font-weight:700; color:var(--ink-950); letter-spacing:-0.01em; }

.creator-steps { display:flex; gap:0; padding:14px 18px; background:var(--surface); border:1px solid var(--line); border-radius:12px; align-items:center; }
.creator-step { display:flex; align-items:center; gap:8px; flex:1; }
.creator-step:last-child { flex:0; }
.creator-step-dot { width:28px; height:28px; border-radius:50%; background:var(--ink-100); color:var(--ink-500); font-size:12px; font-weight:700; display:grid; place-items:center; transition:background .12s, color .12s; flex-shrink:0; }
.creator-step.is-on .creator-step-dot { background:var(--purple-600); color:#fff; box-shadow:0 4px 10px -3px rgba(84,51,194,.5); }
.creator-step.is-done .creator-step-dot { background:var(--purple-100); color:var(--purple-700); }
.creator-step-label { font-size:13px; font-weight:500; color:var(--ink-600); }
.creator-step.is-on .creator-step-label { color:var(--ink-950); font-weight:700; }
.creator-step-line { flex:1; height:2px; background:var(--ink-150); border-radius:99px; margin:0 4px; }

.creator-body { min-height:420px; }
.creator-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.creator-card { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:22px; display:flex; flex-direction:column; gap:14px; }
.creator-card-muted { background:var(--ink-50); }
.creator-card-full { grid-column:1 / -1; }
.creator-card-wide { grid-column:1 / -1; }
@media (max-width:900px) { .creator-grid { grid-template-columns:1fr; } }
.creator-card h3 { font-size:15px; font-weight:700; color:var(--ink-950); }
.creator-sub { font-size:13px; color:var(--ink-500); line-height:1.55; }

.creator-drop { border:2px dashed var(--ink-150); border-radius:14px; padding:36px 18px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; transition:border-color .12s, background .12s; }
.creator-drop:hover, .creator-drop.is-over { border-color:var(--purple-500); background:var(--purple-50); }
.creator-drop-title { font-size:13.5px; font-weight:600; color:var(--ink-900); }
.creator-drop-sub { font-size:11.5px; color:var(--ink-500); }

.creator-uploading { display:inline-flex; align-items:center; gap:8px; font-size:12.5px; color:var(--ink-600); }
.creator-error { font-size:12.5px; color:#bf2b2b; margin:0; }

.creator-thumbs { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px; }
.creator-thumb { position:relative; aspect-ratio:1; border-radius:12px; overflow:hidden; background:var(--ink-100); }
.creator-thumb-trigger { position:absolute; inset:0; padding:0; background:transparent; border:0; cursor:zoom-in; display:block; }
.creator-thumb-trigger img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .25s; }
.creator-thumb-trigger:hover img { transform:scale(1.04); }
.creator-thumb-actions { position:absolute; top:6px; inset-inline-end:6px; display:flex; flex-direction:column; gap:3px; z-index:2; }
.creator-thumb-actions button { width:22px; height:22px; border-radius:6px; background:rgba(0,0,0,.55); color:#fff; display:grid; place-items:center; transition:background .12s; }
.creator-thumb-actions button:hover:not(:disabled) { background:rgba(0,0,0,.8); }
.creator-thumb-actions button:disabled { opacity:.35; }

/* Side-by-side comparison (Original vs Transformed) */
.creator-compare { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.creator-compare-card { display:flex; flex-direction:column; gap:8px; padding:6px; background:transparent; border:2px solid var(--line); border-radius:14px; cursor:pointer; transition:border-color .12s, box-shadow .12s, transform .12s; }
.creator-compare-card:hover { border-color:var(--purple-300); }
.creator-compare-card.is-on { border-color:var(--purple-500); box-shadow:0 0 0 3px rgba(84,51,194,.15); }
.creator-compare-media { position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden; background:var(--ink-100); }
.creator-compare-media img { width:100%; height:100%; object-fit:cover; display:block; }
.creator-compare-check { position:absolute; top:6px; inset-inline-start:6px; width:22px; height:22px; border-radius:50%; background:var(--purple-600); color:#fff; display:grid; place-items:center; box-shadow:0 4px 10px -3px rgba(84,51,194,.5); }
.creator-compare-zoom { position:absolute; top:6px; inset-inline-end:6px; width:24px; height:24px; border-radius:6px; background:rgba(0,0,0,.55); color:#fff; display:grid; place-items:center; cursor:zoom-in; transition:background .12s; }
.creator-compare-zoom:hover { background:rgba(0,0,0,.8); }
.creator-compare-label { display:flex; justify-content:space-between; align-items:center; padding:0 4px 4px; font-size:12.5px; font-weight:600; color:var(--ink-700); }
.creator-compare-label em { font-style:normal; font-size:11px; font-weight:600; color:var(--purple-700); }

/* Lightbox */
.creator-lightbox { position:fixed; inset:0; z-index:90; background:rgba(20,16,40,.85); display:grid; place-items:center; padding:32px; cursor:zoom-out; backdrop-filter:blur(4px); animation:creator-lightbox-in .15s ease-out; }
@keyframes creator-lightbox-in { from { opacity:0; } to { opacity:1; } }
.creator-lightbox-img { max-width:min(1200px, 92vw); max-height:88vh; border-radius:12px; box-shadow:0 24px 60px -20px rgba(0,0,0,.6); cursor:default; display:block; }
.creator-lightbox-close { position:absolute; top:18px; inset-inline-end:18px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; display:grid; place-items:center; transition:background .12s; }
.creator-lightbox-close:hover { background:rgba(255,255,255,.22); }

.creator-ai-stub { padding:24px; border-radius:12px; background:var(--purple-50); display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; color:var(--purple-700); font-size:13px; font-weight:500; }

.creator-ratio { display:flex; gap:8px; flex-wrap:wrap; }
.creator-ratio-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border-radius:99px; background:var(--ink-50); border:1px solid var(--line); font-size:13px; font-weight:500; color:var(--ink-700); transition:all .12s; }
.creator-ratio-btn:hover { background:var(--ink-100); }
.creator-ratio-btn.is-on { background:var(--purple-100); border-color:var(--purple-300); color:var(--purple-900); }

.creator-caption-head { display:flex; justify-content:space-between; align-items:center; }
.creator-lang-toggle { display:flex; gap:0; padding:3px; background:var(--ink-100); border-radius:8px; }
.creator-lang { padding:5px 12px; font-size:12px; font-weight:600; color:var(--ink-600); border-radius:6px; transition:all .12s; }
.creator-lang.is-on { background:#fff; color:var(--ink-950); box-shadow:0 1px 3px rgba(0,0,0,.08); }

.creator-textarea { width:100%; padding:14px 16px; border:1px solid var(--line); border-radius:12px; font-size:14px; line-height:1.6; resize:vertical; background:#fff; color:var(--ink-950); font-family:inherit; }
.creator-textarea:focus { outline:none; border-color:var(--purple-500); box-shadow:0 0 0 3px rgba(84,51,194,.15); }

.creator-label { font-size:12px; font-weight:600; color:var(--ink-600); display:block; margin-bottom:8px; }
.creator-hashtag-row { display:flex; flex-wrap:wrap; gap:6px; padding:8px; border:1px solid var(--line); border-radius:10px; background:#fff; }
.creator-hashtag { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; background:var(--purple-100); color:var(--purple-800); border-radius:99px; font-size:12px; font-weight:600; }
.creator-hashtag button { display:grid; place-items:center; background:transparent; padding:0; }
.creator-hashtag-input { flex:1; min-width:120px; border:none; background:transparent; padding:4px; font-size:13px; outline:none; }

.creator-tone-pill { display:inline-flex; align-items:center; gap:5px; padding:6px 12px; background:var(--purple-50); color:var(--purple-700); border-radius:99px; font-size:12px; font-weight:500; align-self:flex-start; }

.creator-preview-wrap { display:flex; flex-direction:column; align-items:center; gap:18px; }
.creator-preview-toggle { display:flex; gap:6px; padding:4px; background:var(--surface); border:1px solid var(--line); border-radius:99px; }
.creator-preview-tab { padding:6px 18px; border-radius:99px; font-size:12.5px; font-weight:600; color:var(--ink-600); transition:background .12s, color .12s; }
.creator-preview-tab.is-on { background:var(--purple-600); color:#fff; }

.creator-phone { width:340px; max-width:100%; background:#fff; border:1px solid var(--line); border-radius:24px; overflow:hidden; box-shadow:0 18px 40px -16px rgba(20,16,40,.18); }
.creator-phone-head { display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--line); }
.creator-avatar { width:30px; height:30px; border-radius:50%; background:var(--purple-100); color:var(--purple-700); display:grid; place-items:center; font-size:12px; font-weight:700; }
.creator-phone-handle { font-size:13px; font-weight:600; color:var(--ink-950); }
.creator-phone-media { width:100%; background:var(--ink-100); }
.creator-phone-media img { width:100%; height:100%; object-fit:cover; display:block; }
.creator-phone-placeholder { width:100%; height:100%; display:grid; place-items:center; }
.creator-phone-foot { padding:12px 14px; display:flex; flex-direction:column; gap:8px; }
.creator-phone-actions { display:flex; gap:14px; font-size:18px; }
.creator-phone-caption { font-size:13px; color:var(--ink-900); line-height:1.5; }
.creator-phone-caption strong { font-weight:700; margin-inline-end:5px; }
.creator-phone-more { color:var(--ink-500); font-weight:500; padding:0 0 0 4px; background:transparent; }
.creator-phone-tags { font-size:12.5px; color:var(--purple-700); font-weight:500; line-height:1.5; }

.creator-schedule { display:flex; flex-direction:column; gap:18px; max-width:540px; margin:0 auto; }
.creator-schedule-toggle { display:flex; }
.creator-postnow { display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:10px; background:var(--ink-50); cursor:pointer; font-size:13px; font-weight:500; color:var(--ink-700); }
.creator-postnow input { width:16px; height:16px; }
.creator-schedule-row { display:flex; gap:12px; flex-wrap:wrap; }
.creator-field { flex:1; display:flex; flex-direction:column; gap:6px; }
.creator-field span { font-size:12px; color:var(--ink-600); font-weight:600; }
.creator-field input { padding:10px 12px; border:1px solid var(--line); border-radius:10px; font-size:13.5px; background:#fff; }
.creator-field input:focus { outline:none; border-color:var(--purple-500); box-shadow:0 0 0 3px rgba(84,51,194,.15); }

.creator-est-reach { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; background:var(--purple-50); color:var(--purple-700); border-radius:8px; font-size:12.5px; font-weight:500; align-self:flex-start; }

.creator-schedule-actions { display:flex; gap:10px; flex-wrap:wrap; padding-top:12px; border-top:1px solid var(--line); }
.creator-schedule-actions button { flex:1; min-width:140px; }

.creator-foot { display:flex; gap:12px; padding-top:6px; }
.creator-btn-primary { display:inline-flex; align-items:center; gap:6px; padding:11px 20px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:13.5px; font-weight:600; box-shadow:0 6px 16px -6px rgba(84,51,194,.55); transition:background .12s, transform .12s; }
.creator-btn-primary:hover:not(:disabled) { background:var(--purple-700); transform:translateY(-1px); }
.creator-btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.creator-btn-ghost { display:inline-flex; align-items:center; gap:6px; padding:11px 20px; background:var(--ink-100); color:var(--ink-800); border-radius:10px; font-size:13.5px; font-weight:600; transition:background .12s; }
.creator-btn-ghost:hover:not(:disabled) { background:var(--ink-150); }
.creator-btn-ghost:disabled { opacity:.5; cursor:not-allowed; }
.creator-btn-cta { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:11px 20px; background:#BF499B; color:#fff; border-radius:10px; font-size:13.5px; font-weight:600; box-shadow:0 6px 16px -6px rgba(191,73,155,.55); transition:background .12s, transform .12s; }
.creator-btn-cta:hover:not(:disabled) { background:#A83B85; transform:translateY(-1px); }
.creator-btn-cta:disabled { opacity:.5; cursor:not-allowed; }

/* AI image generation panel */
.creator-ai-head { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.creator-ai-counter { font-size:11.5px; font-weight:600; color:var(--purple-700); background:var(--purple-50); padding:3px 9px; border-radius:99px; }
.creator-ai-go { align-self:flex-start; margin-top:6px; }
.creator-ai-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:6px; }
.creator-thumb-aibadge { position:absolute; top:6px; inset-inline-start:6px; display:inline-flex; align-items:center; gap:4px; padding:3px 7px; background:linear-gradient(135deg,#5433c2,#BF499B); color:#fff; border-radius:99px; font-size:10px; font-weight:700; box-shadow:0 4px 10px -3px rgba(84,51,194,.45); }

/* Step 2 image-analysis surface */
.creator-caption-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.creator-detected-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; background:var(--purple-50); color:var(--purple-700); border-radius:99px; font-size:11.5px; font-weight:500; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.creator-analyzing-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; background:var(--ink-100); color:var(--ink-600); border-radius:99px; font-size:11.5px; font-weight:500; }
.creator-aigen-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; background:linear-gradient(135deg, rgba(84,51,194,.1), rgba(191,73,155,.1)); color:var(--purple-700); border-radius:99px; font-size:11.5px; font-weight:600; }
.creator-context-line { font-size:12.5px; color:var(--ink-600); padding:8px 12px; background:var(--ink-50); border-radius:8px; line-height:1.5; }
`

