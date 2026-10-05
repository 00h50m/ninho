// Monta tarefas e cães com o estado de conclusão (usado pelo app e pelo servidor).
import type { CompletionRow, Dog, Task } from './types'
import { summarizeCompletions } from './completions'
import { byTime } from './today'

type Row = Record<string, any>

export function buildTasks(rows: Row[], comps: CompletionRow[], today: string): Task[] {
  const info = summarizeCompletions(comps, 'task_id', today)
  return rows.map(t => ({ ...(t as Task), ...info(t.id) }))
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
