import { describe, it, expect } from 'vitest'
import { planEmploymentChange, type IncomeRequirementState } from '@/lib/portal/employment'

const CONTRACTION = /\b\w+['’](s|t|re|ll|ve|d|m)\b/i

function item(overrides: Partial<IncomeRequirementState> = {}): IncomeRequirementState {
  return {
    employment_type: null,
    label: 'Proof of your income',
    description:
      'If you are employed we need your three most recent monthly payslips, or your twelve most recent weekly payslips. If you are self employed we need your last two years of SA302s together with the Tax Year Overview for each of those years.',
    status: 'outstanding',
    uploadedCount: 0,
    ...overrides
  }
}

describe('planEmploymentChange', () => {
  it('rewrites the item once the client says how they are paid', () => {
    const patch = planEmploymentChange(item(), 'employed_weekly')

    expect(patch.employment_type).toBe('employed_weekly')
    expect(patch.label).toBe('Your 12 most recent weekly payslips')
    expect(patch.expected_count).toBe(12)
  })

  it('swaps in the SA302s for somebody self employed', () => {
    const patch = planEmploymentChange(item(), 'self_employed')

    expect(patch.label).toContain('SA302')
    expect(patch.label).toContain('Tax Year Overview')
    expect(patch.expected_count).toBe(4)
  })

  it('keeps whose item it is on a joint case', () => {
    const patch = planEmploymentChange(
      item({ label: 'Proof of your income - Lisa' }),
      'employed_monthly',
    )

    expect(patch.label).toBe('Your 3 most recent monthly payslips - Lisa')
  })

  it('keeps the name when changing an answer that was already given', () => {
    const patch = planEmploymentChange(
      item({
        employment_type: 'employed_monthly',
        label: 'Your 3 most recent monthly payslips - John Paul',
        description: 'Please upload your 3 most recent monthly payslips.',
      }),
      'employed_fortnightly',
    )

    expect(patch.label).toBe('Your 6 most recent fortnightly payslips - John Paul')
    expect(patch.description).toBe('Please upload your 6 most recent fortnightly payslips.')
  })

  it('leaves a label the adviser has written by hand alone', () => {
    const patch = planEmploymentChange(
      item({ label: 'Payslips - we need these urgently please' }),
      'employed_weekly',
    )

    // Their words are theirs. The count and the type still change underneath.
    expect(patch.label).toBeUndefined()
    expect(patch.expected_count).toBe(12)
    expect(patch.employment_type).toBe('employed_weekly')
  })

  it('judges the label and the description one at a time', () => {
    const patch = planEmploymentChange(
      item({ label: 'Payslips - we need these urgently please' }),
      'employed_weekly',
    )

    // The label was rewritten by hand, the description was not, so only the
    // description is brought up to date. Leaving both would strand wording
    // that still says three months.
    expect(patch.label).toBeUndefined()
    expect(patch.description).toBe('Please upload your 12 most recent weekly payslips.')
  })

  it('never touches what the client has already sent', () => {
    const patch = planEmploymentChange(
      item({ employment_type: 'employed_monthly', uploadedCount: 3, status: 'received' }),
      'employed_weekly',
    )

    // Only the expectation changes. Deleting three payslips because somebody
    // corrected a dropdown would be unforgivable.
    expect(patch).not.toHaveProperty('uploads')
    expect(patch.expected_count).toBe(12)
  })

  it('reopens an item that is no longer complete after the change', () => {
    const patch = planEmploymentChange(
      item({
        employment_type: 'employed_monthly',
        label: 'Your 3 most recent monthly payslips',
        description: 'Please upload your 3 most recent monthly payslips.',
        uploadedCount: 3,
        status: 'received',
      }),
      'employed_weekly',
    )

    expect(patch.status).toBe('outstanding')
  })

  it('leaves a complete item complete when the new count is already met', () => {
    const patch = planEmploymentChange(
      item({
        employment_type: 'employed_weekly',
        label: 'Your 12 most recent weekly payslips',
        description: 'Please upload your 12 most recent weekly payslips.',
        uploadedCount: 12,
        status: 'received',
      }),
      'employed_monthly',
    )

    expect(patch.status).toBeUndefined()
  })

  it('does not reopen something the adviser has already accepted', () => {
    const patch = planEmploymentChange(
      item({ employment_type: 'employed_monthly', status: 'accepted', uploadedCount: 3 }),
      'employed_weekly',
    )

    expect(patch.status).toBeUndefined()
  })

  it('never uses a contraction in anything it writes', () => {
    for (const type of [
      'employed_monthly',
      'employed_4weekly',
      'employed_fortnightly',
      'employed_weekly',
      'self_employed',
    ] as const) {
      const patch = planEmploymentChange(item(), type)
      expect(CONTRACTION.test(patch.label ?? '')).toBe(false)
      expect(CONTRACTION.test(patch.description ?? '')).toBe(false)
    }
  })
})
