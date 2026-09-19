import { describe, it, expect } from 'vitest'
import { parseWordingForm } from '@/lib/cases/wording'

describe('parseWordingForm', () => {
  it('takes the new wording exactly as typed, trimmed', () => {
    expect(
      parseWordingForm({ label: '  Photo ID for John  ', description: '  Passport please.  ' }),
    ).toEqual({ ok: true, wording: { label: 'Photo ID for John', description: 'Passport please.' } })
  })

  it('allows the description to be emptied', () => {
    expect(parseWordingForm({ label: 'Photo ID', description: '' })).toEqual({
      ok: true,
      wording: { label: 'Photo ID', description: '' },
    })
  })

  it('will not leave an item with no name, because the client would not know what it is', () => {
    const result = parseWordingForm({ label: '   ', description: 'Something' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.label).toBeTruthy()
  })
})
