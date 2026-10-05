// Sugestões da IA para a semana (botão na Reunião semanal).
// Só para quem é da casa: o app manda o token da sessão e o servidor confere
// que a conta está ligada à casa pedida (household_members).
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { weeklyTips } from '@/lib/server/ai'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'servidor sem SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const householdId = String(body?.householdId || '')
  if (!token || !/^[0-9a-f-]{36}$/.test(householdId)) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })
  const db = createDb()
  const user = await db.auth.getUser(token)
  if (user.error || !user.data.user) return NextResponse.json({ error: 'sessão inválida' }, { status: 401 })
  // Conta ligada à casa (login). Perfil da versão anônima antiga vale só enquanto ela existir.
  const member = await db.from('household_members').select('user_id').eq('user_id', user.data.user.id).eq('household_id', householdId).maybeSingle()
  const legacy = member.data || user.data.user.is_anonymous === false ? null
    : await db.from('profiles').select('id').eq('id', user.data.user.id).eq('household_id', householdId).maybeSingle()
  if (!member.data && !legacy?.data) return NextResponse.json({ error: 'não é desta casa' }, { status: 403 })
  try {
    const r = await weeklyTips(db, householdId, { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })
    if (r.ok === true) return NextResponse.json({ tips: r.tips })
    const fail = r as { status: number, message: string }
    return NextResponse.json({ error: fail.message }, { status: fail.status })
  } catch (e: any) {
    console.error('[ninho] ia', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível gerar as sugestões agora.' }, { status: 500 })
  }
}
