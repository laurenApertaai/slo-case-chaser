'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * The client saying how they are paid.
 *
 * It sits on their own income evidence item rather than at the top of the page,
 * because on a joint application the two of them can be paid differently and
 * one answer for the whole case would put the wrong request in front of one.
 *
 * Every word here is read by a client, so contractions are spelled out in full.
 */

const OPTIONS = [
  { value: 'employed_monthly', label: 'Employed, paid monthly' },
  { value: 'employed_4weekly', label: 'Employed, paid every 4 weeks' },
  { value: 'employed_fortnightly', label: 'Employed, paid fortnightly' },
  { value: 'employed_weekly', label: 'Employed, paid weekly' },
  { value: 'self_employed', label: 'Self employed' },
]

export function PayFrequency({
  token,
  requirementId,
  current,
}: {
  token: string
  requirementId: string
  current: string | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(value: string) {
    if (!value || value === current) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/portal/${token}/employment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requirement_id: requirementId, employment_type: value }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(body.message ?? 'That did not save. Please try again.')
        return
      }

      // The item retitles itself and the file count changes, so the whole list
      // is read again rather than patched in the browser.
      router.refresh()
    } catch {
      setError('That did not save. Please check your signal and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label
        htmlFor={`pay-${requirementId}`}
        className="block text-sm font-medium text-slate-700"
      >
        How are you paid?
      </label>
      <p className="mt-0.5 text-xs text-slate-500">
        Telling us this changes what we need from you, so please answer it first.
      </p>

      <select
        id={`pay-${requirementId}`}
        defaultValue={current ?? ''}
        disabled={saving}
        onChange={(event) => choose(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
      >
        <option value="" disabled>
          Please choose
        </option>
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {saving && <p className="mt-2 text-xs text-slate-500">Saving…</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
