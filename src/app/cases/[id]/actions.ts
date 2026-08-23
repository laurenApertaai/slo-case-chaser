'use server'

import { revalidatePath } from 'next/cache'
import { currentAdviser } from '@/lib/auth/supabase'
import { serverClient } from '@/lib/db/client'
import { buildExtraRequirement, parseExtraForm } from '@/lib/cases/extra'
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
