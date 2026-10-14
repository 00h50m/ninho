// Lembretes (remédio, rotina, sprint, cães, agenda, desafio, água, check-in).
// Chamado a cada 5 minutos pelo agendador (supabase/scripts/agendar-lembretes.sql).
// Protegido por CRON_SECRET. Repetir a chamada não repete o lembrete.
import { NextResponse } from 'next/server'
import { createDeps, cronAuthorized, missingConfig, pushConfigured } from '@/lib/server/push'
import { runReminders } from '@/lib/server/reminders'
import { runTelegramWater } from '@/lib/server/tgExtras'
import { createBotDeps, telegramConfigured } from '@/lib/server/tg'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const push = pushConfigured(), tg = telegramConfigured()
  // relógio de teste: só no ambiente local de testes (variável própria); em produção não existe
  const at = process.env.NINHO_TEST_CLOCK === '1' ? new URL(req.url).searchParams.get('now') : null
  const now = at && !Number.isNaN(Date.parse(at)) ? new Date(at) : undefined
  if (!push && !tg) return NextResponse.json({ error: 'configuração incompleta', missing: missingConfig() }, { status: 500 })
  const report = push ? await runReminders({ ...createDeps(), ...(now ? { now } : {}) }) : { skipped_push: 'push não configurado', sent: 0, failed: 0, errors: [] as string[] }
  // água também pelo Telegram (nas conversas que ligaram)
  const telegram = tg ? await runTelegramWater({ ...createBotDeps(), ...(now ? { now } : {}) }).catch(e => ({ error: String(e?.message || e).slice(0, 160) })) : null
  if (report.sent || report.failed || report.errors.length || (telegram && 'sent' in telegram && telegram.sent)) console.log('[ninho] lembretes', JSON.stringify({ ...report, errors: report.errors.length, telegram }))
  return NextResponse.json({ ...report, telegram })
}
export const GET = handle
export const POST = handle
