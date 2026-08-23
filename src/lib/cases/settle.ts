/**
 * Taking an item off the client's list without them sending anything.
 *
 * Two reasons, and they must not behave the same:
 *
 *   already_have    It arrived by email, post or in person. The item is
 *                   accepted and the trail records how it actually came in.
 *                   This is the normal path, not the exception: the adviser has
 *                   to put the file on the lender portal and the CRM anyway, so
 *                   making them also upload it here would be duplicate work.
 *
 *   not_applicable  It turned out not to be needed on this case. The item is
 *                   waived. Nothing is recorded as having arrived, because the
 *                   sign-off record must never claim a document that does not
 *                   exist.
 *
 * Neither deletes anything. What was asked for, and what happened to it, stays
 * on the record - that trail is what answers the question if a case is ever
 * looked at again.
 */
import type { RequirementStatus } from '@/lib/cases/status'

/** How a document reached the adviser when it did not come through the portal. */
export type OffPortalRoute = 'email' | 'post' | 'in_person'

const ROUTES: OffPortalRoute[] = ['email', 'post', 'in_person']

export type SettleInput =
  | { action: 'already_have'; receivedVia: OffPortalRoute }
  | { action: 'not_applicable' }

export type SettlePatch = {
  status: 'accepted' | 'waived'
  received_via: OffPortalRoute | null
  received_at: string | null
  accepted_at: string | null
  accepted_by: string | null
  next_chase_at: null
}

export type SettleEvent = {
  type: string
  actor: string
  detail: Record<string, unknown>
}

export type SettleParseResult =
  | { ok: true; input: SettleInput }
  | { ok: false; errors: Record<string, string> }

/** Whether there is anything left to settle. */
export function canSettle(status: RequirementStatus): boolean {
  return status !== 'accepted' && status !== 'waived'
}

export function buildSettle(
  input: SettleInput,
  adviserId: string,
  now: Date = new Date(),
): { patch: SettlePatch; event: SettleEvent } {
  const stamp = now.toISOString()

  if (input.action === 'already_have') {
    return {
      patch: {
        status: 'accepted',
        received_via: input.receivedVia,
        received_at: stamp,
        accepted_at: stamp,
        accepted_by: adviserId,
        next_chase_at: null,
      },
      event: {
        type: 'requirement_accepted',
        actor: adviserId,
        detail: {
          received_via: input.receivedVia,
          // A requirement can reach accepted with no files at all. The tool
          // tracks state, not files.
          files_attached: false,
        },
      },
    }
  }

  return {
    patch: {
      status: 'waived',
      received_via: null,
      received_at: null,
      accepted_at: null,
      accepted_by: null,
      next_chase_at: null,
    },
    event: {
      type: 'requirement_waived',
      actor: adviserId,
      detail: { reason: 'not applicable to this case' },
    },
  }
}

export function parseSettleForm(form: Record<string, string | undefined>): SettleParseResult {
  const action = (form.action ?? '').trim()

  if (action === 'not_applicable') return { ok: true, input: { action: 'not_applicable' } }

  if (action !== 'already_have') {
    return { ok: false, errors: { action: 'That is not something that can be done to an item.' } }
  }

  // Defaults to email, which is how documents nearly always turn up.
  const route = (form.received_via ?? 'email').trim() as OffPortalRoute

  // "portal" is deliberately not on the list. Setting it by hand would fake an
  // upload that never happened.
  if (!ROUTES.includes(route)) {
    return { ok: false, errors: { received_via: 'Say how it reached you.' } }
  }

  return { ok: true, input: { action: 'already_have', receivedVia: route } }
}
