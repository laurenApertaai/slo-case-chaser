import { describe, it, expect } from 'vitest'
import {
  HOUSEHOLD_BILL_FIELDS,
  DEFAULT_TEMPLATE,
  DEFAULT_REJECTION_REASONS,
} from '@/lib/db/seed'

/**
 * Matches contractions with either a straight or a curly apostrophe:
 * we're, don't, they'll, we've, I'd, it's.
 */
const CONTRACTION = /\b\w+['’](s|t|re|ll|ve|d|m)\b/i

/** Every string in the seed data that a client will actually read. */
function clientFacingStrings(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = []

  for (const item of DEFAULT_TEMPLATE) {
    out.push({ where: `template.${item.key}.label`, text: item.label })
    out.push({ where: `template.${item.key}.description`, text: item.description })
    for (const f of item.fields ?? []) {
      out.push({ where: `template.${item.key}.field.${f.key}`, text: f.label })
    }
  }

  for (const f of HOUSEHOLD_BILL_FIELDS) {
    out.push({ where: `bills.${f.key}`, text: f.label })
  }

  for (const r of DEFAULT_REJECTION_REASONS) {
    out.push({ where: `reason "${r.label}".email`, text: r.emailCopy })
    out.push({ where: `reason "${r.label}".sms`, text: r.smsCopy })
  }

  return out
}

describe('household bill fields', () => {
  it('has all nineteen questions from the retired Typeform', () => {
    expect(HOUSEHOLD_BILL_FIELDS).toHaveLength(19)
  })

  it('does not ask for the surname, because the case already knows it', () => {
    const keys = HOUSEHOLD_BILL_FIELDS.map((f) => f.key)
    expect(keys).not.toContain('surname')
  })

  it('uses unique keys', () => {
    const keys = HOUSEHOLD_BILL_FIELDS.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('default template', () => {
  it('contains the nine items of the standard pack', () => {
    expect(DEFAULT_TEMPLATE).toHaveLength(9)
  })

  it('uses unique keys and unique sort orders', () => {
    const keys = DEFAULT_TEMPLATE.map((i) => i.key)
    const orders = DEFAULT_TEMPLATE.map((i) => i.sortOrder)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('expects four pages for the signed SLO documents', () => {
    const slo = DEFAULT_TEMPLATE.find((i) => i.key === 'slo_documents')
    expect(slo?.expectedCount).toBe(4)
  })

  it('marks the income evidence as depending on employment type', () => {
    const income = DEFAULT_TEMPLATE.find((i) => i.key === 'income_evidence')
    expect(income?.employmentDependent).toBe(true)
    expect(income?.perApplicant).toBe(true)
  })

  it('only asks for the second applicant contact details on joint cases', () => {
    const contact = DEFAULT_TEMPLATE.find((i) => i.key === 'applicant_2_contact')
    expect(contact?.jointOnly).toBe(true)
  })

  it('carries the loan amount token on the home improvements question', () => {
    const improvements = DEFAULT_TEMPLATE.find((i) => i.key === 'home_improvements')
    expect(improvements?.description).toContain('{{loan_amount}}')
  })

  it('attaches all nineteen bill fields to the household bills group', () => {
    const bills = DEFAULT_TEMPLATE.find((i) => i.key === 'household_bills')
    expect(bills?.type).toBe('question_group')
    expect(bills?.fields).toHaveLength(19)
  })
})

describe('rejection reasons', () => {
  it('provides a starting set of ten', () => {
    expect(DEFAULT_REJECTION_REASONS).toHaveLength(10)
  })

  it('gives every reason a label, email copy and SMS copy', () => {
    for (const r of DEFAULT_REJECTION_REASONS) {
      expect(r.label.length, `label for ${r.label}`).toBeGreaterThan(0)
      expect(r.emailCopy.length, `email copy for ${r.label}`).toBeGreaterThan(0)
      expect(r.smsCopy.length, `sms copy for ${r.label}`).toBeGreaterThan(0)
    }
  })

  it('includes the upload link in every message so the client can act', () => {
    for (const r of DEFAULT_REJECTION_REASONS) {
      expect(r.emailCopy, `email copy for ${r.label}`).toContain('{{link}}')
      expect(r.smsCopy, `sms copy for ${r.label}`).toContain('{{link}}')
    }
  })

  it('keeps SMS copy short enough to stay cheap to send', () => {
    // 160 characters is one segment. The tokens expand at send time, so this
    // is a guide rather than a guarantee, hence the generous allowance.
    for (const r of DEFAULT_REJECTION_REASONS) {
      expect(r.smsCopy.length, `sms copy for ${r.label}`).toBeLessThan(200)
    }
  })
})

describe('copy standards', () => {
  it('never uses a contraction in anything a client reads', () => {
    const offenders = clientFacingStrings()
      .filter(({ text }) => CONTRACTION.test(text))
      .map(({ where, text }) => `${where}: "${text}"`)

    expect(offenders, `contractions found:\n${offenders.join('\n')}`).toEqual([])
  })
})
