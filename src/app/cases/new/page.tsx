import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentAdviser } from '@/lib/auth/supabase'
import { NewCaseForm } from './form'

export const metadata = { title: 'New case' }

export default async function NewCasePage() {
  const adviser = await currentAdviser()
  if (!adviser) redirect('/login?error=1')

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <div className="h-1 bg-brand" />
      <header className="slo-navy px-8 py-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/cases" className="text-sm text-white/70 hover:text-white">
            ← Cases
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-white">New case</h1>
          <p className="mt-1 text-sm text-white/70">
            Creates the case and its checklist from the standard second charge pack.
          </p>
        </div>
      </header>

      <section className="mx-auto mt-8 max-w-3xl px-8">
        <NewCaseForm />
      </section>
    </main>
  )
}
