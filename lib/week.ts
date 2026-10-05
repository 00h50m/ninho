// Início: semana com dados reais, rotina do momento, resumo de "para agora" e
// cuidados próximos dos cães. Puro (sem React/Supabase).
import type { Dog, Energy, HItem, Task, Who } from './types'
import { addDays, dowOf, hhmm } from './dates'
import { dogKey } from './rotation'
import { isLate } from './today'

export type MoodId = 'otimo' | 'bem' | 'normal' | 'cansaco' | 'pesado'
export const MOODS: Array<{ id: MoodId, emoji: string, label: string }> = [
  { id: 'otimo', emoji: '😄', label: 'Ótimo' },
  { id: 'bem', emoji: '🙂', label: 'Bem' },
  { id: 'normal', emoji: '😐', label: 'Normal' },
  { id: 'cansaco', emoji: '😮‍💨', label: 'Cansaço' },
  { id: 'pesado', emoji: '😣', label: 'Pesado' },
]
export const moodOf = (id: string | null | undefined) => MOODS.find(m => m.id === id) || null

export interface Checkin { date: string, who: Who, mood: MoodId | null, energy: Energy | null, note: string | null }
export interface DayRow { date: string, survival: boolean }

export interface DayInfo {
  date: string
  /** 0 = segunda … 6 = domingo (a semana do Ninho começa na segunda) */
  idx: number
  isToday: boolean
  future: boolean
  /** Conclusões registradas no dia (tarefas + rotinas dos cães; cães iguais contam uma vez) */
  done: number
  moods: Partial<Record<Who, MoodId>>
  /** Energia do dia pelos check-ins (a menor das duas); null = ninguém registrou */
  energy: Energy | null
  survival: boolean
  /** Dia que já passou sem nenhuma conclusão e sem check-in */
  empty: boolean
}

const RANK: Record<Energy, number> = { low: 0, medium: 1, high: 2 }

/** Conclusões por dia a partir do que o app já carregou (histórico + hoje). */
export function completionsByDay(tasks: Task[], dogs: Dog[], today: string): Map<string, number> {
  const m = new Map<string, number>()
  const add = (d: string) => m.set(d, (m.get(d) || 0) + 1)
  for (const t of tasks) {
    for (const h of t.hist || []) add(h.d)
    if (t.completed_today) add(today)
  }
  const seen = new Set<string>()
  for (const dog of dogs) for (const r of dog.routines) {
    const k = dogKey(r)
    const dates = [...(r.hist || []).map(h => h.d), ...(r.completed_today ? [today] : [])]
    for (const d of dates) { if (!seen.has(k + '|' + d)) { seen.add(k + '|' + d); add(d) } }
  }
  return m
}

export function weekDays(weekStart: string, today: string, data: {
  tasks: Task[], dogs: Dog[], checkins: Checkin[], days: DayRow[], survivalNow: boolean
}): DayInfo[] {
  const done = completionsByDay(data.tasks, data.dogs, today)
  return Array.from({ length: 7 }, (_, idx) => {
    const date = addDays(weekStart, idx)
    const cks = data.checkins.filter(c => c.date === date)
    const moods: DayInfo['moods'] = {}
    for (const c of cks) if (c.mood) moods[c.who] = c.mood
    const energies = cks.map(c => c.energy).filter((e): e is Energy => !!e)
    const energy = energies.length ? energies.reduce((a, b) => RANK[a] <= RANK[b] ? a : b) : null
    const survival = !!data.days.find(d => d.date === date)?.survival || (date === today && data.survivalNow)
    const n = done.get(date) || 0
    const future = date > today
    return { date, idx, isToday: date === today, future, done: future ? 0 : n, moods, energy, survival, empty: date < today && n === 0 && cks.length === 0 }
  })
}

// ── Rotinas do dia ───────────────────────────────────────────────────
export interface RoutineLike { id: string, title: string, weekdays: number[] | null, scheduled_time: string | null, duration_min: number | null, assign_mode: string }

const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

/** Rotina acontecendo agora (dentro do horário + duração) e a próxima de hoje. */
export function routineNow<R extends RoutineLike>(routines: R[], today: string, nowHM: string): { now: R | null, next: R | null, today: R[] } {
  const dow = dowOf(today)
  const list = routines.filter(r => !r.weekdays || r.weekdays.includes(dow))
  const timed = list.filter(r => r.scheduled_time).sort((a, b) => hhmm(a.scheduled_time).localeCompare(hhmm(b.scheduled_time)))
  const n = toMin(nowHM)
  const now = timed.find(r => { const s = toMin(hhmm(r.scheduled_time)); return n >= s && n < s + Math.max(r.duration_min || 30, 15) }) || null
  const next = timed.find(r => toMin(hhmm(r.scheduled_time)) > n) || null
  return { now, next, today: list }
}

// ── Para agora (resumo de quem usa o aparelho) ───────────────────────
export function nowSummary(items: HItem[], me: Who | null, ownerOf: (i: HItem) => Who, nowHM: string): { late: number, essentials: number, next: HItem | null } {
  const mine = items.filter(i => !i.completed_today && (!me || ownerOf(i) === me))
  const late = mine.filter(i => isLate(i, nowHM)).length
  const essentials = mine.filter(i => i.essential).length
  const next = mine.filter(i => i.frequency === 'daily' && i.scheduled_time && hhmm(i.scheduled_time) >= nowHM)
    .sort((a, b) => hhmm(a.scheduled_time).localeCompare(hhmm(b.scheduled_time)))[0] || null
  return { late, essentials, next }
}

// ── Cuidados próximos dos cães (manutenções da categoria Cães) ───────
export function dogCare<M extends { category: string, next_due: string, title: string }>(items: M[], today: string, days = 14): M[] {
  const until = addDays(today, days)
  return items.filter(i => i.category === 'caes' && i.next_due <= until).sort((a, b) => a.next_due.localeCompare(b.next_due))
}
