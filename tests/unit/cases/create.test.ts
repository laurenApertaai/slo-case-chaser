import { describe, it, expect } from 'vitest'
import {
  buildRequirements,
  createCase,
  formatLoanAmount,
  generatePortalToken,
  tokenExpiry,
  type CaseStore,
  type CreateCaseInput,
  type NewCaseRow,
  type NewEventRow,
  type NewRequirementRow,
} from '@/lib/cases/create'
import { DEFAULT_TEMPLATE } from '@/lib/db/seed'

const CONTRACTION = /\b\w+['’](s|t|re|ll|ve|d|m)\b/i

const soleInput: CreateCaseInput = {
  adviserId: 'adviser-1',
  caseRef: 'SLO-2026-0412',
  lender: 'Together',
  loanAmount: 25000,
  homeImprovementAmount: null,
  isJoint: false,
  applicant1Name: 'David Walker',
  applicant1Email: 'david@example.com',
  applicant1Mobile: '07700900123',
  applicant2Name: null,
  employmentType: null,
}

const jointInput: CreateCaseInput = {
  ...soleInput,
  isJoint: true,
  applicant2Name: 'Sarah Walker',
}

/** Records everything written, so a test can assert on it without a database. */
function recordingStore(items = DEFAULT_TEMPLATE) {
  const written = {
    cases: [] as NewCaseRow[],
    caseIds: [] as string[],
    requirements: [] as NewRequirementRow[],
    events: [] as NewEventRow[],
  }

  const store: CaseStore = {
    loadTemplate: async () => items,
    insertCase: async (row) => {
      written.cases.push(row)
      return { id: 'case-1', ...row }
    },
    insertRequirements: async (caseId, rows) => {
      written.caseIds.push(caseId)
      written.requirements.push(...rows)
    },
    insertEvent: async (row) => {
      written.events.push(row)
    },
  }

  return { store, written }
}

describe('buildRequirements', () => {
  it('creates one row per item on a sole application', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, soleInput)

    // Nine template items, one of which is joint only, none duplicated.
    expect(rows).toHaveLength(8)
    expect(rows.every((r) => r.applicant === 'joint')).toBe(true)
  })

  it('leaves the second applicant off a sole application entirely', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, soleInput)

    expect(rows.some((r) => r.applicant === 'applicant_2')).toBe(false)
    expect(rows.some((r) => r.template_key === 'applicant_2_contact')).toBe(false)
  })

  it('creates the second applicant requirements from day zero on a joint application', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)
    const forApplicant2 = rows.filter((r) => r.applicant === 'applicant_2')

    // ID, income evidence and employment details are per applicant. The
    // contact details item belongs to applicant 2 as well.
    expect(forApplicant2.map((r) => r.template_key).sort()).toEqual([
      'applicant_2_contact',
      'employment_details',
      'identification',
      'income_evidence',
    ])
  })

  it('duplicates every per-applicant item for applicant 1 as well', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)
    const forApplicant1 = rows.filter((r) => r.applicant === 'applicant_1')

    expect(forApplicant1.map((r) => r.template_key).sort()).toEqual([
      'employment_details',
      'identification',
      'income_evidence',
    ])
    expect(rows).toHaveLength(12)
  })

  it('names whose item is whose, so the shared list is not ambiguous', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)
    const ids = rows.filter((r) => r.template_key === 'identification')

    expect(ids.map((r) => r.label)).toEqual([
      'Photo identification - David',
      'Photo identification - Sarah',
    ])
  })

  it('falls back to the role when the second applicant has no name yet', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, { ...jointInput, applicant2Name: null })
    const ids = rows.filter((r) => r.template_key === 'identification')

    expect(ids.map((r) => r.label)).toEqual([
      'Photo identification - David',
      'Photo identification - second applicant',
    ])
  })

  it('puts the second applicant name into the wording that asks for their details', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)
    const contact = rows.find((r) => r.template_key === 'applicant_2_contact')

    expect(contact?.description).toBe(
      'We require the email address and mobile number for Sarah Walker for the application.',
    )
    expect(contact?.description).not.toContain('{{')
  })

  it('leaves an item that already names its owner alone', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)
    const contact = rows.find((r) => r.template_key === 'applicant_2_contact')

    // It appears once, so there is nothing to tell it apart from. Naming it
    // again gives "... for the second applicant - second applicant".
    expect(contact?.label).toBe('Contact details for the second applicant')
    expect(contact?.applicant).toBe('applicant_2')
  })

  it('leaves labels unadorned on a sole application', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, soleInput)
    const id = rows.find((r) => r.template_key === 'identification')

    expect(id?.label).toBe('Photo identification')
  })

  it('quotes the home improvements figure, not the whole loan', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, {
      ...soleInput,
      loanAmount: 25000,
      homeImprovementAmount: 18000,
    })
    const improvements = rows.find((r) => r.template_key === 'home_improvements')

    expect(improvements?.description).toContain('In terms of the £18,000 for home improvements,')
    expect(improvements?.description).not.toContain('£25,000')
    expect(improvements?.description).not.toContain('{{')
  })

  it('uses the whole loan when no separate improvements figure is given', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, soleInput)
    const improvements = rows.find((r) => r.template_key === 'home_improvements')

    // The common case: the whole loan is for the works.
    expect(improvements?.description).toContain('In terms of the £25,000 for home improvements,')
    expect(improvements?.description).not.toContain('{{')
  })

  it('reads sensibly when no amount is known at all', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, {
      ...soleInput,
      loanAmount: null,
      homeImprovementAmount: null,
    })
    const improvements = rows.find((r) => r.template_key === 'home_improvements')

    expect(improvements?.description).toContain('In terms of the loan amount for home improvements,')
    expect(improvements?.description).not.toContain('{{')
  })

  it('uses the combined income wording until the client says how they are paid', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, soleInput)
    const income = rows.find((r) => r.template_key === 'income_evidence')

    expect(income?.label).toBe('Proof of your income')
    expect(income?.expected_count).toBeNull()
  })

  it('retitles income evidence and sets the file count once employment is known', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, {
      ...soleInput,
      employmentType: 'employed_weekly',
    })
    const income = rows.find((r) => r.template_key === 'income_evidence')

    expect(income?.label).toBe('Your 12 most recent weekly payslips')
    expect(income?.expected_count).toBe(12)
  })

  it('expects four pages back for the signed pack', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, soleInput)
    const pack = rows.find((r) => r.template_key === 'slo_documents')

    expect(pack?.expected_count).toBe(4)
    expect(pack?.type).toBe('upload')
  })

  it('starts everything outstanding and unpaused', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)

    expect(rows.every((r) => r.status === 'outstanding')).toBe(true)
    expect(rows.every((r) => r.is_paused === false)).toBe(true)
    expect(rows.every((r) => r.rejection_count === 0)).toBe(true)
  })

  it('gives every requirement its own place in the list', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)
    const orders = rows.map((r) => r.sort_order)

    expect(new Set(orders).size).toBe(rows.length)
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b))
  })

  it('puts applicant 1 ahead of applicant 2 for the same item', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)
    const [first, second] = rows.filter((r) => r.template_key === 'identification')

    expect(first.applicant).toBe('applicant_1')
    expect(second.applicant).toBe('applicant_2')
    expect(first.sort_order).toBeLessThan(second.sort_order)
  })

  it('never uses a contraction in anything the client reads', () => {
    const rows = buildRequirements(DEFAULT_TEMPLATE, jointInput)

    for (const row of rows) {
      expect(CONTRACTION.test(row.label), `label: "${row.label}"`).toBe(false)
      expect(CONTRACTION.test(row.description ?? ''), `description of "${row.label}"`).toBe(false)
    }
  })
})

describe('formatLoanAmount', () => {
  it('formats a round amount without pence', () => {
    expect(formatLoanAmount(25000)).toBe('£25,000')
  })

  it('keeps the pence when there are any', () => {
    expect(formatLoanAmount(25000.5)).toBe('£25,000.50')
  })

  it('falls back to plain words when the amount is not known', () => {
    expect(formatLoanAmount(null)).toBe('loan amount')
  })
})

describe('generatePortalToken', () => {
  it('is long, unguessable and safe in a URL', () => {
    const token = generatePortalToken()

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    // 32 random bytes, base64url encoded.
    expect(token).toHaveLength(43)
  })

  it('is different every time', () => {
    const tokens = new Set(Array.from({ length: 200 }, generatePortalToken))
    expect(tokens.size).toBe(200)
  })
})

describe('tokenExpiry', () => {
  it('gives the client ninety days', () => {
    const from = new Date('2026-08-23T09:00:00.000Z')
    expect(tokenExpiry(from).toISOString()).toBe('2026-11-21T09:00:00.000Z')
  })
})

describe('createCase', () => {
  it('writes the case, its requirements and an audit event', async () => {
    const { store, written } = recordingStore()

    await createCase(jointInput, store)

    expect(written.cases).toHaveLength(1)
    expect(written.requirements).toHaveLength(12)
    expect(written.events).toHaveLength(1)
  })

  it('returns the created case with its portal token', async () => {
    const { store } = recordingStore()

    const created = await createCase(soleInput, store)

    expect(created.id).toBe('case-1')
    expect(created.requirement_count).toBe(8)
    expect(created.portal_token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(new Date(created.token_expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('records who the case belongs to and what was asked of them', async () => {
    const { store, written } = recordingStore()

    await createCase(soleInput, store)

    expect(written.cases[0].adviser_id).toBe('adviser-1')
    expect(written.cases[0].case_ref).toBe('SLO-2026-0412')
    expect(written.cases[0].status).toBe('active')
    expect(written.events[0].type).toBe('case_created')
    expect(written.events[0].detail).toMatchObject({ requirement_count: 8 })
  })

  it('leaves the second applicant blank until the client supplies the details', async () => {
    const { store, written } = recordingStore()

    await createCase(jointInput, store)

    expect(written.cases[0].is_joint).toBe(true)
    expect(written.cases[0].applicant_2_email).toBeNull()
    expect(written.cases[0].applicant_2_mobile).toBeNull()
  })

  it('keeps the second applicant name the adviser typed in', async () => {
    const { store, written } = recordingStore()

    await createCase(jointInput, store)

    expect(written.cases[0].applicant_2_name).toBe('Sarah Walker')
  })

  it('never stores a second applicant on a sole case', async () => {
    const { store, written } = recordingStore()

    await createCase({ ...soleInput, applicant2Name: 'Left over from a tickbox' }, store)

    expect(written.cases[0].applicant_2_name).toBeNull()
  })

  it('records the home improvements figure separately from the loan', async () => {
    const { store, written } = recordingStore()

    await createCase({ ...soleInput, loanAmount: 25000, homeImprovementAmount: 18000 }, store)

    expect(written.cases[0].loan_amount).toBe(25000)
    expect(written.cases[0].home_improvement_amount).toBe(18000)
  })

  it('does not send the pack out by itself', async () => {
    const { store, written } = recordingStore()

    await createCase(soleInput, store)

    // Creating the case is not issuing it. Day 0 of the chase clock starts
    // when the pack is sent, which is a separate deliberate step.
    expect(written.cases[0].pack_issued_at).toBeNull()
  })

  it('hangs every requirement off the case it just created', async () => {
    const { store, written } = recordingStore()

    const created = await createCase(jointInput, store)

    expect(written.caseIds).toEqual([created.id])
  })

  it('never writes anything about document contents into the audit trail', async () => {
    const { store, written } = recordingStore()

    await createCase(jointInput, store)

    const detail = JSON.stringify(written.events[0].detail)
    expect(detail).not.toContain('david@example.com')
    expect(detail).not.toContain('07700900123')
  })
})
