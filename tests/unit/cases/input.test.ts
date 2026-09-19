import { describe, it, expect } from 'vitest'
import { normaliseMobile, parseAmount, parseCaseForm } from '@/lib/cases/input'

const complete = {
  case_ref: 'SLO-2026-0412',
  lender: 'Together',
  loan_amount: '25000',
  home_improvement_amount: '20000',
  loan_purpose: 'Consol & HI',
  applicant_1_first_name: 'David',
  applicant_1_middle_name: '',
  applicant_1_surname: 'Walker',
  applicant_1_email: 'David@Example.com',
  applicant_1_mobile: '07700 900123',
  is_joint: 'on',
  applicant_2_first_name: 'Sarah',
  applicant_2_middle_name: '',
  applicant_2_surname: 'Walker',
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
      loanPurpose: 'Consol & HI',
      homeImprovementAmount: 20000,
      isJoint: true,
      applicant1Name: 'David Walker',
      applicant1Parts: { first: 'David', middle: null, surname: 'Walker' },
      applicant1Email: 'david@example.com',
      applicant1Mobile: '+447700900123',
      applicant2Name: 'Sarah Walker',
      applicant2Parts: { first: 'Sarah', middle: null, surname: 'Walker' },
      applicant2Email: null,
      applicant2Mobile: null,
      employmentType: null,
    })
  })

  it('treats an unticked joint box as a sole application', () => {
    const result = parse({ is_joint: '' })
    expect(result.ok && result.input.isJoint).toBe(false)
  })

  it('builds the full name with the middle name in its place', () => {
    const result = parse({ applicant_1_middle_name: 'James Robert' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.applicant1Name).toBe('David James Robert Walker')
    expect(result.input.applicant1Parts).toEqual({
      first: 'David',
      middle: 'James Robert',
      surname: 'Walker',
    })
  })

  it('takes a middle name for the second applicant too', () => {
    const result = parse({ applicant_2_middle_name: 'Anne' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.applicant2Name).toBe('Sarah Anne Walker')
    expect(result.input.applicant2Parts?.middle).toBe('Anne')
  })

  it('treats a blank middle name as none, not as an empty word', () => {
    const result = parse({ applicant_1_middle_name: '   ' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.applicant1Name).toBe('David Walker')
    expect(result.input.applicant1Parts?.middle).toBeNull()
  })

  it('keeps a double-barrelled surname whole', () => {
    const result = parse({ applicant_1_surname: 'Smith-Jones' })
    expect(result.ok && result.input.applicant1Parts?.surname).toBe('Smith-Jones')
  })

  it('insists on a first name and surname for the first applicant', () => {
    const result = parse({ applicant_1_first_name: '', applicant_1_surname: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.applicant_1_first_name).toBeTruthy()
    expect(result.errors.applicant_1_surname).toBeTruthy()
  })

  it('asks for the second applicant name on a joint case', () => {
    const result = parse({ applicant_2_first_name: '', applicant_2_surname: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.applicant_2_first_name).toBeTruthy()
    expect(result.errors.applicant_2_surname).toBeTruthy()
  })

  it('does not ask for a second applicant on a sole case', () => {
    const result = parse({ is_joint: '', applicant_2_first_name: '', applicant_2_surname: '' })
    expect(result.ok).toBe(true)
  })

  it('throws away a second applicant name left behind by unticking the box', () => {
    const result = parse({ is_joint: '' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.applicant2Name).toBeNull()
    expect(result.input.applicant2Parts).toBeNull()
  })

  it('does not ask the adviser for the second applicant email and mobile', () => {
    // At this stage nobody knows them. They go on the client list instead.
    const result = parse({})

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.applicant2Email).toBeNull()
    expect(result.input.applicant2Mobile).toBeNull()
  })

  it('takes the loan purpose as words, exactly as typed', () => {
    const result = parse({ loan_purpose: '  Consol & HI  ' })
    expect(result.ok && result.input.loanPurpose).toBe('Consol & HI')
  })

  it('takes the amount of HI as a figure', () => {
    const result = parse({ home_improvement_amount: '£20,000' })
    expect(result.ok && result.input.homeImprovementAmount).toBe(20000)
  })

  it('allows the amount of HI to be left blank when there is none', () => {
    const result = parse({ home_improvement_amount: '' })
    expect(result.ok && result.input.homeImprovementAmount).toBe(null)
  })

  it('reports an amount of HI that is not a figure', () => {
    const result = parse({ home_improvement_amount: 'about half' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.home_improvement_amount).toBeTruthy()
  })

  it('leaves the loan purpose empty rather than inventing one', () => {
    const result = parse({ loan_purpose: '' })
    expect(result.ok && result.input.loanPurpose).toBe(null)
  })

  it('allows the lender to be filled in later', () => {
    const result = parse({ lender: '' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input.lender).toBeNull()
  })

  it('insists on the loan amount, because the case cannot go anywhere without it', () => {
    const result = parse({ loan_amount: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.loan_amount).toBe('Enter the loan amount.')
  })

  it('insists on the things a case cannot exist without', () => {
    const result = parse({
      case_ref: '',
      applicant_1_first_name: '',
      applicant_1_surname: '',
      applicant_1_email: '',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual([
      'applicant_1_email',
      'applicant_1_first_name',
      'applicant_1_surname',
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
