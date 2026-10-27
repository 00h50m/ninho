// Faxinão (migration 030): planos da casa, passos marcados pelo banco numa gravação só.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import { resetSteps, type FaxPlan, type FaxStep, type FaxWho, type Faxinao } from '@/lib/faxinao'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}
const COLS = 'id,title,steps,tips,status,created_by,started_at,finished_at,created_at'

/** Rascunhos, em andamento, modelos e os últimos feitos. null = sem a migration. */
export async function loadFax(householdId: string): Promise<Faxinao[] | null> {
  const r = await supabase.from('faxinoes').select(COLS).eq('household_id', householdId).order('created_at', { ascending: false }).limit(40)
  if (r.error) { if (isMissingTable(r.error)) return null; must(r, 'carregar faxinão') }
  const all = (r.data || []) as Faxinao[]
  return [...all.filter(f => f.status !== 'feito'), ...all.filter(f => f.status === 'feito').slice(0, 5)]
}

export async function createFax(householdId: string, who: Who | null, p: FaxPlan, status: 'rascunho' | 'modelo' = 'rascunho'): Promise<Faxinao> {
  return must(await supabase.from('faxinoes').insert({ household_id: householdId, title: p.title.slice(0, 80), steps: status === 'modelo' ? resetSteps(p.steps) : p.steps, tips: p.tips, status, created_by: who }).select(COLS).single(), 'guardar faxinão') as Faxinao
}

export async function saveDraft(id: string, title: string, steps: FaxStep[]): Promise<void> {
  must(await supabase.from('faxinoes').update({ title: title.slice(0, 80), steps, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'rascunho').select('id'), 'salvar faxinão')
}

export async function startFax(id: string): Promise<void> {
  must(await supabase.from('faxinoes').update({ status: 'andamento', started_at: new Date().toISOString() }).eq('id', id).select('id'), 'começar faxinão')
}

export async function finishFax(id: string): Promise<void> {
  must(await supabase.from('faxinoes').update({ status: 'feito', finished_at: new Date().toISOString() }).eq('id', id).select('id'), 'encerrar faxinão')
}

export async function deleteFax(id: string): Promise<void> {
  must(await supabase.from('faxinoes').delete().eq('id', id).select('id'), 'apagar faxinão')
}

/** Zerar: apaga vários de uma vez (concluídos e rascunhos; os modelos ficam). */
export async function deleteFaxMany(ids: string[]): Promise<void> {
  if (!ids.length) return
  must(await supabase.from('faxinoes').delete().in('id', ids).select('id'), 'zerar faxinão')
}

export async function stepFax(id: string, step: string, action: 'done' | 'skip' | 'undo' | 'later', who: Who | null): Promise<FaxStep[]> {
  return must(await supabase.rpc('ninho_faxinao_step', { p_id: id, p_step: step, p_action: action, p_who: who }), 'marcar passo') as FaxStep[]
}

/** Organiza com a IA (rota do servidor). */
export async function planWithAi(householdId: string, text: string, who: FaxWho, minutes: number | null): Promise<{ ok: true, plan: FaxPlan } | { ok: false, error: string }> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { ok: false, error: 'Sessão não encontrada. Recarregue o app.' }
    const r = await fetch('/api/ai/faxinao', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ householdId, text, who, minutes }) })
    const j = await r.json().catch(() => ({}))
    return r.ok ? { ok: true, plan: j.plan } : { ok: false, error: j.error || 'Não foi possível organizar agora.' }
  } catch { return { ok: false, error: 'Sem conexão com o servidor. Confira a internet e tente de novo.' } }
}
