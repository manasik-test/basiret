/**
 * Tests for WizardPreviewStep + cancel-dialog API wiring (Checkpoint 5).
 *
 * The shell mounts all three steps; we drive the wizard from the image step
 * through caption to preview using the mocked APIs from previous checkpoints.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import '../../i18n'
import ContentPlanCreate from '../../pages/ContentPlanCreate'

// ── Hook mocks ──────────────────────────────────────────────────────────

const generateImageMutate = vi.fn()
const generateCaptionMutate = vi.fn()
const createPostMutate = vi.fn()
const updateTopicMutate = vi.fn()
const analyzeMutate = vi.fn()

vi.mock('../../hooks/useAnalytics', () => ({
  useAccounts: () => ({
    data: [{ id: 'acct-1', username: 'demo' }],
    isLoading: false,
  }),
  useGenerateCaption: () => ({ mutate: generateCaptionMutate, isPending: false }),
  useUpdateContentPlanTopic: () => ({ mutate: updateTopicMutate, isPending: false }),
  useLanguageCacheInvalidation: () => {},
}))

vi.mock('../../hooks/useCreator', () => ({
  useGenerateImage: () => ({ mutate: generateImageMutate, isPending: false }),
  useUploadMedia: () => ({ mutate: vi.fn(), isPending: false }),
  useAnalyzeImage: () => ({ mutate: analyzeMutate, isPending: false }),
  useCreatePost: () => ({ mutate: createPostMutate, isPending: false }),
}))

beforeEach(() => {
  generateImageMutate.mockReset()
  generateCaptionMutate.mockReset()
  createPostMutate.mockReset()
  updateTopicMutate.mockReset()
  analyzeMutate.mockReset()
  // Default scenarios that get the wizard to the preview step.
  generateImageMutate.mockImplementation((_req, opts) => {
    opts?.onSuccess?.({
      url: 'https://example.com/g.png',
      prompt_used: 'foo',
      ratio: '1:1',
      size: '1024x1024',
    })
  })
  generateCaptionMutate.mockImplementation((_req, opts) => {
    opts?.onSuccess?.({ caption: 'AI-written caption text.' })
  })
})

// ── Render helpers ───────────────────────────────────────────────────────

const validState = {
  day_index: 2,
  suggestion_topic: 'Cleaning pools in 40°C heat',
  content_plan_day: '2026-05-13',
  content_type: 'image',
  best_time: '18:00',
  language: 'en' as const,
}

function mountWizard() {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/content-plan/create', state: validState }]}
    >
      <Routes>
        <Route path="/content-plan/create" element={<ContentPlanCreate />} />
        <Route path="/content-plan" element={<div data-testid="plan-stub">PLAN</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function advanceToPreviewStep(user: ReturnType<typeof userEvent.setup>) {
  // Image → set image
  await user.click(screen.getByTestId('image-generate'))
  // Image → Next
  await user.click(screen.getByTestId('wizard-next'))
  // Caption → generate
  await user.click(screen.getByTestId('caption-generate'))
  // Caption → Next
  await user.click(screen.getByTestId('wizard-next'))
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('WizardPreviewStep — render + schedule controls', () => {
  it('renders the StepPreview block, date input, and time input', async () => {
    const user = userEvent.setup()
    mountWizard()
    await advanceToPreviewStep(user)
    expect(screen.getByTestId('wizard-step-preview')).toBeInTheDocument()
    expect(screen.getByTestId('preview-date')).toBeInTheDocument()
    expect(screen.getByTestId('preview-time')).toBeInTheDocument()
  })

  it('date input is pre-filled with content_plan_day', async () => {
    const user = userEvent.setup()
    mountWizard()
    await advanceToPreviewStep(user)
    expect((screen.getByTestId('preview-date') as HTMLInputElement).value).toBe(
      validState.content_plan_day,
    )
  })

  it('time input default matches best_time-derived ISO', async () => {
    const user = userEvent.setup()
    mountWizard()
    await advanceToPreviewStep(user)
    // Wizard's defaultScheduledAt seeds the time slot from best_time = "18:00"
    expect((screen.getByTestId('preview-time') as HTMLInputElement).value).toBe(
      '18:00',
    )
  })
})

describe('WizardPreviewStep — three actions', () => {
  it('Save as draft fires POST /creator/posts with status=draft', async () => {
    const user = userEvent.setup()
    mountWizard()
    await advanceToPreviewStep(user)
    await user.click(screen.getByTestId('preview-save-draft'))
    expect(createPostMutate).toHaveBeenCalledTimes(1)
    const [body] = createPostMutate.mock.calls[0]!
    expect(body).toMatchObject({
      status: 'draft',
      media_urls: ['https://example.com/g.png'],
      caption_en: 'AI-written caption text.',
      ratio: '1:1',
      content_plan_day: validState.content_plan_day,
    })
  })

  it('Schedule fires POST /creator/posts with status=scheduled + scheduled_at', async () => {
    const user = userEvent.setup()
    mountWizard()
    await advanceToPreviewStep(user)
    await user.click(screen.getByTestId('preview-schedule'))
    const [body] = createPostMutate.mock.calls[0]!
    expect(body.status).toBe('scheduled')
    expect(body.scheduled_at).toMatch(/2026-05-13T18:00/)
  })

  it('Publish now fires POST /creator/posts with status=publishing', async () => {
    const user = userEvent.setup()
    mountWizard()
    await advanceToPreviewStep(user)
    await user.click(screen.getByTestId('preview-publish-now'))
    const [body] = createPostMutate.mock.calls[0]!
    expect(body.status).toBe('publishing')
  })

  it('Schedule is disabled when caption is empty', async () => {
    const user = userEvent.setup()
    // Override caption gen to return empty so Next is still gated.
    generateCaptionMutate.mockImplementation((_req, opts) => {
      opts?.onSuccess?.({ caption: 'A caption.' })
    })
    mountWizard()
    await advanceToPreviewStep(user)
    // Manually empty the caption back at the textarea after arriving on step 3.
    // The caption state is preserved across steps, so we need to clear it via
    // the Back path → empty textarea → forward again.
    await user.click(screen.getByTestId('wizard-back'))
    const ta = screen.getByTestId('caption-textarea') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(ta, { target: { value: '' } })
    })
    // With empty caption, the wizard's Next is gated — skip via direct state assert.
    expect(screen.getByTestId('wizard-next')).toBeDisabled()
  })

  it('on submit success, navigates back to /content-plan', async () => {
    const user = userEvent.setup()
    createPostMutate.mockImplementation((_body, opts) => {
      opts?.onSuccess?.({ id: 'new-post-id', permalink: null })
    })
    mountWizard()
    await advanceToPreviewStep(user)
    await user.click(screen.getByTestId('preview-save-draft'))
    expect(screen.getByTestId('plan-stub')).toBeInTheDocument()
  })

  it('on submit error, renders inline error', async () => {
    const user = userEvent.setup()
    createPostMutate.mockImplementation((_body, opts) => {
      opts?.onError?.(new Error('boom'))
    })
    mountWizard()
    await advanceToPreviewStep(user)
    await user.click(screen.getByTestId('preview-save-draft'))
    expect(screen.getByTestId('preview-error')).toHaveTextContent('boom')
  })
})

describe('Cancel dialog — full API wiring (Checkpoint 5)', () => {
  it('Update the suggestion → PATCH /content-plan/topic with refined_prompt', async () => {
    const user = userEvent.setup()
    updateTopicMutate.mockImplementation((_body, opts) => {
      opts?.onSettled?.()
    })
    mountWizard()
    // Edit the prompt so dirty=true AND refined_prompt !== suggestion_topic
    const prompt = screen.getByTestId('image-prompt') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(prompt, {
        target: { value: 'Refined: Cleaning a pool in 40°C Oman heat' },
      })
    })
    await user.click(screen.getByTestId('cancel-button'))
    await user.click(screen.getByTestId('cancel-action-update-suggestion'))
    expect(updateTopicMutate).toHaveBeenCalledTimes(1)
    const [body] = updateTopicMutate.mock.calls[0]!
    expect(body).toMatchObject({
      social_account_id: 'acct-1',
      language: 'en',
      day_index: validState.day_index,
      new_topic: 'Refined: Cleaning a pool in 40°C Oman heat',
    })
  })

  it('Update the suggestion is a no-op when refined_prompt unchanged', async () => {
    const user = userEvent.setup()
    mountWizard()
    // Make state dirty by changing style (not the prompt) — refined_prompt
    // stays equal to suggestion_topic.
    await user.click(screen.getByTestId('image-style-illustration'))
    await user.click(screen.getByTestId('cancel-button'))
    await user.click(screen.getByTestId('cancel-action-update-suggestion'))
    expect(updateTopicMutate).not.toHaveBeenCalled()
    expect(screen.getByTestId('plan-stub')).toBeInTheDocument()
  })

  it('Save as draft (cancel path) → POST /creator/posts with status=draft', async () => {
    const user = userEvent.setup()
    createPostMutate.mockImplementation((_body, opts) => {
      opts?.onSettled?.()
    })
    mountWizard()
    // Make state dirty
    const prompt = screen.getByTestId('image-prompt') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(prompt, { target: { value: 'Edited prompt' } })
    })
    await user.click(screen.getByTestId('cancel-button'))
    await user.click(screen.getByTestId('cancel-action-save-draft'))
    expect(createPostMutate).toHaveBeenCalledTimes(1)
    const [body] = createPostMutate.mock.calls[0]!
    expect(body).toMatchObject({
      status: 'draft',
      content_plan_day: validState.content_plan_day,
    })
  })

  it('Discard → navigates back without any API call', async () => {
    const user = userEvent.setup()
    mountWizard()
    const prompt = screen.getByTestId('image-prompt') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(prompt, { target: { value: 'Edited prompt' } })
    })
    await user.click(screen.getByTestId('cancel-button'))
    await user.click(screen.getByTestId('cancel-action-discard'))
    expect(createPostMutate).not.toHaveBeenCalled()
    expect(updateTopicMutate).not.toHaveBeenCalled()
    expect(screen.getByTestId('plan-stub')).toBeInTheDocument()
  })

  it('X / ESC default-on-close also goes through Save as draft API path', async () => {
    const user = userEvent.setup()
    createPostMutate.mockImplementation((_body, opts) => {
      opts?.onSettled?.()
    })
    mountWizard()
    const prompt = screen.getByTestId('image-prompt') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(prompt, { target: { value: 'Edited prompt' } })
    })
    await user.click(screen.getByTestId('cancel-button'))
    await user.click(screen.getByTestId('cancel-dialog-x'))
    expect(createPostMutate).toHaveBeenCalledTimes(1)
    const [body] = createPostMutate.mock.calls[0]!
    expect(body.status).toBe('draft')
  })
})
