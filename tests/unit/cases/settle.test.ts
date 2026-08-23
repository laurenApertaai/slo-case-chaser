import { describe, it, expect } from 'vitest'
import { buildSettle, canSettle, parseSettleForm } from '@/lib/cases/settle'

const NOW = new Date('2026-08-23T12:00:00.000Z')

describe('buildSettle, already have it', () => {
  it('accepts the item and records how it actually arrived', () => {
    const { patch } = buildSettle(
      { action: 'already_have', receivedVia: 'email' },
      'adviser-1',
      NOW,
    )

    expect(patch.status).toBe('accepted')
    expect(patch.received_via).toBe('email')
    expect(patch.received_at).toBe(NOW.toISOString())
    expect(patch.accepted_at).toBe(NOW.toISOString())
    expect(patch.accepted_by).toBe('adviser-1')
  })

  it('handles post and in person the same way', () => {
    expect(buildSettle({ action: 'already_have', receivedVia: 'post' }, 'a', NOW).patch.received_via).toBe('post')
    expect(
      buildSettle({ action: 'already_have', receivedVia: 'in_person' }, 'a', NOW).patch.received_via,
    ).toBe('in_person')
  })

  it('stops the chase clock', () => {
    const { patch } = buildSettle({ action: 'already_have', receivedVia: 'email' }, 'a', NOW)
    expect(patch.next_chase_at).toBeNull()
  })

  it('writes an event saying it came in outside the portal', () => {
    const { event } = buildSettle({ action: 'already_have', receivedVia: 'post' }, 'a', NOW)

    expect(event.type).toBe('requirement_accepted')
    expect(event.detail).toMatchObject({ received_via: 'post', files_attached: false })
  })
})

describe('buildSettle, does not apply', () => {
  it('waives the item without pretending anything arrived', () => {
    const { patch } = buildSettle({ action: 'not_applicable' }, 'adviser-1', NOW)

    expect(patch.status).toBe('waived')
    // Nothing came in, so nothing may say it did. The sign-off record must not
    // claim a document that never existed.
    expect(patch.received_via).toBeNull()
    expect(patch.received_at).toBeNull()
    expect(patch.accepted_at).toBeNull()
  })

  it('stops the chase clock too', () => {
    const { patch } = buildSettle({ action: 'not_applicable' }, 'a', NOW)
    expect(patch.next_chase_at).toBeNull()
  })

  it('writes its own event, distinct from an acceptance', () => {
    const { event } = buildSettle({ action: 'not_applicable' }, 'a', NOW)
    expect(event.type).toBe('requirement_waived')
  })
})

describe('canSettle', () => {
  it('allows an outstanding item to be settled either way', () => {
    expect(canSettle('outstanding')).toBe(true)
    expect(canSettle('rejected')).toBe(true)
    expect(canSettle('received')).toBe(true)
  })

  it('leaves an item that is already settled alone', () => {
    expect(canSettle('accepted')).toBe(false)
    expect(canSettle('waived')).toBe(false)
  })
})

describe('parseSettleForm', () => {
  it('reads an already-have submission', () => {
    const result = parseSettleForm({ action: 'already_have', received_via: 'post' })
    expect(result).toEqual({ ok: true, input: { action: 'already_have', receivedVia: 'post' } })
  })

  it('defaults to email, which is how documents nearly always arrive', () => {
    const result = parseSettleForm({ action: 'already_have' })
    expect(result.ok && result.input).toEqual({ action: 'already_have', receivedVia: 'email' })
  })

  it('reads a not-applicable submission', () => {
    const result = parseSettleForm({ action: 'not_applicable' })
    expect(result).toEqual({ ok: true, input: { action: 'not_applicable' } })
  })

  it('refuses anything else', () => {
    expect(parseSettleForm({ action: 'delete' }).ok).toBe(false)
    expect(parseSettleForm({}).ok).toBe(false)
  })

  it('refuses a way of arriving it does not recognise', () => {
    expect(parseSettleForm({ action: 'already_have', received_via: 'carrier pigeon' }).ok).toBe(
      false,
    )
  })

  it('never accepts the portal as a route, because the portal does that itself', () => {
    // Marking something as having come in "by portal" by hand would fake an
    // upload that does not exist.
    expect(parseSettleForm({ action: 'already_have', received_via: 'portal' }).ok).toBe(false)
  })
})
