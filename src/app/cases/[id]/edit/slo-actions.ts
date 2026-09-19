'use server'

import { revalidatePath } from 'next/cache'
import { currentAdviser } from '@/lib/auth/supabase'
import { serverClient } from '@/lib/db/client'
import { putSloFiles, removeSloFile } from '@/lib/files/storage'

export type SloState = { status: 'idle' } | { status: 'done'; message: string } | { status: 'error'; message: string }

/** Adds SLO documents to a case, replacing any with the same name. */
export async function attachSloAction(caseId: string, _previous: SloState, formData: FormData): Promise<SloState> {
  const adviser = await currentAdviser()
  if (!adviser) return { status: 'error', message: 'Your session has expired. Please sign in again.' }

  const files = formData.getAll('slo_files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return { status: 'error', message: 'Choose a file first.' }

  try {
    const { attached, problems } = await putSloFiles(caseId, files)
    if (attached.length > 0) {
      await serverClient().from('events').insert({
        case_id: caseId,
        type: 'slo_documents_attached',
        actor: adviser.id,
        detail: { files: attached },
      })
    }
    revalidatePath(`/cases/${caseId}/edit`)
    revalidatePath(`/cases/${caseId}`)

    if (problems.length > 0) {
      return { status: 'error', message: `Some did not attach: ${problems.join('; ')}` }
    }
    return { status: 'done', message: `Attached: ${attached.join(', ')}` }
  } catch (error) {
    return { status: 'error', message: `That did not attach: ${error instanceof Error ? error.message : error}` }
  }
}

/** Takes one SLO document off a case. It is the adviser's own file, not the client's. */
export async function removeSloAction(caseId: string, name: string): Promise<void> {
  const adviser = await currentAdviser()
  if (!adviser) throw new Error('Your session has expired. Please sign in again.')

  await removeSloFile(caseId, name)
  await serverClient().from('events').insert({
    case_id: caseId,
    type: 'slo_document_removed',
    actor: adviser.id,
    detail: { file: name },
  })
  revalidatePath(`/cases/${caseId}/edit`)
  revalidatePath(`/cases/${caseId}`)
}
