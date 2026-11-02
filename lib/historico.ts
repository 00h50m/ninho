// Histórico visual (Nós › Histórico): mapa de calor do mês por pessoa e as sequências de cada tarefa.
// Usa o histórico que o app já carrega (62 dias de conclusões, com quem fez). Puro, testado.
import { addDays, weekStartOf } from './dates'
import { periodStart, scheduledOn } from './frequency'
import { unitOf } from './retro'
import type { Dog, HistEntry, Task, Who } from './types'

type Done = { d: string, by: Who | null }
const doneOf = (x: { hist?: HistEntry[], completed_today?: boolean, completed_by_today?: Who | null }, today: string): Done[] =>
  [...(x.hist || []), ...(x.completed_today ? [{ d: today, by: x.completed_by_today ?? null }] : [])]

export interface HeatDay { date: string, g: number, s: number, future: boolean }

/** `weeks` semanas fechadas de segunda a domingo (a atual incluída): quantas cada uma fez por dia. */
export function heatmap({ tasks, dogs, today }: { tasks: Task[], dogs: Dog[], today: string }, weeks = 5): HeatDay[] {
  const start = addDays(weekStartOf(today), -7 * (weeks - 1))
  const days: HeatDay[] = Array.from({ length: weeks * 7 }, (_, i) => { const date = addDays(start, i); return { date, g: 0, s: 0, future: date > today } })
  const idx = new Map(days.map((d, i) => [d.date, i]))
  const add = (h: Done) => { const i = idx.get(h.d); if (i != null && h.by && h.d <= today) days[i][h.by]++ }
  tasks.forEach(t => doneOf(t, today).forEach(add))
  dogs.forEach(d => d.routines.forEach(r => doneOf(r, today).forEach(add)))
  return days
}

/** Nível de 0 a 4 para a cor do quadradinho (0 = nada; 4 = o dia mais cheio do período). */
export function heatLevel(n: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0 || max <= 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((n / max) * 4))) as 1 | 2 | 3 | 4
}

export interface TaskStreak { task: Task, n: number, unit: string }

/**
 * Sequência atual de cada tarefa: quantos períodos seguidos (dias da diária, semanas da semanal…)
 * ela foi feita, contando só os períodos em que devia ser feita. O período de hoje só entra se já
 * foi feito (ainda há tempo). A partir de `min`, das maiores para as menores, até `max`.
 */
export function taskStreaks({ tasks, today }: { tasks: Task[], today: string }, min = 3, max = 5): TaskStreak[] {
  const out: TaskStreak[] = []
  for (const t of tasks) {
    if (t.frequency === 'once' || t.active === false) continue
    const done = new Set(doneOf(t, today).map(h => periodStart(t.frequency, h.d)))
    const created = t.created_at ? t.created_at.slice(0, 10) : addDays(today, -62)
    const oldest = addDays(today, -61)
    let n = 0, cur = periodStart(t.frequency, today), first = true
    const seen = new Set<string>()
    for (let d = today; d >= oldest && d >= created; d = addDays(d, -1)) {
      if (!scheduledOn(t, d)) continue
      const p = periodStart(t.frequency, d)
      if (seen.has(p)) continue
      seen.add(p)
      if (done.has(p)) { n++; first = false; continue }
      // o período atual ainda não feito não quebra a sequência
      if (first && p === cur) { first = false; continue }
      break
    }
    if (n >= min) out.push({ task: t, n, unit: unitOf(t.frequency, n) })
  }
  return out.sort((a, b) => b.n - a.n || a.task.title.localeCompare(b.task.title, 'pt-BR')).slice(0, max)
}
