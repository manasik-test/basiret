/**
 * Tests for WizardImageStep (Checkpoint 3).
 *
 * Strategy: mock the data hooks at the module boundary so we don't run real
 * React Query or hit the network. Each test wires the mock state for a single
 * scenario and asserts the UI's response.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import '../../i18n'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContentPlanCreate from '../../pages/ContentPlanCreate'

// ── Hook mocks ──────────────────────────────────────────────────────────

const generateMutate = vi.fn()
const uploadMutate = vi.fn()
const analyzeMutate = vi.fn()
let generatePending = false
let uploadPending = false

vi.mock('../../hooks/useCreator', () => ({
  useGenerateImage: () => ({
    mutate: generateMutate,
    isPending: generatePending,
  }),
  useUploadMedia: () => ({
    mutate: uploadMutate,
    isPending: uploadPending,
  }),
  useAnalyzeImage: () => ({
    mutate: analyzeMutate,
    isPending: false,
  }),
  // ContentPlanCreate (the wizard shell) now uses useCreatePost for its
  // save-as-draft cancel-dialog action; stub it so the shell mounts.
  useCreatePost: () => ({ mutate: vi.fn(), isPending: false }),
}))

// Minimal hook surface — only what the wizard touches. Avoiding
// `vi.importActual` keeps the mock factory synchronous so it hoists cleanly
// before any module imports inside the wizard chain.
vi.mock('../../hooks/useAnalytics', () => ({
  useAccounts: () => ({
    data: [{ id: 'acct-fixture-1', username: 'demo' }],
    isLoading: false,
  }),
  useGenerateCaption: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateContentPlanTopic: () => ({ mutate: vi.fn(), isPending: false }),
  useLanguageCacheInvalidation: () => {},
}))

beforeEach(() => {
  generateMutate.mockReset()
  uploadMutate.mockReset()
  analyzeMutate.mockReset()
  generatePending = false
  uploadPending = false
})

afterEach(() => {
  // Defensive — RTL cleanup is registered in test-setup but doesn't hurt.
})

// ── Render helper: full wizard with valid initial state ─────────────────

const validState = {
  day_index: 1,
  suggestion_topic: 'Behind the scenes day in my life',
  content_plan_day: '2026-05-13',
  content_type: 'image',
  best_time: '18:00',
  language: 'en' as const,
}

function mountWizard() {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/content-plan/create', state: validState },
      ]}
    >
      <Routes>
        <Route path="/content-plan/create" element={<ContentPlanCreate />} />
        <Route path="/content-plan" element={<div data-testid="plan-stub" />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('WizardImageStep — suggestion + prompt', () => {
  it('renders the original suggestion topic read-only', () => {
    mountWizard()
    expect(screen.getByTestId('image-suggestion')).toHaveTextContent(
      validState.suggestion_topic,
    )
  })

  it('prompt textarea is pre-filled with the suggestion topic', () => {
    mountWizard()
    const ta = screen.getByTestId('image-prompt') as HTMLTextAreaElement
    expect(ta.value).toBe(validState.suggestion_topic)
  })
})

describe('WizardImageStep — style picker', () => {
  it('defaults to photographic and switches when a card is clicked', async () => {
    const user = userEvent.setup()
    mountWizard()
    expect(screen.getByTestId('image-style-photographic')).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await user.click(screen.getByTestId('image-style-illustration'))
    expect(screen.getByTestId('image-style-illustration')).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByTestId('image-style-photographic')).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
})

describe('WizardImageStep — aspect ratio dropdown', () => {
  it('changes image_ratio in state', async () => {
    const user = userEvent.setup()
    mountWizard()
    const select = screen.getByTestId('image-ratio') as HTMLSelectElement
    expect(select.value).toBe('1:1')
    await user.selectOptions(select, '4:5')
    expect(select.value).toBe('4:5')
  })
})

describe('WizardImageStep — generate button gating', () => {
  it('is disabled when the prompt is empty / whitespace', async () => {
    const user = userEvent.setup()
    mountWizard()
    const ta = screen.getByTestId('image-prompt') as HTMLTextAreaElement
    await user.clear(ta)
    expect(screen.getByTestId('image-generate')).toBeDisabled()
    await user.type(ta, '   ')
    expect(screen.getByTestId('image-generate')).toBeDisabled()
  })

  it('is enabled when the prompt has content', () => {
    mountWizard()
    expect(screen.getByTestId('image-generate')).toBeEnabled()
  })
})

describe('WizardImageStep — generate flow', () => {
  it('clicking Generate fires the API with style-prefixed description + ratio + account_id', async () => {
    const user = userEvent.setup()
    mountWizard()
    await user.click(screen.getByTestId('image-style-lifestyle'))
    await user.selectOptions(screen.getByTestId('image-ratio'), '4:5')
    await user.click(screen.getByTestId('image-generate'))

    expect(generateMutate).toHaveBeenCalledTimes(1)
    const [payload] = generateMutate.mock.calls[0]!
    expect(payload).toMatchObject({
      ratio: '4:5',
      account_id: 'acct-fixture-1',
    })
    expect(payload.description).toContain('Lifestyle photography:')
    expect(payload.description).toContain(validState.suggestion_topic)
  })

  it('on success, renders the result image and enables the Next button', async () => {
    const user = userEvent.setup()
    // Simulate the API immediately resolving with a URL.
    generateMutate.mockImplementation((_req, opts) => {
      opts?.onSuccess?.({
        url: 'https://example.com/generated.png',
        prompt_used: 'foo',
        ratio: '1:1',
        size: '1024x1024',
      })
    })
    mountWizard()
    // Next is disabled before any image exists.
    expect(screen.getByTestId('wizard-next')).toBeDisabled()
    await user.click(screen.getByTestId('image-generate'))
    expect(screen.getByTestId('image-result')).toHaveAttribute(
      'src',
      'https://example.com/generated.png',
    )
    expect(screen.getByTestId('wizard-next')).toBeEnabled()
  })

  it('on success, also triggers image analysis in the background', async () => {
    const user = userEvent.setup()
    generateMutate.mockImplementation((_req, opts) => {
      opts?.onSuccess?.({
        url: 'https://example.com/generated-a.png',
        prompt_used: 'foo',
        ratio: '1:1',
        size: '1024x1024',
      })
    })
    mountWizard()
    await user.click(screen.getByTestId('image-generate'))
    expect(analyzeMutate).toHaveBeenCalledTimes(1)
    expect(analyzeMutate.mock.calls[0]![0]).toBe('https://example.com/generated-a.png')
  })

  it('on error, renders an inline error with a Retry button that re-fires the call', async () => {
    const user = userEvent.setup()
    generateMutate.mockImplementation((_req, opts) => {
      opts?.onError?.(new Error('upstream 503'))
    })
    mountWizard()
    await user.click(screen.getByTestId('image-generate'))
    expect(screen.getByTestId('image-error')).toHaveTextContent('upstream 503')
    expect(screen.getByTestId('image-error-retry')).toBeInTheDocument()

    // Retry path
    await user.click(screen.getByTestId('image-error-retry'))
    expect(generateMutate).toHaveBeenCalledTimes(2)
  })
})

describe('WizardImageStep — regenerate + edit prompt + upload', () => {
  it('Regenerate (after success) re-fires the generate API', async () => {
    const user = userEvent.setup()
    generateMutate.mockImplementation((_req, opts) => {
      opts?.onSuccess?.({
        url: 'https://example.com/g.png',
        prompt_used: 'foo',
        ratio: '1:1',
        size: '1024x1024',
      })
    })
    mountWizard()
    await user.click(screen.getByTestId('image-generate'))
    expect(generateMutate).toHaveBeenCalledTimes(1)
    await user.click(screen.getByTestId('image-action-regenerate'))
    expect(generateMutate).toHaveBeenCalledTimes(2)
  })

  it('Edit prompt focuses the prompt textarea', async () => {
    const user = userEvent.setup()
    generateMutate.mockImplementation((_req, opts) => {
      opts?.onSuccess?.({
        url: 'https://example.com/g.png',
        prompt_used: 'foo',
        ratio: '1:1',
        size: '1024x1024',
      })
    })
    mountWizard()
    await user.click(screen.getByTestId('image-generate'))
    const ta = screen.getByTestId('image-prompt') as HTMLTextAreaElement
    ta.blur()
    expect(document.activeElement).not.toBe(ta)
    await user.click(screen.getByTestId('image-action-edit-prompt'))
    expect(document.activeElement).toBe(ta)
  })

  it('Upload my own triggers the hidden file input', async () => {
    const user = userEvent.setup()
    generateMutate.mockImplementation((_req, opts) => {
      opts?.onSuccess?.({
        url: 'https://example.com/g.png',
        prompt_used: 'foo',
        ratio: '1:1',
        size: '1024x1024',
      })
    })
    mountWizard()
    // Make the file input observable by spying on .click()
    await user.click(screen.getByTestId('image-generate'))
    const fileInput = screen.getByTestId('image-file-input') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')
    await user.click(screen.getByTestId('image-action-upload'))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('Upload my own → onUpload runs the API and renders the uploaded image', async () => {
    uploadMutate.mockImplementation((_file: File, opts) => {
      opts?.onSuccess?.({
        url: 'https://example.com/upload.png',
        media_type: 'image',
        filename: 'upload.png',
      })
    })
    mountWizard()
    const fileInput = screen.getByTestId('image-file-input') as HTMLInputElement
    const file = new File(['fakebytes'], 'photo.jpg', { type: 'image/jpeg' })
    // Drive the underlying input change like the browser would.
    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })
    expect(uploadMutate).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('image-result')).toHaveAttribute(
      'src',
      'https://example.com/upload.png',
    )
    expect(screen.getByTestId('wizard-next')).toBeEnabled()
    // Analysis triggered for uploaded images too.
    expect(analyzeMutate).toHaveBeenCalledTimes(1)
  })

  it('Upload rejects non-image files with an inline error', async () => {
    mountWizard()
    const fileInput = screen.getByTestId('image-file-input') as HTMLInputElement
    const file = new File(['x'], 'thing.mp4', { type: 'video/mp4' })
    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })
    expect(uploadMutate).not.toHaveBeenCalled()
    expect(screen.getByTestId('image-error')).toBeInTheDocument()
  })
})

describe('WizardImageStep — Next button gating', () => {
  it('Next is disabled when image_url is null', () => {
    mountWizard()
    expect(screen.getByTestId('wizard-next')).toBeDisabled()
  })

  it('Next is enabled once a generated image is set', async () => {
    const user = userEvent.setup()
    generateMutate.mockImplementation((_req, opts) => {
      opts?.onSuccess?.({
        url: 'https://example.com/g.png',
        prompt_used: 'foo',
        ratio: '1:1',
        size: '1024x1024',
      })
    })
    mountWizard()
    await user.click(screen.getByTestId('image-generate'))
    expect(screen.getByTestId('wizard-next')).toBeEnabled()
  })
})
