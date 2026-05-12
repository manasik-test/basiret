import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import CancelDialog from '../components/content-plan-create/CancelDialog'
import WizardImageStep from '../components/content-plan-create/WizardImageStep'
import WizardCaptionStep from '../components/content-plan-create/WizardCaptionStep'
import WizardPreviewStep from '../components/content-plan-create/WizardPreviewStep'
import type { ImageAnalysis } from '../api/analytics'
import { useAccounts, useUpdateContentPlanTopic } from '../hooks/useAnalytics'
import { useCreatePost } from '../hooks/useCreator'

/* ─── Types ────────────────────────────────────────────────────────────── */

export type WizardStep = 'image' | 'caption' | 'preview'
export type WizardStyle = 'photographic' | 'illustration' | 'lifestyle'
export type WizardImageRatio = '1:1' | '4:5' | '16:9'
export type WizardLanguage = 'en' | 'ar'

export interface WizardState {
  step: WizardStep
  day_index: number
  suggestion_topic: string
  refined_prompt: string
  style: WizardStyle
  image_url: string | null
  image_ratio: WizardImageRatio
  // GPT-4o Vision analysis of the generated/uploaded image. Populated by a
  // background `useAnalyzeImage` call after image_url is set — non-blocking,
  // proceeding without analysis is fine, the caption step just benefits more
  // when it's present.
  image_analysis: ImageAnalysis | null
  caption: string
  language: WizardLanguage
  scheduled_at: string | null
  content_plan_day: string
  /**
   * True once the user has made any edit that would be lost if they navigated
   * back. Required by the cancel dialog gating logic.
   */
  dirty: boolean
}

interface IncomingState {
  day_index?: number
  suggestion_topic?: string
  content_plan_day?: string
  content_type?: string
  best_time?: string
  language?: WizardLanguage
}

const STEP_ORDER: readonly WizardStep[] = ['image', 'caption', 'preview'] as const

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function nextStep(step: WizardStep): WizardStep | null {
  const i = STEP_ORDER.indexOf(step)
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1]! : null
}

function prevStep(step: WizardStep): WizardStep | null {
  const i = STEP_ORDER.indexOf(step)
  return i > 0 ? STEP_ORDER[i - 1]! : null
}

/** Compute scheduled_at from a content_plan_day ISO date + best_time "HH:MM" string. */
function defaultScheduledAt(dayIso: string, bestTime?: string): string {
  const time = bestTime && /^\d{2}:\d{2}$/.test(bestTime) ? bestTime : '18:00'
  // Build the local ISO datetime; UI will refine with a proper picker in Checkpoint 5.
  return `${dayIso}T${time}:00`
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function ContentPlanCreate() {
  const location = useLocation()

  // Reject deep-links / refreshes that arrive without the required state.
  // location.state is `unknown` per react-router-dom v7 typing, so we
  // narrow defensively rather than trusting the shape.
  const incoming = (location.state ?? null) as IncomingState | null
  const required =
    incoming &&
    typeof incoming.day_index === 'number' &&
    typeof incoming.suggestion_topic === 'string' &&
    typeof incoming.content_plan_day === 'string'
  if (!required) {
    return <Navigate to="/content-plan" replace />
  }

  return <ContentPlanCreateBody initial={incoming as Required<IncomingState>} />
}

function ContentPlanCreateBody({ initial }: { initial: Required<IncomingState> }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  // Language default: UI language (en/ar). brand_identity.primary_language
  // override gets wired in Checkpoint 4 where the caption step actually
  // reads the org's brand context.
  const uiLanguage: WizardLanguage = i18n.language?.startsWith('ar') ? 'ar' : 'en'

  const [state, setState] = useState<WizardState>({
    step: 'image',
    day_index: initial.day_index,
    suggestion_topic: initial.suggestion_topic,
    refined_prompt: initial.suggestion_topic,
    style: 'photographic',
    image_url: null,
    image_ratio: '1:1',
    image_analysis: null,
    caption: '',
    language: initial.language ?? uiLanguage,
    scheduled_at: defaultScheduledAt(initial.content_plan_day, initial.best_time),
    content_plan_day: initial.content_plan_day,
    dirty: false,
  })

  const [cancelOpen, setCancelOpen] = useState(false)

  // Resources for cancel-dialog actions (and the preview step's submits).
  // The wizard is single-account-by-design (matches `useInsights` and the
  // segment hooks — first active social_account is the org's primary one).
  const accounts = useAccounts()
  const primaryAccountId = accounts.data?.[0]?.id
  const createPost = useCreatePost()
  const updateTopic = useUpdateContentPlanTopic()

  /** Update wizard state. Any field other than `step` flips `dirty: true`. */
  const patch = useCallback((p: Partial<WizardState>) => {
    setState((s) => {
      const onlyStepChange =
        Object.keys(p).length === 1 && 'step' in p
      return { ...s, ...p, dirty: onlyStepChange ? s.dirty : true }
    })
  }, [])

  /** Internal step setter that does NOT flip dirty. */
  const goToStep = useCallback((step: WizardStep) => {
    setState((s) => ({ ...s, step }))
  }, [])

  // Scroll to top on step transition so the user lands at the indicator.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' })
  }, [state.step])

  /* ── Cancel handlers ─────────────────────────────────────────────── */

  const handleCancelClick = useCallback(() => {
    if (state.dirty) {
      setCancelOpen(true)
    } else {
      navigate('/content-plan')
    }
  }, [state.dirty, navigate])

  /**
   * Save-as-draft: POST a scheduled_post with status='draft' and whatever
   * wizard fields exist. The backend accepts an empty media_urls list and
   * doesn't require scheduled_at on drafts, so a partial save from any step
   * works — the user can finish the post later from the Drafts tab.
   *
   * Network failures still close the dialog and navigate (the user wants to
   * leave the wizard; surfacing a toast from /content-plan is acceptable in
   * a future iteration). Today, errors are logged silently so the cancel
   * never gets stuck.
   */
  const handleSaveDraft = useCallback(() => {
    setCancelOpen(false)
    const body = {
      media_urls: state.image_url ? [state.image_url] : [],
      media_type: 'image' as const,
      caption_en: state.language === 'en' ? state.caption : undefined,
      caption_ar: state.language === 'ar' ? state.caption : undefined,
      hashtags: [] as string[],
      ratio: state.image_ratio,
      status: 'draft' as const,
      content_plan_day: state.content_plan_day,
      ai_generated_media: !!state.image_url,
      ai_generated_caption: !!state.caption.trim(),
    }
    createPost.mutate(body, {
      onSettled: () => navigate('/content-plan'),
    })
  }, [state, createPost, navigate])

  /**
   * Update-the-suggestion: PATCH the AI cache so the next visitor of the
   * Content Plan page sees the user's edited topic in place of the original
   * AI-written one. The wording on the cancel button ("until next refresh")
   * sets the expectation — generated_at stays the same on the backend, so
   * the next AI regeneration overwrites it.
   *
   * No-op when there's no primary account or the user didn't actually edit
   * the prompt (refined_prompt === suggestion_topic) — the network call
   * would silently succeed but achieve nothing.
   */
  const handleUpdateSuggestion = useCallback(() => {
    setCancelOpen(false)
    if (!primaryAccountId || state.refined_prompt === state.suggestion_topic) {
      navigate('/content-plan')
      return
    }
    updateTopic.mutate(
      {
        social_account_id: primaryAccountId,
        language: state.language,
        day_index: state.day_index,
        new_topic: state.refined_prompt,
      },
      { onSettled: () => navigate('/content-plan') },
    )
  }, [state, primaryAccountId, updateTopic, navigate])

  const handleDiscard = useCallback(() => {
    setCancelOpen(false)
    navigate('/content-plan')
  }, [navigate])

  /* ── Step nav ────────────────────────────────────────────────────── */

  const onBack = useCallback(() => {
    const prev = prevStep(state.step)
    if (prev) goToStep(prev)
    else handleCancelClick()
  }, [state.step, goToStep, handleCancelClick])

  const onNext = useCallback(() => {
    const next = nextStep(state.step)
    if (next) goToStep(next)
  }, [state.step, goToStep])

  const stepIndex = STEP_ORDER.indexOf(state.step)
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEP_ORDER.length - 1

  // Per-step gate for the shell's Next button. Step contents can also gate
  // internally, but expressing the rule here keeps the shell + step in sync
  // (a step without an image must never let the user advance).
  const canAdvance = (() => {
    if (state.step === 'image') return state.image_url !== null
    if (state.step === 'caption') return state.caption.trim().length > 0
    return true
  })()

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="rd-canvas" data-testid="content-plan-create">
      <div className="cpc">
        {/* Top bar: cancel + indicator */}
        <header className="cpc-head">
          <button
            type="button"
            className="cpc-back-link"
            onClick={handleCancelClick}
            data-testid="cancel-button"
          >
            <span aria-hidden>←</span>
            {t('contentPlanCreate.backToPlan')}
          </button>

          <StepIndicator step={state.step} />

          {/* Spacer keeps indicator centered with flex justify-between */}
          <span className="cpc-spacer" aria-hidden />
        </header>

        {/* Active step content */}
        <main className="cpc-main">
          {state.step === 'image' && (
            <WizardImageStep
              topic={state.suggestion_topic}
              refinedPrompt={state.refined_prompt}
              style={state.style}
              ratio={state.image_ratio}
              imageUrl={state.image_url}
              onChangePrompt={(refined_prompt) => patch({ refined_prompt })}
              onChangeStyle={(style) => patch({ style })}
              onChangeRatio={(image_ratio) => patch({ image_ratio })}
              onImageReady={(image_url) => patch({ image_url, image_analysis: null })}
              onAnalysisReady={(image_analysis) => patch({ image_analysis })}
            />
          )}
          {state.step === 'caption' && (
            <WizardCaptionStep
              imageUrl={state.image_url}
              imageRatio={state.image_ratio}
              imageAnalysis={state.image_analysis}
              topic={state.suggestion_topic}
              refinedPrompt={state.refined_prompt}
              language={state.language}
              caption={state.caption}
              onChangeLanguage={(language) => patch({ language })}
              onChangeCaption={(caption) => patch({ caption })}
            />
          )}
          {state.step === 'preview' && (
            <WizardPreviewStep
              imageUrl={state.image_url}
              caption={state.caption}
              language={state.language}
              imageRatio={state.image_ratio}
              refinedPrompt={state.refined_prompt}
              contentPlanDay={state.content_plan_day}
              scheduledAt={state.scheduled_at}
              aiGeneratedMedia={!!state.image_url}
              aiGeneratedCaption={state.caption.trim().length > 0}
              onChangeScheduledAt={(scheduled_at) => patch({ scheduled_at })}
              onSubmitted={() => navigate('/content-plan')}
            />
          )}
        </main>

        {/* Nav buttons (Back/Next). Preview's primary actions live inside
            the step itself, so we only render Next here on non-final steps. */}
        <footer className="cpc-foot">
          <button
            type="button"
            className="cpc-ghost"
            onClick={onBack}
            data-testid="wizard-back"
          >
            {t(isFirst ? 'contentPlanCreate.cancel.cancel' : 'contentPlanCreate.back')}
          </button>
          {!isLast && (
            <button
              type="button"
              className="cpc-primary"
              onClick={onNext}
              disabled={!canAdvance}
              data-testid="wizard-next"
            >
              {state.step === 'image'
                ? t('contentPlanCreate.nextCaption')
                : t('contentPlanCreate.nextPreview')}
            </button>
          )}
        </footer>

        <CancelDialog
          open={cancelOpen}
          onUpdateSuggestion={handleUpdateSuggestion}
          onSaveDraft={handleSaveDraft}
          onDiscard={handleDiscard}
          // Critical: default-on-close (X / ESC / backdrop) must save as draft.
          // Passing handleSaveDraft directly — NOT a separate "close + maybe save"
          // path — keeps that contract local and obvious at the call site.
          onDefaultClose={handleSaveDraft}
        />

        <style>{CPC_STYLES}</style>
      </div>
    </div>
  )
}

/* ─── Step indicator ───────────────────────────────────────────────────── */

function StepIndicator({ step }: { step: WizardStep }) {
  const { t } = useTranslation()
  const items = useMemo(
    () => [
      { key: 'image' as const, label: t('contentPlanCreate.step.image') },
      { key: 'caption' as const, label: t('contentPlanCreate.step.caption') },
      { key: 'preview' as const, label: t('contentPlanCreate.step.preview') },
    ],
    [t],
  )
  const activeIdx = STEP_ORDER.indexOf(step)
  return (
    <ol
      className="cpc-indicator"
      aria-label={t('contentPlanCreate.indicatorLabel')}
      data-testid="step-indicator"
    >
      {items.map((it, idx) => {
        const state =
          idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : 'pending'
        return (
          <li
            key={it.key}
            className={`cpc-indicator-item is-${state}`}
            aria-current={state === 'active' ? 'step' : undefined}
            data-testid={`indicator-${it.key}`}
            data-state={state}
          >
            <span className="cpc-indicator-num">{idx + 1}</span>
            <span className="cpc-indicator-lbl" dir="auto">{it.label}</span>
            {idx < items.length - 1 && <span className="cpc-indicator-bar" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

/* ─── Styles ───────────────────────────────────────────────────────────── */

const CPC_STYLES = `
.cpc { display:flex; flex-direction:column; gap:22px; max-width:880px; margin:0 auto; padding:18px 0 32px; }
.cpc-head { display:flex; align-items:center; justify-content:space-between; gap:18px; }
.cpc-back-link { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:8px; background:transparent; color:var(--ink-700); font-size:13px; font-weight:600; transition:background .12s, color .12s; border:none; cursor:pointer; }
.cpc-back-link:hover { background:var(--ink-100); color:var(--ink-900); }
.cpc-spacer { width:140px; }

.cpc-indicator { display:flex; align-items:center; gap:10px; list-style:none; padding:0; margin:0; }
.cpc-indicator-item { display:inline-flex; align-items:center; gap:8px; color:var(--ink-500); font-size:12.5px; font-weight:600; position:relative; }
.cpc-indicator-num { width:24px; height:24px; border-radius:50%; display:grid; place-items:center; background:var(--ink-100); color:var(--ink-600); font-size:11px; font-weight:700; transition:background .15s, color .15s; }
.cpc-indicator-item.is-active .cpc-indicator-num { background:var(--purple-600); color:#fff; box-shadow:0 0 0 4px rgba(84,51,194,.15); }
.cpc-indicator-item.is-active .cpc-indicator-lbl { color:var(--ink-950); }
.cpc-indicator-item.is-done .cpc-indicator-num { background:var(--purple-100); color:var(--purple-700); }
.cpc-indicator-item.is-done .cpc-indicator-lbl { color:var(--ink-700); }
.cpc-indicator-bar { display:inline-block; width:36px; height:2px; background:var(--ink-150); border-radius:2px; margin-inline-start:4px; }
.cpc-indicator-item.is-done .cpc-indicator-bar { background:var(--purple-300); }

.cpc-main { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:28px; min-height:320px; }
.cpc-placeholder { display:flex; flex-direction:column; align-items:center; gap:12px; text-align:center; padding:48px 24px; color:var(--ink-600); }
.cpc-placeholder-icon { width:48px; height:48px; border-radius:14px; background:var(--purple-50); border:1px dashed var(--purple-200); }
.cpc-placeholder-title { font-size:17px; font-weight:700; color:var(--ink-900); letter-spacing:-0.01em; }
.cpc-placeholder-body { font-size:13.5px; color:var(--ink-500); max-width:440px; line-height:1.55; }

.cpc-foot { display:flex; justify-content:space-between; gap:12px; }
.cpc-ghost { padding:11px 18px; background:var(--ink-100); color:var(--ink-800); border-radius:10px; font-size:13px; font-weight:600; border:none; cursor:pointer; transition:background .12s; }
.cpc-ghost:hover { background:var(--ink-150); }
.cpc-primary { padding:11px 22px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:13px; font-weight:600; border:none; cursor:pointer; transition:background .12s, transform .12s; box-shadow:0 6px 16px -6px rgba(84,51,194,.55); }
.cpc-primary:hover:not(:disabled) { background:var(--purple-700); transform:translateY(-1px); }
.cpc-primary:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }

.cpc-modal-back { position:fixed; inset:0; background:rgba(20,16,40,.45); z-index:60; display:grid; place-items:center; padding:18px; }
.cpc-modal { background:var(--surface); border-radius:14px; padding:24px; max-width:440px; width:100%; display:flex; flex-direction:column; gap:14px; position:relative; box-shadow:0 24px 56px -16px rgba(20,16,40,.45); }
.cpc-modal-x { position:absolute; inset-inline-end:12px; top:10px; width:30px; height:30px; border-radius:8px; background:transparent; color:var(--ink-500); border:none; font-size:22px; line-height:1; cursor:pointer; }
.cpc-modal-x:hover { background:var(--ink-100); color:var(--ink-900); }
.cpc-modal-title { font-size:16px; font-weight:700; color:var(--ink-950); padding-inline-end:24px; }
.cpc-modal-body { font-size:13.5px; color:var(--ink-600); line-height:1.55; }
.cpc-modal-actions { display:flex; flex-direction:column; gap:8px; padding-top:6px; }
.cpc-modal-primary { padding:11px 16px; background:var(--purple-600); color:#fff; border-radius:10px; font-size:13.5px; font-weight:600; border:none; cursor:pointer; transition:background .12s; }
.cpc-modal-primary:hover { background:var(--purple-700); }
.cpc-modal-secondary { padding:11px 16px; background:var(--ink-100); color:var(--ink-900); border-radius:10px; font-size:13.5px; font-weight:600; border:none; cursor:pointer; transition:background .12s; }
.cpc-modal-secondary:hover { background:var(--ink-150); }
.cpc-modal-danger { padding:11px 16px; background:transparent; color:#b91c1c; border-radius:10px; font-size:13px; font-weight:600; border:none; cursor:pointer; transition:background .12s; }
.cpc-modal-danger:hover { background:rgba(185,28,28,.08); }
`
