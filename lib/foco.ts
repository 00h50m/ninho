// Modo foco do Início: só o que é seu agora (atrasadas, essenciais e a próxima com horário),
// em tela cheia, para os dias corridos. Puro, testado.
import type { HItem, Who } from './types'
import { hhmm } from './dates'
import { isLate } from './today'

export type FocusWhy = 'late' | 'essential' | 'next'
export interface FocusItem { item: HItem, why: FocusWhy }

const t = (i: HItem) => hhmm(i.scheduled_time) || '99:99'

/**
 * A lista do foco: atrasadas (da mais antiga), essenciais sem atraso (com horário primeiro) e as
 * próximas com horário de hoje, até `max`. `rest` = o que ainda falta de seu hoje fora da lista.
 */
export function focusList(items: HItem[], me: Who | null, ownerOf: (i: HItem) => Who, nowHM: string, max = 5): { list: FocusItem[], rest: number } {
  const mine = items.filter(i => !i.completed_today && (!me || ownerOf(i) === me))
  const late = mine.filter(i => isLate(i, nowHM)).sort((a, b) => t(a).localeCompare(t(b)))
  const ess = mine.filter(i => i.essential && !late.includes(i)).sort((a, b) => t(a).localeCompare(t(b)))
  const next = mine.filter(i => !late.includes(i) && !ess.includes(i) && i.frequency === 'daily' && i.scheduled_time && hhmm(i.scheduled_time) >= nowHM)
    .sort((a, b) => t(a).localeCompare(t(b)))
  const list: FocusItem[] = [...late.map(item => ({ item, why: 'late' as const })), ...ess.map(item => ({ item, why: 'essential' as const })), ...next.map(item => ({ item, why: 'next' as const }))].slice(0, max)
  return { list, rest: mine.length - list.length }
}

export const WHY_LABEL: Record<FocusWhy, string> = { late: '⚠ atrasada', essential: '● essencial', next: '▸ próxima' }
