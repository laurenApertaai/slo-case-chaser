import { redirect } from 'next/navigation'
import { currentAdviser } from '@/lib/auth/supabase'

export const metadata = { title: 'Cases' }

export default async function CasesPage() {
  const adviser = await currentAdviser()

  // Signed in with an address that is not on the advisers list.
  if (!adviser) redirect('/login?error=1')

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <header className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed in as {adviser.name}, {adviser.firm}
        </p>
      </header>

      <section className="mx-auto mt-8 max-w-5xl rounded-xl border border-slate-200 bg-white p-8">
        <p className="text-slate-600">
          No cases yet. Creating a case from the standard pack is the next thing being built.
        </p>
      </section>
    </main>
  )
}
