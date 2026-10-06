// Lembretes (remédio, rotina, sprint, cães, agenda, desafio, água, check-in).
// Chamado a cada 5 minutos pelo agendador (supabase/scripts/agendar-lembretes.sql).
// Protegido por CRON_SECRET. Repetir a chamada não repete o lembrete.
import { NextResponse } from 'next/server'
import { createDeps, cronAuthorized, missingConfig, pushConfigured } from '@/lib/server/push'
import { runReminders } from '@/lib/server/reminders'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (!pushConfigured()) return NextResponse.json({ error: 'configuração incompleta', missing: missingConfig() }, { status: 500 })
  const report = await runReminders(createDeps())
  if (report.sent || report.failed || report.errors.length) console.log('[ninho] lembretes', JSON.stringify({ ...report, errors: report.errors.length }))
  return NextResponse.json(report)
}
export const GET = handle
export const POST = handle
