// "Organize meu dia": devolve o dia em ordem para a pessoa conferir. Nada é gravado aqui.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { planDay } from '@/lib/server/organizarAi'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'A organização com IA ainda não está configurada neste endereço do app.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const m = await memberOf(db, req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  const me = m.who || (body?.who === 's' ? 's' : 'g')
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 2000) : ''
  if (text.length < 3) return NextResponse.json({ error: 'Escreva o que precisa fazer.' }, { status: 400 })
  try {
    const r = await planDay(db, body.householdId, me, text, { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })
    if (r.ok === true) return NextResponse.json({ plan: r.plan })
    const fail = r as { status: number, message: string }
    return NextResponse.json({ error: fail.message }, { status: fail.status })
  } catch (e: any) {
    console.error('[ninho] ia dia', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível organizar agora.' }, { status: 500 })
  }
}
