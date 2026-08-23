/**
 * How employment type shapes the income evidence requirement.
 *
 * The client picks their own employment type at the top of the portal, because
 * they know it and the adviser often does not when the pack goes out. The
 * requirement then retitles itself and starts counting files.
 */

export type EmploymentType =
  | 'employed_monthly'
  | 'employed_4weekly'
  | 'employed_fortnightly'
  | 'employed_weekly'
  | 'self_employed'

export type IncomeRequirement = {
  label: string
  description: string
  /** number of files expected, or undefined when it is not a fixed count */
  expectedCount?: number
}

/** Wording used before the client has told us how they are paid. */
export const UNKNOWN_INCOME_REQUIREMENT: IncomeRequirement = {
  label: 'Proof of your income',
  description:
    'If you are employed we need your three most recent monthly payslips, or your twelve most recent weekly payslips. If you are self employed we need your last two years of SA302s together with the Tax Year Overview for each of those years.',
}

const PAYSLIP_COUNTS: Record<Exclude<EmploymentType, 'self_employed'>, number> = {
  employed_monthly: 3,
  employed_4weekly: 3,
  employed_fortnightly: 6,
  employed_weekly: 12,
}

const PERIOD_WORDING: Record<Exclude<EmploymentType, 'self_employed'>, string> = {
  employed_monthly: 'monthly',
  employed_4weekly: '4 weekly',
  employed_fortnightly: 'fortnightly',
  employed_weekly: 'weekly',
}

export function requirementsForEmployment(type: EmploymentType | null): IncomeRequirement {
  if (!type) return UNKNOWN_INCOME_REQUIREMENT

  if (type === 'self_employed') {
    return {
      label: 'Your SA302s and Tax Year Overviews',
      description:
        'We need your last two years of SA302s, together with the Tax Year Overview for each of those two years. These are two separate documents and you can download both from your HMRC online account.',
      expectedCount: 4,
    }
  }

  const count = PAYSLIP_COUNTS[type]
  const period = PERIOD_WORDING[type]

  return {
    label: `Your ${count} most recent ${period} payslips`,
    description: `Please upload your ${count} most recent ${period} payslips. They must be the most recent ones you have received, because the lender will not accept older payslips.`,
    expectedCount: count,
  }
}
