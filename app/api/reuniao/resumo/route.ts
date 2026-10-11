// Reunião semanal: manda o resumo da reunião salva no Telegram das duas.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { memberOf } from '@/lib/server/member'
import { sendMeetingSummary } from '@/lib/server/reuniaoAi'
import { createTg, telegramConfigured } from '@/lib/server/tg'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!dbConfigured() || !telegramConfigured()) return NextResponse.json({ error: 'O Telegram ainda não está configurado neste endereço do app.' }, { status: 503 })
  let body: any = null
  try { body = await req.json() } catch { /* vazio */ }
  const db = createDb()
  const m = await memberOf(db, req, String(body?.householdId || ''))
  if (m.ok === false) return NextResponse.json({ error: m.error }, { status: m.status })
  try {
    const r = await sendMeetingSummary(db, createTg(), body.householdId, typeof body?.weekStart === 'string' ? body.weekStart : undefined)
    if (r.ok === true) return NextResponse.json({ sent: r.sent })
    const fail = r as { status: number, message: string }
    return NextResponse.json({ error: fail.message }, { status: fail.status })
  } catch (e: any) {
    console.error('[ninho] resumo reuniao', String(e?.message || e).slice(0, 300))
    return NextResponse.json({ error: 'Não foi possível mandar o resumo agora.' }, { status: 500 })
  }
}
