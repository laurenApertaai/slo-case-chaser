import { describe, it, expect } from 'vitest'
import {
  buildRequirements,
  type CreateCaseInput,
  type NewRequirementRow,
} from '@/lib/cases/create'
import {
  caseRowToInput,
  caseRowToValues,
  detailsPatch,
  planResync,
  type CaseRow,
  type ExistingRequirement,
} from '@/lib/cases/update'
import { DEFAULT_TEMPLATE } from '@/lib/db/seed'

const sole: CreateCaseInput = {
  adviserId: 'adviser-1',
  caseRef: 'A85855',
  lender: 'Equifinance',
  loanAmount: 50000,
  homeImprovementAmount: 20000,
  loanPurpose: 'Consol & HI',
  isJoint: false,
  applicant1Name: 'Jean Jane Smith',
  applicant1Parts: { first: 'Jean', middle: 'Jane', surname: 'Smith' },
  applicant1Email: 'jean@hotmail.com',
  applicant1Mobile: '+447894561230',
  applicant2Name: null,
  applicant2Parts: null,
  applicant2Email: null,
  applicant2Mobile: null,
  employmentType: null,
}

const joint: CreateCaseInput = {
  ...sole,
  isJoint: true,
  applicant2Name: 'John Smith',
  applicant2Parts: { first: 'John', middle: null, surname: 'Smith' },
}

/** What a freshly created case has on it, with ids and statuses the tests can alter. */
function existingFor(input: CreateCaseInput): ExistingRequirement[] {
  return buildRequirements(DEFAULT_TEMPLATE, input).map((row: NewRequirementRow, i) => ({
    id: `req-${i}`,
    template_key: row.template_key,
    applicant: row.applicant,
    status: row.status,
    label: row.label,
    description: row.description,
    expected_count: row.expected_count,
    sort_order: row.sort_order,
  }))
}

function find(existing: ExistingRequirement[], key: string, applicant?: string) {
  return existing.find((r) => r.template_key === key && (!applicant || r.applicant === applicant))!
}

describe('planResync', () => {
  it('does nothing when nothing that affects the list has changed', () => {
    const existing = existingFor(sole)
    const plan = planResync(DEFAULT_TEMPLATE, sole, { ...sole, lender: 'Together' }, existing)

    expect(plan).toEqual({ updates: [], inserts: [], waives: [] })
  })

  it('renames the items when a name is corrected', () => {
    const existing = existingFor(joint)
    const after = {
      ...joint,
      applicant2Name: 'Jon Smith',
      applicant2Parts: { first: 'Jon', middle: null, surname: 'Smith' },
    }

    const plan = planResync(DEFAULT_TEMPLATE, joint, after, existing)
    const id = find(existing, 'identification', 'applicant_2').id

    expect(plan.updates).toContainEqual({
      id,
      patch: { label: 'Photo identification - Jon' },
    })
    expect(plan.inserts).toEqual([])
    expect(plan.waives).toEqual([])
  })

  it('never overwrites wording the adviser has changed by hand', () => {
    const existing = existingFor(joint)
    find(existing, 'identification', 'applicant_2').label = 'Passport for John please'

    const after = {
      ...joint,
      applicant2Name: 'Jon Smith',
      applicant2Parts: { first: 'Jon', middle: null, surname: 'Smith' },
    }
    const plan = planResync(DEFAULT_TEMPLATE, joint, after, existing)

    expect(plan.updates.find((u) => u.id === find(existing, 'identification', 'applicant_2').id))
      .toBeUndefined()
  })

  it('updates the figure in the Loan Purpose question when the HI amount changes', () => {
    const existing = existingFor(sole)
    const plan = planResync(DEFAULT_TEMPLATE, sole, { ...sole, homeImprovementAmount: 30000 }, existing)

    const update = plan.updates.find((u) => u.id === find(existing, 'home_improvements').id)
    expect(update?.patch.description).toContain('In terms of the £30,000 for home improvements')
  })

  it('adds Loan Purpose when HI is added to a case that had none', () => {
    const before = { ...sole, homeImprovementAmount: null }
    const existing = existingFor(before)

    const plan = planResync(DEFAULT_TEMPLATE, before, sole, existing)

    expect(plan.inserts.map((r) => r.template_key)).toEqual(['home_improvements'])
    expect(plan.inserts[0].description).toContain('£20,000')
  })

  it('takes Loan Purpose off the list when the HI is removed', () => {
    const existing = existingFor(sole)
    const plan = planResync(DEFAULT_TEMPLATE, sole, { ...sole, homeImprovementAmount: null }, existing)

    expect(plan.waives.map((w) => w.id)).toEqual([find(existing, 'home_improvements').id])
  })

  it('leaves an answer the client has already given, even when it no longer applies', () => {
    const existing = existingFor(sole)
    find(existing, 'home_improvements').status = 'accepted'

    const plan = planResync(DEFAULT_TEMPLATE, sole, { ...sole, homeImprovementAmount: null }, existing)

    expect(plan.waives).toEqual([])
  })

  it('brings back an item it took off, rather than adding a second copy', () => {
    const before = { ...sole, homeImprovementAmount: null }
    const existing = existingFor(sole)
    find(existing, 'home_improvements').status = 'waived'

    const plan = planResync(DEFAULT_TEMPLATE, before, sole, existing)

    expect(plan.inserts).toEqual([])
    expect(plan.updates.find((u) => u.id === find(existing, 'home_improvements').id)?.patch.status)
      .toBe('outstanding')
  })

  it('leaves alone an item the adviser waived by hand when the edit has nothing to do with it', () => {
    const existing = existingFor(sole)
    find(existing, 'dependants').status = 'waived'

    const plan = planResync(DEFAULT_TEMPLATE, sole, { ...sole, loanAmount: 60000 }, existing)

    expect(plan.updates.find((u) => u.id === find(existing, 'dependants').id)).toBeUndefined()
  })

  it('retitles the income evidence once the pay frequency is known', () => {
    const existing = existingFor(sole)
    const plan = planResync(DEFAULT_TEMPLATE, sole, { ...sole, employmentType: 'employed_weekly' }, existing)

    const update = plan.updates.find((u) => u.id === find(existing, 'income_evidence').id)
    expect(update?.patch).toMatchObject({
      label: 'Your 12 most recent weekly payslips',
      expected_count: 12,
    })
  })

  it('turns a sole case into a joint one without asking for the first applicant twice', () => {
    const existing = existingFor(sole)
    const plan = planResync(DEFAULT_TEMPLATE, sole, joint, existing)

    // The sole applicant's existing items become applicant 1's, named.
    const id = find(existing, 'identification').id
    expect(plan.updates.find((u) => u.id === id)?.patch).toMatchObject({
      applicant: 'applicant_1',
      label: 'Photo identification - Jean',
    })

    // Only the second applicant's items are new.
    expect(plan.inserts.every((r) => r.applicant === 'applicant_2')).toBe(true)
    expect(plan.inserts.map((r) => r.template_key).sort()).toEqual([
      'applicant_2_contact',
      'employment_details',
      'identification',
      'income_evidence',
    ])
    expect(plan.waives).toEqual([])
  })

  it('turns a joint case into a sole one, taking the second applicant items off the list', () => {
    const existing = existingFor(joint)
    const plan = planResync(DEFAULT_TEMPLATE, joint, sole, existing)

    const secondApplicant = existing.filter((r) => r.applicant === 'applicant_2').map((r) => r.id)
    expect(plan.waives.map((w) => w.id).sort()).toEqual(secondApplicant.sort())

    const id = find(existing, 'identification', 'applicant_1').id
    expect(plan.updates.find((u) => u.id === id)?.patch).toMatchObject({
      applicant: 'joint',
      label: 'Photo identification',
    })
  })

  it('takes the contact details item off once the adviser has both the email and mobile', () => {
    const existing = existingFor(joint)
    const after = { ...joint, applicant2Email: 'john@hotmail.com', applicant2Mobile: '+447700900456' }

    const plan = planResync(DEFAULT_TEMPLATE, joint, after, existing)

    expect(plan.waives.map((w) => w.id)).toEqual([find(existing, 'applicant_2_contact').id])
  })

  it('never touches an item the adviser added by hand', () => {
    const existing = existingFor(joint)
    existing.push({
      id: 'extra',
      template_key: null,
      applicant: 'applicant_2',
      status: 'outstanding',
      label: 'Proof of address',
      description: '',
      expected_count: null,
      sort_order: 100,
    })

    const plan = planResync(DEFAULT_TEMPLATE, joint, sole, existing)

    expect(plan.waives.map((w) => w.id)).not.toContain('extra')
    expect(plan.updates.map((u) => u.id)).not.toContain('extra')
  })
})

describe('reading a saved case back', () => {
  const row: CaseRow = {
    id: 'case-1',
    adviser_id: 'adviser-1',
    case_ref: 'A85855',
    lender: 'Equifinance',
    loan_amount: 50000,
    home_improvement_amount: 20000,
    loan_purpose: 'Consol & HI',
    is_joint: true,
    employment_type: null,
    applicant_1_name: 'Jean Jane Smith',
    applicant_1_first_name: 'Jean',
    applicant_1_middle_name: 'Jane',
    applicant_1_surname: 'Smith',
    applicant_1_email: 'jean@hotmail.com',
    applicant_1_mobile: '+447894561230',
    applicant_2_name: 'John Smith',
    applicant_2_first_name: 'John',
    applicant_2_middle_name: null,
    applicant_2_surname: 'Smith',
    applicant_2_email: null,
    applicant_2_mobile: null,
  }

  it('turns a saved case back into what was entered', () => {
    expect(caseRowToInput(row)).toEqual({ ...joint, caseRef: 'A85855' })
  })

  it('fills the edit form with what is saved', () => {
    expect(caseRowToValues(row)).toMatchObject({
      case_ref: 'A85855',
      loan_amount: '50000',
      home_improvement_amount: '20000',
      loan_purpose: 'Consol & HI',
      is_joint: 'on',
      applicant_1_first_name: 'Jean',
      applicant_1_middle_name: 'Jane',
      applicant_2_first_name: 'John',
      applicant_2_email: '',
    })
  })

  it('splits a name saved before the boxes were separate', () => {
    const old = {
      ...row,
      applicant_1_name: 'Lisa Marie Smith',
      applicant_1_first_name: null,
      applicant_1_middle_name: null,
      applicant_1_surname: null,
    }

    expect(caseRowToValues(old)).toMatchObject({
      applicant_1_first_name: 'Lisa',
      applicant_1_middle_name: 'Marie',
      applicant_1_surname: 'Smith',
    })
  })
})

describe('detailsPatch', () => {
  it('writes every editable detail and nothing that must not change', () => {
    const patch = detailsPatch(joint)

    expect(patch).toMatchObject({
      case_ref: 'A85855',
      loan_amount: 50000,
      loan_purpose: 'Consol & HI',
      applicant_2_first_name: 'John',
    })
    // The portal link, owner and status are never touched by an edit.
    for (const key of ['portal_token', 'token_expires_at', 'adviser_id', 'status', 'pack_issued_at']) {
      expect(patch).not.toHaveProperty(key)
    }
  })

  it('clears the second applicant when a case becomes sole', () => {
    const patch = detailsPatch({ ...sole, applicant2Name: 'Left over' })

    expect(patch.applicant_2_name).toBeNull()
    expect(patch.applicant_2_email).toBeNull()
  })
})
