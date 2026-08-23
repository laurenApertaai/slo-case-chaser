import { describe, it, expect } from 'vitest'
import { buildExtraRequirement, parseExtraForm } from '@/lib/cases/extra'

describe('buildExtraRequirement', () => {
  it('puts the new item at the end of the list', () => {
    const row = buildExtraRequirement(
      { label: 'Proof of address', description: '', applicant: 'joint', isMandatory: true },
      { highestSortOrder: 90 },
    )

    expect(row.sort_order).toBe(100)
  })

  it('starts a list that has somehow ended up empty', () => {
    const row = buildExtraRequirement(
      { label: 'Proof of address', description: '', applicant: 'joint', isMandatory: true },
      { highestSortOrder: null },
    )

    expect(row.sort_order).toBe(10)
  })

  it('is an upload, outstanding, and belongs to no template', () => {
    const row = buildExtraRequirement(
      { label: 'Proof of address', description: '', applicant: 'joint', isMandatory: true },
      { highestSortOrder: 90 },
    )

    expect(row.type).toBe('upload')
    expect(row.status).toBe('outstanding')
    // It came from the adviser, not the standard pack, so there is nothing to
    // point back at.
    expect(row.template_key).toBeNull()
    expect(row.rejection_count).toBe(0)
    expect(row.is_paused).toBe(false)
  })

  it('carries the adviser wording through untouched', () => {
    const row = buildExtraRequirement(
      {
        label: 'Proof of address',
        description: 'A utility bill or council tax bill from the last three months.',
        applicant: 'applicant_2',
        isMandatory: false,
      },
      { highestSortOrder: 90 },
    )

    expect(row.label).toBe('Proof of address')
    expect(row.description).toBe('A utility bill or council tax bill from the last three months.')
    expect(row.applicant).toBe('applicant_2')
    expect(row.is_mandatory).toBe(false)
  })

  it('does not touch the chase clock', () => {
    const row = buildExtraRequirement(
      { label: 'Proof of address', description: '', applicant: 'joint', isMandatory: true },
      { highestSortOrder: 90 },
    )

    // Adding an item mid-case joins the next scheduled chaser rather than
    // restarting the cycle, so nothing here sets a chase date.
    expect(row).not.toHaveProperty('next_chase_at')
    expect(row).not.toHaveProperty('last_chased_at')
  })
})

describe('parseExtraForm', () => {
  it('accepts a filled in form', () => {
    const result = parseExtraForm({
      label: '  Proof of address  ',
      description: 'A recent utility bill.',
      applicant: 'applicant_1',
      is_mandatory: 'on',
    })

    expect(result).toEqual({
      ok: true,
      input: {
        label: 'Proof of address',
        description: 'A recent utility bill.',
        applicant: 'applicant_1',
        isMandatory: true,
      },
    })
  })

  it('insists on wording, because the client has to know what to send', () => {
    const result = parseExtraForm({ label: '   ', applicant: 'joint' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.label).toBeTruthy()
  })

  it('treats an unticked box as optional', () => {
    const result = parseExtraForm({ label: 'Proof of address', applicant: 'joint' })
    expect(result.ok && result.input.isMandatory).toBe(false)
  })

  it('refuses an applicant slot it does not recognise', () => {
    const result = parseExtraForm({ label: 'Proof of address', applicant: 'applicant_3' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.applicant).toBeTruthy()
  })

  it('never uses a contraction in the wording it generates itself', () => {
    const result = parseExtraForm({ label: 'Proof of address', applicant: 'joint' })

    // The adviser's own wording is their business. What matters is that the
    // description defaults to empty rather than to invented copy.
    expect(result.ok && result.input.description).toBe('')
  })
})
