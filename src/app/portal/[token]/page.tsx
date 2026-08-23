import type { Metadata } from 'next'
import { resolvePortal, type PortalItem } from '@/lib/portal/resolve'
import { FIRM_NAME } from '@/lib/db/seed'

/**
 * The client's page.
 *
 * A phone page first. The client taps a link in a text message, with no
 * password and no app, and sees everything still needed for both applicants on
 * one list.
 *
 * Every word here is client-facing, so contractions are spelled out in full.
 */

export const metadata: Metadata = {
  title: 'Your documents',
  // A secret link must never end up in a search index.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const STATE_STYLES: Record<PortalItem['state'], string> = {
  outstanding: 'border-slate-200 bg-white',
  checking: 'border-green-200 bg-green-50',
  done: 'border-green-200 bg-green-50',
  sent_back: 'border-amber-300 bg-amber-50',
  not_needed: 'border-slate-200 bg-slate-50',
}

const STATE_TEXT: Record<PortalItem['state'], string> = {
  outstanding: 'text-slate-500',
  checking: 'text-green-800',
  done: 'text-green-800',
  sent_back: 'text-amber-900',
  not_needed: 'text-slate-400',
}

function Closed({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">{FIRM_NAME}</h1>
        <p className="mt-4 text-slate-600">{message}</p>
      </div>
    </main>
  )
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await resolvePortal(token)

  if (!result.ok) return <Closed message={result.reason} />

  const { view } = result

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white px-5 py-6">
        <div className="mx-auto max-w-xl">
          <p className="text-xs uppercase tracking-wide text-slate-500">{FIRM_NAME}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Hello {view.firstName}</h1>
          <p className="mt-2 text-slate-600">
            {view.allDone
              ? 'Thank you. We have everything we asked for and there is nothing else to send.'
              : 'We require the following documents/information in order to fully submit your application.'}
          </p>
          {view.isJoint && !view.allDone && (
            <p className="mt-2 text-sm text-slate-500">
              This list covers both applicants. Either of you can send anything on it.
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-xl px-5">
        <div className="mt-4 flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={view.totalCount - view.outstandingCount}
            aria-valuemin={0}
            aria-valuemax={view.totalCount}
          >
            <div
              className="h-full rounded-full bg-green-600 transition-all"
              style={{
                width: `${
                  view.totalCount === 0
                    ? 0
                    : ((view.totalCount - view.outstandingCount) / view.totalCount) * 100
                }%`,
              }}
            />
          </div>
          <p className="shrink-0 text-sm text-slate-500">
            {view.totalCount - view.outstandingCount} of {view.totalCount}
          </p>
        </div>

        <ul className="mt-5 space-y-3">
          {view.items.map((item) => (
            <li key={item.id} className={`rounded-xl border p-4 ${STATE_STYLES[item.state]}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium text-slate-900">{item.label}</h2>
                <span className={`shrink-0 text-xs font-medium ${STATE_TEXT[item.state]}`}>
                  {item.stateLabel}
                </span>
              </div>

              {item.description && (
                <p className="mt-1.5 text-sm text-slate-600">{item.description}</p>
              )}

              {item.expectedCount !== null && item.state === 'outstanding' && (
                <p className="mt-2 text-sm text-slate-500">
                  {item.uploadedCount} of {item.expectedCount} sent so far
                </p>
              )}

              {!item.isMandatory && (
                <p className="mt-2 text-xs text-slate-400">
                  This one is optional, but it does help.
                </p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm text-slate-500">
          Reference {view.caseRef}. If anything here does not look right, please contact us and we
          will sort it out.
        </p>

        <p className="mt-6 rounded-lg bg-slate-100 p-4 text-center text-sm text-slate-600">
          Sending your documents from this page is being built at the moment. For now, please reply
          to the email we sent you and we will take them that way.
        </p>
      </div>
    </main>
  )
}
