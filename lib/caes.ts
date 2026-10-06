// Cães: cuidados de saúde (com a próxima aplicação), alimentação e filhote.
// Puro, sem React/Supabase. Só registro e lembrete — nada de diagnóstico.
import { HOME_TZ, addDays, dayNum, weekStartOf } from './dates'

export type HealthKind = 'vacina' | 'vermifugo' | 'antipulgas' | 'medicamento' | 'consulta' | 'banho' | 'peso' | 'outro'
/** [tipo, ícone, nome, repetir a cada (dias) sugerido, sugestões de nome] */
export const HEALTH_KINDS: Array<[HealthKind, string, string, number | null, string[]]> = [
  ['vacina', '💉', 'Vacina', 365, ['V10', 'V8', 'Antirrábica', 'Gripe canina', 'Giárdia']],
  ['vermifugo', '💊', 'Vermífugo', 90, ['Vermífugo']],
  ['antipulgas', '🐜', 'Antipulgas', 30, ['Antipulgas e carrapatos']],
  ['medicamento', '🩹', 'Medicamento', null, []],
  ['consulta', '🩺', 'Consulta', null, ['Consulta de rotina', 'Retorno']],
  ['banho', '🛁', 'Banho', 15, ['Banho', 'Banho e tosa']],
  ['peso', '⚖️', 'Peso', null, ['Peso']],
  ['outro', '📝', 'Outro cuidado', null, []],
]
export const kindInfo = (k: string) => HEALTH_KINDS.find(x => x[0] === k) || HEALTH_KINDS[HEALTH_KINDS.length - 1]

export interface HealthRecord {
  id: string, dog_id: string, kind: HealthKind, title: string, date: string, next_date: string | null, every_days: number | null
  dose: string | null, vet: string | null, weight_kg: number | null, notes: string | null, link: string | null, done_by: 'g' | 's' | null
}

/**
 * Próximas aplicações: para cada cuidado (cão + tipo + nome), vale só o registro mais recente.
 * Devolve os que têm próxima data até `days` dias (atrasados primeiro).
 */
export function upcomingCare(records: HealthRecord[], today: string, days = 30): Array<HealthRecord & { late: boolean, inDays: number }> {
  const latest = new Map<string, HealthRecord>()
  for (const r of records) {
    const k = `${r.dog_id}|${r.kind}|${r.title.trim().toLowerCase()}`
    const cur = latest.get(k)
    if (!cur || r.date > cur.date) latest.set(k, r)
  }
  const until = addDays(today, days)
  return Array.from(latest.values())
    .filter(r => r.next_date && r.next_date <= until)
    .map(r => ({ ...r, late: r.next_date! < today, inDays: dayNum(r.next_date!) - dayNum(today) }))
    .sort((a, b) => a.next_date!.localeCompare(b.next_date!))
}

/** Próxima data sugerida: data + repetir a cada N dias. */
export function suggestNext(date: string, everyDays: number | null): string | null {
  return everyDays ? addDays(date, everyDays) : null
}

export function currentWeight(records: HealthRecord[], dogId: string): { kg: number, date: string } | null {
  const w = records.filter(r => r.dog_id === dogId && r.kind === 'peso' && r.weight_kg).sort((a, b) => b.date.localeCompare(a.date))[0]
  return w ? { kg: Number(w.weight_kg), date: w.date } : null
}

export function ageLabel(birth: string | null | undefined, today: string): string | null {
  if (!birth || birth > today) return null
  const [by, bm, bd] = birth.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number)
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0)
  if (months < 1) return `${dayNum(today) - dayNum(birth)} dias`
  if (months < 24) return `${months} ${months === 1 ? 'mês' : 'meses'}`
  return `${Math.floor(months / 12)} anos`
}

/** Dias de ração que ainda restam (estoque registrado − consumo desde então). */
export function foodDaysLeft(d: { food_stock_kg?: number | null, food_stock_on?: string | null, food_g_day?: number | null }, today: string): number | null {
  if (d.food_stock_kg == null || !d.food_stock_on || !d.food_g_day) return null
  const total = Math.floor(Number(d.food_stock_kg) * 1000 / d.food_g_day)
  return Math.max(0, total - Math.max(0, dayNum(today) - dayNum(d.food_stock_on)))
}

// ── Filhote ──────────────────────────────────────────────────────────
export interface AccidentRow { id: string, dog_id: string, location: string, date: string, occurred_at: string, notes?: string | null }
export type Period = 'madrugada' | 'manha' | 'tarde' | 'noite'
export const PERIOD_LABEL: Record<Period, string> = { madrugada: 'Madrugada', manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

export function hourOf(iso: string): number {
  return Number(new Date(iso).toLocaleString('en-GB', { timeZone: HOME_TZ, hour: '2-digit', hour12: false }).slice(0, 2)) % 24
}
export function periodOf(iso: string): Period {
  const h = hourOf(iso)
  return h < 6 ? 'madrugada' : h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite'
}

/** Evolução semanal (últimas N semanas, segunda a domingo), locais e períodos mais frequentes. */
export function puppyStats(acc: AccidentRow[], today: string, weeks = 6) {
  const ws = weekStartOf(today)
  const perWeek = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(ws, -7 * (weeks - 1 - i)), end = addDays(start, 6)
    return { start, count: acc.filter(a => a.date >= start && a.date <= end).length }
  })
  const since = perWeek[0].start
  const recent = acc.filter(a => a.date >= since)
  const places = new Map<string, number>()
  for (const a of recent) places.set(a.location, (places.get(a.location) || 0) + 1)
  const periods: Record<Period, number> = { madrugada: 0, manha: 0, tarde: 0, noite: 0 }
  for (const a of recent) periods[periodOf(a.occurred_at)]++
  const [prev, cur] = [perWeek[weeks - 2]?.count ?? 0, perWeek[weeks - 1].count]
  return {
    perWeek,
    topPlaces: Array.from(places.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3),
    periods,
    trend: cur < prev ? 'down' as const : cur > prev ? 'up' as const : 'same' as const,
  }
}
