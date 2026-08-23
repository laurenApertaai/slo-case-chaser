import { describe, it, expect } from 'vitest'
import {
  requirementsForEmployment,
  UNKNOWN_INCOME_REQUIREMENT,
  type EmploymentType,
} from '@/lib/cases/employment'

const CONTRACTION = /\b\w+['’](s|t|re|ll|ve|d|m)\b/i

describe('requirementsForEmployment', () => {
  it('asks for 3 payslips when paid monthly', () => {
    expect(requirementsForEmployment('employed_monthly').expectedCount).toBe(3)
  })

  it('asks for 3 payslips when paid 4 weekly', () => {
    expect(requirementsForEmployment('employed_4weekly').expectedCount).toBe(3)
  })

  it('asks for 6 payslips when paid fortnightly', () => {
    expect(requirementsForEmployment('employed_fortnightly').expectedCount).toBe(6)
  })

  it('asks for 12 payslips when paid weekly', () => {
    expect(requirementsForEmployment('employed_weekly').expectedCount).toBe(12)
  })

  it('swaps in SA302s and Tax Year Overviews for the self employed', () => {
    const result = requirementsForEmployment('self_employed')
    expect(result.label).toContain('SA302')
    expect(result.label).toContain('Tax Year Overview')
    // Two years, each needing an SA302 and its matching Tax Year Overview.
    expect(result.expectedCount).toBe(4)
  })

  it('falls back to the combined wording when the client has not said yet', () => {
    const result = requirementsForEmployment(null)
    expect(result).toEqual(UNKNOWN_INCOME_REQUIREMENT)
    expect(result.expectedCount).toBeUndefined()
    expect(result.description).toContain('three most recent monthly payslips')
    expect(result.description).toContain('twelve most recent weekly payslips')
  })

  it('puts the count and the pay period into the label the client reads', () => {
    expect(requirementsForEmployment('employed_weekly').label).toBe(
      'Your 12 most recent weekly payslips',
    )
    expect(requirementsForEmployment('employed_fortnightly').label).toBe(
      'Your 6 most recent fortnightly payslips',
    )
  })

  it('never uses a contraction in anything the client reads', () => {
    const types: (EmploymentType | null)[] = [
      null,
      'employed_monthly',
      'employed_4weekly',
      'employed_fortnightly',
      'employed_weekly',
      'self_employed',
    ]

    for (const type of types) {
      const { label, description } = requirementsForEmployment(type)
      expect(CONTRACTION.test(label), `label for ${type}: "${label}"`).toBe(false)
      expect(CONTRACTION.test(description), `description for ${type}`).toBe(false)
    }
  })
})
