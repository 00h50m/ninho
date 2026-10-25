// Escala fixa dos cães (migration 037). Duas formas de dividir as rotinas dos cães:
//  · rodízio: como sempre, alternam sozinhas entre vocês;
//  · escala: cada dia da semana e período (manhã, tarde, noite) tem dona fixa.
// O período vem do horário da rotina (manhã até 11h59, tarde até 17h59, noite a partir das 18h).
// Rotina sem horário, ou período sem dona na escala, continua no rodízio. Puro, testado.
import type { Who } from './types'
import { dowOf } from './dates'

export type DogMode = 'rodizio' | 'escala'
export type Period = 'manha' | 'tarde' | 'noite'
export interface ScheduleCell { dow: number, period: Period, who: Who }
export interface DogPlan { mode: DogMode, cells: ScheduleCell[] }

export const PERIODS: Array<[Period, string, string]> = [['manha', 'Manhã', 'até 11h59'], ['tarde', 'Tarde', '12h às 17h59'], ['noite', 'Noite', 'a partir das 18h']]
export const DOWS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DOW_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Período do horário "HH:MM" (sem horário = null: fica no rodízio). */
export function periodOf(time: string | null | undefined): Period | null {
  if (!time || !/^\d{2}:\d{2}/.test(time)) return null
  const h = Number(time.slice(0, 2))
  return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite'
}

/** Dona pela escala naquele dia e horário; null = rodízio. */
export function scheduleOwner(plan: DogPlan | null | undefined, date: string, time: string | null | undefined): { who: Who, dow: number, period: Period } | null {
  if (!plan || plan.mode !== 'escala') return null
  const period = periodOf(time)
  if (!period) return null
  const dow = dowOf(date)
  const c = plan.cells.find(x => x.dow === dow && x.period === period)
  return c ? { who: c.who, dow, period } : null
}

/** Quantos turnos (dia × período) cada uma tem na semana, e quantos ficam no rodízio. */
export function scheduleLoad(cells: ScheduleCell[]): { g: number, s: number, free: number } {
  const g = cells.filter(c => c.who === 'g').length, s = cells.filter(c => c.who === 's').length
  return { g, s, free: 21 - g - s }
}

/** Toque na célula: rodízio → Giovanna → Sabrina → rodízio. */
export const nextWho = (w: Who | null): Who | null => w === null ? 'g' : w === 'g' ? 's' : null

/** Linhas do banco conferidas. */
export function cellsFromDb(rows: unknown): ScheduleCell[] {
  return (Array.isArray(rows) ? rows : []).flatMap((r: any): ScheduleCell[] => {
    const dow = Number(r?.dow)
    return Number.isInteger(dow) && dow >= 0 && dow <= 6 && ['manha', 'tarde', 'noite'].includes(r?.period) && (r?.who === 'g' || r?.who === 's') ? [{ dow, period: r.period, who: r.who }] : []
  })
}

export const escalaLabel = (dow: number, period: Period, who: Who, names: Record<Who, string>) =>
  `Escala dos cães: ${DOW_LONG[dow]} de ${PERIODS.find(p => p[0] === period)![1].toLowerCase()} é da ${(names[who] || '').split(' ')[0]}`
