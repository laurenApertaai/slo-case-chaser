/**
 * Which routes need an adviser to be logged in.
 *
 * Kept as pure functions so the rules can be tested without spinning up a
 * browser or a server. The middleware is a thin wrapper around these.
 */

/** Routes a client reaches by token, with no login. Never guarded. */
const PUBLIC_PREFIXES = ['/portal', '/login', '/auth']

/** Machine endpoints. Guarded by a shared secret header, not by a session. */
const MACHINE_PREFIXES = ['/api/cron']

/** Next.js internals and static assets. */
const INFRASTRUCTURE_PREFIXES = ['/_next', '/favicon', '/robots.txt', '/sitemap.xml']

export function isPublicRoute(pathname: string): boolean {
  return [...PUBLIC_PREFIXES, ...MACHINE_PREFIXES, ...INFRASTRUCTURE_PREFIXES].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * True when a request must carry a logged-in adviser session.
 *
 * Anything not explicitly public is guarded. New adviser pages are therefore
 * protected by default, which is the safe way round: forgetting to add a route
 * here locks it down rather than exposing it.
 */
export function requiresAuth(pathname: string): boolean {
  return !isPublicRoute(pathname)
}

/**
 * Where to send someone who is not logged in. Carries the page they wanted so
 * they land back on it after signing in.
 */
export function loginRedirect(pathname: string): string {
  if (pathname === '/' || pathname === '/login') return '/login'
  return `/login?next=${encodeURIComponent(pathname)}`
}

/**
 * Validates the `next` parameter before redirecting to it after login.
 *
 * Only same-site paths are allowed. Without this, a crafted link could bounce
 * an adviser to another website straight after they sign in.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/cases'
  if (!next.startsWith('/')) return '/cases'
  if (next.startsWith('//')) return '/cases'
  if (next.startsWith('/login')) return '/cases'
  return next
}
