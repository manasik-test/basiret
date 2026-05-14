/**
 * Tests for Recommendations.tsx — scheduled_post badge variants + status-aware
 * action buttons (Checkpoint 5).
 *
 * Stubs the data hooks to seed a single fixture day with each scheduled_post
 * status. Only the surface that toggles based on the badge is exercised here;
 * the rest of the page is covered by the existing manual smoke path.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import '../i18n'
import Recommendations from './Recommendations'
import type {
  ContentPlanDay,
  ContentPlanDayScheduledPost,
} from '../api/analytics'

// ── Hook mocks ──────────────────────────────────────────────────────────

function makePlan(scheduled: ContentPlanDayScheduledPost | null = null): {
  days: ContentPlanDay[]
} {
  const day0: ContentPlanDay = {
    day_index: 0,
    day_label: 'Monday',
    date: '2026-05-13',
    content_type: 'image',
    best_time: '18:00',
    estimated_reach: 250,
    topic: 'Behind the scenes',
    scheduled_post: scheduled,
  }
  // Pad the week so the list renders normally
  const others: ContentPlanDay[] = Array.from({ length: 6 }, (_, i) => ({
    day_index: i + 1,
    day_label: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]!,
    date: `2026-05-${14 + i}`,
    content_type: 'image',
    best_time: '18:00',
    estimated_reach: 100 + i * 10,
    topic: `Topic ${i + 1}`,
    scheduled_post: null,
  }))
  return { days: [day0, ...others] }
}

const planData = vi.fn(() => makePlan(null))

vi.mock('../hooks/useAnalytics', () => ({
  useContentPlan: () => ({ data: planData(), isLoading: false }),
  useAccounts: () => ({
    data: [{ id: 'acct-1', username: 'demo' }],
    isLoading: false,
  }),
  useGenerateCaption: () => ({ mutate: vi.fn(), isPending: false }),
  useRegenerateContentPlan: () => ({ mutate: vi.fn(), isPending: false }),
  useLanguageCacheInvalidation: () => {},
}))

vi.mock('../hooks/useBilling', () => ({
  useIsFeatureLocked: () => false,
}))

vi.mock('../hooks/useCreator', () => ({
  usePosts: () => ({ data: [], isLoading: false }),
  useCalendar: () => ({ data: {}, isLoading: false }),
  useDeletePost: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}))

function mountPage() {
  return render(
    <MemoryRouter initialEntries={['/content-plan']}>
      <Routes>
        <Route path="/content-plan" element={<Recommendations />} />
        <Route path="/content-plan/create" element={<div data-testid="wizard-stub">WIZARD</div>} />
        <Route path="/create" element={<div data-testid="creator-stub">CREATOR</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Recommendations — no scheduled_post on day', () => {
  it('renders the "Create from this day" button', () => {
    planData.mockReturnValue(makePlan(null))
    mountPage()
    expect(screen.getByTestId('create-from-day')).toBeInTheDocument()
  })
})

describe('Recommendations — scheduled_post status variants', () => {
  it('PUBLISHED → "View on Instagram" anchor pointing to the permalink', () => {
    planData.mockReturnValue(
      makePlan({
        id: 'sp-1',
        status: 'published',
        permalink: 'https://instagram.com/p/ABC',
      }),
    )
    mountPage()
    expect(screen.getByTestId('sched-badge-published')).toBeInTheDocument()
    const action = screen.getByTestId('sched-action-published')
    expect(action).toHaveAttribute('href', 'https://instagram.com/p/ABC')
    expect(action).toHaveAttribute('target', '_blank')
    // Original "Create from this day" button should NOT be present.
    expect(screen.queryByTestId('create-from-day')).not.toBeInTheDocument()
  })

  it('PUBLISHING → "View status" button', () => {
    planData.mockReturnValue(
      makePlan({ id: 'sp-2', status: 'publishing', permalink: null }),
    )
    mountPage()
    expect(screen.getByTestId('sched-badge-publishing')).toBeInTheDocument()
    expect(screen.getByTestId('sched-action-publishing')).toBeInTheDocument()
  })

  it('SCHEDULED → "View scheduled post" button', () => {
    planData.mockReturnValue(
      makePlan({ id: 'sp-3', status: 'scheduled', permalink: null }),
    )
    mountPage()
    expect(screen.getByTestId('sched-badge-scheduled')).toBeInTheDocument()
    expect(screen.getByTestId('sched-action-scheduled')).toBeInTheDocument()
  })

  it('DRAFT → "Continue editing draft" button', () => {
    planData.mockReturnValue(
      makePlan({ id: 'sp-4', status: 'draft', permalink: null }),
    )
    mountPage()
    expect(screen.getByTestId('sched-badge-draft')).toBeInTheDocument()
    expect(screen.getByTestId('sched-action-draft')).toBeInTheDocument()
  })

  it('FAILED → "Retry post" button', () => {
    planData.mockReturnValue(
      makePlan({ id: 'sp-5', status: 'failed', permalink: null }),
    )
    mountPage()
    expect(screen.getByTestId('sched-badge-failed')).toBeInTheDocument()
    expect(screen.getByTestId('sched-action-failed')).toBeInTheDocument()
  })

  it('Day row carries the .has-scheduled class for visual de-emphasis', () => {
    planData.mockReturnValue(
      makePlan({ id: 'sp-6', status: 'scheduled', permalink: null }),
    )
    mountPage()
    const row = screen.getByTestId('cp-row-day-0')
    expect(row.className).toMatch(/has-scheduled/)
  })
})
