// Agenda no celular (035): o calendário da casa em .ics para o Google Agenda / iPhone assinarem.
// Sem login (os apps de calendário não têm): vale o segredo do link, que a casa troca ou desliga em Agenda.
import { NextResponse } from 'next/server'
import { createDb, dbConfigured } from '@/lib/server/push'
import { addDays, homeToday } from '@/lib/dates'
import { ICS_TOKEN, agendaItems, icsCalendar } from '@/lib/ics'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

const notFound = () => new NextResponse('Link da agenda inválido ou desligado.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params
  const token = String(file || '').replace(/\.ics$/i, '')
  if (!ICS_TOKEN.test(token) || !dbConfigured()) return notFound()
  const db = createDb()
  const house = await db.from('households').select('id').eq('ics_token', token).maybeSingle()
  if (house.error || !house.data) return notFound()
  const hh = (house.data as any).id as string
  const today = homeToday()
  const [ev, mt, hl, dg] = await Promise.all([
    db.from('house_events').select('id,kind,title,date,time,who,paid,done_at').eq('household_id', hh).gte('date', addDays(today, -30)).order('date').limit(1000),
    db.from('maintenance_items').select('id,title,next_due').eq('household_id', hh).eq('active', true),
    db.from('dog_health').select('id,dog_id,kind,title,date,next_date,every_days').eq('household_id', hh).order('date', { ascending: false }).limit(500),
    db.from('dogs').select('id,name').eq('household_id', hh).eq('active', true),
  ])
  const items = agendaItems({
    today,
    events: (ev.data || []) as any[],
    maint: (mt.data || []).filter((m: any) => m.next_due) as any[],
    health: (hl.data || []) as any[],
    dogs: (dg.data || []) as any[],
  })
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return new NextResponse(icsCalendar('Ninho · Agenda da casa', items, stamp), {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, max-age=900', 'content-disposition': 'inline; filename="ninho.ics"', 'x-robots-tag': 'noindex' },
  })
}
