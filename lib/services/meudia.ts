// Meu dia (migration 021). A privacidade é do banco: a outra só recebe o que foi compartilhado.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { PKind, PLog, PMed, PQuit, PSettings } from '@/lib/meudia'
import type { CustomFood, FoodProfile } from '@/lib/nutricao'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}

export interface MeuDiaData { available: boolean, settings: PSettings[], logs: PLog[], meds: PMed[], quits: PQuit[], quitsReady?: boolean, profiles: FoodProfile[], foods: CustomFood[], foodReady?: boolean, reason?: string }

export async function loadMeuDia(householdId: string, from: string): Promise<MeuDiaData> {
  const [s, l, m, q, fp, ff] = await Promise.all([
    supabase.from('personal_settings').select('who,water_goal_ml,cup_ml,sleep_goal_h,share,selfcare').eq('household_id', householdId),
    supabase.from('personal_logs').select('id,who,date,kind,value,data,created_at').eq('household_id', householdId).gte('date', from).order('date').limit(4000),
    supabase.from('personal_meds').select('id,who,name,dose,times,active').eq('household_id', householdId).eq('active', true).order('name'),
    supabase.from('personal_quits').select('id,who,title,reason,started_on,active').eq('household_id', householdId).eq('active', true).order('created_at'),
    supabase.from('personal_food_profile').select('who,sex,birth_year,height_cm,activity,goal,pace_kg_week,target_kg,kcal_override,hide_numbers').eq('household_id', householdId),
    supabase.from('personal_foods').select('id,who,name,portion,portion_g,kcal,protein,carb,fat').eq('household_id', householdId).eq('active', true).order('name'),
  ])
  const e = s.error || l.error || m.error
  if (e) {
    if (isMissingTable(e)) { logError('Meu dia indisponível', e); return { available: false, settings: [], logs: [], meds: [], quits: [], profiles: [], foods: [], reason: [e.code, e.message].filter(Boolean).join(' · ') } }
    must({ data: null, error: e }, 'carregar Meu dia')
  }
  // "Parar de…" (migration 025) é opcional: sem a tabela, o resto do Meu dia segue normal
  if (q.error && !isMissingTable(q.error)) must({ data: null, error: q.error }, 'carregar Parar de…')
  // Alimentação (migration 026) também é opcional
  const fe = fp.error || ff.error
  if (fe && !isMissingTable(fe)) must({ data: null, error: fe }, 'carregar Alimentação')
  const n = (v: any) => v == null ? null : Number(v)
  return {
    available: true, settings: (s.data || []) as PSettings[], logs: ((l.data || []) as any[]).map(x => ({ ...x, value: x.value == null ? null : Number(x.value) })), meds: (m.data || []) as PMed[],
    quits: q.error ? [] : (q.data || []) as PQuit[], quitsReady: !q.error,
    profiles: fe ? [] : ((fp.data || []) as any[]).map(x => ({ ...x, height_cm: Number(x.height_cm), pace_kg_week: Number(x.pace_kg_week), target_kg: n(x.target_kg) })) as FoodProfile[],
    foods: fe ? [] : ((ff.data || []) as any[]).map(x => ({ ...x, portion_g: Number(x.portion_g), kcal: Number(x.kcal), protein: n(x.protein), carb: n(x.carb), fat: n(x.fat) })) as CustomFood[],
    foodReady: !fe,
  }
}

export async function saveSettings(householdId: string, who: Who, s: Partial<Omit<PSettings, 'who'>>): Promise<void> {
  must(await supabase.from('personal_settings').upsert({ household_id: householdId, who, ...s, updated_at: new Date().toISOString() }, { onConflict: 'household_id,who' }).select('who'), 'salvar ajustes do Meu dia')
}

export async function addLog(householdId: string, who: Who, date: string, kind: PKind, value: number | null, data: Record<string, any> = {}, id?: string): Promise<PLog> {
  return must(await supabase.from('personal_logs').insert({ ...(id ? { id } : {}), household_id: householdId, who, date, kind, value, data }).select('id,who,date,kind,value,data,created_at').single(), 'registrar') as PLog
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

export async function saveQuit(householdId: string, who: Who, q: { id?: string, title: string, reason: string | null, started_on?: string }): Promise<void> {
  const row = { title: q.title.trim().slice(0, 60), reason: q.reason?.trim().slice(0, 200) || null, ...(q.started_on ? { started_on: q.started_on } : {}) }
  if (q.id) must(await supabase.from('personal_quits').update(row).eq('id', q.id).select('id'), 'salvar hábito')
  else must(await supabase.from('personal_quits').insert({ ...row, household_id: householdId, who }).select('id'), 'cadastrar hábito')
}

export async function stopQuit(id: string): Promise<void> {
  must(await supabase.from('personal_quits').update({ active: false }).eq('id', id).select('id'), 'encerrar hábito')
}

export async function saveFoodProfile(householdId: string, who: Who, p: Omit<FoodProfile, 'who'>): Promise<void> {
  must(await supabase.from('personal_food_profile').upsert({ household_id: householdId, who, ...p, updated_at: new Date().toISOString() }, { onConflict: 'household_id,who' }).select('who'), 'salvar perfil da alimentação')
}

export async function saveFood(householdId: string, who: Who, f: Omit<CustomFood, 'id' | 'who'> & { id?: string }): Promise<void> {
  const row = { name: f.name.trim().slice(0, 60), portion: f.portion.trim().slice(0, 30) || '1 porção', portion_g: f.portion_g, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat }
  if (f.id) must(await supabase.from('personal_foods').update(row).eq('id', f.id).select('id'), 'salvar alimento')
  else must(await supabase.from('personal_foods').insert({ ...row, household_id: householdId, who }).select('id'), 'cadastrar alimento')
}

export async function stopFood(id: string): Promise<void> {
  must(await supabase.from('personal_foods').update({ active: false }).eq('id', id).select('id'), 'remover alimento')
}
