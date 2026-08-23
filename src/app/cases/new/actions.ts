'use server'

import { headers } from 'next/headers'
import { currentAdviser } from '@/lib/auth/supabase'
import { createCase } from '@/lib/cases/create'
import { parseCaseForm, type FieldErrors } from '@/lib/cases/input'

export type NewCaseState =
  | { status: 'idle' }
  | { status: 'error'; errors: FieldErrors; message?: string }
  | { status: 'created'; caseId: string; caseRef: string; portalUrl: string; itemCount: number }

async function absoluteUrl(path: string): Promise<string> {
  const head = await headers()
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000'
  const protocol = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocol}://${host}${path}`
}

export async function createCaseAction(
  _previous: NewCaseState,
  formData: FormData,
): Promise<NewCaseState> {
  // Server actions are reachable by direct POST, not only through this form,
  // so who is asking is established here rather than trusted from the page.
  const adviser = await currentAdviser()
  if (!adviser) {
    return { status: 'error', errors: {}, message: 'Your session has expired. Please sign in again.' }
  }

  const fields = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  )

  const parsed = parseCaseForm(fields, adviser.id)
  if (!parsed.ok) return { status: 'error', errors: parsed.errors }

  try {
    const created = await createCase(parsed.input)

    return {
      status: 'created',
      caseId: created.id,
      caseRef: created.case_ref,
      portalUrl: await absoluteUrl(`/portal/${created.portal_token}`),
      itemCount: created.requirement_count,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[cases] could not create "${parsed.input.caseRef}": ${message}`)

    // A duplicate reference is the one failure worth naming, because it is the
    // adviser's to fix. Everything else is ours.
    if (message.includes('duplicate key')) {
      return { status: 'error', errors: { case_ref: 'A case with that reference already exists.' } }
    }

    return { status: 'error', errors: {}, message: `The case could not be created: ${message}` }
  }
}
