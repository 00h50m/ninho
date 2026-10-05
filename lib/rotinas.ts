// Rotinas (checklist do dia) e hábitos (constância). Puro, sem React/Supabase.
// Rotina: uma ocorrência por dia, conclusão parcial, versão reduzida no modo sobrevivência.
// Hábito: meta de frequência; dia sem registro NÃO é atraso, só ausência.
import { addDays, dowOf } from './dates'
import type { Who } from './types'

// ── Rotinas ──────────────────────────────────────────────────────────
export interface Step { id: string, position: number, title: string, survival: boolean, active?: boolean }
export interface Routine {
  id: string
  template_key: string | null
  title: string
  description: string | null
  category: string
  weekdays: number[] | null
  scheduled_time: string | null
  duration_min: number | null
  assign_mode: 'g' | 's' | 'shared' | 'rotation'
  essential: boolean
  start_date?: string | null
  paused_until?: string | null
  reminder_min?: number | null
  routine_steps: Step[]
}
export interface Run { id: string, routine_id: string, date: string, status: 'open' | 'done', survival: boolean, completed_by: Who | null, checks: Array<{ step_id: string, done_by: Who | null }> }

/** A rotina acontece neste dia? (dia da semana, data inicial e pausa) */
export function routineOnDay(r: Pick<Routine, 'weekdays' | 'start_date' | 'paused_until'>, date: string): boolean {
  if (r.start_date && date < r.start_date) return false
  if (r.paused_until && date <= r.paused_until) return false
  return !r.weekdays || r.weekdays.includes(dowOf(date))
}

/** Passos que valem: no modo sobrevivência, só os 🛡 (se a rotina tiver algum). */
export function stepsFor(r: Pick<Routine, 'routine_steps'>, survival: boolean): Step[] {
  const all = r.routine_steps.filter(s => s.active !== false).sort((a, b) => a.position - b.position)
  if (!survival) return all
  const reduced = all.filter(s => s.survival)
  return reduced.length ? reduced : all
}

export function runProgress(r: Routine, run: Run | undefined, survival: boolean): { done: number, total: number, complete: boolean, partial: boolean } {
  const steps = stepsFor(r, survival)
  const checked = new Set((run?.checks || []).map(c => c.step_id))
  const done = steps.filter(s => checked.has(s.id)).length
  const complete = run?.status === 'done'
  return { done, total: steps.length, complete, partial: !complete && done > 0 }
}

/** Histórico dos últimos dias: done (concluída), partial (alguns passos), none (não feita), off (não era dia). */
export function routineHistory(r: Routine, runs: Run[], today: string, days = 7): Array<{ date: string, state: 'done' | 'partial' | 'none' | 'off' }> {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1)
    const run = runs.find(x => x.routine_id === r.id && x.date === date)
    if (run?.status === 'done') return { date, state: 'done' as const }
    if (run && run.checks.length) return { date, state: 'partial' as const }
    return { date, state: routineOnDay(r, date) ? 'none' as const : 'off' as const }
  })
}

// ── Hábitos ──────────────────────────────────────────────────────────
export interface Habit {
  id: string
  title: string
  description: string | null
  owner: 'g' | 's' | 'shared'
  weekdays: number[] | null
  weekly_target: number
  paused_until: string | null
  archived_at: string | null
}
export interface HabitLog { habit_id: string, date: string, who: Who | null }

export const HABIT_SUGGESTIONS: Array<{ title: string, owner: Habit['owner'], weekly_target: number, weekdays: number[] | null }> = [
  { title: 'Preparar o dia seguinte', owner: 'shared', weekly_target: 5, weekdays: [0, 1, 2, 3, 4] },
  { title: 'Reset rápido da sala', owner: 'shared', weekly_target: 5, weekdays: null },
  { title: 'Cinco minutos de organização', owner: 'shared', weekly_target: 4, weekdays: null },
  { title: 'Verificar a água dos cães', owner: 'shared', weekly_target: 7, weekdays: null },
]

const isPaused = (h: Habit, date: string) => !!h.paused_until && date <= h.paused_until

/** O hábito é esperado neste dia? (com dias certos; meta semanal livre vale qualquer dia) */
export function habitOnDay(h: Habit, date: string): boolean {
  if (isPaused(h, date)) return false
  return !h.weekdays || h.weekdays.includes(dowOf(date))
}

/** Meta da semana: com dias certos = quantidade de dias; sem = weekly_target. */
export function habitTarget(h: Habit): number {
  return h.weekdays ? h.weekdays.length : h.weekly_target
}

export function weekStartMon(date: string): string {
  const d = dowOf(date)
  return addDays(date, -(d === 0 ? 6 : d - 1))
}

export interface HabitState {
  doneToday: boolean
  doneBy: Who | null
  dueToday: boolean
  weekDone: number
  target: number
  /** Sequência: dias seguidos (dias certos) ou semanas seguidas batendo a meta (meta livre) */
  streak: number
  streakUnit: 'dias' | 'semanas'
  /** Últimos 7 dias: done, miss (era dia e não teve registro — sem cobrança), off (não era dia/pausado), today */
  last7: Array<{ date: string, state: 'done' | 'miss' | 'off' | 'today' }>
  paused: boolean
}

export function habitState(h: Habit, logs: HabitLog[], today: string): HabitState {
  const mine = new Map(logs.filter(l => l.habit_id === h.id).map(l => [l.date, l]))
  const ws = weekStartMon(today)
  let weekDone = 0
  for (let i = 0; i < 7; i++) if (mine.has(addDays(ws, i))) weekDone++
  const target = habitTarget(h)

  let streak = 0
  let unit: HabitState['streakUnit'] = 'dias'
  if (h.weekdays) {
    // conta para trás pelos dias esperados; hoje sem registro ainda não quebra
    let d = today
    for (let i = 0; i < 400; i++) {
      if (habitOnDay(h, d)) {
        if (mine.has(d)) streak++
        else if (d !== today) break
      }
      d = addDays(d, -1)
    }
  } else {
    unit = 'semanas'
    // semana atual conta se já bateu a meta; semanas anteriores precisam ter batido
    let w = ws
    if (weekDone >= target) streak++
    for (let i = 0; i < 104; i++) {
      w = addDays(w, -7)
      let n = 0
      for (let j = 0; j < 7; j++) if (mine.has(addDays(w, j))) n++
      if (n >= target) streak++
      else break
    }
  }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6)
    // meta livre (sem dias certos): dia sem registro é neutro, não "faltou"
    const state: 'done' | 'miss' | 'off' | 'today' = mine.has(date) ? 'done' : date === today ? 'today' : h.weekdays && habitOnDay(h, date) ? 'miss' : 'off'
    return { date, state }
  })

  return {
    doneToday: mine.has(today), doneBy: mine.get(today)?.who ?? null, dueToday: habitOnDay(h, today),
    weekDone, target, streak, streakUnit: unit, last7, paused: isPaused(h, today),
  }
}
