// Erros dos agendadores no registro (Ajustes › Sistema) e o backup automático de domingo (043).
// SÓ servidor: usa a chave service_role (createDb).
import type { SupabaseClient } from '@supabase/supabase-js'

/** Registra os erros de uma rodada do agendador. O mesmo erro só entra de novo depois de 6 horas. */
export async function logServerErrors(db: SupabaseClient, context: string, errors: Array<string | undefined | null>): Promise<void> {
  const list = Array.from(new Set(errors.filter((e): e is string => !!e).map(e => e.slice(0, 600)))).slice(0, 5)
  if (!list.length) return
  const ctx = `servidor: ${context}`.slice(0, 120)
  const since = new Date(Date.now() - 6 * 3600_000).toISOString()
  const seen = await db.from('app_errors').select('message').is('household_id', null).eq('context', ctx).gte('created_at', since)
  if (seen.error) return // sem a migration 043: só fica no log da Vercel
  const old = new Set(((seen.data || []) as any[]).map(r => r.message))
  const rows = list.filter(m => !old.has(m)).map(message => ({ household_id: null, context: ctx, message }))
  if (rows.length) await db.from('app_errors').insert(rows).then(() => {}, () => {})
}

/** Domingo: um backup de cada casa (as 8 últimas ficam) e limpa os erros com mais de 30 dias. */
export async function runWeeklyBackups(db: SupabaseClient): Promise<{ backups: number, errors: string[] }> {
  const out = { backups: 0, errors: [] as string[] }
  const hh = await db.from('households').select('id')
  if (hh.error) { out.errors.push(`casas: ${hh.error.message}`); return out }
  for (const h of (hh.data || []) as Array<{ id: string }>) {
    const r = await db.rpc('ninho_save_backup', { p_household_id: h.id, p_kind: 'auto' })
    if (r.error) out.errors.push(`backup: ${r.error.message}`.slice(0, 200)); else out.backups++
  }
  await db.from('app_errors').delete().lt('created_at', new Date(Date.now() - 30 * 864e5).toISOString()).then(() => {}, () => {})
  return out
}
