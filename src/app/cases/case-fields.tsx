'use client'

import { useState } from 'react'

/**
 * The boxes for a case's details, shared by the new case form and the edit
 * form so the two can never drift apart.
 *
 * Every box takes its starting value from `values`. After a failed submit the
 * action hands back what was typed, so a mistake in one box never wipes the
 * rest of the form.
 */

export type CaseValues = Record<string, string>

export const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none'
export const LABEL = 'block text-sm font-medium text-slate-700'

function Field({
  name,
  label,
  errors,
  children,
}: {
  name: string
  label: string
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
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * First, middle and surname as three boxes, because lenders take them
 * separately and a missing middle name is a mismatch against the applicant's ID.
 */
function NameFields({
  prefix,
  values,
  errors,
}: {
  prefix: 'applicant_1' | 'applicant_2'
  values: CaseValues
  errors: Record<string, string>
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Field name={`${prefix}_first_name`} label="First name" errors={errors}>
        <input
          id={`${prefix}_first_name`}
          name={`${prefix}_first_name`}
          defaultValue={values[`${prefix}_first_name`]}
          required
          className={FIELD}
        />
      </Field>

      <div>
        <label htmlFor={`${prefix}_middle_name`} className={LABEL}>
          Middle name(s)
        </label>
        <input
          id={`${prefix}_middle_name`}
          name={`${prefix}_middle_name`}
          defaultValue={values[`${prefix}_middle_name`]}
          className={FIELD}
        />
        <p className="mt-1 text-xs font-medium text-red-700">
          MUST be added if they have a middle name
        </p>
      </div>

      <Field name={`${prefix}_surname`} label="Surname" errors={errors}>
        <input
          id={`${prefix}_surname`}
          name={`${prefix}_surname`}
          defaultValue={values[`${prefix}_surname`]}
          required
          className={FIELD}
        />
      </Field>
    </div>
  )
}

export function CaseFields({
  values,
  errors,
  showApplicant2Contact,
}: {
  values: CaseValues
  errors: Record<string, string>
  /** the edit form lets the adviser add these once known; the new case form does not ask */
  showApplicant2Contact: boolean
}) {
  const [isJoint, setIsJoint] = useState(values.is_joint === 'on')

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="case_ref" label="Case reference" errors={errors}>
          <input id="case_ref" name="case_ref" defaultValue={values.case_ref} required className={FIELD} />
        </Field>

        <Field name="lender" label="Lender" errors={errors}>
          <input id="lender" name="lender" defaultValue={values.lender} className={FIELD} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="loan_amount" label="Loan amount" errors={errors}>
          <input
            id="loan_amount"
            name="loan_amount"
            inputMode="decimal"
            defaultValue={values.loan_amount}
            required
            className={FIELD}
          />
        </Field>

        <Field name="home_improvement_amount" label="Amount of HI (if any)" errors={errors}>
          <input
            id="home_improvement_amount"
            name="home_improvement_amount"
            inputMode="decimal"
            defaultValue={values.home_improvement_amount}
            className={FIELD}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="loan_purpose" label="Loan purpose" errors={errors}>
          <input
            id="loan_purpose"
            name="loan_purpose"
            defaultValue={values.loan_purpose}
            className={FIELD}
          />
        </Field>

        <Field name="employment_type" label="How the client is paid" errors={errors}>
          <select
            id="employment_type"
            name="employment_type"
            defaultValue={values.employment_type ?? ''}
            className={FIELD}
          >
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

      <NameFields prefix="applicant_1" values={values} errors={errors} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="applicant_1_email" label="Email address" errors={errors}>
          <input
            id="applicant_1_email"
            name="applicant_1_email"
            type="email"
            defaultValue={values.applicant_1_email}
            required
            className={FIELD}
          />
        </Field>

        <Field name="applicant_1_mobile" label="Mobile number" errors={errors}>
          <input
            id="applicant_1_mobile"
            name="applicant_1_mobile"
            type="tel"
            defaultValue={values.applicant_1_mobile}
            required
            className={FIELD}
          />
        </Field>
      </div>

      <div className="rounded-md bg-slate-50 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="is_joint"
            checked={isJoint}
            onChange={(event) => setIsJoint(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Joint application</span>
        </label>

        {isJoint && (
          <div className="mt-4 space-y-5 border-t border-slate-200 pt-4">
            <p className="text-sm font-medium text-slate-700">Second applicant</p>

            <NameFields prefix="applicant_2" values={values} errors={errors} />

            {showApplicant2Contact && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="applicant_2_email" label="Email address" errors={errors}>
                  <input
                    id="applicant_2_email"
                    name="applicant_2_email"
                    type="email"
                    defaultValue={values.applicant_2_email}
                    className={FIELD}
                  />
                </Field>

                <Field name="applicant_2_mobile" label="Mobile number" errors={errors}>
                  <input
                    id="applicant_2_mobile"
                    name="applicant_2_mobile"
                    type="tel"
                    defaultValue={values.applicant_2_mobile}
                    className={FIELD}
                  />
                </Field>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
