// Check-in do dia e registro de cada dia (migration 015). Sem a migration,
// responde "indisponível" e o Início segue sem essas partes.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Energy, Who } from '@/lib/types'
import type { Checkin, DayRow, MoodId } from '@/lib/week'

export interface DaysData { available: boolean, checkins: Checkin[], days: DayRow[] }

export async function loadDays(householdId: string, from: string): Promise<DaysData> {
  const [c, d] = await Promise.all([
    supabase.from('daily_checkins').select('date,who,mood,energy,note').eq('household_id', householdId).gte('date', from).order('date').limit(60),
    supabase.from('household_days').select('date,survival').eq('household_id', householdId).gte('date', from).limit(31),
  ])
  const e = c.error || d.error
  if (e) {
    if (isMissingTable(e)) return { available: false, checkins: [], days: [] }
    logError('carregar check-ins', e)
    throw new NinhoError(e, 'carregar check-ins')
  }
  return { available: true, checkins: (c.data || []) as Checkin[], days: (d.data || []) as DayRow[] }
}

export async function saveCheckin(householdId: string, date: string, who: Who, v: { mood?: MoodId | null, energy?: Energy | null, note?: string | null }): Promise<Checkin> {
  const { data, error } = await supabase.rpc('ninho_checkin', {
    p_household_id: householdId, p_date: date, p_who: who,
    p_mood: v.mood ?? null, p_energy: v.energy ?? null, p_note: v.note === undefined ? null : (v.note ?? ''),
  })
  if (error) { logError('salvar check-in', error); throw new NinhoError(error, 'salvar check-in') }
  return data as Checkin
}

/** Marca que o modo sobrevivência esteve ativo no dia (fica para a visão da semana). */
export async function markSurvivalDay(householdId: string, date: string): Promise<void> {
  const { error } = await supabase.from('household_days').upsert({ household_id: householdId, date, survival: true, updated_at: new Date().toISOString() }, { onConflict: 'household_id,date' })
  if (error && !isMissingTable(error)) logError('marcar dia de sobrevivência', error)
}
