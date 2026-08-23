import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { currentAdviser } from '@/lib/auth/supabase'
import { loadCase, type CaseRequirement } from '@/lib/cases/load'
import { StatusBadge } from '../status-badge'
import { PortalLink } from '../portal-link'
import { AddItem } from './add-item'

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

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const adviser = await currentAdviser()
  if (!adviser) redirect('/login?error=1')

  const { id } = await params
  const record = await loadCase(id)
  if (!record) notFound()

  const link = await portalUrl(record.portal_token)

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
              {record.case_ref} · {record.lender ?? 'no lender set'} · {money(record.loan_amount)} ·{' '}
              {record.adviser_name ?? 'unassigned'}
            </p>
          </div>
          <StatusBadge colour={record.progress.colour} label={record.progress.label} />
        </header>

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
                  </p>
                </div>
                <p className={`shrink-0 text-sm ${REQUIREMENT_STYLES[item.status]}`}>
                  {REQUIREMENT_WORDS[item.status]}
                </p>
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
