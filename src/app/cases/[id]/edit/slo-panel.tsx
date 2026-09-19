'use client'

import { useActionState, useTransition } from 'react'
import { attachSloAction, removeSloAction, type SloState } from './slo-actions'

/** The SLO documents the client downloads: see them, add more, swap or remove one. */
export function SloPanel({ caseId, files }: { caseId: string; files: { name: string; size: number }[] }) {
  const [state, formAction, pending] = useActionState<SloState, FormData>(
    attachSloAction.bind(null, caseId),
    { status: 'idle' },
  )
  const [removing, startRemoving] = useTransition()

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8">
      <h2 className="text-lg font-semibold text-slate-900">SLO documents</h2>

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

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          name="slo_files"
          type="file"
          multiple
          accept="application/pdf,image/*"
          aria-label="Upload SLO documents"
          className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
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
