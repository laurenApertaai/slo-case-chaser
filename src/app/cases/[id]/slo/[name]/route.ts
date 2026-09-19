import { NextResponse } from 'next/server'
import { currentAdviser } from '@/lib/auth/supabase'
import { listSloFiles, signedDownload, sloFolder } from '@/lib/files/storage'

/** An adviser downloading one of a case's SLO documents. */
export async function GET(_request: Request, context: { params: Promise<{ id: string; name: string }> }) {
  if (!(await currentAdviser())) return new NextResponse('Please sign in.', { status: 401 })

  const { id, name } = await context.params
  const wanted = decodeURIComponent(name)
  const file = (await listSloFiles(id)).find((f) => f.name === wanted)
  if (!file) return new NextResponse('That document is not on this case.', { status: 404 })

  return NextResponse.redirect(await signedDownload(`${sloFolder(id)}/${file.name}`, file.name))
}
