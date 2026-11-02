// Monta tarefas e cães com o estado de conclusão (usado pelo app e pelo servidor).
import type { CompletionRow, Dog, Task, Who } from './types'
import { summarizeCompletions } from './completions'
import { byTime } from './today'
import { isWho } from './rotation'

type Row = Record<string, any>

/** Linha de task_skips. */
export interface SkipRow { id: string, task_id: string, date: string, kind: 'snooze' | 'skip', skipped_by?: string | null }

/** Linha de task_handoffs (036). */
export interface HandoffRow { id: string, task_id: string, date: string, to_who: string, by_who?: string | null }

/** Linha de task_later (044): "mais tarde", horário só deste dia. */
export interface LaterRow { id: string, task_id: string, date: string, at: string, by_who?: string | null }

export function buildTasks(rows: Row[], comps: CompletionRow[], today: string, skips: SkipRow[] = [], handoffs: HandoffRow[] = [], laters: LaterRow[] = []): Task[] {
  const info = summarizeCompletions(comps, 'task_id', today)
  // Pausa mais recente até hoje de cada tarefa (pular vale o período; adiar, só o dia)
  const last = new Map<string, SkipRow>()
  for (const s of skips) if (s.date <= today && (!last.has(s.task_id) || s.date > last.get(s.task_id)!.date)) last.set(s.task_id, s)
  return rows.map(t => {
    const s = last.get(t.id)
    const h = handoffs.find(x => x.task_id === t.id && x.date === today && isWho(x.to_who))
    const l = laters.find(x => x.task_id === t.id && x.date === today)
    const at = l ? String(l.at).slice(0, 5) : null
    return { ...(t as Task), ...info(t.id), skip: s ? { id: s.id, date: s.date, kind: s.kind, by: isWho(s.skipped_by) ? s.skipped_by : null } : null,
      handoff: h ? { id: h.id, date: h.date, to: h.to_who as Who, by: isWho(h.by_who) ? h.by_who : null } : null,
      ...(l && at ? { scheduled_time: at, later: { id: l.id, date: l.date, at, orig: t.scheduled_time ? String(t.scheduled_time).slice(0, 5) : null, by: isWho(l.by_who) ? l.by_who : null } } : { later: null }) }
  })
}

/** Linha de dog_skips (042): rotina dos cães pulada no dia. */
export interface DogSkipRow { id: string, routine_id: string, date: string, skipped_by?: string | null }

export function buildDogs(rows: Row[], comps: CompletionRow[], today: string, skips: DogSkipRow[] = []): Dog[] {
  const info = summarizeCompletions(comps, 'routine_id', today)
  const sk = (id: string) => { const s = skips.find(x => x.routine_id === id && x.date === today); return s ? { skip: { id: s.id, date: s.date, kind: 'skip' as const, by: isWho(s.skipped_by) ? s.skipped_by : null } } : { skip: null } }
  return rows.map(d => ({
    ...(d as Dog),
    routines: (d.dog_routines || [])
      .filter((r: Row) => r.active !== false)
      .map((r: Row) => ({ ...r, ...info(r.id), ...sk(r.id) }))
      .sort((a: Row, b: Row) => Number(a.frequency !== 'daily') - Number(b.frequency !== 'daily') || byTime(a as any, b as any)),
  }))
}
