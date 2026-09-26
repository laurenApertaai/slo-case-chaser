/**
 * The client telling us how they are paid, and what that changes.
 *
 * The client knows this and the adviser often does not when the pack goes out,
 * so they pick it on their own page and their income evidence item retitles
 * itself: three payslips or twelve, or the SA302s for somebody self employed.
 *
 * It is answered **per applicant**, not per case. On a joint application one of
 * them can be employed and the other self employed, and asking the case as a
 * whole would put the wrong request in front of one of them.
 *
 * Two rules this file exists to hold:
 *
 * 1. **Nothing the client has already sent is ever touched.** Correcting a
 *    dropdown must not delete three payslips. Only the expectation changes.
 * 2. **Wording an adviser has written by hand is theirs.** If the label is no
 *    longer what the pack produced, the count still changes but the words do not.
 */
import { requirementsForEmployment, type EmploymentType } from '@/lib/cases/employment'
import type { RequirementStatus } from '@/lib/cases/status'

export type IncomeRequirementState = {
  /** what they said last time, or null if they have not said yet */
  employment_type: EmploymentType | null
  label: string
  description: string | null
  status: RequirementStatus
  /** files sent against this item so far */
  uploadedCount: number
}

export type EmploymentPatch = {
  employment_type: EmploymentType
  label?: string
  description?: string
  expected_count?: number | null
  status?: 'outstanding'
}

/**
 * Whose item it is, taken off the end of the label.
 *
 * Labels on a joint case read "Proof of your income - Lisa". The name is added
 * when the case is created and is not stored anywhere else on the requirement,
 * so it is recovered here by taking off the wording the pack would have
 * produced and keeping whatever is left.
 *
 * Returns null when the label is not what the pack produced, which is the
 * signal that somebody has written it by hand.
 */
function suffixOf(label: string, was: EmploymentType | null): string | null {
  const base = requirementsForEmployment(was).label
  if (label === base) return ''
  if (label.startsWith(`${base} - `)) return label.slice(base.length)
  return null
}

export function planEmploymentChange(
  current: IncomeRequirementState,
  type: EmploymentType,
): EmploymentPatch {
  const wanted = requirementsForEmployment(type)
  const was = requirementsForEmployment(current.employment_type)

  const patch: EmploymentPatch = { employment_type: type }

  // Wording, only where it is still exactly what the pack produced.
  const suffix = suffixOf(current.label, current.employment_type)
  if (suffix !== null) patch.label = `${wanted.label}${suffix}`

  if ((current.description ?? '') === was.description) patch.description = wanted.description

  const expected = wanted.expectedCount ?? null
  patch.expected_count = expected

  // An item that was complete under the old answer may not be under the new
  // one. It goes back on the list rather than quietly looking finished.
  //
  // Anything the adviser has already accepted or waived is left alone: that is
  // their judgement, and a dropdown does not overturn it.
  const reviewable = current.status === 'received'
  if (reviewable && expected !== null && current.uploadedCount < expected) {
    patch.status = 'outstanding'
  }

  return patch
}
