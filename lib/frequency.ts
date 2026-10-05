// Regras de frequência atuais: diária, semanal (semana começa na segunda),
// quinzenal (blocos fixos de 2 semanas), mensal (mês do calendário), pontual.
import type { Doable } from './types'
import { dayNum, monthStart, weekStartOf, addDays } from './dates'

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

/** Aparece em Hoje: ainda não feita no período, ou feita hoje (para poder desmarcar). */
export function dueToday(x: Doable, today: string): boolean {
  return !!x.completed_today || !doneInPeriod(x, today)
}

export function lastLabel(d: string | null, today: string): string {
  if (!d) return 'nunca feita'
  const n = dayNum(today) - dayNum(d)
  return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`
}
