export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo'

function calendarParts(date: Date, timeZone = SAO_PAULO_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return { year: value('year'), month: value('month'), day: value('day') }
}

export function isoDateInTimeZone(date = new Date(), timeZone = SAO_PAULO_TIME_ZONE) {
  const { year, month, day } = calendarParts(date, timeZone)
  return `${year}-${month}-${day}`
}

export function todayInSaoPaulo(date = new Date()) {
  return isoDateInTimeZone(date, SAO_PAULO_TIME_ZONE)
}

export function addDaysToIsoDate(isoDate: string, amount: number) {
  const value = new Date(`${isoDate}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
}

export function weekStartForIsoDate(isoDate: string) {
  const value = new Date(`${isoDate}T12:00:00.000Z`)
  const day = value.getUTCDay()
  return addDaysToIsoDate(isoDate, -(day === 0 ? 6 : day - 1))
}

export function weekStartInSaoPaulo(date = new Date()) {
  return weekStartForIsoDate(todayInSaoPaulo(date))
}

export function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${isoDate}T12:00:00-03:00`))
}

export function formatLongDateInSaoPaulo(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export function hourInSaoPaulo(date = new Date()) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return Number(hour)
}

export function formatTimeInSaoPaulo(timestamp: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

