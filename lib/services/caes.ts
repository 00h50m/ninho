// Cães (migration 020): saúde, perfil e acidentes do filhote. Sem a migration: indisponível.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { AccidentRow, HealthRecord } from '@/lib/caes'
import { cellsFromDb, type DogMode, type DogPlan, type Period } from '@/lib/escala'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}
const COLS = 'id,dog_id,kind,title,date,next_date,every_days,dose,vet,weight_kg,notes,link,done_by'

export async function loadHealth(householdId: string): Promise<{ available: boolean, records: HealthRecord[] }> {
  const r = await supabase.from('dog_health').select(COLS).eq('household_id', householdId).order('date', { ascending: false }).limit(500)
  if (r.error) {
    if (isMissingTable(r.error)) return { available: false, records: [] }
    must(r, 'carregar saúde dos cães')
  }
  return { available: true, records: (r.data || []) as HealthRecord[] }
}

export type HealthInput = Omit<HealthRecord, 'id' | 'done_by'> & { id?: string }

export async function saveHealth(householdId: string, by: Who | null, d: HealthInput): Promise<void> {
  const row = {
    dog_id: d.dog_id, kind: d.kind, title: d.title.trim(), date: d.date, next_date: d.next_date || null, every_days: d.every_days || null,
    dose: d.dose?.trim() || null, vet: d.vet?.trim() || null, weight_kg: d.weight_kg ?? null, notes: d.notes?.trim() || null, link: d.link?.trim() || null,
  }
  if (d.id) must(await supabase.from('dog_health').update(row).eq('id', d.id).select('id'), 'salvar cuidado')
  else must(await supabase.from('dog_health').insert({ ...row, household_id: householdId, done_by: by }).select('id'), 'registrar cuidado')
}

export async function deleteHealth(id: string): Promise<void> {
  must(await supabase.from('dog_health').delete().eq('id', id).select('id'), 'apagar cuidado')
}

/** Acidentes dos últimos 60 dias (para as estatísticas do filhote). */
export async function loadAccidents(householdId: string, from: string): Promise<AccidentRow[]> {
  return must(await supabase.from('puppy_accidents').select('*').eq('household_id', householdId).gte('date', from).order('occurred_at', { ascending: false }).limit(400), 'carregar acidentes') as AccidentRow[]
}

export async function updateAccident(id: string, patch: { location?: string, occurred_at?: string, date?: string, notes?: string | null }): Promise<void> {
  must(await supabase.from('puppy_accidents').update(patch).eq('id', id).select('id'), 'corrigir acidente')
}

export async function deleteAccident(id: string): Promise<void> {
  must(await supabase.from('puppy_accidents').delete().eq('id', id).select('id'), 'apagar acidente')
}

/** Escala fixa dos cães (037). ready = false: falta a migration (tudo no rodízio). */
export async function loadDogPlan(householdId: string): Promise<{ ready: boolean, plan: DogPlan }> {
  const [h, s] = await Promise.all([
    supabase.from('households').select('dog_mode').eq('id', householdId).maybeSingle(),
    supabase.from('dog_schedule').select('dow,period,who').eq('household_id', householdId),
  ])
  if (h.error || s.error) {
    const e = h.error || s.error
    if (!isMissingTable(e) && !/dog_mode/.test(e?.message || '') && e?.code !== '42703') logError('carregar escala dos cães', e)
    return { ready: false, plan: { mode: 'rodizio', cells: [] } }
  }
  return { ready: true, plan: { mode: (h.data as any)?.dog_mode === 'escala' ? 'escala' : 'rodizio', cells: cellsFromDb(s.data) } }
}
export async function setDogMode(householdId: string, mode: DogMode): Promise<void> {
  must(await supabase.from('households').update({ dog_mode: mode }).eq('id', householdId).select('id'), 'mudar a divisão dos cães')
}
/** Um turno da escala: dona fixa, ou null para voltar ao rodízio. */
export async function setScheduleCell(householdId: string, dow: number, period: Period, who: Who | null): Promise<void> {
  if (who) must(await supabase.from('dog_schedule').upsert({ household_id: householdId, dow, period, who, updated_at: new Date().toISOString() }, { onConflict: 'household_id,dow,period' }).select('dow'), 'salvar escala')
  else must(await supabase.from('dog_schedule').delete().eq('household_id', householdId).eq('dow', dow).eq('period', period).select('dow'), 'salvar escala')
}
