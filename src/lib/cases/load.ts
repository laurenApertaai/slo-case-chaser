/**
 * Reading cases back out for the adviser screens.
 *
 * Every read here uses the secret-key client, server side. Row level security
 * is on for every table with no policies, so a browser-key read returns an
 * empty list rather than an error — which looks exactly like having no cases.
 */
import { serverClient } from '@/lib/db/client'
import { workingDaysBetween } from '@/lib/dates/workingDays'
import { caseProgress, type CaseProgress, type StatusRequirement } from '@/lib/cases/status'
import type { CaseStatus } from '@/lib/cases/status'
import type { ApplicantSlot } from '@/lib/cases/create'

export type CaseSummary = {
  id: string
  case_ref: string
  lender: string | null
  loan_amount: number | null
  is_joint: boolean
  status: CaseStatus
  applicant_1_name: string
  adviser_id: string
  adviser_name: string | null
  pack_issued_at: string | null
  created_at: string
  progress: CaseProgress
}

export type CaseRequirement = StatusRequirement & {
  id: string
  applicant: ApplicantSlot
  type: 'upload' | 'question' | 'question_group'
  label: string
  description: string | null
  expected_count: number | null
  sort_order: number
  template_key: string | null
}

export type CaseDetail = CaseSummary & {
  applicant_1_email: string
  applicant_1_mobile: string
  applicant_2_name: string | null
  applicant_2_email: string | null
  applicant_2_mobile: string | null
  portal_token: string
  token_expires_at: string
  requirements: CaseRequirement[]
}

const CASE_FIELDS =
  'id, case_ref, lender, loan_amount, is_joint, status, applicant_1_name, adviser_id, pack_issued_at, created_at'

const DETAIL_FIELDS = `${CASE_FIELDS}, applicant_1_email, applicant_1_mobile, applicant_2_name, applicant_2_email, applicant_2_mobile, portal_token, token_expires_at`

const REQUIREMENT_FIELDS =
  'id, applicant, type, label, description, status, is_mandatory, expected_count, sort_order, rejection_count, received_at, template_key'

/**
 * Working days since the pack went out, or null while it has not been issued.
 *
 * Kept separate because it is the one part of the status calculation that has
 * to reach the bank holiday feed, and the calculation itself stays pure.
 */
async function daysSinceIssue(packIssuedAt: string | null, now: Date): Promise<number | null> {
  if (!packIssuedAt) return null
  return workingDaysBetween(new Date(packIssuedAt), now)
}

/** Every case in the firm, newest first. */
export async function listCases(now: Date = new Date()): Promise<CaseSummary[]> {
  const db = serverClient()

  const { data: cases, error } = await db
    .from('cases')
    .select(CASE_FIELDS)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!cases?.length) return []

  const ids = cases.map((c) => c.id)

  const [{ data: requirements, error: reqError }, { data: advisers }] = await Promise.all([
    db.from('requirements').select('case_id, status, rejection_count, received_at, is_mandatory').in('case_id', ids),
    db.from('advisers').select('id, name'),
  ])

  if (reqError) throw reqError

  const byCase = new Map<string, StatusRequirement[]>()
  for (const row of requirements ?? []) {
    const list = byCase.get(row.case_id) ?? []
    list.push(row as StatusRequirement)
    byCase.set(row.case_id, list)
  }

  const adviserNames = new Map((advisers ?? []).map((a) => [a.id, a.name as string]))

  return Promise.all(
    cases.map(async (row) => ({
      ...(row as Omit<CaseSummary, 'progress' | 'adviser_name'>),
      adviser_name: adviserNames.get(row.adviser_id) ?? null,
      progress: caseProgress({
        caseStatus: row.status as CaseStatus,
        requirements: byCase.get(row.id) ?? [],
        workingDaysSinceIssue: await daysSinceIssue(row.pack_issued_at, now),
        now,
      }),
    })),
  )
}

/** One case with everything on it, or null when the id does not exist. */
export async function loadCase(id: string, now: Date = new Date()): Promise<CaseDetail | null> {
  const db = serverClient()

  const { data: row, error } = await db.from('cases').select(DETAIL_FIELDS).eq('id', id).maybeSingle()

  if (error) throw error
  if (!row) return null

  const [{ data: requirements, error: reqError }, { data: adviser }] = await Promise.all([
    db.from('requirements').select(REQUIREMENT_FIELDS).eq('case_id', id).order('sort_order'),
    db.from('advisers').select('name').eq('id', row.adviser_id).maybeSingle(),
  ])

  if (reqError) throw reqError

  const list = (requirements ?? []) as CaseRequirement[]

  return {
    ...(row as unknown as Omit<CaseDetail, 'progress' | 'requirements' | 'adviser_name'>),
    adviser_name: (adviser?.name as string) ?? null,
    requirements: list,
    progress: caseProgress({
      caseStatus: row.status as CaseStatus,
      requirements: list,
      workingDaysSinceIssue: await daysSinceIssue(row.pack_issued_at, now),
      now,
    }),
  }
}

/** The highest sort order on a case, so a new item lands at the end. */
export async function highestSortOrder(caseId: string): Promise<number | null> {
  const { data, error } = await serverClient()
    .from('requirements')
    .select('sort_order')
    .eq('case_id', caseId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.sort_order ?? null
}
