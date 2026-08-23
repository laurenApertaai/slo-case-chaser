import { describe, it, expect } from 'vitest'
import { appName } from '@/lib/config'

describe('config', () => {
  it('exposes the application name', () => {
    expect(appName).toBe('Case Document Chaser')
  })
})
