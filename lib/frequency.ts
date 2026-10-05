// Regras de frequência atuais: diária, semanal (semana começa na segunda),
// quinzenal (blocos fixos de 2 semanas), mensal (mês do calendário), pontual.
import type { Doable } from './types'
import { dayNum, dowOf, monthStart, weekStartOf, addDays } from './dates'

const EPOCH_MON = dayNum('1970-01-05') // uma segunda-feira

export function weekNum(date: string): number {
  return Math.floor((dayNum(date) - EPOCH_MON) / 7)
}

/** Primeiro dia do período atual da frequência. Uma conclusão a partir dele vale para o período. */
export function periodStart(freq: string, today: string): string {
  const ws = weekStartOf(today)
  if (freq === 'daily') return today
  if (freq === 'weekly') return ws
  if (freq === 'biweekly') return weekNum(today) % 2 === 0 ? ws : addDays(ws, -7)
  if (freq === 'monthly') return monthStart(today)
  return '0000-01-01' // pontual: qualquer conclusão vale para sempre
}

/** Número do período (muda a cada novo dia/semana/quinzena/mês). Usado no rodízio. */
export function periodIdx(freq: string, today: string): number {
  if (freq === 'daily') return dayNum(today)
  if (freq === 'weekly') return weekNum(today)
  if (freq === 'biweekly') return Math.floor(weekNum(today) / 2)
  if (freq === 'monthly') return Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7))
  return 0
}

export function lastDone(x: Doable, today: string): string | null {
  return x.completed_today ? today : (x.prev_done || null)
}

export function doneInPeriod(x: Doable, today: string): boolean {
  const l = lastDone(x, today)
  return !!l && l >= periodStart(x.frequency, today)
}

/** Segunda = 0 … domingo = 6 (a semana do Ninho começa na segunda). */
const monIdx = (dow: number) => (dow + 6) % 7

/**
 * A tarefa vale neste dia?
 * · diária com dias da semana: só nesses dias;
 * · semanal/quinzenal com dias: a partir do primeiro desses dias no período;
 * · pontual com data: a partir da data;
 * · mensal e sem dias: qualquer dia.
 */
export function scheduledOn(x: Doable, date: string): boolean {
  if (x.frequency === 'once') return !x.due_date || date >= x.due_date
  const wd = x.weekdays
  if (!wd || !wd.length || x.frequency === 'monthly') return true
  if (x.frequency === 'daily') return wd.includes(dowOf(date))
  const first = Math.min(...wd.map(monIdx))
  return monIdx(dowOf(date)) >= first || (x.frequency === 'biweekly' && dayNum(date) - dayNum(periodStart(x.frequency, date)) >= 7)
}

/** Pulada (no período) ou deixada para amanhã (hoje). */
export function skippedNow(x: Doable, today: string): boolean {
  const s = x.skip
  if (!s) return false
  return s.kind === 'snooze' ? s.date === today : s.date >= periodStart(x.frequency, today) && s.date <= today
}

/** Aparece em Hoje: feita hoje (para poder desmarcar) ou do dia, não pulada e ainda não feita no período. */
export function dueToday(x: Doable, today: string): boolean {
  if (x.completed_today) return true
  return scheduledOn(x, today) && !skippedNow(x, today) && !doneInPeriod(x, today)
}

/** Ao contrário de dueToday, só pela pausa: estaria em Hoje se não tivesse sido pulada/adiada. */
export function pausedToday(x: Doable, today: string): boolean {
  return !x.completed_today && skippedNow(x, today) && scheduledOn(x, today) && !doneInPeriod(x, today)
}

export const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "seg, qua, sex" · "dias úteis" · "fim de semana" */
export function weekdaysLabel(wd: number[] | null | undefined): string {
  if (!wd || !wd.length || wd.length === 7) return ''
  const s = [...wd].sort((a, b) => monIdx(a) - monIdx(b))
  if (s.join() === '1,2,3,4,5') return 'dias úteis'
  if (s.join() === '6,0') return 'fim de semana'
  return s.map(d => WEEKDAY_SHORT[d]).join(', ')
}

export function lastLabel(d: string | null, today: string): string {
  if (!d) return 'nunca feita'
  const n = dayNum(today) - dayNum(d)
  return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`
}
