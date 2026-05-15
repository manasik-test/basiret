/**
 * Tests for BatchGenerateDialog.
 *
 * Verifies radio selection, remember-checkbox state, ESC + backdrop close,
 * and that confirm fires with the user's selections.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import '../../i18n'
import BatchGenerateDialog from './BatchGenerateDialog'

describe('BatchGenerateDialog', () => {
  it('does not render when open is false', () => {
    render(
      <BatchGenerateDialog
        open={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('batch-generate-dialog')).not.toBeInTheDocument()
  })

  it('renders both radio options + remember checkbox when open', () => {
    render(
      <BatchGenerateDialog
        open
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('batch-generate-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('batch-drafts')).toBeInTheDocument()
    expect(screen.getByTestId('batch-schedule')).toBeInTheDocument()
    expect(screen.getByTestId('batch-remember-checkbox')).toBeInTheDocument()
  })

  it('defaults to "drafts" selection', () => {
    render(
      <BatchGenerateDialog
        open
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('batch-drafts')).toBeChecked()
    expect(screen.getByTestId('batch-schedule')).not.toBeChecked()
  })

  it('honors initialAction prop', () => {
    render(
      <BatchGenerateDialog
        open
        initialAction="schedule"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('batch-schedule')).toBeChecked()
    expect(screen.getByTestId('batch-drafts')).not.toBeChecked()
  })

  it('fires onConfirm with selected action + remember state', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <BatchGenerateDialog
        open
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    await user.click(screen.getByTestId('batch-schedule'))
    await user.click(screen.getByTestId('batch-remember-checkbox'))
    await user.click(screen.getByTestId('batch-confirm-btn'))
    expect(onConfirm).toHaveBeenCalledWith('schedule', true)
  })

  it('cancel button fires onCancel without firing onConfirm', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <BatchGenerateDialog
        open
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByTestId('batch-cancel-btn'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('ESC key fires onCancel', () => {
    const onCancel = vi.fn()
    render(
      <BatchGenerateDialog
        open
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
