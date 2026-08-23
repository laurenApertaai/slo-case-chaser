/**
 * Working-day maths for the chase schedule.
 *
 * Chasers only ever go out on working days: no weekends, no England and Wales
 * bank holidays. The holiday list comes from the official gov.uk feed and is
 * cached for 24 hours.
 *
 * If the feed cannot be reached we fall back to the last good copy. We never
 * fall back to treating every day as a working day, because that would text
 * clients on Christmas morning.
 */

const BANK_HOLIDAY_FEED = 'https://www.gov.uk/bank-holidays.json'
const DIVISION = 'england-and-wales'
const CACHE_MS = 24 * 60 * 60 * 1000

/** A source of bank holiday dates as YYYY-MM-DD strings. */
export type HolidayProvider = () => Promise<Set<string>>

let cache: { dates: Set<string>; fetchedAt: number } | null = null

/** Formats a date as YYYY-MM-DD in Europe/London. */
export function isoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Day of week in Europe/London. 0 is Sunday, 6 is Saturday. */
export function londonDayOfWeek(date: Date): number {
  const name = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

export function isWeekend(date: Date): boolean {
  const day = londonDayOfWeek(date)
  return day === 0 || day === 6
}

/** Fetches the England and Wales bank holidays, cached for 24 hours. */
export const govUkHolidays: HolidayProvider = async () => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.dates

  try {
    const response = await fetch(BANK_HOLIDAY_FEED)
    if (!response.ok) throw new Error(`gov.uk returned ${response.status}`)

    const body = (await response.json()) as Record<string, { events: { date: string }[] }>
    const events = body[DIVISION]?.events ?? []
    const dates = new Set(events.map((e) => e.date))

    cache = { dates, fetchedAt: Date.now() }
    return dates
  } catch (error) {
    if (cache) {
      console.warn('Bank holiday feed unavailable, using the cached copy.', error)
      return cache.dates
    }
    throw new Error(
      'Bank holiday feed unavailable and nothing cached. Refusing to continue, ' +
        'because guessing would risk chasing clients on a bank holiday.',
    )
  }
}

/** Clears the cache. Used by tests. */
export function resetHolidayCache(): void {
  cache = null
}

export async function isWorkingDay(
  date: Date,
  holidays: HolidayProvider = govUkHolidays,
): Promise<boolean> {
  if (isWeekend(date)) return false
  const dates = await holidays()
  return !dates.has(isoDate(date))
}

/** Adds a whole number of working days, skipping weekends and bank holidays. */
export async function addWorkingDays(
  date: Date,
  days: number,
  holidays: HolidayProvider = govUkHolidays,
): Promise<Date> {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('addWorkingDays expects a whole number of days, zero or more')
  }

  const result = new Date(date.getTime())
  let remaining = days

  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    if (await isWorkingDay(result, holidays)) remaining -= 1
  }

  return result
}

/**
 * The next working day at a given hour, London time. Used for the 9am adviser
 * digest and for the tighter loop after a rejection.
 */
export async function nextWorkingDayAt(
  date: Date,
  hour: number,
  holidays: HolidayProvider = govUkHolidays,
): Promise<Date> {
  const next = await addWorkingDays(date, 1, holidays)
  const [y, m, d] = isoDate(next).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0))
}

/**
 * How many working days have passed between two moments.
 *
 * The start day itself does not count, so the day the pack goes out is day 0
 * and the chase cadence in the spec — day 2, 4, 6, 8 — lines up directly.
 *
 * A pack issued on a Friday afternoon has had no working days by Sunday. That
 * matters: counting calendar days would flag a case red over a bank holiday
 * weekend when the client has not actually had a chance to do anything.
 */
export async function workingDaysBetween(
  from: Date,
  to: Date,
  holidays: HolidayProvider = govUkHolidays,
): Promise<number> {
  if (to.getTime() <= from.getTime()) return 0

  const cursor = new Date(from.getTime())
  const end = isoDate(to)
  let days = 0

  while (isoDate(cursor) < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (await isWorkingDay(cursor, holidays)) days += 1
  }

  return days
}
