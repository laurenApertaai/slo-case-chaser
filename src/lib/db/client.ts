import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client.
 *
 * Server-side only. The client portal is reached by token rather than by an
 * authenticated user, so every portal read and write goes through a server
 * route that validates the token first and then uses this client.
 *
 * Never import this into a client component.
 */
export function serverClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

  return createClient(url, key, { auth: { persistSession: false } })
}
