import { describe, it, expect } from 'vitest'
import { formFor, validateAnswers } from '@/lib/portal/answers'
import { HOUSEHOLD_BILL_FIELDS } from '@/lib/db/seed'

const TODAY = new Date('2026-09-19T12:00:00Z')
const CONTRACTION = /\b\w+['’](s|t|re|ll|ve|d|m)\b/i

function validate(key: string, raw: Record<string, string>) {
  return validateAnswers(key, raw, TODAY)
}

function allBills(value = '0') {
  return Object.fromEntries(HOUSEHOLD_BILL_FIELDS.map((f) => [f.key, value]))
}

describe('formFor', () => {
  it('asks for bank details in the order the adviser wants them', () => {
    expect(formFor('bank_details')!.map((f) => f.label)).toEqual([
      'Name on Account',
      'Account number',
      'Sort Code',
      'Bank name',
    ])
  })

  it('asks for all nineteen household bills', () => {
    expect(formFor('household_bills')).toHaveLength(19)
  })

  it('has nothing to fill in for an upload item', () => {
    expect(formFor('identification')).toBeNull()
  })

  it('never uses a contraction in anything the client reads', () => {
    for (const key of ['dependants', 'applicant_2_contact', 'employment_details', 'home_improvements', 'bank_details', 'household_bills']) {
      for (const field of formFor(key)!) {
        expect(CONTRACTION.test(field.label), `${key}: ${field.label}`).toBe(false)
      }
    }
  })
})

describe('bank details', () => {
  const good = {
    account_name: 'Jean Smith',
    account_number: '12345678',
    sort_code: '12-34-56',
    bank_name: 'Nationwide',
  }

  it('accepts a proper set and tidies the sort code', () => {
    const result = validate('bank_details', good)
    expect(result).toEqual({ ok: true, values: { ...good, sort_code: '123456' } })
  })

  it('accepts a sort code typed with spaces', () => {
    const result = validate('bank_details', { ...good, sort_code: '12 34 56' })
    expect(result.ok && result.values.sort_code).toBe('123456')
  })

  it('refuses a sort code that is not six digits', () => {
    const result = validate('bank_details', { ...good, sort_code: '12345' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.sort_code).toBe('A sort code is 6 numbers, for example 12-34-56.')
  })

  it('refuses an account number that is not eight digits', () => {
    const result = validate('bank_details', { ...good, account_number: '1234567' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.account_number).toBe('An account number is 8 numbers.')
  })

  it('insists on every box', () => {
    const result = validate('bank_details', {})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual([
      'account_name',
      'account_number',
      'bank_name',
      'sort_code',
    ])
  })
})

describe('household bills', () => {
  it('accepts all nineteen, including zero', () => {
    const result = validate('household_bills', { ...allBills('0'), council_tax: '£150.50' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.council_tax).toBe('150.5')
    expect(result.values.water).toBe('0')
  })

  it('refuses a blank one, because blank and zero are not the same answer', () => {
    const result = validate('household_bills', { ...allBills(), food: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.food).toBe('Please enter an amount. If this does not apply to you, enter 0.')
  })

  it('refuses words and minus figures', () => {
    const result = validate('household_bills', { ...allBills(), fuel: 'about 50', water: '-5' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual(['fuel', 'water'])
  })
})

describe('dependents', () => {
  it('asks nothing else when the answer is no', () => {
    const result = validate('dependants', { has_dependants: 'no' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.has_dependants).toBe('no')
    expect(result.values.dependant_count).toBe('')
    expect(result.values.dependant_1_age).toBe('')
  })

  it('asks how many once the answer is yes', () => {
    const result = validate('dependants', { has_dependants: 'yes' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.dependant_count).toBeTruthy()
  })

  it('asks for exactly as many ages as there are dependents', () => {
    const result = validate('dependants', { has_dependants: 'yes', dependant_count: '3' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual([
      'dependant_1_age',
      'dependant_2_age',
      'dependant_3_age',
    ])
  })

  it('accepts three dependents with three ages', () => {
    const result = validate('dependants', {
      has_dependants: 'yes',
      dependant_count: '3',
      dependant_1_age: '7',
      dependant_2_age: '4',
      dependant_3_age: '0',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.dependant_3_age).toBe('0')
    // The fourth box was never shown, so nothing is stored against it.
    expect(result.values.dependant_4_age).toBe('')
  })

  it('goes up to ten', () => {
    const raw: Record<string, string> = { has_dependants: 'yes', dependant_count: '10' }
    for (let i = 1; i <= 10; i += 1) raw[`dependant_${i}_age`] = String(i)

    const result = validate('dependants', raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.dependant_10_age).toBe('10')
  })

  it('refuses a count that is not on the list', () => {
    const result = validate('dependants', { has_dependants: 'yes', dependant_count: '14' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.dependant_count).toBeTruthy()
  })

  it('refuses an age that is not a number', () => {
    const result = validate('dependants', {
      has_dependants: 'yes',
      dependant_count: '1',
      dependant_1_age: 'nearly four',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.dependant_1_age).toBeTruthy()
  })

  it('throws away ages from a count that was cut back', () => {
    // Answered three, then changed to one. The other two must not be kept.
    const result = validate('dependants', {
      has_dependants: 'yes',
      dependant_count: '1',
      dependant_1_age: '7',
      dependant_2_age: '4',
      dependant_3_age: '2',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.dependant_2_age).toBe('')
    expect(result.values.dependant_3_age).toBe('')
  })

  it('insists on a yes or a no', () => {
    const result = validate('dependants', {})
    expect(result.ok).toBe(false)
  })
})

describe('employment details', () => {
  it('accepts an employed answer', () => {
    const result = validate('employment_details', {
      employment_status: 'employed',
      job_title: 'Nurse',
      employer_name: 'NHS Lothian',
      joined_date: '2019-03-01',
    })
    expect(result.ok).toBe(true)
  })

  it('refuses a joining date in the future', () => {
    const result = validate('employment_details', {
      employment_status: 'employed',
      job_title: 'Nurse',
      employer_name: 'NHS Lothian',
      joined_date: '2027-01-01',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.joined_date).toBe('That date is in the future. Please check it.')
  })

  it('accepts a sole trader without a company name', () => {
    const result = validate('employment_details', {
      employment_status: 'self_employed',
      trading_style: 'sole_trader',
      years_self_employed: '6',
    })
    expect(result.ok).toBe(true)
  })

  it('asks a limited company for its name', () => {
    const result = validate('employment_details', {
      employment_status: 'self_employed',
      trading_style: 'limited',
      years_self_employed: '6',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.company_name).toBeTruthy()
  })

  it('does not ask the employed about self employment, or the other way round', () => {
    const result = validate('employment_details', {
      employment_status: 'employed',
      job_title: 'Nurse',
      employer_name: 'NHS Lothian',
      joined_date: '2019-03-01',
      trading_style: 'limited',
    })
    expect(result.ok && result.values.trading_style).toBe('')
  })
})

describe('second applicant contact details', () => {
  it('accepts and tidies them', () => {
    const result = validate('applicant_2_contact', {
      partner_email: 'John@Hotmail.com',
      partner_mobile: '07700 900456',
    })
    expect(result).toEqual({
      ok: true,
      values: { partner_email: 'john@hotmail.com', partner_mobile: '+447700900456' },
    })
  })

  it('refuses a number that cannot receive a text', () => {
    const result = validate('applicant_2_contact', {
      partner_email: 'john@hotmail.com',
      partner_mobile: '01412211234',
    })
    expect(result.ok).toBe(false)
  })
})

describe('loan purpose', () => {
  it('takes the breakdown as written', () => {
    const result = validate('home_improvements', { breakdown: '£10k kitchen, £5k windows' })
    expect(result.ok && result.values.breakdown).toBe('£10k kitchen, £5k windows')
  })

  it('insists on something', () => {
    expect(validate('home_improvements', { breakdown: '  ' }).ok).toBe(false)
  })
})

describe('error messages', () => {
  it('never uses a contraction', () => {
    const cases: [string, Record<string, string>][] = [
      ['bank_details', { sort_code: '1', account_number: '1' }],
      ['household_bills', { food: 'x' }],
      ['dependants', { has_dependants: 'yes' }],
      ['employment_details', { employment_status: 'employed', joined_date: '2099-01-01' }],
      ['applicant_2_contact', { partner_email: 'x', partner_mobile: 'x' }],
      ['home_improvements', {}],
    ]
    for (const [key, raw] of cases) {
      const result = validate(key, raw)
      if (result.ok) continue
      for (const message of Object.values(result.errors)) {
        expect(CONTRACTION.test(message), `${key}: ${message}`).toBe(false)
      }
    }
  })
})
