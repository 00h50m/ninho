// Recebe uma parte de um arquivo grande (PDF de até 15 MB) para a IA ler.
// As partes ficam só até a leitura (são apagadas na hora) e só o servidor as vê.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { savePart } from '@/lib/server/nutritionAi'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'A leitura com IA ainda não está configurada neste endereço do app.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const m = await memberOf(db, req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  const err = await savePart(db, body.householdId, m.userId, body)
  return err ? NextResponse.json({ error: err }, { status: 400 }) : NextResponse.json({ ok: true })
}
