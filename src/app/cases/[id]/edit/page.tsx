import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { currentAdviser } from '@/lib/auth/supabase'
import { serverClient } from '@/lib/db/client'
import { CASE_ROW_FIELDS, caseRowToValues, type CaseRow } from '@/lib/cases/update'
import { EditCaseForm } from './form'

export const metadata = { title: 'Edit case' }
export const dynamic = 'force-dynamic'

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  const adviser = await currentAdviser()
  if (!adviser) redirect('/login?error=1')

  const { id } = await params

  const { data, error } = await serverClient()
    .from('cases')
    .select(CASE_ROW_FIELDS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) notFound()

  const row = data as unknown as CaseRow

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <header className="mx-auto max-w-3xl">
        <Link href={`/cases/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to the case
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Edit case {row.case_ref}</h1>
      </header>

      <section className="mx-auto mt-8 max-w-3xl">
        <EditCaseForm caseId={id} initial={caseRowToValues(row)} />
      </section>
    </main>
  )
}
