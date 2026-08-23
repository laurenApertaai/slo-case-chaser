/**
 * Turning a portal token into what the client is allowed to see.
 *
 * The portal has no login. The link is the credential, so this file is the
 * whole of the access control for the client half of the tool and it is written
 * to be read in one sitting.
 *
 * Two rules govern it:
 *
 * 1. Nothing is returned that the client should not have. The case row carries
 *    the adviser, the encrypted bank details and the token itself; none of them
 *    go out. The view is built field by field rather than by spreading the row,
 *    so adding a column to `cases` can never quietly leak it.
 *
 * 2. The client never reads internal state. "Rejected" is an adviser word.
 *    The client reads "Please send this again".
 */
import { timingSafeEqual } from 'node:crypto'
import { serverClient } from '@/lib/db/client'
import type { ApplicantSlot } from '@/lib/cases/create'
import type { EmploymentType } from '@/lib/cases/employment'
import type { CaseStatus, RequirementStatus } from '@/lib/cases/status'

/** 32 random bytes, base64url encoded. */
const TOKEN_LENGTH = 43

export type PortalRequirementRow = {
  id: string
  applicant: ApplicantSlot
  type: 'upload' | 'question' | 'question_group'
  label: string
  description: string | null
  status: RequirementStatus
  is_mandatory: boolean
  expected_count: number | null
  sort_order: number
  upload_count: number
}

export type PortalCaseRow = {
  id: string
  case_ref: string
  status: CaseStatus
  is_joint: boolean
  employment_type: EmploymentType | null
  applicant_1_name: string
  portal_token: string
  token_expires_at: string
  requirements: PortalRequirementRow[]

  // Present on the row, never in the view. Named here so it is obvious that
  // leaving them out is a decision rather than an oversight.
  adviser_id: string
  bank_details_enc: string | null
  bank_details_last4: string | null
}

/** What the client is told about one item. */
export type PortalItemState = 'outstanding' | 'checking' | 'done' | 'sent_back' | 'not_needed'

export type PortalItem = {
  id: string
  label: string
  description: string | null
  type: 'upload' | 'question' | 'question_group'
  applicant: ApplicantSlot
  state: PortalItemState
  stateLabel: string
  isMandatory: boolean
  expectedCount: number | null
  uploadedCount: number
}

export type PortalView = {
  caseRef: string
  firstName: string
  isJoint: boolean
  employmentType: EmploymentType | null
  items: PortalItem[]
  /** how many things are still being asked of the client */
  outstandingCount: number
  totalCount: number
  allDone: boolean
}

export type PortalResolution =
  | { ok: true; view: PortalView }
  | { ok: false; status: 404 | 410; reason: string }

export type PortalStore = {
  findByToken(token: string): Promise<PortalCaseRow | null>
}

/**
 * How each internal state reads to the client.
 *
 * "Rejected" never appears. A client who has been told their payslip was
 * rejected hears a judgement; a client told to send it again hears a task.
 */
const CLIENT_WORDING: Record<RequirementStatus, { state: PortalItemState; label: string }> = {
  outstanding: { state: 'outstanding', label: 'Still required' },
  received: { state: 'checking', label: 'Received, we are checking this' },
  accepted: { state: 'done', label: 'Accepted' },
  rejected: { state: 'sent_back', label: 'Please send this again' },
  waived: { state: 'not_needed', label: 'No longer needed' },
}

/** Whether this item is still being asked of the client. */
function isOutstanding(status: RequirementStatus): boolean {
  return status === 'outstanding' || status === 'rejected'
}

/**
 * Compares two tokens without giving away how much of one matched.
 *
 * Honest about what this does and does not buy. The database lookup that found
 * the row is an indexed equality match and is not itself constant time, so this
 * does not close every timing channel. What it does close is the application
 * level one: no early-exit string comparison in our own code. Against a 256 bit
 * random token neither channel is realistically exploitable, and the cost of
 * doing it properly here is one function call.
 */
function tokensMatch(supplied: string, stored: string): boolean {
  if (supplied.length !== stored.length) return false

  const a = Buffer.from(supplied, 'utf8')
  const b = Buffer.from(stored, 'utf8')
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

export function buildPortalView(row: PortalCaseRow): PortalView {
  const items = [...row.requirements]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((requirement) => {
      const wording = CLIENT_WORDING[requirement.status]

      return {
        id: requirement.id,
        label: requirement.label,
        description: requirement.description,
        type: requirement.type,
        applicant: requirement.applicant,
        state: wording.state,
        stateLabel: wording.label,
        isMandatory: requirement.is_mandatory,
        expectedCount: requirement.expected_count,
        uploadedCount: requirement.upload_count,
      }
    })

  const outstandingCount = row.requirements.filter((r) => isOutstanding(r.status)).length

  return {
    caseRef: row.case_ref,
    // First name only. The portal is a conversation, not a letter.
    firstName: row.applicant_1_name.trim().split(/\s+/)[0] ?? row.applicant_1_name,
    isJoint: row.is_joint,
    employmentType: row.employment_type,
    items,
    outstandingCount,
    totalCount: row.requirements.length,
    allDone: row.requirements.length > 0 && outstandingCount === 0,
  }
}

export async function resolvePortal(
  token: string,
  store: PortalStore = supabasePortalStore(),
  now: Date = new Date(),
): Promise<PortalResolution> {
  // Anything the wrong shape is not a token. Stop before touching the database.
  if (token.length !== TOKEN_LENGTH) {
    return { ok: false, status: 404, reason: 'That link is not valid.' }
  }

  const row = await store.findByToken(token)
  if (!row) return { ok: false, status: 404, reason: 'That link is not valid.' }

  if (!tokensMatch(token, row.portal_token)) {
    return { ok: false, status: 404, reason: 'That link is not valid.' }
  }

  if (new Date(row.token_expires_at).getTime() <= now.getTime()) {
    return {
      ok: false,
      status: 410,
      reason: 'That link has expired. Please contact us and we will send you a new one.',
    }
  }

  if (row.status === 'withdrawn') {
    return {
      ok: false,
      status: 410,
      reason: 'This application has been closed. Please contact us if you think that is wrong.',
    }
  }

  return { ok: true, view: buildPortalView(row) }
}

// ---------------------------------------------------------------------------
// The real database
// ---------------------------------------------------------------------------

export function supabasePortalStore(): PortalStore {
  return {
    async findByToken(token) {
      const db = serverClient()

      const { data, error } = await db
        .from('cases')
        .select(
          'id, case_ref, status, is_joint, employment_type, applicant_1_name, portal_token, token_expires_at, adviser_id, bank_details_enc, bank_details_last4',
        )
        .eq('portal_token', token)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const { data: requirements, error: reqError } = await db
        .from('requirements')
        .select('id, applicant, type, label, description, status, is_mandatory, expected_count, sort_order, uploads(count)')
        .eq('case_id', data.id)
        .order('sort_order')

      if (reqError) throw reqError

      return {
        ...(data as Omit<PortalCaseRow, 'requirements'>),
        requirements: (requirements ?? []).map((r) => {
          const { uploads, ...rest } = r as typeof r & { uploads: { count: number }[] }
          return {
            ...(rest as unknown as Omit<PortalRequirementRow, 'upload_count'>),
            upload_count: uploads?.[0]?.count ?? 0,
          }
        }),
      }
    },
  }
}
