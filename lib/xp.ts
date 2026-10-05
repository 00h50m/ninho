// Regras de XP, nível e sequência mostradas no app.
// O total oficial vem do banco (ninho_household_xp); aqui ficam os valores por item
// e o cálculo visual. Os pesos precisam bater com ninho_xp_for_weight (migration 003).
import type { Weight } from './types'

export const XPW: Record<Weight, number> = { light: 1, medium: 2, heavy: 3 }
/** Cada rotina de cão concluída vale 1 XP (por cão). */
export const DOG_ROUTINE_XP = 1

export const LEVELS = [
  { l: 1, n: 'Nest Builders', min: 0, max: 100 },
  { l: 2, n: 'Nest Keepers', min: 100, max: 300 },
  { l: 3, n: 'Home Runners', min: 300, max: 600 },
  { l: 4, n: 'Domestic Legends', min: 600, max: 1000 },
  { l: 5, n: 'Ninho Masters', min: 1000, max: 9999 },
]

export function xpForWeight(w: string): number {
  return XPW[w as Weight] ?? 1
}

export function getLevel(xp: number) {
  return [...LEVELS].reverse().find(l => xp >= l.min) || LEVELS[0]
}

export function levelProgress(xp: number): number {
  const lv = getLevel(xp)
  return Math.max(0, Math.min(100, Math.round(((xp - lv.min) / (lv.max - lv.min)) * 100)))
}

/** Origem do XP, no mesmo formato do banco: 'task:<id>:<data>' ou 'dog:<id>:<data>'. */
export function xpReason(kind: 'task' | 'dog', id: string, date: string): string {
  return `${kind}:${id}:${date}`
}

/**
 * Bolinhas da semana no card Sequência (segunda → domingo).
 * 'today' = hoje ainda sem conclusão; 'on' = dia dentro da sequência.
 */
export function weekDots(todayIndex: number, streak: number, doneToday: boolean): Array<'on' | 'today' | ''> {
  return [0, 1, 2, 3, 4, 5, 6].map(i => {
    if (i === todayIndex) return doneToday ? 'on' : 'today'
    if (i < todayIndex && todayIndex - i <= streak - (doneToday ? 1 : 0)) return 'on'
    return ''
  })
}

export function getChaosInfo(p: number) {
  if (p < 35) return { label: 'Organizada ✦', color: 'var(--green)' }
  if (p < 65) return { label: 'Atenção necessária', color: 'var(--amb)' }
  return { label: 'Casa em alerta!', color: 'var(--cor)' }
}
