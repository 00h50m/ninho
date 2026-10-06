// Agenda da casa e vencimentos (migration 019). Sem a migration: indisponível.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { HouseEvent } from '@/lib/agenda'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}
const COLS = 'id,kind,title,date,time,who,notes,link,paid,done_at'

export interface AgendaData { available: boolean, events: HouseEvent[], sobrouUrl: string | null }

export async function loadAgenda(householdId: string, from: string): Promise<AgendaData> {
  const [e, h] = await Promise.all([
    supabase.from('house_events').select(COLS).eq('household_id', householdId).or(`date.gte.${from},and(kind.eq.vencimento,paid.is.false),and(done_at.is.null,kind.neq.vencimento)`).order('date').limit(300),
    supabase.from('households').select('sobrou_url').eq('id', householdId).maybeSingle(),
  ])
  if (e.error) {
    if (isMissingTable(e.error)) return { available: false, events: [], sobrouUrl: null }
    must(e, 'carregar agenda')
  }
  return { available: true, events: (e.data || []) as HouseEvent[], sobrouUrl: (h.data as any)?.sobrou_url ?? null }
}

export type EventInput = Omit<HouseEvent, 'id' | 'done_at'> & { id?: string }

export async function saveEvent(householdId: string, by: Who | null, d: EventInput): Promise<void> {
  const row = { kind: d.kind, title: d.title.trim(), date: d.date, time: d.time || null, who: d.who, notes: d.notes?.trim() || null, link: d.link?.trim() || null, paid: d.kind === 'vencimento' ? !!d.paid : null }
  if (d.id) must(await supabase.from('house_events').update(row).eq('id', d.id).select('id'), 'salvar evento')
  else must(await supabase.from('house_events').insert({ ...row, household_id: householdId, created_by: by }).select('id'), 'criar evento')
}

export async function setEventDone(id: string, done: boolean): Promise<void> {
  must(await supabase.from('house_events').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id).select('id'), done ? 'concluir evento' : 'reabrir evento')
}

export async function setBillPaid(id: string, paid: boolean): Promise<void> {
  must(await supabase.from('house_events').update({ paid }).eq('id', id).select('id'), paid ? 'marcar como pago' : 'marcar como pendente')
}

export async function deleteEvent(id: string): Promise<void> {
  must(await supabase.from('house_events').delete().eq('id', id).select('id'), 'apagar evento')
}

export async function saveSobrouUrl(householdId: string, url: string | null): Promise<void> {
  must(await supabase.from('households').update({ sobrou_url: url }).eq('id', householdId).select('id'), 'salvar link do Sobrou!')
}
