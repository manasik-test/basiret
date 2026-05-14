import { describe, expect, it } from 'vitest'

import { periodDelta } from './Dashboard'

type Entry = {
  date: string
  likes: number
  comments: number
  reach: number
  engagement: number
  posts: number
}

// Build a timeline of N entries with the given per-day engagement value.
// Date and the rest of the metrics are filled with stable defaults — the
// computation under test only reads the requested field.
function buildTimeline(values: number[]): Entry[] {
  return values.map((v, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    likes: 0,
    comments: 0,
    reach: 0,
    engagement: v,
    posts: 0,
  }))
}

describe('periodDelta', () => {
  it('returns null when the timeline is undefined', () => {
    expect(periodDelta(undefined, 'engagement')).toBeNull()
  })

  it('returns null when the timeline has fewer than 4 entries', () => {
    expect(periodDelta(buildTimeline([10, 20, 30]), 'engagement')).toBeNull()
  })

  it('returns null when the older half sum is zero (new account, no baseline)', () => {
    // half=2: prev=[0,0], curr=[10,20] → prev=0 → null
    expect(periodDelta(buildTimeline([0, 0, 10, 20]), 'engagement')).toBeNull()
  })

  it('returns null when the newer half sum is zero (recent activity collapsed)', () => {
    // half=2: prev=[10,20], curr=[0,0] → curr=0 → null
    //
    // This is the oman.smartpools case — without this guard, the formula
    // returns -100% on every KPI for any account that's been recently quiet.
    expect(periodDelta(buildTimeline([10, 20, 0, 0]), 'engagement')).toBeNull()
  })

  it('returns a positive number when engagement is growing', () => {
    // half=2: prev=100, curr=120 → +20%
    expect(periodDelta(buildTimeline([40, 60, 50, 70]), 'engagement')).toBe(20)
  })

  it('returns a negative number when engagement is shrinking but non-zero (legitimate signal)', () => {
    // half=2: prev=100, curr=80 → -20%
    expect(periodDelta(buildTimeline([40, 60, 30, 50]), 'engagement')).toBe(-20)
  })
})
