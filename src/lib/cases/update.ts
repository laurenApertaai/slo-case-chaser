/**
 * Changing a case after it has been created.
 *
 * Every detail typed into the new case form can be changed later. Some of those
 * details decide what is on the client's list - the names label the items, the
 * HI amount decides whether Loan Purpose is asked at all, joint or sole decides
 * whether the second applicant has items - so an edit also brings the list into
 * line with the new details.
 *
 * Three rules keep that safe:
 *
 * 1. Nothing is deleted. An item that no longer applies is waived, so the record
 *    of what was asked for survives. An item the edit makes relevant again is
 *    brought back rather than added twice.
 *
 * 2. Only what the edit changed is touched. An item the adviser waived by hand
 *    stays waived unless this edit is what decides it applies again. Wording the
 *    adviser has rewritten by hand is never overwritten. Items added by hand are
 *    never touched at all.
 *
 * 3. Anything the client has already sent stays as it is. A received or
 *    accepted item is never waived by an edit.
 */
import { serverClient } from '@/lib/db/client'
import {
  buildCaseRow,
  buildRequirements,
  STANDARD_PACK,
  supabaseStore,
  type ApplicantSlot,
  type CreateCaseInput,
  type NameParts,
  type NewCaseRow,
  type NewRequirementRow,
} from '@/lib/cases/create'
import type { EmploymentType } from '@/lib/cases/employment'
import type { RequirementStatus } from '@/lib/cases/status'
import type { TemplateItem } from '@/lib/db/seed'

/** The editable columns of a case, as they come back from the database. */
export type CaseRow = {
  id: string
  adviser_id: string
  case_ref: string
  lender: string | null
  loan_amount: number | string | null
  home_improvement_amount: number | string | null
  loan_purpose: string | null
  is_joint: boolean
  employment_type: EmploymentType | null
  applicant_1_name: string
  applicant_1_first_name: string | null
  applicant_1_middle_name: string | null
  applicant_1_surname: string | null
  applicant_1_email: string
  applicant_1_mobile: string
  applicant_2_name: string | null
  applicant_2_first_name: string | null
  applicant_2_middle_name: string | null
  applicant_2_surname: string | null
  applicant_2_email: string | null
  applicant_2_mobile: string | null
}

export const CASE_ROW_FIELDS =
  'id, adviser_id, case_ref, lender, loan_amount, home_improvement_amount, loan_purpose, is_joint, employment_type, ' +
  'applicant_1_name, applicant_1_first_name, applicant_1_middle_name, applicant_1_surname, applicant_1_email, applicant_1_mobile, ' +
  'applicant_2_name, applicant_2_first_name, applicant_2_middle_name, applicant_2_surname, applicant_2_email, applicant_2_mobile'

/** A requirement as it stands on the case. */
export type ExistingRequirement = {
  id: string
  template_key: string | null
  applicant: ApplicantSlot
  status: RequirementStatus
  label: string
  description: string | null
  expected_count: number | null
  sort_order: number
}

export type RequirementPatch = Partial<{
  applicant: ApplicantSlot
  label: string
  description: string
  expected_count: number | null
  sort_order: number
  status: 'outstanding'
}>

export type ResyncPlan = {
  updates: { id: string; patch: RequirementPatch }[]
  inserts: NewRequirementRow[]
  waives: { id: string; label: string }[]
}

// ---------------------------------------------------------------------------
// Reading a saved case back
// ---------------------------------------------------------------------------

function amount(value: number | string | null): number | null {
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parts(
  first: string | null,
  middle: string | null,
  surname: string | null,
): NameParts | null {
  if (!first || !surname) return null
  return { first, middle: middle || null, surname }
}

/**
 * A name saved before first, middle and surname were separate boxes, split
 * as best it can be so the edit form is not empty. The adviser can correct it.
 */
function splitName(full: string | null): NameParts {
  const words = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { first: '', middle: null, surname: '' }
  if (words.length === 1) return { first: words[0], middle: null, surname: '' }
  return {
    first: words[0],
    middle: words.slice(1, -1).join(' ') || null,
    surname: words[words.length - 1],
  }
}

export function caseRowToInput(row: CaseRow): CreateCaseInput {
  return {
    adviserId: row.adviser_id,
    caseRef: row.case_ref,
    lender: row.lender,
    loanAmount: amount(row.loan_amount),
    homeImprovementAmount: amount(row.home_improvement_amount),
    loanPurpose: row.loan_purpose,
    isJoint: row.is_joint,
    applicant1Name: row.applicant_1_name,
    applicant1Parts: parts(row.applicant_1_first_name, row.applicant_1_middle_name, row.applicant_1_surname),
    applicant1Email: row.applicant_1_email,
    applicant1Mobile: row.applicant_1_mobile,
    applicant2Name: row.applicant_2_name,
    applicant2Parts: parts(row.applicant_2_first_name, row.applicant_2_middle_name, row.applicant_2_surname),
    applicant2Email: row.applicant_2_email,
    applicant2Mobile: row.applicant_2_mobile,
    employmentType: row.employment_type,
  }
}

/** The case as the edit form's boxes should show it. */
export function caseRowToValues(row: CaseRow): Record<string, string> {
  const name1 =
    parts(row.applicant_1_first_name, row.applicant_1_middle_name, row.applicant_1_surname) ??
    splitName(row.applicant_1_name)
  const name2 =
    parts(row.applicant_2_first_name, row.applicant_2_middle_name, row.applicant_2_surname) ??
    splitName(row.applicant_2_name)

  const text = (value: number | string | null) => (value === null ? '' : String(amount(value) ?? value))

  return {
    case_ref: row.case_ref,
    lender: row.lender ?? '',
    loan_amount: text(row.loan_amount),
    home_improvement_amount: text(row.home_improvement_amount),
    loan_purpose: row.loan_purpose ?? '',
    employment_type: row.employment_type ?? '',
    applicant_1_first_name: name1.first,
    applicant_1_middle_name: name1.middle ?? '',
    applicant_1_surname: name1.surname,
    applicant_1_email: row.applicant_1_email,
    applicant_1_mobile: row.applicant_1_mobile,
    is_joint: row.is_joint ? 'on' : '',
    applicant_2_first_name: name2.first,
    applicant_2_middle_name: name2.middle ?? '',
    applicant_2_surname: name2.surname,
    applicant_2_email: row.applicant_2_email ?? '',
    applicant_2_mobile: row.applicant_2_mobile ?? '',
  }
}

/**
 * The columns an edit writes. Built the same way a new case is, so the same
 * tidying applies, minus everything an edit must never change: the portal
 * link, who owns the case, its status and when the pack went out.
 */
const NEVER_EDITED = ['adviser_id', 'status', 'portal_token', 'token_expires_at', 'pack_issued_at'] as const

export function detailsPatch(input: CreateCaseInput) {
  const row: Partial<NewCaseRow> = { ...buildCaseRow(input) }
  for (const key of NEVER_EDITED) delete row[key]
  return row as Omit<NewCaseRow, (typeof NEVER_EDITED)[number]>
}

export type CaseDetails = ReturnType<typeof detailsPatch>

/** Which details an edit actually changed, by column name. */
export function changedFields(before: CreateCaseInput, after: CreateCaseInput): string[] {
  const a = detailsPatch(before) as Record<string, unknown>
  const b = detailsPatch(after) as Record<string, unknown>
  return Object.keys(b).filter((key) => a[key] !== b[key])
}

// ---------------------------------------------------------------------------
// Bringing the list into line
// ---------------------------------------------------------------------------

/**
 * One key per item and person, so a sole applicant's item lines up with the
 * same item for applicant 1 when a case becomes joint, and the other way round.
 */
function keyFor(templateKey: string, applicant: ApplicantSlot, perApplicant: Set<string>): string {
  const person = applicant === 'joint' && perApplicant.has(templateKey) ? 'applicant_1' : applicant
  return `${templateKey}:${person}`
}

function isUnsettled(status: RequirementStatus): boolean {
  return status === 'outstanding' || status === 'rejected'
}

export function planResync(
  template: TemplateItem[],
  before: CreateCaseInput,
  after: CreateCaseInput,
  existing: ExistingRequirement[],
): ResyncPlan {
  const perApplicant = new Set(template.filter((t) => t.perApplicant).map((t) => t.key))
  const index = (rows: { template_key: string | null; applicant: ApplicantSlot }[]) => {
    const map = new Map<string, number>()
    rows.forEach((row, i) => {
      if (!row.template_key) return
      const key = keyFor(row.template_key, row.applicant, perApplicant)
      if (!map.has(key)) map.set(key, i)
    })
    return map
  }

  const wasExpected = buildRequirements(template, before)
  const nowExpected = buildRequirements(template, after)
  const beforeAt = index(wasExpected)
  const afterAt = index(nowExpected)
  const existingAt = index(existing)

  const plan: ResyncPlan = { updates: [], inserts: [], waives: [] }

  for (const [key, i] of afterAt) {
    const wanted = nowExpected[i]
    const j = existingAt.get(key)

    if (j === undefined) {
      plan.inserts.push(wanted)
      continue
    }

    const current = existing[j]
    const b = beforeAt.get(key)
    const was = b === undefined ? undefined : wasExpected[b]
    const patch: RequirementPatch = {}

    if (current.applicant !== wanted.applicant) patch.applicant = wanted.applicant
    if (current.sort_order !== wanted.sort_order) patch.sort_order = wanted.sort_order

    // Only rewrite wording that is still exactly what the pack produced. If
    // the adviser has changed it by hand, it is theirs.
    const labelUntouched = !was || current.label === was.label
    if (labelUntouched && current.label !== wanted.label) patch.label = wanted.label

    const descriptionUntouched = !was || (current.description ?? '') === (was.description ?? '')
    if (descriptionUntouched && (current.description ?? '') !== wanted.description) {
      patch.description = wanted.description
    }

    if (isUnsettled(current.status) && current.expected_count !== wanted.expected_count) {
      patch.expected_count = wanted.expected_count
    }

    // Brought back only when it is this edit that makes it apply again.
    if (!was && current.status === 'waived') patch.status = 'outstanding'

    if (Object.keys(patch).length > 0) plan.updates.push({ id: current.id, patch })
  }

  for (const [key] of beforeAt) {
    if (afterAt.has(key)) continue
    const j = existingAt.get(key)
    if (j === undefined) continue

    const current = existing[j]
    if (isUnsettled(current.status)) plan.waives.push({ id: current.id, label: current.label })
  }

  return plan
}

// ---------------------------------------------------------------------------
// Writing it down
// ---------------------------------------------------------------------------

export type UpdateResult = {
  fieldsChanged: string[]
  added: number
  removed: number
  restored: number
}

/**
 * Saves new details for a case and brings its list into line.
 *
 * The owner of the case never changes here - the adviser id on the input is
 * replaced with the one already on the case.
 */
export async function updateCase(caseId: string, input: CreateCaseInput, actor: string): Promise<UpdateResult> {
  const db = serverClient()

  const { data: row, error } = await db.from('cases').select(CASE_ROW_FIELDS).eq('id', caseId).single()
  if (error) throw error

  const current = row as unknown as CaseRow
  const before = caseRowToInput(current)
  const after: CreateCaseInput = { ...input, adviserId: current.adviser_id }

  const [template, { data: requirements, error: reqError }] = await Promise.all([
    supabaseStore(db).loadTemplate(STANDARD_PACK),
    db
      .from('requirements')
      .select('id, template_key, applicant, status, label, description, expected_count, sort_order')
      .eq('case_id', caseId),
  ])
  if (reqError) throw reqError

  const plan = planResync(template, before, after, (requirements ?? []) as ExistingRequirement[])
  const fieldsChanged = changedFields(before, after)

  const { error: caseError } = await db.from('cases').update(detailsPatch(after)).eq('id', caseId)
  if (caseError) throw caseError

  for (const { id, patch } of plan.updates) {
    const { error: e } = await db.from('requirements').update(patch).eq('id', id)
    if (e) throw e
  }

  if (plan.inserts.length > 0) {
    const { error: e } = await db
      .from('requirements')
      .insert(plan.inserts.map((r) => ({ ...r, case_id: caseId })))
    if (e) throw e
  }

  if (plan.waives.length > 0) {
    const { error: e } = await db
      .from('requirements')
      .update({ status: 'waived', next_chase_at: null })
      .in('id', plan.waives.map((w) => w.id))
    if (e) throw e
  }

  const restored = plan.updates.filter((u) => u.patch.status === 'outstanding').length

  await db.from('events').insert({
    case_id: caseId,
    type: 'case_updated',
    actor,
    // Which details changed and what happened to the list. Column names and
    // item labels only - never the values typed in.
    detail: {
      fields_changed: fieldsChanged,
      items_added: plan.inserts.map((r) => r.label),
      items_removed: plan.waives.map((w) => w.label),
      items_restored: restored,
    },
  })

  return {
    fieldsChanged,
    added: plan.inserts.length,
    removed: plan.waives.length,
    restored,
  }
}

// Re-exported so callers do not need to know where the row shape lives.
export type { NewCaseRow }
