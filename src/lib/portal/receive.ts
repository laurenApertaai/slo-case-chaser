/**
 * Taking in what a client sends from their page: typed answers and files.
 *
 * Every function here is handed a case that has already been opened by its
 * token, and refuses any item that is not on that case. A client can only ever
 * write to their own list.
 *
 * Something received comes off the client's to-do list straight away - before
 * the adviser has looked at it - so they are never chased for something they
 * sent yesterday.
 */
import { randomUUID } from 'node:crypto'
import { serverClient } from '@/lib/db/client'
import { encryptBankDetails, toBytea, type BankDetails } from '@/lib/crypto/bankDetails'
import { formFor, validateAnswers } from '@/lib/portal/answers'
import type { PortalCaseRow, PortalRequirementRow } from '@/lib/portal/resolve'
import { countPages, isComplete, MAX_FILE_BYTES, putFile, uploadPath } from '@/lib/files/storage'

export type ReceiveResult =
  | { ok: true; complete: boolean; sentSoFar?: number; expected?: number | null }
  | { ok: false; status: number; message: string; errors?: Record<string, string> }

const COUNTED_IN_PAGES = 'slo_documents'

function findItem(row: PortalCaseRow, requirementId: string): PortalRequirementRow | undefined {
  return row.requirements.find((r) => r.id === requirementId)
}

/** Already dealt with, so there is nothing for the client to add. */
function isClosed(item: PortalRequirementRow): boolean {
  return item.status === 'accepted' || item.status === 'waived'
}

async function markReceived(caseId: string, requirementId: string): Promise<void> {
  const { error } = await serverClient()
    .from('requirements')
    .update({
      status: 'received',
      received_at: new Date().toISOString(),
      received_via: 'portal',
      next_chase_at: null,
    })
    .eq('id', requirementId)
    .eq('case_id', caseId)
  if (error) throw error
}

async function logEvent(caseId: string, requirementId: string, type: string, detail: Record<string, unknown>) {
  await serverClient().from('events').insert({
    case_id: caseId,
    requirement_id: requirementId,
    type,
    actor: 'client',
    detail,
  })
}

// ---------------------------------------------------------------------------
// Typed answers
// ---------------------------------------------------------------------------

export async function receiveAnswers(
  row: PortalCaseRow,
  requirementId: string,
  raw: Record<string, string>,
): Promise<ReceiveResult> {
  const item = findItem(row, requirementId)
  if (!item) return { ok: false, status: 404, message: 'We could not find that item.' }
  if (!formFor(item.template_key) || !item.template_key) {
    return { ok: false, status: 400, message: 'This item needs a document, not details.' }
  }
  if (isClosed(item)) {
    return { ok: false, status: 409, message: 'We already have this one, so there is nothing more to send.' }
  }

  const checked = validateAnswers(item.template_key, raw)
  if (!checked.ok) {
    return { ok: false, status: 400, message: 'Please check the boxes marked in red.', errors: checked.errors }
  }

  const db = serverClient()

  if (item.template_key === 'bank_details') {
    // Sealed on the case, never written to the ordinary answers table.
    const details = checked.values as BankDetails
    const { error } = await db
      .from('cases')
      .update({
        bank_details_enc: toBytea(encryptBankDetails(details)),
        bank_details_last4: details.account_number.slice(-4),
      })
      .eq('id', row.id)
    if (error) throw error
  } else {
    const { error } = await db.from('answers').upsert(
      Object.entries(checked.values).map(([field_key, value]) => ({
        requirement_id: item.id,
        field_key,
        value,
        answered_at: new Date().toISOString(),
      })),
      { onConflict: 'requirement_id,field_key' },
    )
    if (error) throw error
  }

  // The second applicant's details also go on the case, so chasers can reach
  // them directly from now on.
  if (item.template_key === 'applicant_2_contact') {
    const { error } = await db
      .from('cases')
      .update({
        applicant_2_email: checked.values.partner_email,
        applicant_2_mobile: checked.values.partner_mobile,
      })
      .eq('id', row.id)
    if (error) throw error
  }

  await markReceived(row.id, item.id)
  // The label only. What was typed never goes into the audit trail.
  await logEvent(row.id, item.id, 'answer_received', { label: item.label })

  return { ok: true, complete: true }
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * HEIC in particular often arrives with no type, or labelled as the generic
 * "unknown binary" type, so the name is trusted over either.
 */
function mimeFor(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  const known: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    heif: 'image/heif',
    webp: 'image/webp',
  }
  return (ext && known[ext]) || 'application/octet-stream'
}

export async function receiveFiles(
  row: PortalCaseRow,
  requirementId: string,
  files: File[],
): Promise<ReceiveResult> {
  const item = findItem(row, requirementId)
  if (!item) return { ok: false, status: 404, message: 'We could not find that item.' }
  if (item.type !== 'upload') {
    return { ok: false, status: 400, message: 'This item needs details typed in, not a document.' }
  }
  if (isClosed(item)) {
    return { ok: false, status: 409, message: 'We already have this one, so there is nothing more to send.' }
  }

  const real = files.filter((f) => f.size > 0)
  if (real.length === 0) return { ok: false, status: 400, message: 'Please choose a file or take a photo.' }
  if (real.length > 20) return { ok: false, status: 400, message: 'Please send no more than 20 files at a time.' }

  const tooBig = real.find((f) => f.size > MAX_FILE_BYTES)
  if (tooBig) {
    return {
      ok: false,
      status: 413,
      message: `${tooBig.name} is too large to send. Please send a file smaller than 25MB.`,
    }
  }

  const db = serverClient()

  for (const file of real) {
    const id = randomUUID()
    const bytes = Buffer.from(await file.arrayBuffer())
    const mimeType = mimeFor(file)
    const path = uploadPath(row.id, item.id, id, file.name)

    // Kept exactly as it arrived.
    await putFile(path, bytes, mimeType)

    const { error } = await db.from('uploads').insert({
      id,
      requirement_id: item.id,
      original_filename: file.name,
      storage_path: path,
      mime_type: mimeType,
      size_bytes: bytes.length,
      page_count: await countPages(bytes, mimeType),
      uploaded_by: 'client',
      source: 'portal',
    })
    if (error) throw error
  }

  // Everything sent so far, not just this batch.
  const { data: all, error: countError } = await db
    .from('uploads')
    .select('page_count')
    .eq('requirement_id', item.id)
    .is('deleted_at', null)
  if (countError) throw countError

  const filesSoFar = all?.length ?? 0
  const pagesSoFar = (all ?? []).reduce((sum, u) => sum + (u.page_count ?? 1), 0)
  const byPages = item.template_key === COUNTED_IN_PAGES

  const complete = isComplete({
    expected: item.expected_count,
    files: filesSoFar,
    pages: pagesSoFar,
    countPages: byPages,
  })

  if (complete) await markReceived(row.id, item.id)

  await logEvent(row.id, item.id, 'upload_received', {
    label: item.label,
    files: real.length,
    complete,
  })

  return {
    ok: true,
    complete,
    sentSoFar: byPages ? pagesSoFar : filesSoFar,
    expected: item.expected_count,
  }
}
