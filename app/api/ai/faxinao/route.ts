// Organiza um faxinão com a IA e devolve o plano para conferir. Nada é gravado aqui.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { planFax } from '@/lib/server/faxinaoAi'

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
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 2000) : ''
  const who = body?.who === 'g' || body?.who === 's' ? body.who : 'both'
  const minutes = Number.isFinite(body?.minutes) && body.minutes >= 15 && body.minutes <= 720 ? Math.round(body.minutes) : null
  if (text.length < 3) return NextResponse.json({ error: 'Escreva o que precisa ser feito.' }, { status: 400 })
  try {
    const r = await planFax(db, body.householdId, { text, who, minutes }, { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })
    if (r.ok === true) return NextResponse.json({ plan: r.plan })
    const fail = r as { status: number, message: string }
    return NextResponse.json({ error: fail.message }, { status: fail.status })
  } catch (e: any) {
    console.error('[ninho] ia faxinao', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível organizar agora.' }, { status: 500 })
  }
}
