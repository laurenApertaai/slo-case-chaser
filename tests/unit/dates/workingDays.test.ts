import { describe, it, expect } from 'vitest'
import {
  isWeekend,
  isWorkingDay,
  addWorkingDays,
  workingDaysBetween,
  nextWorkingDayAt,
  isoDate,
  type HolidayProvider,
} from '@/lib/dates/workingDays'

/**
 * A fixed holiday list so these tests never touch the network and never
 * change meaning when the real calendar rolls over.
 *
 * 2026 England and Wales dates used below:
 *   1 Jan  New Year's Day
 *   3 Apr  Good Friday
 *   6 Apr  Easter Monday
 *  25 Dec  Christmas Day
 *  28 Dec  Boxing Day, substitute (26th falls on a Saturday)
 *
 * 2027 is needed too, because the Christmas shutdown runs across the year end:
 *   1 Jan  New Year's Day (a Friday in 2027)
 */
const holidays: HolidayProvider = async () =>
  new Set(['2026-01-01', '2026-04-03', '2026-04-06', '2026-12-25', '2026-12-28', '2027-01-01'])

const at = (iso: string) => new Date(`${iso}T12:00:00Z`)

describe('isWeekend', () => {
  it('treats Saturday and Sunday as the weekend', () => {
    expect(isWeekend(at('2026-08-22'))).toBe(true) // Saturday
    expect(isWeekend(at('2026-08-23'))).toBe(true) // Sunday
  })

  it('treats Monday to Friday as not the weekend', () => {
    expect(isWeekend(at('2026-08-24'))).toBe(false) // Monday
    expect(isWeekend(at('2026-08-21'))).toBe(false) // Friday
  })
})

describe('isWorkingDay', () => {
  it('says no to a Saturday', async () => {
    expect(await isWorkingDay(at('2026-08-22'), holidays)).toBe(false)
  })

  it('says no to Christmas Day', async () => {
    expect(await isWorkingDay(at('2026-12-25'), holidays)).toBe(false)
  })

  it('says no to Good Friday', async () => {
    expect(await isWorkingDay(at('2026-04-03'), holidays)).toBe(false)
  })

  it('says yes to an ordinary Tuesday', async () => {
    expect(await isWorkingDay(at('2026-08-25'), holidays)).toBe(true)
  })
})

describe('addWorkingDays', () => {
  it('rolls a Friday over the weekend', async () => {
    // Friday 21 August, plus 2 working days, is Tuesday 25 August.
    const result = await addWorkingDays(at('2026-08-21'), 2, holidays)
    expect(isoDate(result)).toBe('2026-08-25')
  })

  it('skips both Good Friday and Easter Monday', async () => {
    // Thursday 2 April. The 3rd is Good Friday, the 4th and 5th are the
    // weekend, the 6th is Easter Monday. So two working days lands on
    // Wednesday 8 April.
    const result = await addWorkingDays(at('2026-04-02'), 2, holidays)
    expect(isoDate(result)).toBe('2026-04-08')
  })

  it('handles the full day 2, 4, 6, 8 chase cycle across Christmas', async () => {
    // Pack issued Tuesday 22 December. Christmas Day, the Boxing Day
    // substitute and New Year's Day all fall inside the cycle, so the day 6
    // chaser lands on Monday 4 January rather than on New Year's Day itself.
    const start = at('2026-12-22')
    expect(isoDate(await addWorkingDays(start, 2, holidays))).toBe('2026-12-24')
    expect(isoDate(await addWorkingDays(start, 4, holidays))).toBe('2026-12-30')
    expect(isoDate(await addWorkingDays(start, 6, holidays))).toBe('2027-01-04')
  })

  it('returns the same day when adding zero', async () => {
    const result = await addWorkingDays(at('2026-08-25'), 0, holidays)
    expect(isoDate(result)).toBe('2026-08-25')
  })

  it('refuses a negative or fractional number of days', async () => {
    await expect(addWorkingDays(at('2026-08-25'), -1, holidays)).rejects.toThrow()
    await expect(addWorkingDays(at('2026-08-25'), 1.5, holidays)).rejects.toThrow()
  })
})

describe('nextWorkingDayAt', () => {
  it('gives 9am on the next working day, skipping the weekend', async () => {
    const result = await nextWorkingDayAt(at('2026-08-21'), 9, holidays) // Friday
    expect(isoDate(result)).toBe('2026-08-24') // Monday
    expect(result.getUTCHours()).toBe(9)
  })

  it('skips a bank holiday when finding the next working day', async () => {
    const result = await nextWorkingDayAt(at('2026-04-02'), 9, holidays) // Thursday
    expect(isoDate(result)).toBe('2026-04-07') // Tuesday after Easter
  })
})

describe('workingDaysBetween', () => {
  it('counts nothing on the day the pack goes out', async () => {
    const day = at('2026-08-24') // Monday
    expect(await workingDaysBetween(day, day, holidays)).toBe(0)
  })

  it('counts the working days that have passed since', async () => {
    const monday = at('2026-08-24')
    expect(await workingDaysBetween(monday, at('2026-08-25'), holidays)).toBe(1)
    expect(await workingDaysBetween(monday, at('2026-08-28'), holidays)).toBe(4)
  })

  it('does not count the weekend', async () => {
    const friday = at('2026-08-21')
    // Saturday and Sunday pass, but the client has had no working day at all.
    expect(await workingDaysBetween(friday, at('2026-08-23'), holidays)).toBe(0)
    expect(await workingDaysBetween(friday, at('2026-08-24'), holidays)).toBe(1)
  })

  it('does not count a bank holiday', async () => {
    // Thursday 2 April to Tuesday 7 April, with Good Friday and Easter Monday
    // in between. Only the Tuesday counts.
    expect(await workingDaysBetween(at('2026-04-02'), at('2026-04-07'), holidays)).toBe(1)
  })

  it('reads a pack issued over the Christmas shutdown correctly', async () => {
    // Issued Wednesday 23 December. Christmas Day, the Boxing Day substitute
    // and New Year's Day all fall inside the gap, so by 4 January the client
    // has had 24, 29, 30 and 31 December and 4 January: five working days out
    // of twelve calendar ones.
    expect(await workingDaysBetween(at('2026-12-23'), at('2027-01-04'), holidays)).toBe(5)
  })

  it('returns zero rather than a negative when the dates are the wrong way round', async () => {
    expect(await workingDaysBetween(at('2026-08-28'), at('2026-08-24'), holidays)).toBe(0)
  })
})
