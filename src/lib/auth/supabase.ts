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
import { serverClient } from '@/lib/db/client'

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
 * Two different clients on purpose. The publishable-key client establishes
 * *who* is asking, because only it carries the session. The lookup itself then
 * uses the secret-key client, because row level security is switched on for
 * every table with no policies, so a browser-key read returns nothing at all.
 *
 * Reading the row with the session client instead is the bug this comment
 * exists to prevent: the login succeeds, the page loads, and the adviser is
 * silently bounced back to the login screen with no useful error.
 */
export async function currentAdviser() {
  const supabase = await authClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const { data } = await serverClient()
    .from('advisers')
    .select('id, name, email, firm')
    .eq('email', user.email)
    .maybeSingle()

  return data ?? null
}
