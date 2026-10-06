// Agenda da casa: eventos domésticos, manutenções que vencem e vencimentos simples.
// Puro (sem React/Supabase). Não é módulo financeiro: vencimento é só nome, data,
// responsável e pago/pendente, com link opcional para o Sobrou!.
import { addDays, dowOf } from './dates'

export type EventKind = 'consulta_caes' | 'visita' | 'entrega' | 'servico' | 'compromisso' | 'vencimento'
export const KINDS: Array<[EventKind, string, string]> = [
  ['consulta_caes', '🐾', 'Consulta dos cães'],
  ['visita', '🏠', 'Visita'],
  ['entrega', '📦', 'Entrega'],
  ['servico', '🔧', 'Serviço'],
  ['compromisso', '📅', 'Compromisso da casa'],
  ['vencimento', '🧾', 'Vencimento'],
]
export const kindIcon = (k: string) => KINDS.find(x => x[0] === k)?.[1] || '📅'
export const kindLabel = (k: string) => KINDS.find(x => x[0] === k)?.[2] || 'Evento'

export interface HouseEvent {
  id: string, kind: EventKind, title: string, date: string, time: string | null
  who: 'g' | 's' | 'both' | null, notes: string | null, link: string | null, paid: boolean | null, done_at: string | null
}

export interface AgendaEntry {
  key: string
  date: string
  time: string | null
  title: string
  icon: string
  source: 'event' | 'maint'
  event?: HouseEvent
  maintId?: string
  late: boolean
}

/**
 * Próximos dias: eventos (menos vencimentos, que têm a própria lista) e manutenções que vencem.
 * Eventos passados que não foram marcados como feitos ficam em "atrasados".
 */
export function agendaEntries(events: HouseEvent[], maint: Array<{ id: string, title: string, next_due: string, category: string }>, today: string, days = 60): AgendaEntry[] {
  const until = addDays(today, days)
  const ev: AgendaEntry[] = events
    .filter(e => e.kind !== 'vencimento' && !e.done_at && e.date <= until)
    .map(e => ({ key: 'e:' + e.id, date: e.date, time: e.time, title: e.title, icon: kindIcon(e.kind), source: 'event' as const, event: e, late: e.date < today }))
  const mt: AgendaEntry[] = maint
    .filter(m => m.next_due <= until)
    .map(m => ({ key: 'm:' + m.id, date: m.next_due, time: null, title: m.title, icon: m.category === 'caes' ? '🐾' : '🔧', source: 'maint' as const, maintId: m.id, late: m.next_due < today }))
  return [...ev, ...mt].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99') || a.title.localeCompare(b.title))
}

/** Agrupa por dia: "Atrasados", "Hoje", "Amanhã", "sex, 09/10"… */
export function groupByDay(entries: AgendaEntry[], today: string): Array<{ label: string, date: string, items: AgendaEntry[] }> {
  const out: Array<{ label: string, date: string, items: AgendaEntry[] }> = []
  const late = entries.filter(e => e.late)
  if (late.length) out.push({ label: 'Atrasados', date: '', items: late })
  for (const e of entries.filter(x => !x.late)) {
    let g = out.find(x => x.date === e.date)
    if (!g) { g = { label: dayLabel(e.date, today), date: e.date, items: [] }; out.push(g) }
    g.items.push(e)
  }
  return out
}

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoje'
  if (date === addDays(today, 1)) return 'Amanhã'
  return `${DOW[dowOf(date)]}, ${date.slice(8, 10)}/${date.slice(5, 7)}`
}

/** Vencimentos: pendentes primeiro (atrasados no topo), depois os pagos recentes. */
export function bills(events: HouseEvent[], today: string): { pending: HouseEvent[], paid: HouseEvent[], overdue: number } {
  const all = events.filter(e => e.kind === 'vencimento')
  const pending = all.filter(e => !e.paid).sort((a, b) => a.date.localeCompare(b.date))
  const paid = all.filter(e => e.paid && e.date >= addDays(today, -45)).sort((a, b) => b.date.localeCompare(a.date))
  return { pending, paid, overdue: pending.filter(e => e.date < today).length }
}

/** Link do vencimento: o do próprio item, senão o do Sobrou! da casa. Só http(s). */
export function billLink(e: Pick<HouseEvent, 'link'>, sobrouUrl: string | null): string | null {
  const l = e.link || sobrouUrl
  return l && /^https?:\/\//i.test(l) ? l : null
}
