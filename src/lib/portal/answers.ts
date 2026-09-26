/**
 * The boxes a client fills in for each question on their list, and the checks
 * that stop them getting it wrong.
 *
 * Every check runs on the server when the answer is sent, whatever the page
 * did in the browser. Everything the client reads here - labels and error
 * messages alike - spells contractions out in full.
 */
import { DEFAULT_TEMPLATE, HOUSEHOLD_BILL_FIELDS } from '@/lib/db/seed'
import { normaliseMobile, parseAmount } from '@/lib/cases/input'
import { isoDate } from '@/lib/dates/workingDays'

export type FieldKind =
  | 'text'
  | 'longtext'
  | 'money'
  | 'number'
  | 'date'
  | 'email'
  | 'mobile'
  | 'sortcode'
  | 'account'
  | 'choice'
  /** the same as a choice, but shown as a dropdown where there are too many
      options to sit as buttons on a phone */
  | 'select'

export type FormField = {
  key: string
  label: string
  kind: FieldKind
  options?: { value: string; label: string }[]
  /**
   * Only shown, and only checked, when another answer says so: either it
   * matches `value`, or it is a number at least as big as `atLeast`.
   *
   * `atLeast` is what lets one dependent age box appear per dependent. Picking
   * 3 shows boxes 1, 2 and 3, and picking 1 again empties the other two rather
   * than leaving stale ages behind.
   */
  showWhen?: { key: string; value?: string; atLeast?: number }
}

export type AnswerResult =
  | { ok: true; values: Record<string, string> }
  | { ok: false; errors: Record<string, string> }

function labelOf(itemKey: string, fieldKey: string): string {
  const item = DEFAULT_TEMPLATE.find((i) => i.key === itemKey)
  return item?.fields?.find((f) => f.key === fieldKey)?.label ?? fieldKey
}

/** As many dependents as anybody is going to be asked to list one by one. */
export const MAX_DEPENDANTS = 10

const EMPLOYED = { key: 'employment_status', value: 'employed' }
const SELF_EMPLOYED = { key: 'employment_status', value: 'self_employed' }

const FORMS: Record<string, FormField[]> = {
  dependants: [
    {
      key: 'has_dependants',
      label: labelOf('dependants', 'has_dependants'),
      kind: 'choice',
      options: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes' },
      ],
    },
    {
      key: 'dependant_count',
      label: 'How many dependents do you have?',
      kind: 'select',
      options: Array.from({ length: MAX_DEPENDANTS }, (_, i) => ({
        value: String(i + 1),
        label: String(i + 1),
      })),
      showWhen: { key: 'has_dependants', value: 'yes' },
    },
    // One age box per dependent, appearing as soon as the count reaches it.
    ...Array.from({ length: MAX_DEPENDANTS }, (_, i) => ({
      key: `dependant_${i + 1}_age`,
      label: `Dependent ${i + 1} age`,
      kind: 'number' as const,
      showWhen: { key: 'dependant_count', atLeast: i + 1 },
    })),
  ],

  applicant_2_contact: [
    { key: 'partner_email', label: labelOf('applicant_2_contact', 'partner_email'), kind: 'email' },
    { key: 'partner_mobile', label: labelOf('applicant_2_contact', 'partner_mobile'), kind: 'mobile' },
  ],

  employment_details: [
    {
      key: 'employment_status',
      label: 'Are you employed or self employed?',
      kind: 'choice',
      options: [
        { value: 'employed', label: 'Employed' },
        { value: 'self_employed', label: 'Self employed' },
      ],
    },
    { key: 'job_title', label: 'Job title', kind: 'text', showWhen: EMPLOYED },
    { key: 'employer_name', label: 'Name of the company you work for', kind: 'text', showWhen: EMPLOYED },
    { key: 'joined_date', label: 'Date you joined the company', kind: 'date', showWhen: EMPLOYED },
    {
      key: 'trading_style',
      label: 'Sole trader or limited company',
      kind: 'choice',
      options: [
        { value: 'sole_trader', label: 'Sole trader' },
        { value: 'limited', label: 'Limited company' },
      ],
      showWhen: SELF_EMPLOYED,
    },
    {
      key: 'company_name',
      label: 'Company name',
      kind: 'text',
      showWhen: { key: 'trading_style', value: 'limited' },
    },
    { key: 'years_self_employed', label: 'Years in self employment', kind: 'number', showWhen: SELF_EMPLOYED },
  ],

  home_improvements: [
    { key: 'breakdown', label: labelOf('home_improvements', 'breakdown'), kind: 'longtext' },
  ],

  bank_details: [
    { key: 'account_name', label: labelOf('bank_details', 'account_name'), kind: 'text' },
    { key: 'account_number', label: labelOf('bank_details', 'account_number'), kind: 'account' },
    { key: 'sort_code', label: labelOf('bank_details', 'sort_code'), kind: 'sortcode' },
    { key: 'bank_name', label: labelOf('bank_details', 'bank_name'), kind: 'text' },
  ],

  household_bills: HOUSEHOLD_BILL_FIELDS.map((f) => ({ key: f.key, label: f.label, kind: 'money' as const })),
}

/** The boxes for a question item, or null for an item that is uploaded instead. */
export function formFor(templateKey: string | null): FormField[] | null {
  if (!templateKey) return null
  return FORMS[templateKey] ?? null
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Whether a field applies, given the other answers. */
function applies(field: FormField, raw: Record<string, string>): boolean {
  if (!field.showWhen) return true
  const parent = FORMS_BY_KEY.get(field.showWhen.key)
  // A field whose parent is itself hidden is hidden too.
  if (parent && !applies(parent, raw)) return false

  const answer = (raw[field.showWhen.key] ?? '').trim()

  if (field.showWhen.atLeast !== undefined) {
    const n = Number(answer)
    return Number.isFinite(n) && n >= field.showWhen.atLeast
  }

  return answer === field.showWhen.value
}

const FORMS_BY_KEY = new Map(Object.values(FORMS).flat().map((f) => [f.key, f]))

/** Checks one field. Returns the tidied value, or an error message. */
function check(field: FormField, value: string, today: string): { value: string } | { error: string } {
  if (field.kind === 'money') {
    if (value === '') return { error: 'Please enter an amount. If this does not apply to you, enter 0.' }
    const amount = parseAmount(value)
    if (amount === null || amount === 'invalid') return { error: 'Please enter an amount in numbers, for example 120.' }
    return { value: String(amount) }
  }

  if (value === '') return { error: 'Please fill this in.' }

  switch (field.kind) {
    case 'sortcode': {
      const digits = value.replace(/[\s-]/g, '')
      return /^\d{6}$/.test(digits)
        ? { value: digits }
        : { error: 'A sort code is 6 numbers, for example 12-34-56.' }
    }
    case 'account': {
      const digits = value.replace(/\s/g, '')
      return /^\d{8}$/.test(digits) ? { value: digits } : { error: 'An account number is 8 numbers.' }
    }
    case 'email': {
      const email = value.toLowerCase()
      return isEmail(email) ? { value: email } : { error: 'That does not look like an email address.' }
    }
    case 'mobile': {
      const mobile = normaliseMobile(value)
      return mobile ? { value: mobile } : { error: 'That does not look like a UK mobile number.' }
    }
    case 'date': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'Please enter a date.' }
      return value > today ? { error: 'That date is in the future. Please check it.' } : { value }
    }
    case 'number': {
      const n = Number(value)
      return Number.isFinite(n) && n >= 0 ? { value: String(n) } : { error: 'Please enter a number.' }
    }
    case 'choice':
    case 'select': {
      return field.options?.some((o) => o.value === value)
        ? { value }
        : { error: 'Please choose one.' }
    }
    default:
      return { value }
  }
}

export function validateAnswers(
  templateKey: string,
  raw: Record<string, string | undefined>,
  now: Date = new Date(),
): AnswerResult {
  const form = formFor(templateKey)
  if (!form) return { ok: false, errors: { form: 'This item is sent as a document, not filled in.' } }

  const today = isoDate(now)
  const input = Object.fromEntries(form.map((f) => [f.key, (raw[f.key] ?? '').trim()]))

  const values: Record<string, string> = {}
  const errors: Record<string, string> = {}

  for (const field of form) {
    // Anything that does not apply is stored empty, so a stale answer from a
    // different choice is never kept.
    if (!applies(field, input)) {
      values[field.key] = ''
      continue
    }

    const result = check(field, input[field.key], today)
    if ('error' in result) errors[field.key] = result.error
    else values[field.key] = result.value
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values }
}
