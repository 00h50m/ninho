// Sprint do Ninho: cronômetro pelo horário (sobrevive a sair da tela e ao celular
// bloqueado), sugestão de tarefas por cômodo e resumo. Puro, sem React/Supabase.
import type { Task, Who } from './types'
import { CAT } from './constants'
import { dueToday } from './frequency'

export interface Sprint {
  id: string
  date: string
  started_by: Who | null
  participants: Who[]
  duration_min: number
  area: string
  goal: string | null
  task_ids: string[]
  started_at: string
  paused_at: string | null
  paused_ms: number
  ended_at: string | null
  status: 'running' | 'paused' | 'done' | 'cancelled'
  done_task_ids: string[]
  xp: number
}

export const DURATIONS = [10, 15, 25]

/** Cômodos/objetivos: as categorias das tarefas + a casa toda. */
export const AREAS: Array<[string, string]> = [['casa', '🏠 Casa toda'], ...Object.entries(CAT).filter(([k]) => k !== 'finance')]
export const areaLabel = (a: string) => (AREAS.find(x => x[0] === a)?.[1] || a).replace(/^\S+\s/, '')

/** Tempo que já correu (sem as pausas). */
export function elapsedMs(s: Pick<Sprint, 'started_at' | 'paused_at' | 'paused_ms' | 'ended_at'>, now: number): number {
  const end = s.ended_at ? Date.parse(s.ended_at) : now
  const pausedNow = s.paused_at && !s.ended_at ? Math.max(0, now - Date.parse(s.paused_at)) : 0
  return Math.max(0, end - Date.parse(s.started_at) - (s.paused_ms || 0) - pausedNow)
}

export function remainingMs(s: Pick<Sprint, 'started_at' | 'paused_at' | 'paused_ms' | 'ended_at' | 'duration_min'>, now: number): number {
  return Math.max(0, s.duration_min * 60000 - elapsedMs(s, now))
}

export function fmtClock(ms: number): string {
  const t = Math.ceil(ms / 1000)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

const WRANK: Record<string, number> = { light: 0, medium: 1, heavy: 2 }

/**
 * Tarefas sugeridas para o cômodo: pendentes, primeiro as de hoje e as essenciais,
 * depois as rápidas. "Casa toda" = qualquer cômodo.
 */
export function suggestTasks(tasks: Task[], area: string, today: string, max = 6): Task[] {
  return tasks
    .filter(t => t.active !== false && !t.completed_today && (area === 'casa' || t.category === area))
    .filter(t => !(t.frequency === 'once' && t.due_date && t.due_date > today))
    .map(t => ({ t, due: dueToday(t, today) }))
    .sort((a, b) => Number(b.due) - Number(a.due) || Number(b.t.essential) - Number(a.t.essential) || (WRANK[a.t.weight] ?? 1) - (WRANK[b.t.weight] ?? 1) || a.t.title.localeCompare(b.t.title))
    .slice(0, max).map(x => x.t)
}

/** "Sprint de 15 minutos — Cozinha" / "4 tarefas concluídas · +6 XP" */
export function summary(s: Pick<Sprint, 'duration_min' | 'area' | 'goal' | 'done_task_ids' | 'xp'>): { title: string, result: string } {
  const n = s.done_task_ids.length
  return {
    title: `Sprint de ${s.duration_min} minutos — ${s.goal?.trim() || areaLabel(s.area)}`,
    result: `${n} tarefa${n === 1 ? '' : 's'} concluída${n === 1 ? '' : 's'} · +${s.xp} XP`,
  }
}
