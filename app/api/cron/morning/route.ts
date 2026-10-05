// Bom dia (agendado pela Vercel: vercel.json). Protegido por CRON_SECRET.
// Manda pelo push (se as chaves VAPID estão configuradas) e pelo Telegram (se o bot está configurado).
import { NextResponse } from 'next/server'
import { createDeps, cronAuthorized, missingConfig, pushConfigured } from '@/lib/server/push'
import { runMorning } from '@/lib/server/notify'
import { runTelegramDigest } from '@/lib/server/telegram'
import { createBotDeps, telegramConfigured } from '@/lib/server/tg'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const push = pushConfigured(), tg = telegramConfigured()
  if (!push && !tg) return NextResponse.json({ error: 'configuração incompleta', missing: missingConfig() }, { status: 500 })
  const report = push ? await runMorning(createDeps()) : { skipped_push: 'push não configurado' }
  const telegram = tg ? await runTelegramDigest(createBotDeps(), 'morning') : null
  console.log('[ninho] cron manhã', JSON.stringify({ ...report, errors: (report as any).errors?.length, telegram: telegram && { ...telegram, errors: telegram.errors.length } }))
  return NextResponse.json({ ...report, telegram })
}
