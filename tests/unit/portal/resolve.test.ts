import { describe, it, expect } from 'vitest'
import { resolvePortal, type PortalStore, type PortalCaseRow } from '@/lib/portal/resolve'

const NOW = new Date('2026-08-23T12:00:00.000Z')
const TOKEN = 'a'.repeat(43)

const CONTRACTION = /\b\w+['’](s|t|re|ll|ve|d|m)\b/i

function caseRow(overrides: Partial<PortalCaseRow> = {}): PortalCaseRow {
  return {
    id: 'case-1',
    case_ref: 'SLO-2026-0412',
    status: 'active',
    is_joint: true,
    employment_type: null,
    applicant_1_name: 'David Walker',
    portal_token: TOKEN,
    token_expires_at: '2026-11-21T00:00:00.000Z',

    // Deliberately present on the row and deliberately never in the response.
    adviser_id: 'adviser-1',
    bank_details_enc: 'ENCRYPTEDBLOB',
    bank_details_last4: '4321',

    requirements: [
      {
        id: 'req-1',
        applicant: 'joint',
        type: 'upload',
        label: 'Your signed SLO documents',
        description: 'Please print, sign and send back.',
        status: 'outstanding',
        is_mandatory: true,
        expected_count: 4,
        sort_order: 10,
        upload_count: 1,
      },
    ],
    ...overrides,
  }
}

function storeReturning(row: PortalCaseRow | null): PortalStore {
  return { findByToken: async () => row }
}

async function resolve(row: PortalCaseRow | null, token = TOKEN, now = NOW) {
  return resolvePortal(token, storeReturning(row), now)
}

describe('resolvePortal', () => {
  it('opens the portal for a valid token', async () => {
    const result = await resolve(caseRow())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.view.caseRef).toBe('SLO-2026-0412')
  })

  it('is not found for a token nobody has ever had', async () => {
    const result = await resolve(null)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(404)
  })

  it('is gone once the link has expired', async () => {
    const result = await resolve(caseRow({ token_expires_at: '2026-08-22T00:00:00.000Z' }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(410)
  })

  it('is gone when the case has been withdrawn', async () => {
    const result = await resolve(caseRow({ status: 'withdrawn' }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(410)
  })

  it('stays open on a completed case, so the client can still see what they sent', async () => {
    const result = await resolve(caseRow({ status: 'complete' }))
    expect(result.ok).toBe(true)
  })

  it('refuses a token that does not match the row byte for byte', async () => {
    // The lookup found something, but the stored token differs. Belt and braces
    // against anything that could make the database match loosely.
    const result = await resolve(caseRow({ portal_token: 'b'.repeat(43) }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(404)
  })

  it('refuses a token of the wrong length without comparing it', async () => {
    const result = await resolve(caseRow(), 'short')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(404)
  })

  it('never puts adviser or bank details in front of the client', async () => {
    const result = await resolve(caseRow())

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const body = JSON.stringify(result.view)
    expect(body).not.toContain('adviser')
    expect(body).not.toContain('ENCRYPTEDBLOB')
    expect(body).not.toContain('4321')
    expect(body).not.toContain('bank_details')
  })

  it('does not hand the token back out in the body', async () => {
    const result = await resolve(caseRow())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.stringify(result.view)).not.toContain(TOKEN)
  })

  it('greets the client by their first name only', async () => {
    const result = await resolve(caseRow())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.view.firstName).toBe('David')
  })
})

describe('what the client is told about each item', () => {
  async function itemWith(status: string, extra: Record<string, unknown> = {}) {
    const row = caseRow()
    row.requirements = [{ ...row.requirements[0], status: status as never, ...extra }]
    const result = await resolve(row)
    if (!result.ok) throw new Error('expected the portal to open')
    return result.view.items[0]
  }

  it('says outstanding while nothing has been sent', async () => {
    const item = await itemWith('outstanding')

    expect(item.state).toBe('outstanding')
    expect(item.stateLabel).toBe('Still required')
  })

  it('says it is being checked, never that it is under review', async () => {
    const item = await itemWith('received')

    expect(item.state).toBe('checking')
    expect(item.stateLabel).toBe('Received, we are checking this')
  })

  it('says accepted once it is confirmed', async () => {
    const item = await itemWith('accepted')

    expect(item.state).toBe('done')
    expect(item.stateLabel).toBe('Accepted')
  })

  it('flips a rejected item back rather than calling it rejected', async () => {
    const item = await itemWith('rejected')

    // The client never reads the word "rejected". They read what to do next.
    expect(item.state).toBe('sent_back')
    expect(item.stateLabel).toBe('Please send this again')
  })

  it('says a waived item is no longer needed rather than pretending it arrived', async () => {
    const item = await itemWith('waived')

    expect(item.state).toBe('not_needed')
    expect(item.stateLabel).toBe('No longer needed')
  })

  it('counts files towards the expected number', async () => {
    const item = await itemWith('outstanding', { expected_count: 12, upload_count: 8 })

    expect(item.expectedCount).toBe(12)
    expect(item.uploadedCount).toBe(8)
  })

  it('never uses a contraction in anything the client reads', async () => {
    for (const status of ['outstanding', 'received', 'accepted', 'rejected', 'waived']) {
      const item = await itemWith(status)
      expect(CONTRACTION.test(item.stateLabel), `${status}: "${item.stateLabel}"`).toBe(false)
    }
  })
})

describe('what the client sees overall', () => {
  function withItems(statuses: string[]) {
    const row = caseRow()
    row.requirements = statuses.map((status, index) => ({
      ...row.requirements[0],
      id: `req-${index}`,
      status: status as never,
      sort_order: (index + 1) * 10,
    }))
    return row
  }

  it('counts what is still needed, ignoring what is settled', async () => {
    const result = await resolve(withItems(['outstanding', 'rejected', 'accepted', 'waived']))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.view.outstandingCount).toBe(2)
    expect(result.view.totalCount).toBe(4)
    expect(result.view.allDone).toBe(false)
  })

  it('knows when the client has finished', async () => {
    const result = await resolve(withItems(['accepted', 'received', 'waived']))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Nothing is being asked of them, even though one is still being checked.
    expect(result.view.outstandingCount).toBe(0)
    expect(result.view.allDone).toBe(true)
  })

  it('keeps completed items on the list so progress is visible', async () => {
    const result = await resolve(withItems(['accepted', 'outstanding']))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.view.items).toHaveLength(2)
  })

  it('keeps the list in the order the adviser set', async () => {
    const row = withItems(['outstanding', 'outstanding', 'outstanding'])
    row.requirements[0].sort_order = 90
    row.requirements[2].sort_order = 10

    const result = await resolve(row)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.view.items.map((i) => i.id)).toEqual(['req-2', 'req-1', 'req-0'])
  })
})
