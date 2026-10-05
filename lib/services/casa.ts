// Acesso ao Supabase para a Fase 3: divisão, lista de compras e manutenção.
// Mesmo padrão de lib/services/ninho.ts: confere `error` e lança NinhoError.
import { supabase } from '@/lib/supabase'
import { NinhoError, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { SplitMode } from '@/lib/split'
import type { ShoppingItem } from '@/lib/shopping'
import type { MaintenanceItem, MaintenanceLog } from '@/lib/maintenance'

type Res<T> = { data: T | null, error: unknown }

async function run<T>(context: string, p: PromiseLike<Res<T>>): Promise<T> {
  let res: Res<T>
  try { res = await p } catch (e) { logError(context, e); throw new NinhoError(e, context) }
  if (res.error) { logError(context, res.error); throw new NinhoError(res.error, context) }
  return res.data as T
}

// ── Divisão ────────────────────────────────────────────────────────────

/** Modo de divisão da casa. Se a migration 007 ainda não foi aplicada, usa o rodízio antigo. */
export async function loadSplitMode(householdId: string): Promise<SplitMode> {
  const r = await supabase.from('households').select('split_mode').eq('id', householdId).maybeSingle()
  if (r.error) {
    logError('carregar modo de divisão', r.error)
    return 'rotation'
  }
  return (r.data as any)?.split_mode === 'rotation' ? 'rotation' : 'smart'
}

export async function saveSplitMode(householdId: string, mode: SplitMode) {
  await run('salvar modo de divisão', supabase.from('households').update({ split_mode: mode }).eq('id', householdId).select('id'))
}

// ── Compras ────────────────────────────────────────────────────────────

const SHOP_COLS = 'id,household_id,title,qty,category,note,added_by,checked_at,checked_by,done_at,created_at'

/** Lista aberta + histórico recente (para "comprar de novo"). */
export async function loadShopping(householdId: string, historyDays = 120): Promise<{ open: ShoppingItem[], history: ShoppingItem[] }> {
  const since = new Date(Date.now() - historyDays * 86400000).toISOString()
  const [open, history] = await Promise.all([
    run('carregar lista de compras', supabase.from('shopping_items').select(SHOP_COLS).eq('household_id', householdId).is('done_at', null).order('created_at')),
    run('carregar compras anteriores', supabase.from('shopping_items').select(SHOP_COLS).eq('household_id', householdId).gte('done_at', since).order('done_at', { ascending: false }).limit(400)),
  ])
  return { open: open as ShoppingItem[], history: history as ShoppingItem[] }
}

export async function addShoppingItem(householdId: string, title: string, qty: string | null, category: string, by: Who | null) {
  return await run('adicionar item', supabase.rpc('ninho_add_shopping_item', { p_household_id: householdId, p_title: title, p_qty: qty, p_category: category, p_by: by })) as { id: string, created: boolean, reopened: boolean }
}

export async function setShoppingChecked(id: string, by: Who | null, checked: boolean) {
  await run(checked ? 'riscar item' : 'desmarcar item', supabase.from('shopping_items').update(checked ? { checked_at: new Date().toISOString(), checked_by: by } : { checked_at: null, checked_by: null }).eq('id', id).select('id'))
}

export async function updateShoppingItem(id: string, patch: Partial<Pick<ShoppingItem, 'title' | 'qty' | 'category' | 'note'>>) {
  await run('atualizar item', supabase.from('shopping_items').update(patch).eq('id', id).select('id'))
}

export async function removeShoppingItem(id: string) {
  await run('remover item', supabase.from('shopping_items').delete().eq('id', id).select('id'))
}

/** Finaliza a compra: os itens riscados saem da lista e viram histórico. */
export async function finishShopping(householdId: string): Promise<string[]> {
  const rows = await run('finalizar compra', supabase.from('shopping_items').update({ done_at: new Date().toISOString() })
    .eq('household_id', householdId).is('done_at', null).not('checked_at', 'is', null).select('id')) as Array<{ id: string }>
  return rows.map(r => r.id)
}

/** Desfaz "finalizar compra" (devolve os itens para a lista). */
export async function reopenShopping(ids: string[]) {
  if (!ids.length) return
  await run('desfazer finalizar compra', supabase.from('shopping_items').update({ done_at: null }).in('id', ids).select('id'))
}

// ── Manutenção ─────────────────────────────────────────────────────────

const MAINT_COLS = 'id,household_id,title,category,every_months,every_days,last_done,next_due,assigned_to,notes,active'

export async function loadMaintenance(householdId: string): Promise<{ items: MaintenanceItem[], log: MaintenanceLog[] }> {
  const [items, log] = await Promise.all([
    run('carregar manutenções', supabase.from('maintenance_items').select(MAINT_COLS).eq('household_id', householdId).eq('active', true).order('next_due')),
    run('carregar histórico de manutenção', supabase.from('maintenance_log').select('id,item_id,done_on,done_by').eq('household_id', householdId).order('done_on', { ascending: false }).limit(100)),
  ])
  return { items: items as MaintenanceItem[], log: log as MaintenanceLog[] }
}

export type MaintenanceInput = Pick<MaintenanceItem, 'title' | 'category' | 'every_months' | 'every_days' | 'last_done' | 'next_due' | 'assigned_to' | 'notes'>

export async function saveMaintenance(householdId: string, data: MaintenanceInput, id?: string) {
  if (id) await run('atualizar manutenção', supabase.from('maintenance_items').update(data).eq('id', id).select('id'))
  else await run('criar manutenção', supabase.from('maintenance_items').insert({ ...data, household_id: householdId }).select('id'))
}

export async function insertMaintenanceMany(householdId: string, rows: MaintenanceInput[]) {
  if (!rows.length) return
  await run('criar manutenções', supabase.from('maintenance_items').insert(rows.map(r => ({ ...r, household_id: householdId }))).select('id'))
}

export async function archiveMaintenance(id: string) {
  await run('remover manutenção', supabase.from('maintenance_items').update({ active: false }).eq('id', id).select('id'))
}

export async function completeMaintenance(id: string, date: string, by: Who) {
  return await run('concluir manutenção', supabase.rpc('ninho_complete_maintenance', { p_item_id: id, p_date: date, p_by: by })) as { created: boolean, log_id: string, next_due: string, xp: number }
}

export async function undoMaintenance(logId: string) {
  return await run('desfazer manutenção', supabase.rpc('ninho_undo_maintenance', { p_log_id: logId })) as { removed: boolean }
}
