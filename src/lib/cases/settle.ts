/**
 * Taking an item off the client's list without them sending anything.
 *
 * Two reasons, and they must not behave the same:
 *
 *   already_have    It arrived some other way and the adviser has it. The item
 *                   is accepted. This is the normal path, not the exception:
 *                   the adviser has to put the file on the lender portal and
 *                   the CRM anyway, so making them also upload it here would be
 *                   duplicate work.
 *
 *                   Which route it came by is not recorded. It was asked for and
 *                   it was answered; whether that was email or post changes
 *                   nothing anybody will ever act on, and asking is friction on
 *                   a job done forty times a week.
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

export type SettleInput = { action: 'already_have' } | { action: 'not_applicable' }

export type SettlePatch = {
  status: 'accepted' | 'waived'
  /** null on both paths: nothing came through the portal either way */
  received_via: null
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
        received_via: null,
        received_at: stamp,
        accepted_at: stamp,
        accepted_by: adviserId,
        next_chase_at: null,
      },
      event: {
        type: 'requirement_accepted',
        actor: adviserId,
        detail: {
          // It reached the adviser outside the portal. A requirement can reach
          // accepted with no files at all; the tool tracks state, not files.
          outside_portal: true,
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
  if (action === 'already_have') return { ok: true, input: { action: 'already_have' } }

  return { ok: false, errors: { action: 'That is not something that can be done to an item.' } }
}
