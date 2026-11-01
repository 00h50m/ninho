// Resumo de domingo (agendado pela Vercel: vercel.json). Protegido por CRON_SECRET.
// Manda pelo push (se as chaves VAPID estão configuradas) e pelo Telegram (se o bot está configurado).
import { NextResponse } from 'next/server'
import { createDb, createDeps, cronAuthorized, missingConfig, pushConfigured } from '@/lib/server/push'
import { logServerErrors, runWeeklyBackups } from '@/lib/server/sistema'
import { runWeekly } from '@/lib/server/notify'
import { runTelegramDigest } from '@/lib/server/telegram'
import { createBotDeps, telegramConfigured } from '@/lib/server/tg'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const push = pushConfigured(), tg = telegramConfigured()
  // backup da casa todo domingo (043), mesmo sem push nem Telegram
  const backup = await runWeeklyBackups(createDb()).catch(e => ({ backups: 0, errors: [String(e?.message || e).slice(0, 200)] }))
  if (!push && !tg) return NextResponse.json({ error: 'configuração incompleta', missing: missingConfig(), backup }, { status: 500 })
  const report = push ? await runWeekly(createDeps()) : { skipped_push: 'push não configurado' }
  const telegram = tg ? await runTelegramDigest(createBotDeps(), 'weekly') : null
  console.log('[ninho] cron domingo', JSON.stringify({ ...report, errors: (report as any).errors?.length, telegram: telegram && { ...telegram, errors: telegram.errors.length } }))
  await logServerErrors(createDb(), 'domingo', [...((report as any).errors || []), ...(telegram?.errors || []), ...backup.errors]).catch(() => {})
  return NextResponse.json({ ...report, telegram, backup })
}
