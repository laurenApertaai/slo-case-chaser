/**
 * Adding a one-off requirement to a live case.
 *
 * Cases do not all fit the standard pack. A lender asks for proof of address, a
 * client turns out to have a second job, an underwriter comes back wanting one
 * more thing. The adviser types their own wording, says who it belongs to and
 * whether it is mandatory, and it joins the list.
 *
 * Deliberately not done here: touching the chase clock. Per the spec, adding an
 * item mid-case joins the next scheduled chaser rather than restarting the
 * cycle, so nothing in this file sets a chase date. Waking up a case that has
 * already gone quiet is the chaser's job, in phase 7.
 */
import type { ApplicantSlot, NewRequirementRow } from '@/lib/cases/create'

export type ExtraRequirementInput = {
  label: string
  description: string
  applicant: ApplicantSlot
  isMandatory: boolean
}

export type ExtraParseResult =
  | { ok: true; input: ExtraRequirementInput }
  | { ok: false; errors: Record<string, string> }

const APPLICANT_SLOTS: ApplicantSlot[] = ['applicant_1', 'applicant_2', 'joint']

/** Matches the spacing used when a case is first created. */
const SORT_STEP = 10

export function buildExtraRequirement(
  input: ExtraRequirementInput,
  context: { highestSortOrder: number | null },
): NewRequirementRow {
  return {
    applicant: input.applicant,
    // Everything added by hand is an upload. A one-off question would need its
    // own fields defining, which is a bigger job and not one anybody has asked for.
    type: 'upload',
    label: input.label,
    description: input.description,
    status: 'outstanding',
    is_mandatory: input.isMandatory,
    expected_count: null,
    sort_order: (context.highestSortOrder ?? 0) + SORT_STEP,
    rejection_count: 0,
    is_paused: false,
    // It came from the adviser, not the pack, so there is nothing to point back at.
    template_key: null,
  }
}

export function parseExtraForm(form: Record<string, string | undefined>): ExtraParseResult {
  const errors: Record<string, string> = {}
  const read = (key: string) => (form[key] ?? '').trim()

  const label = read('label')
  if (!label) errors.label = 'Say what you need. The client sees this wording.'

  const applicant = read('applicant') as ApplicantSlot
  if (!APPLICANT_SLOTS.includes(applicant)) errors.applicant = 'Choose who this is for.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    input: {
      label,
      description: read('description'),
      applicant,
      isMandatory: read('is_mandatory') !== '',
    },
  }
}
