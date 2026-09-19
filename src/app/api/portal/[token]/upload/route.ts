import { NextResponse } from 'next/server'
import { openPortal } from '@/lib/portal/resolve'
import { receiveFiles } from '@/lib/portal/receive'

/** Files a client sends for one item on their list. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const opened = await openPortal(token)
  if (!opened.ok) {
    return NextResponse.json({ message: opened.reason }, { status: opened.status, headers: { 'cache-control': 'no-store' } })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, message: 'Something went wrong sending that. Please try again.' }, { status: 400 })
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File)

  try {
    const result = await receiveFiles(opened.row, String(form.get('requirement_id') ?? ''), files)
    return NextResponse.json(result, {
      status: result.ok ? 200 : result.status,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    console.error('[portal] upload failed:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { ok: false, message: 'Something went wrong on our side. Please try again in a minute.' },
      { status: 500 },
    )
  }
}
