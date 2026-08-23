import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentAdviser } from '@/lib/auth/supabase'
import { listCases } from '@/lib/cases/load'
import { StatusBadge } from './status-badge'

export const metadata = { title: 'Cases' }

// The case list is a live picture of what needs doing. Caching it would show an
// adviser a document as outstanding after the client has already sent it.
export const dynamic = 'force-dynamic'

function money(amount: number | null): string {
  if (amount === null) return ''
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>
}) {
  const adviser = await currentAdviser()

  // Signed in with an address that is not on the advisers list.
  if (!adviser) redirect('/login?error=1')

  const params = await searchParams
  const showAll = params.all === '1'

  const everything = await listCases()

  // Defaults to your own cases, but the filter clears. Holiday and sickness
  // cover happen constantly, and a case nobody can see is a case that stalls.
  const cases = showAll ? everything : everything.filter((c) => c.adviser_id === adviser.id)
  const othersCount = everything.length - cases.length

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

      <div className="mx-auto mt-6 flex max-w-5xl items-center gap-4 text-sm">
        <Link
          href="/cases"
          className={showAll ? 'text-slate-500 hover:text-slate-700' : 'font-medium text-slate-900'}
        >
          My cases
        </Link>
        <Link
          href="/cases?all=1"
          className={showAll ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-700'}
        >
          Everyone&rsquo;s cases
          {!showAll && othersCount > 0 && (
            <span className="ml-1 text-slate-400">({othersCount} more)</span>
          )}
        </Link>
      </div>

      <section className="mx-auto mt-4 max-w-5xl rounded-xl border border-slate-200 bg-white">
        {cases.length === 0 ? (
          <p className="p-8 text-slate-600">
            {showAll
              ? 'No cases yet. Create one from the standard pack to get started.'
              : 'None of your own. Try everyone’s cases, or create one.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {cases.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/cases/${row.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {row.applicant_1_name}
                      {row.is_joint && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                          joint
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {row.case_ref}
                      {row.lender && ` · ${row.lender}`}
                      {row.loan_amount !== null && ` · ${money(row.loan_amount)}`}
                      {showAll && row.adviser_name && ` · ${row.adviser_name}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <p className="hidden text-sm text-slate-500 sm:block">
                      {row.progress.accepted} of {row.progress.total} in
                    </p>
                    <StatusBadge colour={row.progress.colour} label={row.progress.label} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
