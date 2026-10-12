// Meu dia (migration 021). A privacidade é do banco: a outra só recebe o que foi compartilhado.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { PKind, PLog, PMed, PQuit, PSettings } from '@/lib/meudia'
import type { CustomFood, FoodProfile } from '@/lib/nutricao'
import { validatePlan, type DietPlan, type PlanRow } from '@/lib/dietPlan'
import type { PGoal } from '@/lib/goals'
import type { MoodRow } from '@/lib/humor'
import { cleanItems, type SavedMeal } from '@/lib/savedMeals'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}

export interface MeuDiaData { available: boolean, settings: PSettings[], logs: PLog[], meds: PMed[], quits: PQuit[], quitsReady?: boolean, profiles: FoodProfile[], foods: CustomFood[], foodReady?: boolean, plans: PlanRow[], plansReady?: boolean, goals: PGoal[], goalsReady?: boolean, saved: SavedMeal[], savedReady?: boolean, reason?: string }

export async function loadMeuDia(householdId: string, from: string): Promise<MeuDiaData> {
  const [s, l, m, q, fp, ff, dp, gl, sm] = await Promise.all([
    supabase.from('personal_settings').select('who,water_goal_ml,cup_ml,sleep_goal_h,share,selfcare').eq('household_id', householdId),
    supabase.from('personal_logs').select('id,who,date,kind,value,data,created_at').eq('household_id', householdId).gte('date', from).order('date').limit(4000),
    supabase.from('personal_meds').select('id,who,name,dose,times,active').eq('household_id', householdId).eq('active', true).order('name'),
    supabase.from('personal_quits').select('id,who,title,reason,started_on,active').eq('household_id', householdId).eq('active', true).order('created_at'),
    supabase.from('personal_food_profile').select('who,sex,birth_year,height_cm,activity,goal,pace_kg_week,target_kg,kcal_override,hide_numbers').eq('household_id', householdId),
    supabase.from('personal_foods').select('id,who,name,portion,portion_g,kcal,protein,carb,fat').eq('household_id', householdId).eq('active', true).order('name'),
    supabase.from('personal_diet_plans').select('id,who,title,plan,source,remind').eq('household_id', householdId).eq('active', true),
    supabase.from('personal_goals').select('id,who,title,kind,unit,start_value,target,start_date,due_date,status').eq('household_id', householdId).neq('status', 'arquivado').order('created_at'),
    supabase.from('personal_saved_meals').select('id,who,name,items,kcal,uses').eq('household_id', householdId).eq('active', true).order('uses', { ascending: false }).order('name'),
  ])
  const e = s.error || l.error || m.error
  if (e) {
    if (isMissingTable(e)) { logError('Meu dia indisponível', e); return { available: false, settings: [], logs: [], meds: [], quits: [], profiles: [], foods: [], plans: [], goals: [], saved: [], reason: [e.code, e.message].filter(Boolean).join(' · ') } }
    must({ data: null, error: e }, 'carregar Meu dia')
  }
  // "Parar de…" (migration 025) é opcional: sem a tabela, o resto do Meu dia segue normal
  if (q.error && !isMissingTable(q.error)) must({ data: null, error: q.error }, 'carregar Parar de…')
  // Alimentação (migration 026) também é opcional
  const fe = fp.error || ff.error
  if (fe && !isMissingTable(fe)) must({ data: null, error: fe }, 'carregar Alimentação')
  const n = (v: any) => v == null ? null : Number(v)
  // Plano alimentar (migration 027) também é opcional
  if (dp.error && !isMissingTable(dp.error)) must({ data: null, error: dp.error }, 'carregar plano alimentar')
  // Objetivos (migration 029) também são opcionais
  if (gl.error && !isMissingTable(gl.error)) must({ data: null, error: gl.error }, 'carregar objetivos')
  // Refeições salvas (migration 031) também são opcionais
  if (sm.error && !isMissingTable(sm.error)) must({ data: null, error: sm.error }, 'carregar refeições salvas')
  return {
    available: true, settings: (s.data || []) as PSettings[], logs: ((l.data || []) as any[]).map(x => ({ ...x, value: x.value == null ? null : Number(x.value) })), meds: (m.data || []) as PMed[],
    quits: q.error ? [] : (q.data || []) as PQuit[], quitsReady: !q.error,
    profiles: fe ? [] : ((fp.data || []) as any[]).map(x => ({ ...x, height_cm: Number(x.height_cm), pace_kg_week: Number(x.pace_kg_week), target_kg: n(x.target_kg) })) as FoodProfile[],
    foods: fe ? [] : ((ff.data || []) as any[]).map(x => ({ ...x, portion_g: Number(x.portion_g), kcal: Number(x.kcal), protein: n(x.protein), carb: n(x.carb), fat: n(x.fat) })) as CustomFood[],
    foodReady: !fe,
    plans: dp.error ? [] : ((dp.data || []) as any[]).flatMap(x => { const plan = validatePlan(x.plan); return plan ? [{ ...x, plan }] : [] }) as PlanRow[],
    plansReady: !dp.error,
    goals: gl.error ? [] : ((gl.data || []) as any[]).map(x => ({ ...x, target: Number(x.target), start_value: n(x.start_value) })) as PGoal[],
    goalsReady: !gl.error,
    saved: sm.error ? [] : ((sm.data || []) as any[]).map(x => ({ ...x, kcal: Number(x.kcal), items: cleanItems(x.items) })) as SavedMeal[],
    savedReady: !sm.error,
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

/** Vários alimentos de uma vez (ex.: os do plano). Devolve quantos entraram. */
export async function saveFoods(householdId: string, who: Who, list: Array<Omit<CustomFood, 'id' | 'who'>>): Promise<number> {
  const rows = list.slice(0, 150).map(f => ({ household_id: householdId, who, name: f.name.trim().slice(0, 60), portion: f.portion.trim().slice(0, 30) || '1 porção', portion_g: Math.min(2000, Math.max(0.1, f.portion_g)), kcal: Math.min(3000, Math.max(0, f.kcal)), protein: f.protein, carb: f.carb, fat: f.fat }))
  for (let i = 0; i < rows.length; i += 50) must(await supabase.from('personal_foods').insert(rows.slice(i, i + 50)).select('id'), 'cadastrar alimentos')
  return rows.length
}

/** Refeição salva (031): nova, ou renomear/atualizar uma existente. */
export async function saveMeal(householdId: string, who: Who, m: { id?: string, name: string, items: SavedMeal['items'], kcal: number }): Promise<void> {
  const row = { name: m.name.trim().slice(0, 60), items: m.items, kcal: m.kcal, updated_at: new Date().toISOString() }
  if (m.id) must(await supabase.from('personal_saved_meals').update(row).eq('id', m.id).select('id'), 'salvar refeição')
  else must(await supabase.from('personal_saved_meals').insert({ ...row, household_id: householdId, who }).select('id'), 'salvar refeição')
}
export async function stopMeal(id: string): Promise<void> {
  must(await supabase.from('personal_saved_meals').update({ active: false }).eq('id', id).select('id'), 'remover refeição salva')
}
/** Conta mais um uso (as mais usadas aparecem primeiro). Falhar aqui não atrapalha o registro. */
export async function countMealUse(id: string, uses: number): Promise<void> {
  await supabase.from('personal_saved_meals').update({ uses: uses + 1 }).eq('id', id)
}

export async function stopFood(id: string): Promise<void> {
  must(await supabase.from('personal_foods').update({ active: false }).eq('id', id).select('id'), 'remover alimento')
}

/** Salva o plano conferido (o anterior fica guardado como inativo). */
export async function savePlan(householdId: string, who: Who, plan: DietPlan, source: string | null): Promise<void> {
  must(await supabase.from('personal_diet_plans').update({ active: false }).eq('household_id', householdId).eq('who', who).eq('active', true).select('id'), 'trocar plano')
  must(await supabase.from('personal_diet_plans').insert({ household_id: householdId, who, title: plan.title.slice(0, 80), plan, source: source?.slice(0, 120) || null }).select('id'), 'salvar plano')
}

export async function setPlanRemind(id: string, remind: boolean): Promise<void> {
  must(await supabase.from('personal_diet_plans').update({ remind }).eq('id', id).select('id'), 'lembretes do plano')
}

export async function stopPlan(id: string): Promise<void> {
  must(await supabase.from('personal_diet_plans').update({ active: false }).eq('id', id).select('id'), 'remover plano')
}

// ── Fotos de evolução (migration 028) ─────────────────────────────────
export interface PPhoto { id: string, who: Who, date: string, pose: 'frente' | 'lado' | 'costas' | 'outra', note: string | null, thumb: string }

/** Lista com as miniaturas (a foto inteira só é buscada para ver ou comparar). null = sem a migration. */
export async function listPhotos(householdId: string): Promise<PPhoto[] | null> {
  const r = await supabase.from('personal_photos').select('id,who,date,pose,note,thumb').eq('household_id', householdId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(300)
  if (r.error) { if (isMissingTable(r.error)) return null; must(r, 'carregar fotos') }
  return (r.data || []) as PPhoto[]
}

export async function photoData(id: string): Promise<string> {
  return (must(await supabase.from('personal_photos').select('data').eq('id', id).single(), 'abrir foto') as any).data
}

export async function addPhoto(householdId: string, who: Who, p: { date: string, pose: PPhoto['pose'], note: string | null, thumb: string, data: string }): Promise<void> {
  must(await supabase.from('personal_photos').insert({ household_id: householdId, who, ...p }).select('id'), 'guardar foto')
}

export async function deletePhoto(id: string): Promise<void> {
  must(await supabase.from('personal_photos').delete().eq('id', id).select('id'), 'apagar foto')
}

// ── Objetivos (migration 029) ─────────────────────────────────────────
export async function saveGoal(householdId: string, who: Who, g: Omit<PGoal, 'id' | 'who' | 'status'> & { id?: string }): Promise<void> {
  const row = { title: g.title.trim().slice(0, 80), kind: g.kind, unit: g.unit?.trim().slice(0, 20) || null, start_value: g.start_value, target: g.target, start_date: g.start_date, due_date: g.due_date || null }
  if (g.id) must(await supabase.from('personal_goals').update(row).eq('id', g.id).select('id'), 'salvar objetivo')
  else must(await supabase.from('personal_goals').insert({ ...row, household_id: householdId, who }).select('id'), 'criar objetivo')
}

export async function setGoalStatus(id: string, status: PGoal['status']): Promise<void> {
  must(await supabase.from('personal_goals').update({ status }).eq('id', id).select('id'), 'atualizar objetivo')
}

/** Humor do check-in de quem está usando (para o calendário do Meu dia). */
export async function loadMoods(householdId: string, who: Who, from: string): Promise<MoodRow[]> {
  const r = await supabase.from('daily_checkins').select('date,mood').eq('household_id', householdId).eq('who', who).gte('date', from).order('date')
  if (r.error) { if (isMissingTable(r.error)) return []; must(r, 'carregar humor') }
  return (r.data || []) as MoodRow[]
}
