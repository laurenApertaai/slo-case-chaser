/**
 * Creating a case from a template.
 *
 * A case is the client, the loan, and the list of everything they owe us. That
 * list is generated once, here, from the standard pack, and it is the thing the
 * portal shows and the chaser chases.
 *
 * On a joint application the second applicant's items are created on day zero
 * rather than in a second wave, so the client can see everything needed for
 * both of them from the outset. Their email address and mobile number are just
 * another outstanding item, and supplying them is what starts chasers going to
 * them directly.
 *
 * The database work sits behind `CaseStore` so that the list-building rules can
 * be tested on their own. `supabaseStore()` is the real implementation.
 */
import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverClient } from '@/lib/db/client'
import { requirementsForEmployment, type EmploymentType } from '@/lib/cases/employment'
import { DEFAULT_TEMPLATE, type TemplateItem } from '@/lib/db/seed'

export const STANDARD_PACK = 'Standard second charge pack'

/** How long a portal link stays usable. */
const TOKEN_DAYS = 90

export type ApplicantSlot = 'applicant_1' | 'applicant_2' | 'joint'

export type CreateCaseInput = {
  adviserId: string
  caseRef: string
  lender: string | null
  loanAmount: number | null
  isJoint: boolean
  applicant1Name: string
  applicant1Email: string
  applicant1Mobile: string
  employmentType: EmploymentType | null
}

export type NewCaseRow = {
  adviser_id: string
  case_ref: string
  lender: string | null
  loan_amount: number | null
  status: 'active'
  is_joint: boolean
  employment_type: EmploymentType | null
  applicant_1_name: string
  applicant_1_email: string
  applicant_1_mobile: string
  applicant_2_name: string | null
  applicant_2_email: string | null
  applicant_2_mobile: string | null
  portal_token: string
  token_expires_at: string
  pack_issued_at: null
}

export type NewRequirementRow = {
  applicant: ApplicantSlot
  type: TemplateItem['type']
  label: string
  description: string
  status: 'outstanding'
  is_mandatory: boolean
  expected_count: number | null
  sort_order: number
  rejection_count: 0
  is_paused: false
  /** which template item this came from, kept for later rebuilds and reporting */
  template_key: string
}

export type NewEventRow = {
  case_id: string
  type: string
  actor: string
  detail: Record<string, unknown>
}

/** A case as it came back from the database. */
export type CaseRecord = NewCaseRow & { id: string }

/** The same case, plus how much was asked of the client. */
export type CreatedCase = CaseRecord & { requirement_count: number }

export type CaseStore = {
  loadTemplate(name: string): Promise<TemplateItem[]>
  insertCase(row: NewCaseRow): Promise<CaseRecord>
  insertRequirements(caseId: string, rows: NewRequirementRow[]): Promise<void>
  insertEvent(row: NewEventRow): Promise<void>
}

// ---------------------------------------------------------------------------
// The portal link
// ---------------------------------------------------------------------------

/**
 * The secret in the client's link.
 *
 * 32 random bytes, which is far past guessable, base64url encoded so it
 * survives being pasted into a text message without escaping.
 */
export function generatePortalToken(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenExpiry(from: Date = new Date()): Date {
  const expires = new Date(from)
  expires.setUTCDate(expires.getUTCDate() + TOKEN_DAYS)
  return expires
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/**
 * The loan amount as the client should read it.
 *
 * Whole pounds where the amount is round, because "£25,000.00" in a sentence
 * looks like a form field rather than a conversation. Falls back to plain words
 * so the sentence still reads properly before an amount is known.
 */
export function formatLoanAmount(amount: number | null): string {
  if (amount === null || Number.isNaN(amount)) return 'loan amount'

  const whole = Number.isInteger(amount)
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount)
}

function fillTokens(text: string, input: CreateCaseInput): string {
  return text
    .replaceAll('{{loan_amount}}', formatLoanAmount(input.loanAmount))
    .replaceAll('{{case_ref}}', input.caseRef)
    .replaceAll('{{lender}}', input.lender ?? 'the lender')
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

/**
 * Whose item this is, spelled out on the shared list.
 *
 * Both applicants see one list, so two items called "Photo identification" with
 * nothing to tell them apart is a guaranteed support call. A plain hyphen is
 * used rather than a dash because these labels go out in text messages, and a
 * dash pushes the whole message into a character set that doubles its cost.
 */
function labelFor(base: string, applicant: ApplicantSlot, input: CreateCaseInput): string {
  if (!input.isJoint || applicant === 'joint') return base
  if (applicant === 'applicant_1') return `${base} - ${firstName(input.applicant1Name)}`
  return `${base} - second applicant`
}

// ---------------------------------------------------------------------------
// Building the list
// ---------------------------------------------------------------------------

/** Leaves room between template items so an ad-hoc item can be slotted in later. */
const SORT_STEP = 10

function slotsFor(item: TemplateItem, isJoint: boolean): ApplicantSlot[] {
  if (item.jointOnly && !isJoint) return []
  if (item.perApplicant) return isJoint ? ['applicant_1', 'applicant_2'] : ['joint']
  return [item.applicantSlot ?? 'joint']
}

function slotOffset(applicant: ApplicantSlot): number {
  if (applicant === 'applicant_1') return 1
  if (applicant === 'applicant_2') return 2
  return 0
}

/**
 * Every requirement a new case starts with.
 *
 * Pure: no database, no clock, no randomness. Everything that decides what the
 * client is asked for is decided here and can be read in one sitting.
 */
export function buildRequirements(
  template: TemplateItem[],
  input: CreateCaseInput,
): NewRequirementRow[] {
  const rows: NewRequirementRow[] = []

  for (const item of [...template].sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const applicant of slotsFor(item, input.isJoint)) {
      // Income evidence retitles itself once the client says how they are paid,
      // and carries the file count that lets the portal say "8 of 12 uploaded".
      const income = item.employmentDependent
        ? requirementsForEmployment(input.employmentType)
        : null

      const base = income?.label ?? item.label
      const description = income?.description ?? item.description
      const expected = income ? income.expectedCount : item.expectedCount

      rows.push({
        applicant,
        type: item.type,
        label: labelFor(base, applicant, input),
        description: fillTokens(description, input),
        status: 'outstanding',
        is_mandatory: item.isMandatory,
        expected_count: expected ?? null,
        sort_order: item.sortOrder * SORT_STEP + slotOffset(applicant),
        rejection_count: 0,
        is_paused: false,
        template_key: item.key,
      })
    }
  }

  return rows
}

export function buildCaseRow(input: CreateCaseInput, now: Date = new Date()): NewCaseRow {
  return {
    adviser_id: input.adviserId,
    case_ref: input.caseRef.trim(),
    lender: input.lender?.trim() || null,
    loan_amount: input.loanAmount,
    status: 'active',
    is_joint: input.isJoint,
    employment_type: input.employmentType,
    applicant_1_name: input.applicant1Name.trim(),
    applicant_1_email: input.applicant1Email.trim().toLowerCase(),
    applicant_1_mobile: input.applicant1Mobile.trim(),

    // The second applicant's details are one of their outstanding items, not
    // something the adviser types in. Until the client supplies them, chasers
    // go to applicant 1 alone and carry the full list for both.
    applicant_2_name: null,
    applicant_2_email: null,
    applicant_2_mobile: null,

    portal_token: generatePortalToken(),
    token_expires_at: tokenExpiry(now).toISOString(),

    // Creating a case is not issuing it. The chase clock starts when the pack
    // goes out, which is a separate, deliberate step.
    pack_issued_at: null,
  }
}

// ---------------------------------------------------------------------------
// Writing it down
// ---------------------------------------------------------------------------

export async function createCase(
  input: CreateCaseInput,
  store: CaseStore = supabaseStore(),
  now: Date = new Date(),
): Promise<CreatedCase> {
  const template = await store.loadTemplate(STANDARD_PACK)
  const requirements = buildRequirements(template, input)
  const created = await store.insertCase(buildCaseRow(input, now))

  await store.insertRequirements(created.id, requirements)

  await store.insertEvent({
    case_id: created.id,
    type: 'case_created',
    actor: input.adviserId,
    // Counts and references only. Nothing that identifies a person or a
    // document belongs in the audit trail, because the trail outlives the files.
    detail: {
      case_ref: created.case_ref,
      is_joint: input.isJoint,
      requirement_count: requirements.length,
    },
  })

  return { ...created, requirement_count: requirements.length }
}

// ---------------------------------------------------------------------------
// The real database
// ---------------------------------------------------------------------------

export function supabaseStore(db: SupabaseClient = serverClient()): CaseStore {
  return {
    async loadTemplate(name) {
      const { data, error } = await db
        .from('templates')
        .select('items')
        .eq('name', name)
        .maybeSingle()

      if (error) throw error

      // A database without the pack loaded is a fresh machine, not a broken
      // one, so fall back to the copy in the code rather than failing.
      if (!data?.items) {
        console.warn(`[cases] template "${name}" is not in the database, using the built-in pack`)
        return DEFAULT_TEMPLATE
      }

      return data.items as TemplateItem[]
    },

    async insertCase(row) {
      const { data, error } = await db.from('cases').insert(row).select().single()
      if (error) throw error
      return data as CaseRecord
    },

    async insertRequirements(caseId, rows) {
      const { error } = await db
        .from('requirements')
        .insert(rows.map((row) => ({ ...row, case_id: caseId })))
      if (error) throw error
    },

    async insertEvent(row) {
      const { error } = await db.from('events').insert(row)
      if (error) throw error
    },
  }
}
