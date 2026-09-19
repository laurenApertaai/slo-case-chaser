'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { currentAdviser } from '@/lib/auth/supabase'
import { parseCaseForm, type FieldErrors } from '@/lib/cases/input'
import { updateCase } from '@/lib/cases/update'

export type EditCaseState =
  | { status: 'idle' }
  | {
      status: 'error'
      errors: FieldErrors
      message?: string
      /** what was typed, so the form can show it again */
      values: Record<string, string>
      attempt: number
    }

export async function updateCaseAction(
  caseId: string,
  _previous: EditCaseState,
  formData: FormData,
): Promise<EditCaseState> {
  const fields = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  )
  const keep = { values: fields, attempt: Date.now() }

  // Server actions are reachable by direct POST, not only through this form.
  const adviser = await currentAdviser()
  if (!adviser) {
    return { status: 'error', errors: {}, message: 'Your session has expired. Please sign in again.', ...keep }
  }

  // The owner is not changed by an edit; updateCase keeps the one on the case.
  const parsed = parseCaseForm(fields, adviser.id)
  if (!parsed.ok) return { status: 'error', errors: parsed.errors, ...keep }

  try {
    await updateCase(caseId, parsed.input, adviser.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[cases] could not update ${caseId}: ${message}`)

    if (message.includes('duplicate key')) {
      return { status: 'error', errors: { case_ref: 'A case with that reference already exists.' }, ...keep }
    }
    return { status: 'error', errors: {}, message: `The changes could not be saved: ${message}`, ...keep }
  }

  revalidatePath(`/cases/${caseId}`)
  revalidatePath('/cases')
  redirect(`/cases/${caseId}?saved=1`)
}
