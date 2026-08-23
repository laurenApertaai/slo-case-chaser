import { describe, it, expect, beforeEach } from 'vitest'
import { serverClient } from '@/lib/db/client'

// These tests control their own environment rather than relying on .env.local,
// so they behave identically on a laptop and in CI.
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test'
})

describe('serverClient', () => {
  it('throws a clear error when the secret key is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => serverClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY is not set')
  })

  it('throws a clear error when the project URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(() => serverClient()).toThrow('NEXT_PUBLIC_SUPABASE_URL is not set')
  })

  it('returns a client when both values are present', () => {
    expect(serverClient()).toBeTruthy()
  })
})
