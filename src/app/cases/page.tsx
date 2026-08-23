import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentAdviser } from '@/lib/auth/supabase'
import { serverClient } from '@/lib/db/client'

export const metadata = { title: 'Cases' }

type CaseRow = {
  id: string
  case_ref: string
  lender: string | null
  is_joint: boolean
  applicant_1_name: string
  created_at: string
}

export default async function CasesPage() {
  const adviser = await currentAdviser()

  // Signed in with an address that is not on the advisers list.
  if (!adviser) redirect('/login?error=1')

  // Every adviser can see every case. Holiday and sickness cover happen
  // constantly, and a case nobody can see is a case that stalls.
  //
  // Read with the secret key, server side. Row level security is on with no
  // policies, so the browser key returns an empty list rather than an error.
  const { data, error } = await serverClient()
    .from('cases')
    .select('id, case_ref, lender, is_joint, applicant_1_name, created_at')
    .order('created_at', { ascending: false })

  const cases = (data ?? []) as CaseRow[]

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <header className="mx-auto flex max-w-5xl items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as {adviser.name}, {adviser.firm}
          </p>
        </div>
        <Link
          href="/cases/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New case
        </Link>
      </header>

      <section className="mx-auto mt-8 max-w-5xl rounded-xl border border-slate-200 bg-white">
        {error && (
          <p role="alert" className="p-8 text-sm text-red-700">
            The case list could not be loaded: {error.message}
          </p>
        )}

        {!error && cases.length === 0 && (
          <p className="p-8 text-slate-600">
            No cases yet. Create one from the standard pack to get started.
          </p>
        )}

        {!error && cases.length > 0 && (
          <ul className="divide-y divide-slate-200">
            {cases.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-4 p-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {row.applicant_1_name}
                    {row.is_joint && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                        joint
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    {row.case_ref}
                    {row.lender && ` · ${row.lender}`}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(row.created_at).toLocaleDateString('en-GB')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mx-auto mt-4 max-w-5xl text-xs text-slate-400">
        Red, amber and green status and the single case view are the next thing being built.
      </p>
    </main>
  )
}
