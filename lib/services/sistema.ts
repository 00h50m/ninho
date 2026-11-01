// Ajustes › Sistema (043): erros do app e backups da casa. Tudo pelo cliente com a segurança por casa;
// "Fazer backup agora" passa pelo servidor (/api/backup), que é quem monta a cópia.
import { supabase } from '@/lib/supabase'
import type { Who } from '@/lib/types'

export interface AppErrorRow { id: string, who: Who | null, context: string, message: string, code: string | null, created_at: string, household_id: string | null }
export interface BackupRow { id: string, kind: 'auto' | 'manual', size_bytes: number, created_at: string }

/** Grava um erro do app (sem esperar e sem nunca falhar para quem usa). */
export function reportError(householdId: string, who: Who | null, row: { context: string, message: string, code: string | null }) {
  const path = typeof location !== 'undefined' ? (location.pathname + location.search).slice(0, 200) : null
  supabase.from('app_errors').insert({ household_id: householdId, who, path, ...row }).then(() => {}, () => {})
}

/** Os últimos erros (da casa e do servidor). available=false: falta a migration 043. */
export async function loadErrors(householdId: string): Promise<{ available: boolean, rows: AppErrorRow[] }> {
  const r = await supabase.from('app_errors').select('id,who,context,message,code,created_at,household_id')
    .or(`household_id.eq.${householdId},household_id.is.null`).order('created_at', { ascending: false }).limit(40)
  return r.error ? { available: false, rows: [] } : { available: true, rows: (r.data || []) as AppErrorRow[] }
}

export async function clearErrors(householdId: string) {
  // dois DELETE simples: o PostgREST recusa DELETE com "or" + retorno
  const [a, b] = await Promise.all([
    supabase.from('app_errors').delete().eq('household_id', householdId).select('id'),
    supabase.from('app_errors').delete().is('household_id', null).select('id'),
  ])
  if (a.error) throw a.error
  if (b.error) throw b.error
}

export async function loadBackups(householdId: string): Promise<{ available: boolean, rows: BackupRow[] }> {
  const r = await supabase.from('household_backups').select('id,kind,size_bytes,created_at').eq('household_id', householdId).order('created_at', { ascending: false }).limit(8)
  return r.error ? { available: false, rows: [] } : { available: true, rows: (r.data || []) as BackupRow[] }
}

const save = (name: string, data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function downloadBackup(b: BackupRow) {
  const r = await supabase.from('household_backups').select('data').eq('id', b.id).single()
  if (r.error) throw r.error
  save(`ninho-backup-${b.created_at.slice(0, 10)}.json`, (r.data as any).data)
}

export async function backupNow(householdId: string): Promise<{ ok: true } | { ok: false, error: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, error: 'Sessão não encontrada. Recarregue o app.' }
  try {
    const r = await fetch('/api/backup', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ householdId }) })
    const j = await r.json().catch(() => ({}))
    return r.ok ? { ok: true } : { ok: false, error: j.error || 'Não foi possível fazer o backup agora.' }
  } catch { return { ok: false, error: 'Sem conexão com o servidor. Confira a internet e tente de novo.' } }
}

/** O Meu dia é pessoal e fica fora do backup da casa: cada uma baixa só o seu. */
const MINE = ['personal_settings', 'personal_logs', 'personal_meds', 'personal_goals', 'personal_quits', 'personal_food_profile', 'personal_foods', 'personal_diet_plans', 'personal_menus', 'personal_recipes', 'personal_saved_meals']
export async function downloadMine(householdId: string, who: Who, today: string) {
  const out: Record<string, unknown> = { ninho_meu_dia: 'v1', exported_at: new Date().toISOString(), who }
  for (const t of MINE) {
    const r = await supabase.from(t).select('*').eq('household_id', householdId).eq('who', who)
    out[t] = r.error ? null : r.data
  }
  save(`ninho-meu-dia-${today}.json`, out)
}
