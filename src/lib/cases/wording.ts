/**
 * Changing the wording of one item on a case's list.
 *
 * The client reads exactly what is saved here. Once an item's wording has been
 * changed by hand, a later edit to the case details never overwrites it - see
 * `planResync` in `update.ts`.
 */

export type Wording = { label: string; description: string }

export type WordingParseResult =
  | { ok: true; wording: Wording }
  | { ok: false; errors: Record<string, string> }

export function parseWordingForm(form: Record<string, string | undefined>): WordingParseResult {
  const label = (form.label ?? '').trim()
  const description = (form.description ?? '').trim()

  if (!label) return { ok: false, errors: { label: 'The item needs a name. The client sees it.' } }

  return { ok: true, wording: { label, description } }
}
