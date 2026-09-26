import { NextResponse } from 'next/server'
import { openPortal } from '@/lib/portal/resolve'
import { receiveEmploymentType } from '@/lib/portal/receive'

/** A client saying how they are paid, for one applicant's income evidence. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const opened = await openPortal(token)
  if (!opened.ok) {
    return NextResponse.json(
      { message: opened.reason },
      { status: opened.status, headers: { 'cache-control': 'no-store' } },
    )
  }

  let body: { requirement_id?: string; employment_type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: 'Something went wrong sending that. Please try again.' },
      { status: 400 },
    )
  }

  try {
    const result = await receiveEmploymentType(
      opened.row,
      String(body.requirement_id ?? ''),
      String(body.employment_type ?? ''),
    )
    return NextResponse.json(result, {
      status: result.ok ? 200 : result.status,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    console.error('[portal] employment type failed:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { ok: false, message: 'Something went wrong on our side. Please try again in a minute.' },
      { status: 500 },
    )
  }
}
