'use server'

import { revalidatePath } from 'next/cache'
import { currentAdviser } from '@/lib/auth/supabase'
import { serverClient } from '@/lib/db/client'
import { buildExtraRequirement, parseExtraForm } from '@/lib/cases/extra'
import { buildSettle, parseSettleForm } from '@/lib/cases/settle'
import { highestSortOrder } from '@/lib/cases/load'

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
