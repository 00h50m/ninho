// Monta tarefas e cães com o estado de conclusão (usado pelo app e pelo servidor).
import type { CompletionRow, Dog, Task } from './types'
import { summarizeCompletions } from './completions'
import { byTime } from './today'
import { isWho } from './rotation'

type Row = Record<string, any>

/** Linha de task_skips. */
export interface SkipRow { id: string, task_id: string, date: string, kind: 'snooze' | 'skip', skipped_by?: string | null }

export function buildTasks(rows: Row[], comps: CompletionRow[], today: string, skips: SkipRow[] = []): Task[] {
  const info = summarizeCompletions(comps, 'task_id', today)
  // Pausa mais recente até hoje de cada tarefa (pular vale o período; adiar, só o dia)
  const last = new Map<string, SkipRow>()
  for (const s of skips) if (s.date <= today && (!last.has(s.task_id) || s.date > last.get(s.task_id)!.date)) last.set(s.task_id, s)
  return rows.map(t => {
    const s = last.get(t.id)
    return { ...(t as Task), ...info(t.id), skip: s ? { id: s.id, date: s.date, kind: s.kind, by: isWho(s.skipped_by) ? s.skipped_by : null } : null }
  })
}

export function buildDogs(rows: Row[], comps: CompletionRow[], today: string): Dog[] {
  const info = summarizeCompletions(comps, 'routine_id', today)
  return rows.map(d => ({
    ...(d as Dog),
    routines: (d.dog_routines || [])
      .filter((r: Row) => r.active !== false)
      .map((r: Row) => ({ ...r, ...info(r.id) }))
      .sort((a: Row, b: Row) => Number(a.frequency !== 'daily') - Number(b.frequency !== 'daily') || byTime(a as any, b as any)),
  }))
}
