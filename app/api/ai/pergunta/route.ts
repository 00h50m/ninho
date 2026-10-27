// "Perguntar ao Ninho" pelo app: ajuda no dia a dia da casa. Nada é gravado (só o uso da IA).
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { askNinho } from '@/lib/server/askAi'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'A IA ainda não está configurada neste endereço do app.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const m = await memberOf(db, req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  const me = m.who || (body?.who === 's' ? 's' : 'g')
  const q = typeof body?.question === 'string' ? body.question.trim().slice(0, 1200) : ''
  if (q.length < 3) return NextResponse.json({ error: 'Escreva a pergunta.' }, { status: 400 })
  try {
    const r = await askNinho(db, body.householdId, me, q, { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })
    return r.ok === true ? NextResponse.json({ text: r.text }) : NextResponse.json({ error: (r as { message: string }).message }, { status: 422 })
  } catch (e: any) {
    console.error('[ninho] ia pergunta', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível responder agora.' }, { status: 500 })
  }
}
