import type { CaseColour } from '@/lib/cases/status'

/**
 * Red, amber and green as words as well as colour.
 *
 * Colour alone is not enough: roughly one man in twelve cannot reliably tell
 * red from green, and a status nobody can read is a status nobody acts on.
 */
const STYLES: Record<CaseColour, string> = {
  green: 'bg-green-100 text-green-800 ring-green-600/20',
  amber: 'bg-amber-100 text-amber-900 ring-amber-600/30',
  red: 'bg-red-100 text-red-800 ring-red-600/20',
  grey: 'bg-slate-100 text-slate-700 ring-slate-500/20',
}

const DOTS: Record<CaseColour, string> = {
  green: 'bg-green-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
  grey: 'bg-slate-400',
}

export function StatusBadge({ colour, label }: { colour: CaseColour; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[colour]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[colour]}`} aria-hidden="true" />
      {label}
    </span>
  )
}
