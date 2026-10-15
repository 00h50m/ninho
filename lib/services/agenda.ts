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
/** Coluna que ainda não existe (migration nova não executada). */
const missingColumn = (e: any) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find the '.*' column/i.test(e.message || ''))

export interface AgendaData { available: boolean, events: HouseEvent[], sobrouUrl: string | null }

export async function loadAgenda(householdId: string, from: string): Promise<AgendaData> {
  const ev = (cols: string) => supabase.from('house_events').select(cols).eq('household_id', householdId).or(`date.gte.${from},and(kind.eq.vencimento,paid.is.false),and(done_at.is.null,kind.neq.vencimento)`).order('date').limit(300)
  const [e0, h] = await Promise.all([ev(COLS + ',end_time'), supabase.from('households').select('sobrou_url').eq('id', householdId).maybeSingle()])
  // sem a hora de fim (036): carrega como antes
  const e = missingColumn(e0.error) ? await ev(COLS) : e0
  if (e.error) {
    if (isMissingTable(e.error)) return { available: false, events: [], sobrouUrl: null }
    must(e, 'carregar agenda')
  }
  return { available: true, events: (e.data || []) as unknown as HouseEvent[], sobrouUrl: (h.data as any)?.sobrou_url ?? null }
}

export type EventInput = Omit<HouseEvent, 'id' | 'done_at'> & { id?: string }

export async function saveEvent(householdId: string, by: Who | null, d: EventInput): Promise<void> {
  const base = { kind: d.kind, title: d.title.trim(), date: d.date, time: d.time || null, who: d.who, notes: d.notes?.trim() || null, link: d.link?.trim() || null, paid: d.kind === 'vencimento' ? !!d.paid : null }
  const end = d.time && d.end_time && d.end_time > d.time ? d.end_time : null
  const write = (row: Record<string, unknown>) => d.id ? supabase.from('house_events').update(row).eq('id', d.id).select('id') : supabase.from('house_events').insert({ ...row, household_id: householdId, created_by: by }).select('id')
  let r = await write({ ...base, end_time: end })
  // sem a hora de fim (036): grava sem ela
  if (missingColumn(r.error)) r = await write(base)
  must(r, d.id ? 'salvar evento' : 'criar evento')
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
