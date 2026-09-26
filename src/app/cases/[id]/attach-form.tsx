'use client'

import { useActionState, useRef, useTransition } from 'react'
import { attachFormAction, removeFormAction, type FormState } from './actions'

/**
 * A form the adviser needs signed, attached to one item on the client's list.
 *
 * Uploaded from the adviser's own machine. The client gets a Download button on
 * that item and sends the signed copy back in the same place, so it is chased
 * like anything else rather than sitting in a pile nobody is watching.
 */
export function AttachForm({
  caseId,
  requirementId,
  files,
}: {
  caseId: string
  requirementId: string
  files: { name: string; size: number }[]
}) {
  const input = useRef<HTMLInputElement>(null)
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    attachFormAction.bind(null, caseId, requirementId),
    { status: 'idle' },
  )
  const [removing, startRemoving] = useTransition()

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-700">
        Forms for the client to sign
      </p>

      {files.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {files.map((file) => (
            <li key={file.name} className="flex items-center justify-between gap-3 p-2 text-xs">
              <a
                href={`/cases/${caseId}/form/${requirementId}/${encodeURIComponent(file.name)}`}
                className="truncate font-medium text-slate-800 underline underline-offset-2"
              >
                {file.name}
              </a>
              <button
                type="button"
                disabled={removing}
                onClick={() =>
                  startRemoving(() => {
                    removeFormAction(caseId, requirementId, file.name)
                  })
                }
                className="shrink-0 text-slate-500 underline underline-offset-2 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-2">
        <input
          ref={input}
          type="file"
          name="files"
          multiple
          className="hidden"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="btn-quiet px-4 py-2 text-xs disabled:opacity-60"
        >
          {pending ? 'Attaching…' : files.length > 0 ? 'Attach another' : 'Attach a form'}
        </button>
      </form>

      {state.status === 'error' && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {state.message}
        </p>
      )}
      {state.status === 'attached' && (
        <p className="mt-2 text-xs text-green-700">
          Attached. The client can download {state.names.length === 1 ? 'it' : 'them'} now.
        </p>
      )}
    </div>
  )
}
