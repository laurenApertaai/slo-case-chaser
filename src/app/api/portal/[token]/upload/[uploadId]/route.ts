import { NextResponse } from 'next/server'
import { openPortal } from '@/lib/portal/resolve'
import { removeUpload } from '@/lib/portal/receive'

/** A client taking back a file they sent by mistake. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ token: string; uploadId: string }> },
) {
  const { token, uploadId } = await context.params
  const opened = await openPortal(token)
  if (!opened.ok) {
    return NextResponse.json(
      { message: opened.reason },
      { status: opened.status, headers: { 'cache-control': 'no-store' } },
    )
  }

  const requirementId = new URL(request.url).searchParams.get('requirement') ?? ''

  try {
    const result = await removeUpload(opened.row, requirementId, uploadId)
    return NextResponse.json(result, {
      status: result.ok ? 200 : result.status,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    console.error('[portal] remove failed:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { ok: false, message: 'Something went wrong on our side. Please try again in a minute.' },
      { status: 500 },
    )
  }
}
