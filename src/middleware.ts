import { NextResponse, type NextRequest } from 'next/server'
import { middlewareClient } from '@/lib/auth/supabase'
import { requiresAuth, loginRedirect } from '@/lib/auth/routes'

/**
 * Keeps the adviser session fresh and locks anything that is not explicitly
 * public. The rules themselves live in `lib/auth/routes.ts` so they can be
 * tested without a browser.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  if (!requiresAuth(pathname)) return response

  const supabase = middlewareClient(request, response)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    const target = loginRedirect(pathname)
    url.pathname = target.split('?')[0]
    url.search = target.includes('?') ? target.slice(target.indexOf('?')) : ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
