/**
 * Tests for BatchGenerateProgressModal.
 *
 * Verifies per-day status rendering, header counter, "X/7 ready" formatting,
 * "continue in background" button visibility and onClose wiring.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import '../../i18n'
import BatchGenerateProgressModal from './BatchGenerateProgressModal'
import type { BatchProgressData } from '../../api/analytics'

function makeProgress(overrides: Partial<BatchProgressData> = {}): BatchProgressData {
  return {
    id: 'batch-1',
    social_account_id: 'acct-1',
    language: 'en',
    action: 'drafts',
    status: 'running',
    per_day_status: {
      '0': { status: 'done', scheduled_post_id: 'p0', error: null, fell_back_to_draft: false },
      '1': { status: 'done', scheduled_post_id: 'p1', error: null, fell_back_to_draft: false },
      '2': { status: 'generating_image', scheduled_post_id: null, error: null, fell_back_to_draft: false },
      '3': { status: 'queued', scheduled_post_id: null, error: null, fell_back_to_draft: false },
      '4': { status: 'queued', scheduled_post_id: null, error: null, fell_back_to_draft: false },
      '5': { status: 'queued', scheduled_post_id: null, error: null, fell_back_to_draft: false },
      '6': { status: 'queued', scheduled_post_id: null, error: null, fell_back_to_draft: false },
    },
    started_at: '2026-05-15T10:00:00Z',
    completed_at: null,
    error_message: null,
    ...overrides,
  }
}

describe('BatchGenerateProgressModal', () => {
  it('does not render when open is false', () => {
    render(
      <BatchGenerateProgressModal
        open={false}
        progress={makeProgress()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('batch-progress-modal')).not.toBeInTheDocument()
  })

  it('renders one row per day (7 rows) when open', () => {
    render(
      <BatchGenerateProgressModal open progress={makeProgress()} onClose={vi.fn()} />,
    )
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`batch-day-row-${i}`)).toBeInTheDocument()
    }
  })

  it('header shows X/7 counter reflecting "done" entries', () => {
    render(
      <BatchGenerateProgressModal open progress={makeProgress()} onClose={vi.fn()} />,
    )
    // 2 days are 'done' in the fixture
    expect(screen.getByText(/2\/7/)).toBeInTheDocument()
  })

  it('close button fires onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <BatchGenerateProgressModal open progress={makeProgress()} onClose={onClose} />,
    )
    await user.click(screen.getByTestId('batch-progress-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('"continue in background" button fires onClose while running', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <BatchGenerateProgressModal open progress={makeProgress()} onClose={onClose} />,
    )
    await user.click(screen.getByTestId('batch-progress-continue'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ESC fires onClose', () => {
    const onClose = vi.fn()
    render(
      <BatchGenerateProgressModal open progress={makeProgress()} onClose={onClose} />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders error_message when present', () => {
    render(
      <BatchGenerateProgressModal
        open
        progress={makeProgress({
          status: 'failed',
          error_message: 'Content plan no longer available',
        })}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/Content plan no longer available/i)).toBeInTheDocument()
  })

  it('renders gracefully when progress is null (queued state for all days)', () => {
    render(
      <BatchGenerateProgressModal open progress={null} onClose={vi.fn()} />,
    )
    expect(screen.getByTestId('batch-progress-modal')).toBeInTheDocument()
    // Header shows 0/7 ready when nothing is in flight yet
    expect(screen.getByText(/0\/7/)).toBeInTheDocument()
  })
})
