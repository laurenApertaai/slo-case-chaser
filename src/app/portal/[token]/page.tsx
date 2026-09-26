import type { Metadata } from 'next'
import { buildPortalView, openPortal, type PortalItem } from '@/lib/portal/resolve'
import { formFor } from '@/lib/portal/answers'
import { listSloFiles } from '@/lib/files/storage'
import { FIRM_NAME } from '@/lib/db/seed'
import { UploadButton } from './upload-button'
import { DetailsForm } from './details-form'
import { PayFrequency } from './pay-frequency'

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
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-lg">
        <div className="slo-navy px-6 py-5">
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
            {FIRM_NAME}
          </h1>
        </div>
        <div className="p-8">
        <p className="mt-4 text-slate-600">{message}</p>
        </div>
      </div>
    </main>
  )
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const opened = await openPortal(token)

  if (!opened.ok) return <Closed message={opened.reason} />

  const view = buildPortalView(opened.row)
  const sloFiles = await listSloFiles(opened.row.id)

  /**
   * Whether the client can still put something against this item.
   *
   * Everything stays open until the adviser has accepted it, or it has been
   * waived. Clients mistype an age or send the wrong photo constantly, and
   * locking an item the moment it arrives turns a five second correction into a
   * phone call. Once it is accepted it is the adviser's judgement, and it is
   * not quietly replaced underneath them.
   */
  const open = (item: PortalItem) => item.state !== 'done' && item.state !== 'not_needed'

  /** Already sent once, so the buttons offer a change rather than a first go. */
  const sent = (item: PortalItem) => item.state === 'checking'

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="h-1 bg-brand" />
      <header className="slo-navy px-5 py-8">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
            {FIRM_NAME}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Hello {view.firstName}</h1>
          <p className="mt-3 text-white/85">
            {view.allDone
              ? 'Thank you. We have everything we asked for and there is nothing else to send.'
              : 'We require the following documents/information in order to fully submit your application.'}
          </p>
          {view.isJoint && !view.allDone && (
            <p className="mt-3 text-sm text-white/70">
              This list covers both applicants. Either of you can add details/documents.
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

              {item.templateKey === 'slo_documents' && sloFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {sloFiles.map((file) => (
                    <a
                      key={file.name}
                      href={`/api/portal/${token}/slo/${encodeURIComponent(file.name)}`}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Download {sloFiles.length > 1 ? file.name : 'the document'}
                    </a>
                  ))}
                </div>
              )}

              {/* Income evidence asks how they are paid before it asks for
                  anything, because the answer decides what we are asking for. */}
              {open(item) && item.templateKey === 'income_evidence' && (
                <PayFrequency
                  token={token}
                  requirementId={item.id}
                  current={item.employmentType}
                />
              )}

              {open(item) && item.type === 'upload' && (
                <UploadButton token={token} requirementId={item.id} sent={sent(item)} />
              )}

              {open(item) && item.type !== 'upload' && formFor(item.templateKey) && (
                <DetailsForm
                  token={token}
                  requirementId={item.id}
                  fields={formFor(item.templateKey)!}
                  initial={item.values}
                  sent={sent(item)}
                />
              )}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm text-slate-500">
          Reference {view.caseRef}. If anything here does not look right, please contact us and we
          will sort it out.
        </p>

      </div>
    </main>
  )
}
