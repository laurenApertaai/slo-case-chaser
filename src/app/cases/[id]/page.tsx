import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { currentAdviser } from '@/lib/auth/supabase'
import { loadCase, type CaseRequirement } from '@/lib/cases/load'
import { StatusBadge } from '../status-badge'
import { PortalLink } from '../portal-link'
import { AddItem } from './add-item'
import { SettleItem } from './settle-item'
import { RewordItem } from './reword-item'
import { Received } from './received'
import { formFor } from '@/lib/portal/answers'
import { canSettle } from '@/lib/cases/settle'
import { AttachForm } from './attach-form'
import { formFolder, listFolder, listSloFiles } from '@/lib/files/storage'
import { SloPanel } from './edit/slo-panel'

export const metadata = { title: 'Case' }

// Always live. An adviser looking at a case is deciding what to do next.
export const dynamic = 'force-dynamic'

const REQUIREMENT_STYLES: Record<string, string> = {
  outstanding: 'text-slate-500',
  received: 'text-amber-700',
  accepted: 'text-green-700',
  rejected: 'text-red-700',
  waived: 'text-slate-400',
}

const REQUIREMENT_WORDS: Record<string, string> = {
  outstanding: 'Outstanding',
  received: 'Received, needs review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  waived: 'Waived',
}

function whose(applicant: CaseRequirement['applicant']): string {
  if (applicant === 'applicant_1') return 'Applicant 1'
  if (applicant === 'applicant_2') return 'Applicant 2'
  return 'Both'
}

function money(amount: number | null): string {
  if (amount === null) return 'not set'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount)
}

async function portalUrl(token: string): Promise<string> {
  const head = await headers()
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000'
  const protocol = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocol}://${host}/portal/${token}`
}

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const adviser = await currentAdviser()
  if (!adviser) redirect('/login?error=1')

  const { id } = await params
  const { saved } = await searchParams
  const record = await loadCase(id)
  if (!record) notFound()

  const link = await portalUrl(record.portal_token)
  const sloFiles = await listSloFiles(record.id)

  // The forms the adviser has attached, one folder per item.
  const attachedForms: Record<string, { name: string; size: number }[]> = {}
  await Promise.all(
    record.requirements
      .filter((r) => r.type === 'upload' && r.template_key !== 'slo_documents')
      .map(async (r) => {
        attachedForms[r.id] = await listFolder(formFolder(record.id, r.id))
      }),
  )

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/cases" className="text-sm text-slate-500 hover:text-slate-700">
          ← Cases
        </Link>

        <header className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {record.applicant_1_name}
              {record.is_joint && (
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 align-middle text-xs font-normal text-slate-600">
                  joint
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {record.case_ref} · {record.lender ?? 'no lender set'} · {money(record.loan_amount)}
              {record.loan_purpose && ` · ${record.loan_purpose}`} ·{' '}
              {record.adviser_name ?? 'unassigned'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge colour={record.progress.colour} label={record.progress.label} />
            <Link
              href={`/cases/${record.id}/edit`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit case details
            </Link>
          </div>
        </header>

        {saved && (
          <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Changes saved. The client list has been updated to match.
          </p>
        )}

        {record.progress.reasons.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {record.progress.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Progress</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {record.progress.accepted}
              <span className="text-base font-normal text-slate-400"> of {record.progress.total}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{record.progress.percentComplete}% accepted</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Needs review</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{record.progress.received}</p>
            <p className="mt-1 text-xs text-slate-500">
              {record.progress.overdueReview > 0
                ? `${record.progress.overdueReview} waiting over a day`
                : 'nothing overdue'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pack issued</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {record.pack_issued_at
                ? new Date(record.pack_issued_at).toLocaleDateString('en-GB')
                : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {record.pack_issued_at ? 'chase clock running' : 'not sent yet'}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Applicant 1</p>
            <p className="mt-1 font-medium text-slate-900">{record.applicant_1_name}</p>
            <p className="mt-1 text-sm text-slate-600">{record.applicant_1_email}</p>
            <p className="text-sm text-slate-600">{record.applicant_1_mobile}</p>
          </div>

          {record.is_joint && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Applicant 2</p>
              <p className="mt-1 font-medium text-slate-900">
                {record.applicant_2_name ?? 'Name not given'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {record.applicant_2_email ?? 'Email not given yet'}
              </p>
              <p className="text-sm text-slate-600">
                {record.applicant_2_mobile ?? 'Mobile not given yet'}
              </p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-sm font-medium text-slate-700">The client portal link</p>
          <PortalLink
            url={link}
            note={`Secret link, no password. Expires ${new Date(
              record.token_expires_at,
            ).toLocaleDateString('en-GB')}. Sending it out automatically is built in a later phase, so for now copy it from here.`}
          />
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-900">The checklist</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {record.requirements.length} items. This is what the client sees.
            </p>
          </div>

          <ul className="divide-y divide-slate-200">
            {record.requirements.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {item.label}
                    {!item.is_mandatory && (
                      <span className="ml-2 text-xs font-normal text-slate-400">optional</span>
                    )}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {whose(item.applicant)} · {item.type.replace('_', ' ')}
                    {item.expected_count !== null && ` · ${item.expected_count} files expected`}
                    {item.rejection_count > 0 && ` · rejected ${item.rejection_count}×`}
                    {item.received_via && item.received_via !== 'portal' &&
                      ` · came in by ${item.received_via.replace('_', ' ')}`}
                  </p>

                  <Received
                    caseId={record.id}
                    templateKey={item.template_key}
                    uploads={item.uploads}
                    answers={item.answers}
                    fields={formFor(item.template_key)}
                    bankLast4={record.bank_details_last4}
                  />
                  {item.template_key === 'slo_documents' && (
                    <SloPanel caseId={record.id} files={sloFiles} compact />
                  )}

                  {/* Only an item the client sends a document back for can
                      carry a form to sign. */}
                  {item.type === 'upload' && item.template_key !== 'slo_documents' && (
                    <AttachForm
                      caseId={record.id}
                      requirementId={item.id}
                      files={attachedForms[item.id] ?? []}
                    />
                  )}

                  <RewordItem
                    caseId={record.id}
                    requirementId={item.id}
                    label={item.label}
                    description={item.description}
                  />
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className={`text-sm ${REQUIREMENT_STYLES[item.status]}`}>
                    {REQUIREMENT_WORDS[item.status]}
                  </p>
                  {canSettle(item.status) && (
                    <SettleItem caseId={record.id} requirementId={item.id} label={item.label} />
                  )}
                </div>
              </li>
            ))}
          </ul>

          <AddItem caseId={record.id} isJoint={record.is_joint} />
        </section>

        <p className="mt-4 text-xs text-slate-400">
          Reviewing, accepting and rejecting are phase 5. Issuing the pack and chasing are phases 6
          and 7.
        </p>
      </div>
    </main>
  )
}
