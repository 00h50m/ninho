// Despensa e jantar das duas (migration 038). Da casa: as duas veem e editam. Sem a migration: indisponível.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import { guessCategory } from '@/lib/shopping'
import type { Who } from '@/lib/types'
import type { PantryItem, Place } from '@/lib/despensa'
import type { Cook, HouseMeal } from '@/lib/jantar'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}

export interface CasaExtra { ready: boolean, pantry: PantryItem[], meals: HouseMeal[] }

/** Despensa ativa e jantares de duas semanas antes até três semanas depois. */
export async function loadCasaExtra(householdId: string, from: string, to: string): Promise<CasaExtra> {
  const [p, m] = await Promise.all([
    supabase.from('pantry_items').select('id,name,place,qty,expires_on,created_by').eq('household_id', householdId).eq('active', true).order('expires_on', { ascending: true, nullsFirst: false }).limit(500),
    supabase.from('house_meals').select('id,date,meal,title,cook,recipe_id,ingredients,notes').eq('household_id', householdId).gte('date', from).lte('date', to).order('date'),
  ])
  const e = p.error || m.error
  if (e) { if (isMissingTable(e)) return { ready: false, pantry: [], meals: [] }; must({ data: null, error: e }, 'carregar despensa e jantar') }
  return { ready: true, pantry: (p.data || []) as PantryItem[], meals: ((m.data || []) as any[]).map(x => ({ ...x, ingredients: Array.isArray(x.ingredients) ? x.ingredients : [] })) as HouseMeal[] }
}

export interface PantryInput { id?: string, name: string, place: Place, qty: string | null, expires_on: string | null }
export async function savePantry(householdId: string, by: Who | null, x: PantryInput): Promise<void> {
  const row = { name: x.name.trim().slice(0, 80), place: x.place, qty: x.qty?.trim().slice(0, 30) || null, expires_on: x.expires_on || null, updated_at: new Date().toISOString() }
  if (x.id) must(await supabase.from('pantry_items').update(row).eq('id', x.id).select('id'), 'salvar item')
  else must(await supabase.from('pantry_items').insert({ ...row, household_id: householdId, created_by: by }).select('id'), 'guardar na despensa')
}
export async function removePantry(id: string): Promise<void> {
  must(await supabase.from('pantry_items').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id).select('id'), 'tirar da despensa')
}
/** Acabou: sai da despensa e entra na lista de compras (sem duplicar o que já está aberto). */
export async function pantryToShopping(householdId: string, by: Who | null, it: PantryItem): Promise<{ created: boolean }> {
  const r = must(await supabase.rpc('ninho_add_shopping_item', { p_household_id: householdId, p_title: it.name.slice(0, 80), p_qty: it.qty ? it.qty.slice(0, 30) : null, p_category: guessCategory(it.name), p_by: by }), 'mandar para compras') as any
  await removePantry(it.id)
  return { created: !!(r?.created || r?.reopened) }
}

export interface MealInput { date: string, title: string, cook: Cook, recipe_id: string | null, ingredients: Array<{ title: string, qty: string }>, notes: string | null }
export async function saveMeal(householdId: string, by: Who | null, x: MealInput): Promise<void> {
  must(await supabase.from('house_meals').upsert({ household_id: householdId, date: x.date, meal: 'jantar', title: x.title.trim().slice(0, 80), cook: x.cook, recipe_id: x.recipe_id,
    ingredients: x.ingredients.slice(0, 40).map(i => ({ title: i.title.slice(0, 80), qty: (i.qty || '').slice(0, 30) })), notes: x.notes?.trim().slice(0, 300) || null, created_by: by, updated_at: new Date().toISOString() },
  { onConflict: 'household_id,date,meal' }).select('id'), 'planejar jantar')
}
export async function deleteMeal(id: string): Promise<void> {
  must(await supabase.from('house_meals').delete().eq('id', id).select('id'), 'tirar jantar')
}
