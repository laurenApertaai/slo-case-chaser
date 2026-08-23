'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createCaseAction, type NewCaseState } from './actions'
import { PortalLink } from '../portal-link'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none'
const LABEL = 'block text-sm font-medium text-slate-700'

function Field({
  name,
  label,
  hint,
  errors,
  children,
}: {
  name: string
  label: string
  hint?: string
  errors: Record<string, string>
  children: React.ReactNode
}) {
  const error = errors[name]

  return (
    <div>
      <label htmlFor={name} className={LABEL}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function NewCaseForm() {
  const [state, formAction, pending] = useActionState<NewCaseState, FormData>(createCaseAction, {
    status: 'idle',
  })

  if (state.status === 'created') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Case {state.caseRef} created
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {state.itemCount} items are on the client checklist, all outstanding. The pack has not
          been sent yet.
        </p>

        <div className="mt-6">
          <p className={`${LABEL} mb-1`}>The client portal link</p>
          <PortalLink
            url={state.portalUrl}
            note="This is the secret link. It expires in 90 days. Sending it is part of issuing the pack, which is built in a later phase. It is also kept on the case page, so it is not lost if you navigate away."
          />
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/cases/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create another
          </Link>
          <Link
            href="/cases"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to cases
          </Link>
        </div>
      </div>
    )
  }

  const errors = state.status === 'error' ? state.errors : {}
  const message = state.status === 'error' ? state.message : undefined

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-8">
      {message && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="case_ref" label="Case reference" errors={errors}>
            <input id="case_ref" name="case_ref" required className={FIELD} />
          </Field>

          <Field name="lender" label="Lender" hint="Optional" errors={errors}>
            <input id="lender" name="lender" className={FIELD} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="loan_amount"
            label="Loan amount"
            hint="Optional. Appears in the question about what the money is for."
            errors={errors}
          >
            <input id="loan_amount" name="loan_amount" inputMode="decimal" className={FIELD} />
          </Field>

          <Field
            name="employment_type"
            label="How the client is paid"
            hint="Leave blank and the client picks this themselves in the portal."
            errors={errors}
          >
            <select id="employment_type" name="employment_type" defaultValue="" className={FIELD}>
              <option value="">Not known yet</option>
              <option value="employed_monthly">Employed, paid monthly</option>
              <option value="employed_4weekly">Employed, paid 4 weekly</option>
              <option value="employed_fortnightly">Employed, paid fortnightly</option>
              <option value="employed_weekly">Employed, paid weekly</option>
              <option value="self_employed">Self employed</option>
            </select>
          </Field>
        </div>

        <hr className="border-slate-200" />

        <Field name="applicant_1_name" label="Client name" errors={errors}>
          <input id="applicant_1_name" name="applicant_1_name" required className={FIELD} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="applicant_1_email" label="Email address" errors={errors}>
            <input
              id="applicant_1_email"
              name="applicant_1_email"
              type="email"
              required
              className={FIELD}
            />
          </Field>

          <Field
            name="applicant_1_mobile"
            label="Mobile number"
            hint="UK mobile. Chasers go out by text as well as email."
            errors={errors}
          >
            <input
              id="applicant_1_mobile"
              name="applicant_1_mobile"
              type="tel"
              required
              className={FIELD}
            />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-md bg-slate-50 p-4">
          <input
            type="checkbox"
            name="is_joint"
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            Joint application
            <span className="mt-0.5 block text-xs text-slate-500">
              The second applicant&rsquo;s items are added straight away, so the client sees
              everything needed for both from the start. Their email and mobile are one of the
              items, not something you type here.
            </span>
          </span>
        </label>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create case'}
          </button>
          <Link
            href="/cases"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  )
}
