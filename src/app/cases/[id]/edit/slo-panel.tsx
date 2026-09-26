'use client'

import { useActionState, useRef, useTransition } from 'react'
import { attachSloAction, removeSloAction, type SloState } from './slo-actions'

/** The SLO documents the client downloads: see them, add more, swap or remove one. */
export function SloPanel({
  caseId,
  files,
  compact = false,
}: {
  caseId: string
  files: { name: string; size: number }[]
  /** true when it sits inside the item on the case page rather than alone */
  compact?: boolean
}) {
  const [state, formAction, pending] = useActionState<SloState, FormData>(
    attachSloAction.bind(null, caseId),
    { status: 'idle' },
  )
  const [removing, startRemoving] = useTransition()
  const input = useRef<HTMLInputElement>(null)

  return (
    <section
      className={
        compact
          ? 'mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3'
          : 'rounded-xl border border-slate-200 bg-white p-8'
      }
    >
      <h2 className={compact ? 'text-xs font-medium text-slate-700' : 'text-lg font-semibold text-slate-900'}>
        SLO documents for the client to sign
      </h2>

      {files.length === 0 ? (
        <p className="mt-2 text-sm text-amber-800">
          None attached yet. The client cannot download anything until one is.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200">
          {files.map((file) => (
            <li key={file.name} className="flex items-center justify-between gap-3 p-3 text-sm">
              <a
                href={`/cases/${caseId}/slo/${encodeURIComponent(file.name)}`}
                className="truncate font-medium text-slate-800 underline underline-offset-2"
              >
                {file.name}
              </a>
              <button
                type="button"
                disabled={removing}
                onClick={() => startRemoving(() => removeSloAction(caseId, file.name))}
                className="shrink-0 text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-4">
        {/* The picker opens from the button. A bare file input shows "No file
            chosen" next to it, which reads like something has gone wrong. */}
        <input
          ref={input}
          name="slo_files"
          type="file"
          multiple
          accept="application/pdf,image/*"
          aria-label="Upload SLO documents"
          className="hidden"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="btn-brand px-5 py-2.5 text-sm disabled:opacity-60"
        >
          {pending ? 'Uploading…' : 'Upload SLO documents'}
        </button>
      </form>

      {state.status !== 'idle' && (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`mt-2 text-sm ${state.status === 'error' ? 'text-red-700' : 'text-green-800'}`}
        >
          {state.message}
        </p>
      )}
    </section>
  )
}
