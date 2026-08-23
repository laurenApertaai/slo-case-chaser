import { NextResponse } from 'next/server'
import { resolvePortal } from '@/lib/portal/resolve'

/**
 * What the client's portal can read.
 *
 * The portal never talks to the database directly. Access is by token rather
 * than by a logged-in user, so every portal read goes through here: the token is
 * validated first, then the secret-key client does the work.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const result = await resolvePortal(token)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      // A secret link is not a public page. Nothing about it should be cached
      // or indexed anywhere between here and the client's phone.
      { status: result.status, headers: { 'cache-control': 'no-store' } },
    )
  }

  return NextResponse.json(result.view, { headers: { 'cache-control': 'no-store' } })
}
