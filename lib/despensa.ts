// Despensa com validade (migration 038): o que tem em casa, onde fica e quando vence.
// "Usar logo" = vence em até 3 dias; acabou → vai para a lista de compras. Puro, testado.
import { dayNum } from './dates'
import type { Who } from './types'

export type Place = 'despensa' | 'geladeira' | 'freezer' | 'banheiro' | 'limpeza' | 'outros'
export const PLACES: Array<[Place, string]> = [['geladeira', '🧊 Geladeira'], ['freezer', '❄️ Freezer'], ['despensa', '🥫 Despensa'], ['banheiro', '🧴 Banheiro'], ['limpeza', '🧽 Limpeza'], ['outros', '📦 Outros']]
export interface PantryItem { id: string, name: string, place: Place, qty: string | null, expires_on: string | null, created_by?: Who | null }

export type Urgency = 'vencido' | 'hoje' | 'logo' | 'semana' | 'ok' | 'sem'
/** Situação da validade: vencido, vence hoje, logo (até 3 dias), na semana (até 7), ok ou sem validade. */
export function urgency(it: Pick<PantryItem, 'expires_on'>, today: string): { u: Urgency, days: number | null } {
  if (!it.expires_on) return { u: 'sem', days: null }
  const d = dayNum(it.expires_on) - dayNum(today)
  return { u: d < 0 ? 'vencido' : d === 0 ? 'hoje' : d <= 3 ? 'logo' : d <= 7 ? 'semana' : 'ok', days: d }
}
export function urgencyLabel(it: Pick<PantryItem, 'expires_on'>, today: string): string {
  const { u, days } = urgency(it, today)
  if (u === 'sem') return 'sem validade'
  if (u === 'vencido') return days === -1 ? 'venceu ontem' : `venceu há ${-days!} dias`
  if (u === 'hoje') return 'vence hoje'
  if (days === 1) return 'vence amanhã'
  return `vence em ${days} dias`
}
const RANK: Record<Urgency, number> = { vencido: 0, hoje: 1, logo: 2, semana: 3, ok: 4, sem: 5 }
/** Lista por lugar, com o que vence antes no topo de cada lugar. */
export function byPlace(items: PantryItem[], today: string): Array<{ place: Place, label: string, items: PantryItem[] }> {
  return PLACES.map(([place, label]) => ({ place, label, items: items.filter(i => i.place === place)
    .sort((a, b) => RANK[urgency(a, today).u] - RANK[urgency(b, today).u] || String(a.expires_on || '9999').localeCompare(String(b.expires_on || '9999')) || a.name.localeCompare(b.name, 'pt-BR')) }))
    .filter(g => g.items.length)
}
/** "Usar logo": vencidos, de hoje e até 3 dias. */
export const useSoon = (items: PantryItem[], today: string) => items.filter(i => ['vencido', 'hoje', 'logo'].includes(urgency(i, today).u))
  .sort((a, b) => String(a.expires_on).localeCompare(String(b.expires_on)))

/** Lugar provável pelo nome (para já sugerir no cadastro). */
export function guessPlace(name: string): Place {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/congelad|sorvete|polpa|gelo/.test(n)) return 'freezer'
  if (/leite|iogurte|queijo|presunto|manteiga|requeijao|ovo|carne|frango|peixe|fruta|verdura|legume|alface|tomate|suco|creme de leite|margarina|frios/.test(n)) return 'geladeira'
  if (/shampoo|sabonete|pasta de dente|creme dental|desodorante|papel higienico|absorvente|condicionador/.test(n)) return 'banheiro'
  if (/detergente|sabao|amaciante|desinfetante|agua sanitaria|esponja|multiuso|alcool|limpa/.test(n)) return 'limpeza'
  return 'despensa'
}

/** Compras finalizadas recentes que ainda não estão na despensa (para guardar com um toque). */
export function fromShopping(history: Array<{ title: string, done_at: string | null, category?: string }>, items: PantryItem[], today: string, days = 3): string[] {
  const have = new Set(items.map(i => i.name.trim().toLowerCase()))
  const seen = new Set<string>()
  return history.filter(h => h.done_at && dayNum(today) - dayNum(h.done_at.slice(0, 10)) <= days)
    .map(h => h.title.trim()).filter(t => { const k = t.toLowerCase(); if (have.has(k) || seen.has(k)) return false; seen.add(k); return true }).slice(0, 20)
}
