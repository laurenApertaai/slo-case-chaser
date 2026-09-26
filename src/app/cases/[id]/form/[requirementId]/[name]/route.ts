import { NextResponse } from 'next/server'
import { currentAdviser } from '@/lib/auth/supabase'
import { formFolder, listFolder, signedDownload } from '@/lib/files/storage'

/** An adviser opening a form they attached to an item. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; requirementId: string; name: string }> },
) {
  const adviser = await currentAdviser()
  if (!adviser) return new NextResponse('Please sign in.', { status: 401 })

  const { id, requirementId, name } = await context.params
  const folder = formFolder(id, requirementId)

  const wanted = decodeURIComponent(name)
  const file = (await listFolder(folder)).find((f) => f.name === wanted)
  if (!file) return new NextResponse('That form is not there.', { status: 404 })

  const url = await signedDownload(`${folder}/${file.name}`, file.name)
  return NextResponse.redirect(url, { headers: { 'cache-control': 'no-store' } })
}
