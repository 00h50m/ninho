// Bom dia (agendado pela Vercel: vercel.json). Protegido por CRON_SECRET.
import { NextResponse } from 'next/server'
import { createDeps, cronAuthorized, missingConfig } from '@/lib/server/push'
import { runMorning } from '@/lib/server/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const missing = missingConfig()
  if (missing.length) return NextResponse.json({ error: 'configuração incompleta', missing }, { status: 500 })
  const report = await runMorning(createDeps())
  console.log('[ninho] cron manhã', JSON.stringify({ ...report, errors: report.errors.length }))
  return NextResponse.json(report)
}
