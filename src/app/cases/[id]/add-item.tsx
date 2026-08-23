'use client'

import { useActionState, useState } from 'react'
import { addExtraItemAction, type ExtraItemState } from './actions'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none'
const LABEL = 'block text-sm font-medium text-slate-700'

export function AddItem({ caseId, isJoint }: { caseId: string; isJoint: boolean }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ExtraItemState, FormData>(
    addExtraItemAction,
    { status: 'idle' },
  )

  if (!open) {
    return (
      <div className="p-4">
        <button
          onClick={() => setOpen(true)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Add another item
        </button>
        {state.status === 'added' && (
          <span className="ml-3 text-sm text-green-700">
            &ldquo;{state.label}&rdquo; added to the list.
          </span>
        )}
      </div>
    )
  }

  const errors = state.status === 'error' ? state.errors : {}

  return (
    <form action={formAction} className="border-t border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="case_id" value={caseId} />

      {state.status === 'error' && state.message && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <fieldset disabled={pending} className="space-y-4">
        <div>
          <label htmlFor="label" className={LABEL}>
            What do you need?
          </label>
          <input id="label" name="label" required className={FIELD} placeholder="Proof of address" />
          {errors.label && (
            <p role="alert" className="mt-1 text-xs text-red-700">
              {errors.label}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="description" className={LABEL}>
            Anything else the client should know
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            className={FIELD}
            placeholder="A utility bill or council tax bill from the last three months."
          />
          <p className="mt-1 text-xs text-slate-500">
            Optional. The client reads both of these, so spell contractions out in full.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="applicant" className={LABEL}>
              Who is it for?
            </label>
            <select id="applicant" name="applicant" defaultValue="joint" className={FIELD}>
              <option value="joint">The case as a whole</option>
              <option value="applicant_1">Applicant 1</option>
              {isJoint && <option value="applicant_2">Applicant 2</option>}
            </select>
            {errors.applicant && (
              <p role="alert" className="mt-1 text-xs text-red-700">
                {errors.applicant}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="is_mandatory"
              defaultChecked
              className="h-4 w-4 rounded border-slate-300"
            />
            Mandatory
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? 'Adding…' : 'Add to the list'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Adding an item does not restart the chase clock. It joins the next scheduled chaser.
        </p>
      </fieldset>
    </form>
  )
}
