'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * What the client has sent against one item, with a way to take one back.
 *
 * Clients send the wrong photo constantly, and until now the only way out was
 * to ring up. Removing one marks it withdrawn rather than deleting it: nobody
 * loses the right document by tapping the wrong line, and the record still
 * shows it was sent and taken back.
 *
 * Client-facing, so contractions are spelled out in full.
 */
export function SentFiles({
  token,
  requirementId,
  files,
}: {
  token: string
  requirementId: string
  files: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (files.length === 0) return null

  async function remove(id: string) {
    setBusy(id)
    setError(null)

    try {
      const response = await fetch(
        `/api/portal/${token}/upload/${id}?requirement=${requirementId}`,
        { method: 'DELETE' },
      )
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(body.message ?? 'That did not work. Please try again.')
        return
      }

      router.refresh()
    } catch {
      setError('That did not work. Please check your signal and try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-slate-700">You have sent</p>
      <ul className="mt-1 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-3 p-2.5 text-sm">
            <span className="truncate text-slate-700">{file.name}</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => remove(file.id)}
              className="shrink-0 text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-red-700 disabled:opacity-60"
            >
              {busy === file.id ? 'Removing…' : 'Remove'}
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
