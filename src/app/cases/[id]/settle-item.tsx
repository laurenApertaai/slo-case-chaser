'use client'

import { useActionState, useState } from 'react'
import { settleRequirementAction, type SettleState } from './actions'

/**
 * Taking one item off the client's list.
 *
 * Two buttons, because the two reasons are genuinely different and recording
 * the wrong one puts a wrong answer on the sign-off record. Neither deletes
 * anything.
 */
export function SettleItem({
  caseId,
  requirementId,
  label,
}: {
  caseId: string
  requirementId: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<SettleState, FormData>(
    settleRequirementAction,
    { status: 'idle' },
  )

  if (state.status === 'settled') {
    return (
      <p className="mt-2 text-xs text-green-700">
        {state.outcome === 'accepted' ? 'Marked as received.' : 'Waived.'} It has come off the
        client list.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800"
      >
        Take this off the list
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

      <p className="text-xs font-medium text-slate-700">{label}</p>

      <fieldset disabled={pending} className="mt-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            name="action"
            value="already_have"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            We already have it
          </button>
          <select
            name="received_via"
            defaultValue="email"
            aria-label="How it reached you"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900"
          >
            <option value="email">by email</option>
            <option value="post">by post</option>
            <option value="in_person">in person</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            name="action"
            value="not_applicable"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Does not apply to this case
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Nothing is deleted. The first records that it arrived outside the portal, the second that
          it was not needed. Both stay on the case record.
        </p>
      </fieldset>
    </form>
  )
}
