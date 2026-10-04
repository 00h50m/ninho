import { addDaysToIsoDate } from '@/lib/date'

export type RecurrenceType =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'interval_days'
  | 'after_completion'
  | 'once'

export interface RecurrenceRule {
  type: RecurrenceType
  startsOn: string
  endsOn?: string | null
  pausedUntil?: string | null
  interval?: number
  weekdays?: number[]
  dayOfMonth?: number | null
}

function utcDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00.000Z`)
}

function differenceInDays(from: string, to: string) {
  return Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 86_400_000)
}

function isoWeekday(isoDate: string) {
  const weekday = utcDate(isoDate).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

function monthlyTargetDay(isoDate: string, requestedDay: number) {
  const value = utcDate(isoDate)
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate()
  return Math.min(requestedDay, lastDay)
}

function normalizedInterval(interval?: number) {
  return Math.max(1, Math.trunc(interval || 1))
}

export function isOccurrenceDate(
  rule: RecurrenceRule,
  date: string,
  lastCompletedOn?: string | null,
) {
  if (date < rule.startsOn || (rule.endsOn && date > rule.endsOn)) return false
  if (rule.pausedUntil && date <= rule.pausedUntil) return false

  const elapsed = differenceInDays(rule.startsOn, date)
  const interval = normalizedInterval(rule.interval)

  switch (rule.type) {
    case 'daily':
      return true
    case 'weekdays':
      return (rule.weekdays || []).includes(isoWeekday(date))
    case 'weekly':
      return elapsed % 7 === 0
    case 'biweekly':
      return elapsed % 14 === 0
    case 'monthly': {
      const requestedDay = rule.dayOfMonth || utcDate(rule.startsOn).getUTCDate()
      return utcDate(date).getUTCDate() === monthlyTargetDay(date, requestedDay)
    }
    case 'interval_days':
      return elapsed % interval === 0
    case 'after_completion': {
      const nextDate = lastCompletedOn
        ? addDaysToIsoDate(lastCompletedOn, interval)
        : rule.startsOn
      return date === nextDate
    }
    case 'once':
      return date === rule.startsOn
  }
}

export function occurrenceDatesBetween(
  rule: RecurrenceRule,
  from: string,
  until: string,
  lastCompletedOn?: string | null,
) {
  if (until < from) return []

  const dates: string[] = []
  let cursor = from < rule.startsOn ? rule.startsOn : from

  while (cursor <= until) {
    if (isOccurrenceDate(rule, cursor, lastCompletedOn)) dates.push(cursor)
    if (rule.type === 'after_completion' && dates.length > 0) break
    cursor = addDaysToIsoDate(cursor, 1)
  }

  return dates
}
