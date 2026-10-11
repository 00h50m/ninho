// Lê o plano alimentar (PDF ou foto) com a IA e devolve organizado para a pessoa conferir.
// Nada é gravado aqui: o app salva o plano depois que a pessoa confere. O arquivo não fica guardado.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { fileFrom, readPlan } from '@/lib/server/nutritionAi'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: 'A leitura com IA ainda não está configurada neste endereço do app.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const m = await memberOf(db, req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  const file = await fileFrom(db, body.householdId, m.userId, body, true)
  if (!file) return NextResponse.json({ error: 'Arquivo inválido. Mande um PDF (até 15 MB) ou uma foto.' }, { status: 400 })
  try {
    const r = await readPlan(db, body.householdId, file, { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL })
    if (r.ok === true) return NextResponse.json({ plan: r.plan })
    const fail = r as { status: number, message: string }
    return NextResponse.json({ error: fail.message }, { status: fail.status })
  } catch (e: any) {
    console.error('[ninho] ia plano', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível ler o plano agora.' }, { status: 500 })
  }
}
