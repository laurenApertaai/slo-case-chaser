import { describe, it, expect } from 'vitest'
import { caseProgress, type StatusRequirement } from '@/lib/cases/status'

const NOW = new Date('2026-08-23T12:00:00.000Z')

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString()
}

function req(overrides: Partial<StatusRequirement> = {}): StatusRequirement {
  return {
    status: 'outstanding',
    rejection_count: 0,
    received_at: null,
    is_mandatory: true,
    ...overrides,
  }
}

function progress(requirements: StatusRequirement[], extra: Partial<Parameters<typeof caseProgress>[0]> = {}) {
  return caseProgress({
    caseStatus: 'active',
    requirements,
    workingDaysSinceIssue: null,
    now: NOW,
    ...extra,
  })
}

describe('caseProgress', () => {
  it('is green when there is nothing left to collect', () => {
    const result = progress([req({ status: 'accepted' }), req({ status: 'accepted' })])

    expect(result.colour).toBe('green')
    expect(result.outstanding).toBe(0)
  })

  it('counts a waived item as dealt with, not as received', () => {
    const result = progress([req({ status: 'accepted' }), req({ status: 'waived' })])

    expect(result.colour).toBe('green')
    // Waived means it turned out not to be needed. Pretending it arrived would
    // put something in the sign-off record that never existed.
    expect(result.received).toBe(0)
    expect(result.accepted).toBe(1)
  })

  it('is grey while the client is still working through the list', () => {
    const result = progress([req({ status: 'accepted' }), req()])

    expect(result.colour).toBe('grey')
    expect(result.outstanding).toBe(1)
  })

  it('is amber when something has been waiting on the adviser over 24 hours', () => {
    const result = progress([req({ status: 'received', received_at: hoursAgo(25) }), req()])

    expect(result.colour).toBe('amber')
    expect(result.reasons).toContain('1 item has been waiting on review for more than a day')
  })

  it('is not amber yet when the document only landed this morning', () => {
    const result = progress([req({ status: 'received', received_at: hoursAgo(3) }), req()])

    expect(result.colour).toBe('grey')
    expect(result.received).toBe(1)
    expect(result.overdueReview).toBe(0)
  })

  it('is red when the same item has been rejected twice', () => {
    const result = progress([req({ status: 'rejected', rejection_count: 2 })])

    expect(result.colour).toBe('red')
    expect(result.reasons).toContain('An item has been rejected twice, so a call is needed')
  })

  it('is red once the case has run past the final chaser', () => {
    const result = progress([req()], { workingDaysSinceIssue: 9 })

    expect(result.colour).toBe('red')
    expect(result.reasons).toContain('Past day 8 with items still outstanding, so chasing has stopped')
  })

  it('is not red on day 8 itself, because the final chaser goes out that day', () => {
    const result = progress([req()], { workingDaysSinceIssue: 8 })
    expect(result.colour).toBe('grey')
  })

  it('does not go red on day count alone once everything is in', () => {
    const result = progress([req({ status: 'accepted' })], { workingDaysSinceIssue: 20 })
    expect(result.colour).toBe('green')
  })

  it('shows red rather than amber when a case is both', () => {
    const result = progress([
      req({ status: 'rejected', rejection_count: 2 }),
      req({ status: 'received', received_at: hoursAgo(48) }),
    ])

    expect(result.colour).toBe('red')
    // The amber problem is still real and still listed, it just is not the headline.
    expect(result.reasons).toHaveLength(2)
  })

  it('has no clock at all until the pack goes out', () => {
    const result = progress([req()], { workingDaysSinceIssue: null })

    expect(result.colour).toBe('grey')
    expect(result.label).toBe('Not yet issued')
  })

  it('leaves a case that is on hold alone', () => {
    const result = progress([req({ status: 'received', received_at: hoursAgo(72) })], {
      caseStatus: 'on_hold',
      workingDaysSinceIssue: 20,
    })

    expect(result.colour).toBe('grey')
    expect(result.label).toBe('On hold')
  })

  it('treats a withdrawn case as closed, whatever is on it', () => {
    const result = progress([req({ status: 'rejected', rejection_count: 3 })], {
      caseStatus: 'withdrawn',
    })

    expect(result.colour).toBe('grey')
    expect(result.label).toBe('Withdrawn')
  })

  it('counts an optional item towards progress but never holds the case up', () => {
    const result = progress([
      req({ status: 'accepted' }),
      req({ status: 'outstanding', is_mandatory: false }),
    ])

    // Nothing mandatory is missing, so the case is collectable.
    expect(result.colour).toBe('green')
    expect(result.outstanding).toBe(1)
  })

  it('reports the counts the case list needs to show', () => {
    const result = progress([
      req({ status: 'accepted' }),
      req({ status: 'accepted' }),
      req({ status: 'received', received_at: hoursAgo(30) }),
      req({ status: 'rejected', rejection_count: 1 }),
      req(),
    ])

    expect(result).toMatchObject({
      total: 5,
      accepted: 2,
      received: 1,
      overdueReview: 1,
      outstanding: 2,
    })
  })

  it('describes an empty case without dividing by zero', () => {
    const result = progress([])

    expect(result.total).toBe(0)
    expect(result.percentComplete).toBe(0)
    expect(result.colour).toBe('grey')
  })

  it('reports how far through the client is', () => {
    const result = progress([
      req({ status: 'accepted' }),
      req({ status: 'accepted' }),
      req({ status: 'accepted' }),
      req(),
    ])

    expect(result.percentComplete).toBe(75)
  })
})
