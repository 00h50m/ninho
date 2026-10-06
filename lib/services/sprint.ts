// Sprint do Ninho (migration 018). Sem a migration, o sprint fica indisponível.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { Sprint } from '@/lib/sprint'

const COLS = 'id,date,started_by,participants,duration_min,area,goal,task_ids,started_at,paused_at,paused_ms,ended_at,status,done_task_ids,xp'
function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}

export interface SprintData { available: boolean, active: Sprint | null, recent: Sprint[] }

export async function loadSprints(householdId: string): Promise<SprintData> {
  const r = await supabase.from('sprints').select(COLS).eq('household_id', householdId).order('started_at', { ascending: false }).limit(8)
  if (r.error) {
    if (isMissingTable(r.error)) return { available: false, active: null, recent: [] }
    must(r, 'carregar sprints')
  }
  const rows = (r.data || []) as Sprint[]
  return { available: true, active: rows.find(s => !s.ended_at) || null, recent: rows.filter(s => s.ended_at && s.status === 'done').slice(0, 5) }
}

export async function startSprint(householdId: string, v: { started_by: Who | null, participants: Who[], duration_min: number, area: string, goal: string | null, task_ids: string[], date: string }): Promise<Sprint> {
  const r = await supabase.from('sprints').insert({ household_id: householdId, ...v }).select(COLS).single()
  if (r.error?.code === '23505') throw new NinhoError({ message: 'NINHO_SPRINT_ACTIVE', code: '23505' }, 'iniciar sprint')
  return must(r, 'iniciar sprint') as Sprint
}

export async function pauseSprint(id: string, pause: boolean, extraMin = 0): Promise<void> {
  must(await supabase.rpc('ninho_sprint_pause', { p_sprint_id: id, p_pause: pause, p_extra_min: extraMin }), pause ? 'pausar sprint' : 'continuar sprint')
}

export async function updateSprintTasks(id: string, taskIds: string[]): Promise<void> {
  must(await supabase.from('sprints').update({ task_ids: taskIds }).eq('id', id).select('id'), 'atualizar tarefas do sprint')
}

export async function finishSprint(id: string, cancel = false): Promise<{ done: number, xp: number, status: string }> {
  return must(await supabase.rpc('ninho_finish_sprint', { p_sprint_id: id, p_cancel: cancel }), cancel ? 'cancelar sprint' : 'encerrar sprint') as any
}
