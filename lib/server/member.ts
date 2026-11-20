// Quem está pedindo (SÓ servidor): confere o token da sessão e que a conta é desta casa.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Who } from '@/lib/types'
import { LEGACY, OFF_MSG, featuresOf, type Features } from '@/lib/modulos'

export type Member = { ok: true, userId: string, who: Who | null } | { ok: false, status: number, error: string }

/** Módulos da casa (046). Sem a coluna (antes de rodar a migration): tudo ligado, como sempre foi. */
export async function houseFeatures(db: SupabaseClient, householdId: string): Promise<Features> {
  const r = await db.from('households').select('features').eq('id', householdId).maybeSingle()
  if (r.error) return r.error.code === '42703' || /features/.test(r.error.message) ? LEGACY : featuresOf(null)
  return featuresOf((r.data as any)?.features)
}

/** É da casa e (se pedido) a casa tem o módulo ligado: IA ou Sobrou. */
export async function memberOf(db: SupabaseClient, req: Request, householdId: string, need?: 'ia' | 'sobrou'): Promise<Member> {
  const m = await memberOnly(db, req, householdId)
  if (m.ok === false || !need) return m
  return (await houseFeatures(db, householdId))[need] ? m : { ok: false, status: 403, error: OFF_MSG[need] }
}

async function memberOnly(db: SupabaseClient, req: Request, householdId: string): Promise<Member> {
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
