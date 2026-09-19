import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { countPages, isComplete, safeFileName, uploadPath } from '@/lib/files/storage'

async function pdfWith(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage()
  return Buffer.from(await doc.save())
}

describe('safeFileName', () => {
  it('keeps an ordinary name readable', () => {
    expect(safeFileName('Payslip March.pdf')).toBe('Payslip March.pdf')
  })

  it('cannot be used to write outside the case folder', () => {
    expect(safeFileName('../../other-case/evil.pdf')).toBe('evil.pdf')
    expect(safeFileName('..\\..\\evil.pdf')).toBe('evil.pdf')
  })

  it('never ends up empty', () => {
    expect(safeFileName('')).toBe('file')
    expect(safeFileName('///')).toBe('file')
  })
})

describe('uploadPath', () => {
  it('keeps every client file under its own case and item', () => {
    expect(uploadPath('case-1', 'req-1', 'up-1', 'IMG_2231.HEIC')).toBe(
      'cases/case-1/requirements/req-1/up-1-IMG_2231.HEIC',
    )
  })
})

describe('countPages', () => {
  it('counts every page of a PDF', async () => {
    expect(await countPages(await pdfWith(4), 'application/pdf')).toBe(4)
  })

  it('counts a photo as one page', async () => {
    expect(await countPages(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg')).toBe(1)
  })

  it('counts a PDF it cannot read as one, rather than refusing the upload', async () => {
    expect(await countPages(Buffer.from('not really a pdf'), 'application/pdf')).toBe(1)
  })
})

describe('isComplete', () => {
  it('is complete on the first file when no number is expected', () => {
    expect(isComplete({ expected: null, files: 1, pages: 1, countPages: false })).toBe(true)
  })

  it('waits for the full set of payslips', () => {
    expect(isComplete({ expected: 3, files: 2, pages: 2, countPages: false })).toBe(false)
    expect(isComplete({ expected: 3, files: 3, pages: 3, countPages: false })).toBe(true)
  })

  it('counts pages for the SLO pack, so one 4 page PDF is enough', () => {
    expect(isComplete({ expected: 4, files: 1, pages: 4, countPages: true })).toBe(true)
  })

  it('counts pages for the SLO pack, so four photos are enough too', () => {
    expect(isComplete({ expected: 4, files: 4, pages: 4, countPages: true })).toBe(true)
  })

  it('does not count pages for payslips, so one long payslip is not three', () => {
    expect(isComplete({ expected: 3, files: 1, pages: 3, countPages: false })).toBe(false)
  })
})
