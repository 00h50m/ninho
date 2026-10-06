// Meu dia (migration 021). A privacidade é do banco: a outra só recebe o que foi compartilhado.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { PKind, PLog, PMed, PSettings } from '@/lib/meudia'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}

export interface MeuDiaData { available: boolean, settings: PSettings[], logs: PLog[], meds: PMed[], reason?: string }

export async function loadMeuDia(householdId: string, from: string): Promise<MeuDiaData> {
  const [s, l, m] = await Promise.all([
    supabase.from('personal_settings').select('who,water_goal_ml,cup_ml,sleep_goal_h,share,selfcare').eq('household_id', householdId),
    supabase.from('personal_logs').select('id,who,date,kind,value,data,created_at').eq('household_id', householdId).gte('date', from).order('date').limit(4000),
    supabase.from('personal_meds').select('id,who,name,dose,times,active').eq('household_id', householdId).eq('active', true).order('name'),
  ])
  const e = s.error || l.error || m.error
  if (e) {
    if (isMissingTable(e)) { logError('Meu dia indisponível', e); return { available: false, settings: [], logs: [], meds: [], reason: [e.code, e.message].filter(Boolean).join(' · ') } }
    must({ data: null, error: e }, 'carregar Meu dia')
  }
  return { available: true, settings: (s.data || []) as PSettings[], logs: ((l.data || []) as any[]).map(x => ({ ...x, value: x.value == null ? null : Number(x.value) })), meds: (m.data || []) as PMed[] }
}

export async function saveSettings(householdId: string, who: Who, s: Partial<Omit<PSettings, 'who'>>): Promise<void> {
  must(await supabase.from('personal_settings').upsert({ household_id: householdId, who, ...s, updated_at: new Date().toISOString() }, { onConflict: 'household_id,who' }).select('who'), 'salvar ajustes do Meu dia')
}

export async function addLog(householdId: string, who: Who, date: string, kind: PKind, value: number | null, data: Record<string, any> = {}): Promise<PLog> {
  return must(await supabase.from('personal_logs').insert({ household_id: householdId, who, date, kind, value, data }).select('id,who,date,kind,value,data,created_at').single(), 'registrar') as PLog
}

export async function updateLog(id: string, value: number | null, data: Record<string, any>): Promise<void> {
  must(await supabase.from('personal_logs').update({ value, data }).eq('id', id).select('id'), 'atualizar registro')
}

export async function deleteLog(id: string): Promise<void> {
  must(await supabase.from('personal_logs').delete().eq('id', id).select('id'), 'apagar registro')
}

export async function saveMed(householdId: string, who: Who, m: { id?: string, name: string, dose: string | null, times: string[] }): Promise<void> {
  const row = { name: m.name.trim(), dose: m.dose?.trim() || null, times: m.times.filter(Boolean).sort() }
  if (m.id) must(await supabase.from('personal_meds').update(row).eq('id', m.id).select('id'), 'salvar remédio')
  else must(await supabase.from('personal_meds').insert({ ...row, household_id: householdId, who }).select('id'), 'cadastrar remédio')
}

export async function stopMed(id: string): Promise<void> {
  must(await supabase.from('personal_meds').update({ active: false }).eq('id', id).select('id'), 'parar remédio')
}
