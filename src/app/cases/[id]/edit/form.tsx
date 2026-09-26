'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updateCaseAction, type EditCaseState } from './actions'
import { CaseFields, type CaseValues } from '../../case-fields'

export function EditCaseForm({ caseId, initial }: { caseId: string; initial: CaseValues }) {
  const [state, formAction, pending] = useActionState<EditCaseState, FormData>(
    updateCaseAction.bind(null, caseId),
    { status: 'idle' },
  )

  const errors = state.status === 'error' ? state.errors : {}

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-8">
      {state.status === 'error' && state.message && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      {/* Remounted after each failed submit so the boxes show what was typed. */}
      <fieldset
        key={state.status === 'error' ? state.attempt : 'first'}
        disabled={pending}
        className="space-y-5"
      >
        <CaseFields
          values={state.status === 'error' ? state.values : initial}
          errors={errors}
          showApplicant2Contact
        />

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            className="btn-brand px-5 py-2.5 text-sm"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
          <Link
            href={`/cases/${caseId}`}
            className="btn-quiet px-5 py-2.5 text-sm"
          >
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  )
}
