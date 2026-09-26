'use server'

import { revalidatePath } from 'next/cache'
import { currentAdviser } from '@/lib/auth/supabase'
import { serverClient } from '@/lib/db/client'
import { buildExtraRequirement, parseExtraForm } from '@/lib/cases/extra'
import { buildSettle, parseSettleForm } from '@/lib/cases/settle'
import { parseWordingForm } from '@/lib/cases/wording'
import { decryptBankDetails, fromBytea } from '@/lib/crypto/bankDetails'
import { highestSortOrder } from '@/lib/cases/load'
import { formFolder, putIntoFolder, removeFromFolder } from '@/lib/files/storage'

export type ExtraItemState =
  | { status: 'idle' }
  | { status: 'error'; errors: Record<string, string>; message?: string }
  | { status: 'added'; label: string }

export async function addExtraItemAction(
  _previous: ExtraItemState,
  formData: FormData,
): Promise<ExtraItemState> {
  // Server actions are reachable by direct POST, not only through this form.
  const adviser = await currentAdviser()
  if (!adviser) {
    return { status: 'error', errors: {}, message: 'Your session has expired. Please sign in again.' }
  }

  const caseId = String(formData.get('case_id') ?? '')
  if (!caseId) return { status: 'error', errors: {}, message: 'Which case is this for?' }

  const fields = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  )

  const parsed = parseExtraForm(fields)
  if (!parsed.ok) return { status: 'error', errors: parsed.errors }

  try {
    const db = serverClient()
    const row = buildExtraRequirement(parsed.input, {
      highestSortOrder: await highestSortOrder(caseId),
    })

    const { error } = await db.from('requirements').insert({ ...row, case_id: caseId })
    if (error) throw error

    await db.from('events').insert({
      case_id: caseId,
      type: 'requirement_added',
      actor: adviser.id,
      // The label is the adviser's own wording for what was asked for, which is
      // exactly what the audit trail is for. No document content goes in here.
      detail: { label: parsed.input.label, applicant: parsed.input.applicant },
    })

    revalidatePath(`/cases/${caseId}`)
    return { status: 'added', label: parsed.input.label }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[cases] could not add an item to ${caseId}: ${message}`)
    return { status: 'error', errors: {}, message: `The item could not be added: ${message}` }
  }
}

export type SettleState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'settled'; label: string; outcome: 'accepted' | 'waived' }

/**
 * Takes an item off the client's list without them sending anything.
 *
 * Either it already arrived by email, post or in person, or it turned out not
 * to apply to this case. Nothing is deleted either way.
 */
export async function settleRequirementAction(
  _previous: SettleState,
  formData: FormData,
): Promise<SettleState> {
  const adviser = await currentAdviser()
  if (!adviser) return { status: 'error', message: 'Your session has expired. Please sign in again.' }

  const requirementId = String(formData.get('requirement_id') ?? '')
  const caseId = String(formData.get('case_id') ?? '')
  if (!requirementId || !caseId) return { status: 'error', message: 'Which item is this?' }

  const parsed = parseSettleForm(
    Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])),
  )
  if (!parsed.ok) return { status: 'error', message: Object.values(parsed.errors)[0] }

  try {
    const db = serverClient()

    // Read the label first, so the audit trail says what was settled rather
    // than only which row id it was.
    const { data: requirement, error: readError } = await db
      .from('requirements')
      .select('label, status')
      .eq('id', requirementId)
      .single()

    if (readError) throw readError

    const { patch, event } = buildSettle(parsed.input, adviser.id)

    const { error } = await db.from('requirements').update(patch).eq('id', requirementId)
    if (error) throw error

    await db.from('events').insert({
      case_id: caseId,
      requirement_id: requirementId,
      type: event.type,
      actor: event.actor,
      detail: { ...event.detail, label: requirement.label },
    })

    revalidatePath(`/cases/${caseId}`)

    return {
      status: 'settled',
      label: requirement.label as string,
      outcome: patch.status,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[cases] could not settle ${requirementId}: ${message}`)
    return { status: 'error', message: `That did not work: ${message}` }
  }
}

export type WordingState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'saved' }

/** Changes the wording of one item on the client's list. */
export async function rewordRequirementAction(
  _previous: WordingState,
  formData: FormData,
): Promise<WordingState> {
  const adviser = await currentAdviser()
  if (!adviser) return { status: 'error', message: 'Your session has expired. Please sign in again.' }

  const requirementId = String(formData.get('requirement_id') ?? '')
  const caseId = String(formData.get('case_id') ?? '')
  if (!requirementId || !caseId) return { status: 'error', message: 'Which item is this?' }

  const parsed = parseWordingForm({
    label: String(formData.get('label') ?? ''),
    description: String(formData.get('description') ?? ''),
  })
  if (!parsed.ok) return { status: 'error', message: Object.values(parsed.errors)[0] }

  try {
    const db = serverClient()

    const { data: before, error: readError } = await db
      .from('requirements')
      .select('label')
      .eq('id', requirementId)
      .eq('case_id', caseId)
      .single()
    if (readError) throw readError

    const { error } = await db
      .from('requirements')
      .update({ label: parsed.wording.label, description: parsed.wording.description })
      .eq('id', requirementId)
    if (error) throw error

    await db.from('events').insert({
      case_id: caseId,
      requirement_id: requirementId,
      type: 'requirement_reworded',
      actor: adviser.id,
      detail: { from_label: before.label, to_label: parsed.wording.label },
    })

    revalidatePath(`/cases/${caseId}`)
    return { status: 'saved' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[cases] could not reword ${requirementId}: ${message}`)
    return { status: 'error', message: `That did not save: ${message}` }
  }
}

export type RevealState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'shown'
      details: { account_name: string; account_number: string; sort_code: string; bank_name: string }
    }

/**
 * Opens a case's bank details for the adviser to read in full.
 *
 * Every look is written to the audit trail - who, and when - because these are
 * the details most worth protecting. What they say is never written down.
 */
export async function revealBankDetailsAction(caseId: string): Promise<RevealState> {
  const adviser = await currentAdviser()
  if (!adviser) return { status: 'error', message: 'Your session has expired. Please sign in again.' }

  try {
    const db = serverClient()
    const { data, error } = await db.from('cases').select('bank_details_enc').eq('id', caseId).single()
    if (error) throw error
    if (!data.bank_details_enc) return { status: 'error', message: 'No bank details have been given yet.' }

    const details = decryptBankDetails(fromBytea(data.bank_details_enc))

    await db.from('events').insert({
      case_id: caseId,
      type: 'bank_details_viewed',
      actor: adviser.id,
      detail: {},
    })

    return { status: 'shown', details }
  } catch (error) {
    console.error(`[cases] could not open bank details for ${caseId}:`, error instanceof Error ? error.message : error)
    return { status: 'error', message: 'The bank details could not be opened.' }
  }
}

export type FormState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'attached'; names: string[] }

/**
 * A form the adviser needs signed, uploaded from their own machine and
 * attached to one item on the client's list.
 *
 * The client gets a Download button on that item and sends the signed copy
 * back in the same place, so it is chased like anything else.
 */
export async function attachFormAction(
  caseId: string,
  requirementId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const adviser = await currentAdviser()
  if (!adviser) return { status: 'error', message: 'Your session has expired. Please sign in again.' }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  if (files.length === 0 || files.every((f) => f.size === 0)) {
    return { status: 'error', message: 'Choose a file first.' }
  }

  try {
    // The item has to be on this case. Without this an id from anywhere would
    // attach a file to somebody else's list.
    const { data: owned, error: ownedError } = await serverClient()
      .from('requirements')
      .select('id')
      .eq('id', requirementId)
      .eq('case_id', caseId)
      .maybeSingle()

    if (ownedError) throw ownedError
    if (!owned) return { status: 'error', message: 'That item is not on this case.' }

    const { attached, problems } = await putIntoFolder(formFolder(caseId, requirementId), files)

    if (attached.length === 0) {
      return { status: 'error', message: problems.join(', ') || 'Nothing was attached.' }
    }

    await serverClient().from('events').insert({
      case_id: caseId,
      requirement_id: requirementId,
      type: 'form_attached',
      actor: adviser.id,
      detail: { files: attached },
    })

    revalidatePath(`/cases/${caseId}`)
    return { status: 'attached', names: attached }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[cases] could not attach a form to ${requirementId}: ${message}`)
    return { status: 'error', message: `That did not attach: ${message}` }
  }
}

/** Removes a form the adviser attached. Client uploads are never touched. */
export async function removeFormAction(
  caseId: string,
  requirementId: string,
  name: string,
): Promise<void> {
  const adviser = await currentAdviser()
  if (!adviser) return

  await removeFromFolder(formFolder(caseId, requirementId), name)
  await serverClient().from('events').insert({
    case_id: caseId,
    requirement_id: requirementId,
    type: 'form_removed',
    actor: adviser.id,
    detail: { file: name },
  })
  revalidatePath(`/cases/${caseId}`)
}
