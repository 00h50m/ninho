// Quem está pedindo (SÓ servidor): confere o token da sessão e que a conta é desta casa.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Who } from '@/lib/types'

export type Member = { ok: true, userId: string, who: Who | null } | { ok: false, status: number, error: string }

export async function memberOf(db: SupabaseClient, req: Request, householdId: string): Promise<Member> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token || !/^[0-9a-f-]{36}$/.test(householdId)) return { ok: false, status: 400, error: 'pedido inválido' }
  const user = await db.auth.getUser(token)
  if (user.error || !user.data.user) return { ok: false, status: 401, error: 'sessão inválida' }
  const member = await db.from('household_members').select('who').eq('user_id', user.data.user.id).eq('household_id', householdId).maybeSingle()
  if (member.data) return { ok: true, userId: user.data.user.id, who: (member.data as any).who }
  // Perfil da versão anônima antiga vale só enquanto ela existir
  if (user.data.user.is_anonymous === false) return { ok: false, status: 403, error: 'não é desta casa' }
  const legacy = await db.from('profiles').select('id').eq('id', user.data.user.id).eq('household_id', householdId).maybeSingle()
  return legacy.data ? { ok: true, userId: user.data.user.id, who: null } : { ok: false, status: 403, error: 'não é desta casa' }
}
