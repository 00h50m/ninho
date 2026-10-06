// Manutenção recorrente: próxima data, situação e modelos prontos.
// A próxima data oficial é calculada no banco (ninho_next_due); nextDue() espelha a mesma regra
// para montar o formulário e as mensagens.
import type { Who } from './types'
import { addDays, dayNum } from './dates'

export interface MaintenanceItem {
  id: string
  household_id: string
  title: string
  category: MaintCat
  every_months: number | null
  every_days: number | null
  last_done: string | null
  next_due: string
  assigned_to: Who | null
  notes: string | null
  active: boolean
  /** Migration 019 */
  provider?: string | null
  warranty_until?: string | null
  cost?: number | null
  link?: string | null
}

export interface MaintenanceLog { id: string, item_id: string, done_on: string, done_by: Who | null }

export type MaintCat = 'casa' | 'carro' | 'caes' | 'saude' | 'outros'
export const MAINT_CATS: Array<[MaintCat, string]> = [['casa', '🏠 Casa'], ['caes', '🐾 Cães'], ['carro', '🚗 Carro'], ['saude', '🩺 Saúde'], ['outros', '🔧 Outros']]
export const MAINT_CAT_LABEL: Record<string, string> = Object.fromEntries(MAINT_CATS)
export const MAINT_XP = 3
/** "Em breve" = vence nos próximos dias. */
export const SOON_DAYS = 7

/** Mesma regra do banco: meses do calendário (31/01 + 1 mês = 28/02) ou dias corridos. */
export function nextDue(from: string, months: number | null, days: number | null): string {
  if (months) {
    const [y, m, d] = from.split('-').map(Number)
    const total = (m - 1) + months
    const ty = y + Math.floor(total / 12), tm = ((total % 12) + 12) % 12
    const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
    return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
  }
  return addDays(from, days || 30)
}

export type MaintStatus = 'late' | 'today' | 'soon' | 'ok'

export function statusOf(it: Pick<MaintenanceItem, 'next_due'>, today: string): { status: MaintStatus, days: number } {
  const days = dayNum(it.next_due) - dayNum(today)
  return { status: days < 0 ? 'late' : days === 0 ? 'today' : days <= SOON_DAYS ? 'soon' : 'ok', days }
}

export function dueLabel(it: Pick<MaintenanceItem, 'next_due'>, today: string): string {
  const { days } = statusOf(it, today)
  if (days < -1) return `atrasada ${-days} dias`
  if (days === -1) return 'venceu ontem'
  if (days === 0) return 'vence hoje'
  if (days === 1) return 'vence amanhã'
  if (days <= 60) return `em ${days} dias`
  const months = Math.round(days / 30)
  return `em ~${months} ${months === 1 ? 'mês' : 'meses'}`
}

export function everyLabel(it: Pick<MaintenanceItem, 'every_months' | 'every_days'>): string {
  if (it.every_months) {
    const m = it.every_months
    if (m === 12) return 'todo ano'
    if (m % 12 === 0) return `a cada ${m / 12} anos`
    return m === 1 ? 'todo mês' : `a cada ${m} meses`
  }
  const d = it.every_days || 0
  if (d === 7) return 'toda semana'
  if (d % 7 === 0 && d <= 70) return `a cada ${d / 7} semanas`
  return d === 1 ? 'todo dia' : `a cada ${d} dias`
}

/** Itens que precisam de atenção (atrasados, hoje, em breve), do mais urgente ao menos. */
export function upcoming(items: MaintenanceItem[], today: string, withinDays = SOON_DAYS): MaintenanceItem[] {
  return items.filter(i => i.active && statusOf(i, today).days <= withinDays).sort((a, b) => a.next_due.localeCompare(b.next_due) || a.title.localeCompare(b.title))
}

/** Itens da pessoa (fixos dela ou sem responsável) que vencem até hoje — usados no bom dia. */
export function dueForPerson(items: MaintenanceItem[], who: Who, today: string): MaintenanceItem[] {
  return items.filter(i => i.active && (!i.assigned_to || i.assigned_to === who) && i.next_due <= today).sort((a, b) => a.next_due.localeCompare(b.next_due))
}

export interface MaintTemplate { title: string, category: MaintCat, every_months?: number, every_days?: number }
export const MAINT_TEMPLATES: MaintTemplate[] = [
  { title: 'Limpar filtro do ar-condicionado', category: 'casa', every_months: 3 },
  { title: 'Trocar refil do filtro de água', category: 'casa', every_months: 6 },
  { title: 'Dedetização', category: 'casa', every_months: 6 },
  { title: 'Limpar caixa d’água', category: 'casa', every_months: 6 },
  { title: 'Limpar ralos e sifões', category: 'casa', every_months: 1 },
  { title: 'Lavar cortinas', category: 'casa', every_months: 6 },
  { title: 'Virar o colchão', category: 'casa', every_months: 3 },
  { title: 'Testar disjuntores e trocar lâmpadas', category: 'casa', every_months: 6 },
  { title: 'Vacina V10 (Penélope e Zelda)', category: 'caes', every_months: 12 },
  { title: 'Vacina antirrábica', category: 'caes', every_months: 12 },
  { title: 'Vermífugo', category: 'caes', every_months: 3 },
  { title: 'Antipulgas', category: 'caes', every_days: 30 },
  { title: 'Consulta no veterinário', category: 'caes', every_months: 12 },
  { title: 'Cortar unhas dos cães', category: 'caes', every_days: 21 },
  { title: 'Revisão do carro', category: 'carro', every_months: 12 },
  { title: 'Calibrar pneus', category: 'carro', every_months: 1 },
  { title: 'Trocar óleo', category: 'carro', every_months: 6 },
  { title: 'Check-up / exames de rotina', category: 'saude', every_months: 12 },
  { title: 'Dentista', category: 'saude', every_months: 6 },
]
