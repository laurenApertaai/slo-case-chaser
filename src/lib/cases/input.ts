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
import type { CreateCaseInput, NameParts } from '@/lib/cases/create'
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

/** First, middle and surname joined the way they read on an application. */
export function fullName(parts: NameParts): string {
  return [parts.first, parts.middle, parts.surname].filter(Boolean).join(' ')
}

/**
 * Reads one applicant's name out of the form, reporting any missing part
 * against the field it belongs to.
 */
function readName(
  read: (key: string) => string,
  prefix: 'applicant_1' | 'applicant_2',
  errors: FieldErrors,
  who: string,
): NameParts | null {
  const first = read(`${prefix}_first_name`)
  const middle = read(`${prefix}_middle_name`)
  const surname = read(`${prefix}_surname`)

  if (!first) errors[`${prefix}_first_name`] = `Enter the ${who} first name.`
  if (!surname) errors[`${prefix}_surname`] = `Enter the ${who} surname.`
  if (!first || !surname) return null

  return { first, middle: middle || null, surname }
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

  const name1 = readName(read, 'applicant_1', errors, 'client')

  const email = read('applicant_1_email').toLowerCase()
  if (!email) errors.applicant_1_email = 'Enter the client email address.'
  else if (!isEmail(email)) errors.applicant_1_email = 'That does not look like an email address.'

  const rawMobile = read('applicant_1_mobile')
  const mobile = normaliseMobile(rawMobile)
  if (!rawMobile) errors.applicant_1_mobile = 'Enter the client mobile number.'
  else if (!mobile) errors.applicant_1_mobile = 'That does not look like a UK mobile number.'

  const amount = parseAmount(read('loan_amount'))
  if (amount === 'invalid') errors.loan_amount = 'Enter the loan amount in figures, for example 25000.'

  const improvements = parseAmount(read('home_improvement_amount'))
  if (improvements === 'invalid') {
    errors.home_improvement_amount =
      'Enter the home improvements amount in figures, for example 20000.'
  }

  const isJoint = read('is_joint') !== ''
  const name2 = isJoint ? readName(read, 'applicant_2', errors, 'second applicant') : null

  // On a joint case the second applicant's email and mobile are required, the
  // same as the first applicant's. Nothing on the client's list asks for them,
  // so this form is the only place they come from. Anything left in these boxes
  // on a sole case is ignored, not validated.
  const email2 = isJoint ? read('applicant_2_email').toLowerCase() : ''
  if (isJoint && !email2) errors.applicant_2_email = 'Enter the second applicant email address.'
  else if (email2 && !isEmail(email2)) {
    errors.applicant_2_email = 'That does not look like an email address.'
  }

  const rawMobile2 = isJoint ? read('applicant_2_mobile') : ''
  const mobile2 = rawMobile2 ? normaliseMobile(rawMobile2) : null
  if (isJoint && !rawMobile2) errors.applicant_2_mobile = 'Enter the second applicant mobile number.'
  else if (rawMobile2 && !mobile2) {
    errors.applicant_2_mobile = 'That does not look like a UK mobile number.'
  }

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
      homeImprovementAmount: improvements as number | null,
      isJoint,
      applicant1Name: fullName(name1 as NameParts),
      applicant1Parts: name1,
      applicant1Email: email,
      applicant1Mobile: mobile as string,
      // Only meaningful on a joint case. A name left over from ticking the box
      // and unticking it again must not be stored.
      applicant2Name: name2 ? fullName(name2) : null,
      applicant2Parts: name2,
      applicant2Email: email2 || null,
      applicant2Mobile: mobile2,
      employmentType: EMPLOYMENT_TYPES.includes(employment) ? employment : null,
    },
  }
}
