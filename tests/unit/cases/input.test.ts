import { describe, it, expect } from 'vitest'
import { normaliseMobile, parseAmount, parseCaseForm } from '@/lib/cases/input'

const complete = {
  case_ref: 'SLO-2026-0412',
  lender: 'Together',
  loan_amount: '25000',
  applicant_1_name: 'David Walker',
  applicant_1_email: 'David@Example.com',
  applicant_1_mobile: '07700 900123',
  is_joint: 'on',
  employment_type: '',
}

function parse(overrides: Record<string, string> = {}) {
  return parseCaseForm({ ...complete, ...overrides }, 'adviser-1')
}

describe('normaliseMobile', () => {
  it('turns a UK mobile into the form a texting service accepts', () => {
    expect(normaliseMobile('07700 900123')).toBe('+447700900123')
    expect(normaliseMobile('07700900123')).toBe('+447700900123')
    expect(normaliseMobile('+44 7700 900123')).toBe('+447700900123')
    expect(normaliseMobile('447700900123')).toBe('+447700900123')
    expect(normaliseMobile('(07700) 900-123')).toBe('+447700900123')
  })

  it('rejects a landline, because a landline cannot receive the chaser', () => {
    expect(normaliseMobile('01412211234')).toBeNull()
  })

  it('rejects a number that is the wrong length', () => {
    expect(normaliseMobile('0770090012')).toBeNull()
    expect(normaliseMobile('077009001234')).toBeNull()
  })

  it('rejects anything that is not a number at all', () => {
    expect(normaliseMobile('')).toBeNull()
    expect(normaliseMobile('ask his wife')).toBeNull()
  })
})

describe('parseAmount', () => {
  it('reads what an adviser actually types', () => {
    expect(parseAmount('25000')).toBe(25000)
    expect(parseAmount('25,000')).toBe(25000)
    expect(parseAmount('£25,000')).toBe(25000)
    expect(parseAmount(' £25,000.50 ')).toBe(25000.5)
  })

  it('treats blank as not known yet', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
  })

  it('refuses nonsense rather than storing a zero', () => {
    expect(parseAmount('twenty five grand')).toBe('invalid')
    expect(parseAmount('-5000')).toBe('invalid')
  })
})

describe('parseCaseForm', () => {
  it('accepts a complete form', () => {
    const result = parse()

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.input).toEqual({
      adviserId: 'adviser-1',
      caseRef: 'SLO-2026-0412',
      lender: 'Together',
      loanAmount: 25000,
      isJoint: true,
      applicant1Name: 'David Walker',
      applicant1Email: 'david@example.com',
      applicant1Mobile: '+447700900123',
      employmentType: null,
    })
  })

  it('treats an unticked joint box as a sole application', () => {
    const result = parse({ is_joint: '' })
    expect(result.ok && result.input.isJoint).toBe(false)
  })

  it('allows the lender and the amount to be filled in later', () => {
    const result = parse({ lender: '', loan_amount: '' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.lender).toBeNull()
    expect(result.input.loanAmount).toBeNull()
  })

  it('insists on the things a case cannot exist without', () => {
    const result = parse({ case_ref: '', applicant_1_name: '', applicant_1_email: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual([
      'applicant_1_email',
      'applicant_1_name',
      'case_ref',
    ])
  })

  it('catches a mistyped email address before the pack goes nowhere', () => {
    const result = parse({ applicant_1_email: 'david@example' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.applicant_1_email).toContain('email')
  })

  it('catches a mobile number that cannot receive a text', () => {
    const result = parse({ applicant_1_mobile: '01412211234' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.applicant_1_mobile).toContain('mobile')
  })

  it('reports a nonsense loan amount rather than quietly storing nothing', () => {
    const result = parse({ loan_amount: 'twenty five grand' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.loan_amount).toBeTruthy()
  })

  it('keeps an employment type when the adviser already knows it', () => {
    const result = parse({ employment_type: 'employed_weekly' })
    expect(result.ok && result.input.employmentType).toBe('employed_weekly')
  })

  it('ignores an employment type it does not recognise', () => {
    const result = parse({ employment_type: 'paid in cash' })
    expect(result.ok && result.input.employmentType).toBe(null)
  })
})
