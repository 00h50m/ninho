// Atualizações do bot do Telegram. O Telegram manda o segredo combinado no cabeçalho
// (definido em /api/telegram/setup). Sempre responde 200 para o Telegram não reenviar.
import { NextResponse } from 'next/server'
import { handleUpdate } from '@/lib/server/telegram'
import { createBotDeps, telegramConfigured, webhookAuthorized } from '@/lib/server/tg'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!telegramConfigured()) return NextResponse.json({ error: 'bot não configurado' }, { status: 503 })
  if (!webhookAuthorized(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  let update: unknown
  try { update = await req.json() } catch { return NextResponse.json({ ok: true }) }
  try { await handleUpdate(createBotDeps(), update) }
  catch (e: any) { console.error('[ninho] telegram', String(e?.message || e).slice(0, 300)) }
  return NextResponse.json({ ok: true })
}
