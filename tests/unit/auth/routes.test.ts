import { describe, it, expect } from 'vitest'
import { requiresAuth, isPublicRoute, loginRedirect, safeNextPath } from '@/lib/auth/routes'

describe('route guarding', () => {
  it('guards the adviser dashboard', () => {
    expect(requiresAuth('/cases')).toBe(true)
    expect(requiresAuth('/cases/abc-123')).toBe(true)
    expect(requiresAuth('/review')).toBe(true)
  })

  it('leaves the client portal open, because clients have no login', () => {
    expect(requiresAuth('/portal/some-long-token')).toBe(false)
    expect(isPublicRoute('/portal/some-long-token')).toBe(true)
  })

  it('leaves the portal API open too, or the portal page cannot do anything', () => {
    // The page and the routes it calls have to be open together. Guarding the
    // API by session would bounce the client to an adviser login screen the
    // moment they tried to answer a question or send a file.
    expect(requiresAuth('/api/portal/some-long-token')).toBe(false)
    expect(requiresAuth('/api/portal/some-long-token/upload')).toBe(false)
    expect(requiresAuth('/api/portal/some-long-token/answer')).toBe(false)
  })

  it('leaves the login page open', () => {
    expect(requiresAuth('/login')).toBe(false)
  })

  it('leaves the scheduled endpoints open to the guard, since they use a secret header', () => {
    expect(requiresAuth('/api/cron/chase')).toBe(false)
  })

  it('guards any new adviser route by default', () => {
    // The safe way round: a route nobody remembered to list is locked, not open.
    expect(requiresAuth('/some-page-invented-next-year')).toBe(true)
  })

  it('does not treat a lookalike prefix as public', () => {
    // "/portalx" must not inherit "/portal" permissions.
    expect(requiresAuth('/portalx')).toBe(true)
    expect(requiresAuth('/api/portalx')).toBe(true)
    expect(requiresAuth('/loginsomething')).toBe(true)
  })
})

describe('loginRedirect', () => {
  it('remembers the page the adviser was trying to reach', () => {
    expect(loginRedirect('/cases/abc-123')).toBe('/login?next=%2Fcases%2Fabc-123')
  })

  it('does not add a next parameter for the home page', () => {
    expect(loginRedirect('/')).toBe('/login')
  })
})

describe('safeNextPath', () => {
  it('returns the requested page when it is a normal path', () => {
    expect(safeNextPath('/cases/abc-123')).toBe('/cases/abc-123')
  })

  it('falls back to the case list when nothing was requested', () => {
    expect(safeNextPath(null)).toBe('/cases')
    expect(safeNextPath('')).toBe('/cases')
  })

  it('refuses to bounce an adviser to another website after login', () => {
    expect(safeNextPath('https://evil.example.com')).toBe('/cases')
    expect(safeNextPath('//evil.example.com')).toBe('/cases')
  })

  it('refuses to loop back to the login page', () => {
    expect(safeNextPath('/login')).toBe('/cases')
  })
})
