'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createCaseAction, type NewCaseState } from './actions'
import { PortalLink } from '../portal-link'
import { CaseFields, LABEL } from '../case-fields'

export function NewCaseForm() {
  const [state, formAction, pending] = useActionState<NewCaseState, FormData>(createCaseAction, {
    status: 'idle',
  })

  if (state.status === 'created') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Case {state.caseRef} created
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {state.itemCount} items are on the client checklist, all outstanding. The pack has not
          been sent yet.
        </p>

        {state.sloAttached.length > 0 && (
          <p className="mt-2 text-sm text-green-800">
            SLO documents attached: {state.sloAttached.join(', ')}
          </p>
        )}
        {state.sloAttached.length === 0 && state.sloProblems.length === 0 && (
          <p className="mt-2 text-sm text-amber-800">
            No SLO documents attached. Add them from Edit case details, so the client can download
            them.
          </p>
        )}
        {state.sloProblems.length > 0 && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            Some SLO documents did not attach: {state.sloProblems.join('; ')}. Add them again from
            Edit case details.
          </p>
        )}

        <div className="mt-6">
          <p className={`${LABEL} mb-1`}>The client portal link</p>
          <PortalLink
            url={state.portalUrl}
            note="This is the secret link. It expires in 90 days. Sending it is part of issuing the pack, which is built in a later phase. It is also kept on the case page, so it is not lost if you navigate away."
          />
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/cases/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create another
          </Link>
          <Link
            href="/cases"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to cases
          </Link>
        </div>
      </div>
    )
  }

  const errors = state.status === 'error' ? state.errors : {}
  const message = state.status === 'error' ? state.message : undefined

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-8">
      {message && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      {/* Remounted after each failed submit so the boxes show what was typed. */}
      <fieldset
        key={state.status === 'error' ? state.attempt : 'first'}
        disabled={pending}
        className="space-y-5"
      >
        <CaseFields
          values={state.status === 'error' ? state.values : {}}
          errors={errors}
          showApplicant2Contact={false}
        />

        <div>
          <label htmlFor="slo_files" className={LABEL}>
            Upload SLO documents
          </label>
          <input
            id="slo_files"
            name="slo_files"
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create case'}
          </button>
          <Link
            href="/cases"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  )
}
