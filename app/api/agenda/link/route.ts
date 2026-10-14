// Agenda no celular (035): liga, troca ou desliga o link secreto do calendário da casa.
// O segredo é gerado aqui no servidor (nunca no aparelho) e só quem é da casa pede.
import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

const missingColumn = (e: any) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /ics_token/.test(e.message || ''))

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'O servidor ainda não está configurado.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const householdId = String(body?.householdId || '')
  const m = await memberOf(db, req, householdId)
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  const action = body?.action === 'off' ? 'off' : 'on'
  const token = action === 'off' ? null : randomBytes(24).toString('hex')
  const r = await db.from('households').update({ ics_token: token }).eq('id', householdId).select('id')
  if (missingColumn(r.error)) return NextResponse.json({ error: 'Falta rodar a atualização do banco (migration 035) no Supabase.' }, { status: 409 })
  if (r.error) { console.error('[ninho] agenda link', r.error.code, String(r.error.message).slice(0, 200)); return NextResponse.json({ error: 'Não foi possível gerar o link agora.' }, { status: 500 }) }
  return NextResponse.json({ token })
}
