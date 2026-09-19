'use client'

import { useState, useTransition } from 'react'
import type { FormField } from '@/lib/portal/answers'
import type { CaseUpload } from '@/lib/cases/load'
import { revealBankDetailsAction, type RevealState } from './actions'

/** What the client has sent for one item: their files, their typed answers. */
export function Received({
  caseId,
  templateKey,
  uploads,
  answers,
  fields,
  bankLast4,
}: {
  caseId: string
  templateKey: string | null
  uploads: CaseUpload[]
  answers: Record<string, string>
  fields: FormField[] | null
  bankLast4: string | null
}) {
  const hasAnswers = fields && fields.some((f) => answers[f.key])
  const isBank = templateKey === 'bank_details'

  if (uploads.length === 0 && !hasAnswers && !(isBank && bankLast4)) return null

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">From the client</p>

      {uploads.length > 0 && (
        <ul className="mt-2 space-y-1">
          {uploads.map((u) => (
            <li key={u.id} className="flex flex-wrap items-baseline gap-x-2">
              <a
                href={`/cases/${caseId}/files/${u.id}`}
                className="font-medium text-slate-800 underline underline-offset-2"
              >
                {u.original_filename}
              </a>
              <span className="text-xs text-slate-500">
                {u.page_count && u.page_count > 1 ? `${u.page_count} pages · ` : ''}
                {new Date(u.uploaded_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasAnswers && !isBank && (
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
          {fields!
            .filter((f) => answers[f.key])
            .map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-slate-500">{f.label}</dt>
                <dd className="text-slate-900">{display(f, answers[f.key])}</dd>
              </div>
            ))}
        </dl>
      )}

      {isBank && bankLast4 && <BankDetails caseId={caseId} last4={bankLast4} />}
    </div>
  )
}

function display(field: FormField, value: string): string {
  if (field.kind === 'choice') return field.options?.find((o) => o.value === value)?.label ?? value
  if (field.kind === 'money') return `£${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
  if (field.kind === 'date') return new Date(value).toLocaleDateString('en-GB')
  return value
}

/** Masked until asked for; every look is recorded against the adviser. */
function BankDetails({ caseId, last4 }: { caseId: string; last4: string }) {
  const [state, setState] = useState<RevealState>({ status: 'idle' })
  const [pending, start] = useTransition()

  if (state.status === 'shown') {
    const d = state.details
    return (
      <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-slate-500">Name on Account</dt>
        <dd className="text-slate-900">{d.account_name}</dd>
        <dt className="text-slate-500">Account number</dt>
        <dd className="font-mono text-slate-900">{d.account_number}</dd>
        <dt className="text-slate-500">Sort Code</dt>
        <dd className="font-mono text-slate-900">{d.sort_code.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3')}</dd>
        <dt className="text-slate-500">Bank name</dt>
        <dd className="text-slate-900">{d.bank_name}</dd>
      </dl>
    )
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <span className="font-mono text-slate-900">Account •••• {last4}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await revealBankDetailsAction(caseId)))}
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        {pending ? 'Opening…' : 'Show full bank details'}
      </button>
      {state.status === 'error' && <span className="text-xs text-red-700">{state.message}</span>}
    </div>
  )
}
