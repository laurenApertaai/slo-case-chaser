import { NextResponse } from 'next/server'
import { openPortal } from '@/lib/portal/resolve'
import { receiveAnswers } from '@/lib/portal/receive'

/** A client's typed answers for one item on their list. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const opened = await openPortal(token)
  if (!opened.ok) {
    return NextResponse.json({ message: opened.reason }, { status: opened.status, headers: { 'cache-control': 'no-store' } })
  }

  let body: { requirement_id?: string; values?: Record<string, string> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Something went wrong sending that. Please try again.' }, { status: 400 })
  }

  try {
    const result = await receiveAnswers(opened.row, String(body.requirement_id ?? ''), body.values ?? {})
    return NextResponse.json(result, {
      status: result.ok ? 200 : result.status,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    console.error('[portal] answer failed:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { ok: false, message: 'Something went wrong on our side. Please try again in a minute.' },
      { status: 500 },
    )
  }
}
