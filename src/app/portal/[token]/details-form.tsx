'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FormField } from '@/lib/portal/answers'

const BOX =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-slate-500 focus:outline-none'

/** A box with something wrong in it, matching "the boxes marked in red". */
const WRONG = 'border-red-500 bg-red-50'

/**
 * The client's Enter details button, opening the boxes for one item.
 *
 * Each box is the right kind for its answer - numbers only where a number is
 * wanted, a date picker for a date - and every answer is checked again on the
 * server when it is sent. Client-facing, so contractions are spelled out.
 */
export function DetailsForm({
  sent = false,
  token,
  requirementId,
  fields,
  initial,
}: {
  /** true once an answer has already been sent, so the button offers a change */
  sent?: boolean
  token: string
  requirementId: string
  fields: FormField[]
  initial: Record<string, string>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }))

  const shown = (field: FormField): boolean => {
    if (!field.showWhen) return true
    const parent = fields.find((f) => f.key === field.showWhen!.key)
    if (parent && !shown(parent)) return false

    const answer = values[field.showWhen.key] ?? ''

    // "at least this many" is how one age box appears per dependent.
    if (field.showWhen.atLeast !== undefined) {
      const n = Number(answer)
      return Number.isFinite(n) && answer !== '' && n >= field.showWhen.atLeast
    }

    return answer === field.showWhen.value
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setMessage(null)
    setErrors({})

    try {
      const response = await fetch(`/api/portal/${token}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requirement_id: requirementId, values }),
      })
      const result = await response.json()

      if (result.ok) {
        setOpen(false)
        router.refresh()
        return
      }
      setErrors(result.errors ?? {})
      setMessage(result.message ?? 'That did not send. Please try again.')
    } catch {
      setMessage('That did not send. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          sent
            ? 'btn-quiet mt-3 w-full px-6 py-2.5 text-sm sm:w-auto'
            : 'btn-brand mt-3 w-full px-6 py-3 text-sm sm:w-auto'
        }
      >
        {sent ? 'Change your answer' : 'Enter details'}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      {fields.filter(shown).map((field) => {
        const id = `${requirementId}-${field.key}`
        const error = errors[field.key]

        return (
          <div key={field.key}>
            {field.kind === 'select' ? (
              <>
                <label htmlFor={id} className="block text-sm font-medium text-slate-700">
                  {field.label}
                </label>
                <select
                  id={id}
                  value={values[field.key] ?? ''}
                  onChange={(event) => set(field.key, event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="" disabled>
                    Please choose
                  </option>
                  {field.options!.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            ) : field.kind === 'choice' ? (
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">{field.label}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {field.options!.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm ${
                        values[field.key] === option.value
                          ? 'border-brand bg-brand text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={id}
                        value={option.value}
                        checked={values[field.key] === option.value}
                        onChange={() => set(field.key, option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                <label htmlFor={id} className="block text-sm font-medium text-slate-700">
                  {field.label}
                </label>
                {field.kind === 'longtext' ? (
                  <textarea
                    id={id}
                    rows={4}
                    value={values[field.key] ?? ''}
                    onChange={(e) => set(field.key, e.target.value)}
                    aria-invalid={Boolean(error)}
                    className={`${BOX} ${error ? WRONG : ''}`}
                  />
                ) : (
                  <div className="relative">
                    {field.kind === 'money' && (
                      <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate-500">
                        £
                      </span>
                    )}
                    <input
                      id={id}
                      value={values[field.key] ?? ''}
                      onChange={(e) => set(field.key, e.target.value)}
                      {...inputProps(field)}
                      aria-invalid={Boolean(error)}
                      className={`${BOX} ${field.kind === 'money' ? 'pl-7' : ''} ${error ? WRONG : ''}`}
                    />
                  </div>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        )
      })}

      {message && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={sending}
          className="btn-brand px-6 py-3 text-sm"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/** The right keyboard and box for each kind of answer, especially on a phone. */
function inputProps(field: FormField): React.InputHTMLAttributes<HTMLInputElement> {
  switch (field.kind) {
    case 'money':
      return { inputMode: 'decimal', autoComplete: 'off' }
    case 'number':
      return { inputMode: 'numeric' }
    case 'sortcode':
      return { inputMode: 'numeric', placeholder: '12-34-56', autoComplete: 'off' }
    case 'account':
      return { inputMode: 'numeric', maxLength: 8, autoComplete: 'off' }
    case 'date':
      return { type: 'date' }
    case 'email':
      return { type: 'email', autoComplete: 'email' }
    case 'mobile':
      return { type: 'tel', autoComplete: 'tel' }
    default:
      return { type: 'text' }
  }
}
