import { NextResponse } from 'next/server'
import { openPortal } from '@/lib/portal/resolve'
import { listSloFiles, signedDownload, sloFolder } from '@/lib/files/storage'

/**
 * Downloads one of the SLO documents the adviser attached to the case.
 *
 * The link is checked, the file must be one of this case's own, and the client
 * is handed a download that works for one minute.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string; name: string }> }) {
  const { token, name } = await context.params
  const opened = await openPortal(token)
  if (!opened.ok) return new NextResponse(opened.reason, { status: opened.status })

  const wanted = decodeURIComponent(name)
  const files = await listSloFiles(opened.row.id)
  const file = files.find((f) => f.name === wanted)
  if (!file) return new NextResponse('That document is not available.', { status: 404 })

  const url = await signedDownload(`${sloFolder(opened.row.id)}/${file.name}`, file.name)
  return NextResponse.redirect(url, { headers: { 'cache-control': 'no-store' } })
}
