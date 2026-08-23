import { redirect } from 'next/navigation'
import { authClient } from '@/lib/auth/supabase'
import { safeNextPath } from '@/lib/auth/routes'

export const metadata = { title: 'Sign in' }

async function signIn(formData: FormData) {
  'use server'

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNextPath(String(formData.get('next') ?? ''))

  const supabase = await authClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error(`[login] failed for "${email}": ${error.message}`)
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`)
  }

  console.log(`[login] success for "${email}", session ${data.session ? 'created' : 'MISSING'}`)
  redirect(next)
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  const next = safeNextPath(params.next)
  const failed = params.error === '1'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Secured Lending Options</h1>
        <p className="mt-1 text-sm text-slate-500">Case document chaser</p>

        {failed && (
          <p
            role="alert"
            className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700"
          >
            That email address and password did not match. Please try again.
          </p>
        )}

        <form action={signIn} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}
