import { NextResponse } from 'next/server'
import { openPortal } from '@/lib/portal/resolve'
import { formFolder, listFolder, signedDownload } from '@/lib/files/storage'

/**
 * A client downloading a form the adviser attached to one of their items.
 *
 * The link is checked, the item must be on this client's own case, and the
 * download works for one minute.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; requirementId: string; name: string }> },
) {
  const { token, requirementId, name } = await context.params
  const opened = await openPortal(token)
  if (!opened.ok) return new NextResponse(opened.reason, { status: opened.status })

  // Somebody else's item id must not reach somebody else's file.
  if (!opened.row.requirements.some((r) => r.id === requirementId)) {
    return new NextResponse('That form is not available.', { status: 404 })
  }

  const folder = formFolder(opened.row.id, requirementId)
  const wanted = decodeURIComponent(name)
  const file = (await listFolder(folder)).find((f) => f.name === wanted)
  if (!file) return new NextResponse('That form is not available.', { status: 404 })

  const url = await signedDownload(`${folder}/${file.name}`, file.name)
  return NextResponse.redirect(url, { headers: { 'cache-control': 'no-store' } })
}
