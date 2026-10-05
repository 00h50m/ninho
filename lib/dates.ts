// Datas do Ninho. O "dia doméstico" é sempre o de São Paulo, independentemente
// do fuso do aparelho ou do servidor. Datas trafegam como 'YYYY-MM-DD' (string)
// e toda aritmética é feita em UTC puro, sem depender do fuso local.

export const HOME_TZ = 'America/Sao_Paulo'
const DAY = 86400000

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: HOME_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export interface HomeClock {
  /** 'YYYY-MM-DD' em São Paulo */
  date: string
  /** 'HH:MM' em São Paulo */
  hm: string
  hour: number
  /** 0 = domingo … 6 = sábado */
  dow: number
}

/** Hora e data de um instante, vistos em São Paulo. */
export function homeClock(instant: Date = new Date()): HomeClock {
  const p: Record<string, string> = {}
  for (const x of partsFmt.formatToParts(instant)) p[x.type] = x.value
  const hour = Number(p.hour) % 24
  const date = `${p.year}-${p.month}-${p.day}`
  return { date, hm: `${String(hour).padStart(2, '0')}:${p.minute}`, hour, dow: dowOf(date) }
}

/** Data de hoje em São Paulo. */
export function homeToday(instant: Date = new Date()): string {
  return homeClock(instant).date
}

function toUTC(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): string {
  const x = new Date(ms)
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`
}

/** Número de dias desde 1970-01-01 (para comparar e contar dias). */
export function dayNum(date: string): number {
  return Math.round(toUTC(date) / DAY)
}

export function addDays(date: string, n: number): string {
  return fromUTC(toUTC(date) + n * DAY)
}

/** 0 = domingo … 6 = sábado */
export function dowOf(date: string): number {
  return new Date(toUTC(date)).getUTCDay()
}

/** Segunda-feira da semana da data (a semana do Ninho começa na segunda). */
export function weekStartOf(date: string): string {
  const dow = dowOf(date)
  return addDays(date, -(dow === 0 ? 6 : dow - 1))
}

/** Índice do dia na semana do Ninho: 0 = segunda … 6 = domingo. */
export function weekdayIndex(date: string): number {
  const dow = dowOf(date)
  return dow === 0 ? 6 : dow - 1
}

export function monthStart(date: string): string {
  return date.slice(0, 8) + '01'
}

/** 'DD/MM' a partir de 'YYYY-MM-DD'. */
export function fmtDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

/** "quarta-feira, 7 de outubro" em São Paulo. */
export function longDateLabel(instant: Date): string {
  return instant.toLocaleDateString('pt-BR', { timeZone: HOME_TZ, weekday: 'long', day: 'numeric', month: 'long' })
}

/** "14:05" de um instante (timestamptz), em São Paulo. */
export function timeOfInstant(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: HOME_TZ, hour: '2-digit', minute: '2-digit' })
}

/** 'HH:MM' a partir de '07:00:00' ou '07:00'. */
export function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : ''
}

export function greeting(hour: number): string {
  return hour < 5 ? 'Boa noite' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}
