/**
 * Supabase clients for the adviser login.
 *
 * These use the publishable key, never the secret one. The secret key lives
 * only in `src/lib/db/client.ts` and is used for trusted server work such as
 * portal routes and scheduled jobs.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

function credentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set')
  return { url, key }
}

/** For server components and route handlers. */
export async function authClient() {
  const { url, key } = credentials()
  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a server component, where cookies cannot be written.
          // The middleware refreshes the session instead, so this is safe.
        }
      },
    },
  })
}

/** For the middleware, which must write refreshed cookies onto the response. */
export function middlewareClient(request: NextRequest, response: NextResponse) {
  const { url, key } = credentials()

  return createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
}

/**
 * The logged-in adviser's own record, or null.
 *
 * Auth identity and the adviser record are joined on email address, so a
 * login only works for an address that appears in the advisers table.
 */
export async function currentAdviser() {
  const supabase = await authClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const { data } = await supabase
    .from('advisers')
    .select('id, name, email, firm')
    .eq('email', user.email)
    .maybeSingle()

  return data ?? null
}
