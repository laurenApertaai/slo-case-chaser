/**
 * Reading and checking the new case form.
 *
 * Kept apart from the form itself so the rules can be tested without a browser,
 * and apart from `create.ts` so that creating a case does not care where the
 * details came from.
 *
 * These messages are read by advisers, not clients, so the contraction rule
 * does not bind here. They are written plainly anyway.
 */
import type { CreateCaseInput } from '@/lib/cases/create'
import type { EmploymentType } from '@/lib/cases/employment'

export type FieldErrors = Record<string, string>

export type ParseResult =
  | { ok: true; input: CreateCaseInput }
  | { ok: false; errors: FieldErrors }

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'employed_monthly',
  'employed_4weekly',
  'employed_fortnightly',
  'employed_weekly',
  'self_employed',
]

/**
 * A UK mobile number in the form a texting service will accept.
 *
 * Worth being strict about. A wrong or unreachable number is the single most
 * common reason a client looks like they are ignoring you, and it is invisible
 * unless it is caught here, at the one moment somebody is looking at it.
 *
 * Returns null for anything that is not a UK mobile, including landlines,
 * which cannot receive the chaser at all.
 */
export function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '')

  let national: string
  if (digits.startsWith('+44')) national = `0${digits.slice(3)}`
  else if (digits.startsWith('44')) national = `0${digits.slice(2)}`
  else if (digits.startsWith('0')) national = digits
  else return null

  // UK mobiles are 07 followed by nine digits.
  if (!/^07\d{9}$/.test(national)) return null

  return `+44${national.slice(1)}`
}

/**
 * A loan amount as an adviser would type it.
 *
 * Blank means not known yet, which is allowed. `'invalid'` is returned rather
 * than null for anything unreadable, so that a typo is reported instead of
 * being silently stored as no amount at all.
 */
export function parseAmount(raw: string): number | null | 'invalid' {
  const cleaned = raw.replace(/[£,\s]/g, '')
  if (cleaned === '') return null

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return 'invalid'

  return value
}

function isEmail(value: string): boolean {
  // Deliberately loose. The only mistakes worth catching here are the obvious
  // ones; whether an address actually receives mail is answered by sending to it.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function parseCaseForm(
  form: Record<string, string | undefined>,
  adviserId: string,
): ParseResult {
  const errors: FieldErrors = {}
  const read = (key: string) => (form[key] ?? '').trim()

  const caseRef = read('case_ref')
  if (!caseRef) errors.case_ref = 'Give the case a reference.'

  const name = read('applicant_1_name')
  if (!name) errors.applicant_1_name = 'Enter the client name.'

  const email = read('applicant_1_email').toLowerCase()
  if (!email) errors.applicant_1_email = 'Enter the client email address.'
  else if (!isEmail(email)) errors.applicant_1_email = 'That does not look like an email address.'

  const rawMobile = read('applicant_1_mobile')
  const mobile = normaliseMobile(rawMobile)
  if (!rawMobile) errors.applicant_1_mobile = 'Enter the client mobile number.'
  else if (!mobile) errors.applicant_1_mobile = 'That does not look like a UK mobile number.'

  const amount = parseAmount(read('loan_amount'))
  if (amount === 'invalid') errors.loan_amount = 'Enter the loan amount in figures, for example 25000.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const employment = read('employment_type') as EmploymentType
  const lender = read('lender')

  return {
    ok: true,
    input: {
      adviserId,
      caseRef,
      lender: lender || null,
      loanAmount: amount as number | null,
      isJoint: read('is_joint') !== '',
      applicant1Name: name,
      applicant1Email: email,
      applicant1Mobile: mobile as string,
      employmentType: EMPLOYMENT_TYPES.includes(employment) ? employment : null,
    },
  }
}
