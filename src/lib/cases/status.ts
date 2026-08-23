/**
 * What colour a case is, and why.
 *
 * Deliberately pure. No database, no clock of its own, no bank holiday feed.
 * Everything it needs is handed in, so the rule that decides whether a case is
 * in trouble can be read and tested in one place.
 *
 * There are four colours, not three. Red, amber and green cover a case that is
 * finished, a case waiting on the adviser, and a case in trouble — but they
 * leave out the ordinary majority: issued yesterday, client working through it,
 * nothing wrong. That is grey. Colouring it amber would make amber meaningless
 * within a week, which is exactly how a dashboard stops being looked at.
 */

export type RequirementStatus = 'outstanding' | 'received' | 'accepted' | 'rejected' | 'waived'

export type CaseStatus = 'active' | 'on_hold' | 'complete' | 'withdrawn'

export type CaseColour = 'green' | 'amber' | 'red' | 'grey'

export type StatusRequirement = {
  status: RequirementStatus
  rejection_count: number
  received_at: string | null
  is_mandatory: boolean
}

export type CaseProgressInput = {
  caseStatus: CaseStatus
  requirements: StatusRequirement[]
  /** working days since the pack went out, or null while it has not been issued */
  workingDaysSinceIssue: number | null
  now: Date
}

export type CaseProgress = {
  colour: CaseColour
  /** short adviser-facing summary, shown on the case list */
  label: string
  /** why it is not green, worst first; empty when there is nothing wrong */
  reasons: string[]
  total: number
  accepted: number
  /** uploaded or answered, not yet reviewed */
  received: number
  /** of those, the ones that have sat longer than a day and are now late */
  overdueReview: number
  /** still to come in, including anything rejected and sent back */
  outstanding: number
  percentComplete: number
}

/** How long an item may sit unreviewed before the case goes amber. */
const REVIEW_HOURS = 24

/** The final automated chaser goes out on day 8. After that, chasing stops. */
const FINAL_CHASE_DAY = 8

function hoursSince(iso: string | null, now: Date): number {
  if (!iso) return 0
  return (now.getTime() - new Date(iso).getTime()) / (60 * 60 * 1000)
}

export function caseProgress(input: CaseProgressInput): CaseProgress {
  const { requirements, now } = input

  const total = requirements.length
  const accepted = requirements.filter((r) => r.status === 'accepted').length
  const waived = requirements.filter((r) => r.status === 'waived').length
  const receivedItems = requirements.filter((r) => r.status === 'received')
  const outstanding = requirements.filter(
    (r) => r.status === 'outstanding' || r.status === 'rejected',
  ).length

  const stale = receivedItems.filter((r) => hoursSince(r.received_at, now) > REVIEW_HOURS)

  // Waived items are settled without pretending they arrived, so they count
  // towards being finished but never towards anything having been received.
  const settled = accepted + waived

  const counts = {
    total,
    accepted,
    received: receivedItems.length,
    overdueReview: stale.length,
    outstanding,
    percentComplete: total === 0 ? 0 : Math.round((settled / total) * 100),
  }

  // A case nobody is working is not a case in trouble. Say what it is and stop.
  if (input.caseStatus === 'withdrawn') {
    return { ...counts, colour: 'grey', label: 'Withdrawn', reasons: [] }
  }
  if (input.caseStatus === 'on_hold') {
    return { ...counts, colour: 'grey', label: 'On hold', reasons: [] }
  }

  const reasons: string[] = []

  const rejectedTwice = requirements.some((r) => r.rejection_count >= 2)
  if (rejectedTwice) {
    reasons.push('An item has been rejected twice, so a call is needed')
  }

  const pastFinalChase =
    input.workingDaysSinceIssue !== null && input.workingDaysSinceIssue > FINAL_CHASE_DAY

  if (pastFinalChase && outstanding > 0) {
    reasons.push('Past day 8 with items still outstanding, so chasing has stopped')
  }

  if (stale.length > 0) {
    reasons.push(
      stale.length === 1
        ? '1 item has been waiting on review for more than a day'
        : `${stale.length} items have been waiting on review for more than a day`,
    )
  }

  // Everything mandatory is settled, so the case is collectable. An optional
  // item left outstanding does not hold it up.
  const nothingLeft =
    total > 0 &&
    requirements.every(
      (r) => r.status === 'accepted' || r.status === 'waived' || !r.is_mandatory,
    )

  if (nothingLeft && !rejectedTwice) {
    return { ...counts, colour: 'green', label: 'Complete', reasons: [] }
  }

  if (rejectedTwice || (pastFinalChase && outstanding > 0)) {
    return { ...counts, colour: 'red', label: 'Call required', reasons }
  }

  if (stale.length > 0) {
    return { ...counts, colour: 'amber', label: 'Waiting on you', reasons }
  }

  if (input.workingDaysSinceIssue === null) {
    return { ...counts, colour: 'grey', label: 'Not yet issued', reasons }
  }

  return { ...counts, colour: 'grey', label: 'In progress', reasons }
}
