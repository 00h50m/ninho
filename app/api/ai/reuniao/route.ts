// Reunião semanal: rascunho com IA para conferir e editar. Nada é gravado aqui.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { draftMeeting } from '@/lib/server/reuniaoAi'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'A IA ainda não está configurada neste endereço do app.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const m = await memberOf(db, req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  const agenda = Array.isArray(body?.agenda) ? body.agenda.filter((x: unknown) => typeof x === 'string') : []
  try {
    const r = await draftMeeting(db, body.householdId, agenda, { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })
    if (r.ok === true) return NextResponse.json({ draft: r.draft })
    const fail = r as { status: number, message: string }
    return NextResponse.json({ error: fail.message }, { status: fail.status })
  } catch (e: any) {
    console.error('[ninho] ia reuniao', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível montar o rascunho agora.' }, { status: 500 })
  }
}
