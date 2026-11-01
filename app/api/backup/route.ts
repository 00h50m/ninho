// "Fazer backup agora" (Ajustes › Sistema): o servidor monta a cópia da casa e guarda (as 8 últimas).
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'O servidor ainda não está configurado.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const householdId = String(body?.householdId || '')
  const m = await memberOf(db, req, householdId)
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  // um backup na hora a cada 10 minutos basta
  const last = await db.from('household_backups').select('created_at').eq('household_id', householdId).eq('kind', 'manual').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (last.error) return NextResponse.json({ error: 'O backup precisa da atualização do banco (migration 043).' }, { status: 409 })
  if (last.data && Date.now() - Date.parse((last.data as any).created_at) < 10 * 60_000) return NextResponse.json({ error: 'Já tem um backup de agora há pouco. Tente daqui a alguns minutos.' }, { status: 429 })
  const r = await db.rpc('ninho_save_backup', { p_household_id: householdId, p_kind: 'manual' })
  if (r.error) { console.error('[ninho] backup', r.error.message); return NextResponse.json({ error: 'Não foi possível fazer o backup agora.' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}
