import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentAdviser } from '@/lib/auth/supabase'
import { NewCaseForm } from './form'

export const metadata = { title: 'New case' }

export default async function NewCasePage() {
  const adviser = await currentAdviser()
  if (!adviser) redirect('/login?error=1')

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <header className="mx-auto max-w-3xl">
        <Link href="/cases" className="text-sm text-slate-500 hover:text-slate-700">
          ← Cases
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">New case</h1>
        <p className="mt-1 text-sm text-slate-500">
          Creates the case and its checklist from the standard second charge pack.
        </p>
      </header>

      <section className="mx-auto mt-8 max-w-3xl">
        <NewCaseForm />
      </section>
    </main>
  )
}
