'use client'

import { useActionState, useState } from 'react'
import { rewordRequirementAction, type WordingState } from './actions'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none'

/** Changes the wording of one item. The client reads exactly what is saved. */
export function RewordItem({
  caseId,
  requirementId,
  label,
  description,
}: {
  caseId: string
  requirementId: string
  label: string
  description: string | null
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<WordingState, FormData>(
    async (previous, formData) => {
      const result = await rewordRequirementAction(previous, formData)
      // Close once saved; the page reloads the item with its new wording.
      if (result.status === 'saved') setOpen(false)
      return result
    },
    { status: 'idle' },
  )

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 mr-4 text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800"
      >
        Edit wording
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="requirement_id" value={requirementId} />

      {state.status === 'error' && (
        <p role="alert" className="mb-2 text-xs text-red-700">
          {state.message}
        </p>
      )}

      <fieldset disabled={pending} className="space-y-3">
        <div>
          <label htmlFor={`label-${requirementId}`} className="block text-xs font-medium text-slate-700">
            Item
          </label>
          <input
            id={`label-${requirementId}`}
            name="label"
            defaultValue={label}
            required
            className={FIELD}
          />
        </div>

        <div>
          <label
            htmlFor={`description-${requirementId}`}
            className="block text-xs font-medium text-slate-700"
          >
            What the client is told
          </label>
          <textarea
            id={`description-${requirementId}`}
            name="description"
            defaultValue={description ?? ''}
            rows={3}
            className={FIELD}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="btn-brand px-4 py-2 text-xs"
          >
            {pending ? 'Saving…' : 'Save wording'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}
