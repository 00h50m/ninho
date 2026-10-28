// Retrospectiva (Nós › Histórico): semana a semana por pessoa, por cômodo e as tarefas mais
// esquecidas. Usa o histórico que o app já carrega (62 dias de conclusões, com quem fez).
// Puro, testado.
import { addDays, weekStartOf } from './dates'
import { periodStart, scheduledOn } from './frequency'
import { CAT } from './constants'
import type { Dog, HistEntry, Task, Who } from './types'

type Done = { d: string, by: Who | null }
const doneOf = (x: { hist?: HistEntry[], completed_today?: boolean, completed_by_today?: Who | null }, today: string): Done[] =>
  [...(x.hist || []), ...(x.completed_today ? [{ d: today, by: x.completed_by_today ?? null }] : [])]

/** Rótulo sem o emoji da frente, para desempatar em ordem alfabética. */
const plain = (s: string) => s.replace(/^\S+\s+/, '')

export interface RetroInput { tasks: Task[], dogs: Dog[], today: string }

/** Últimas `n` semanas (a atual incluída, até hoje): quantas cada uma fez (tarefas e rotinas dos cães). */
export function weeksByPerson({ tasks, dogs, today }: RetroInput, n = 8): Array<{ week: string, g: number, s: number, x: number }> {
  const cur = weekStartOf(today)
  const weeks = Array.from({ length: n }, (_, i) => ({ week: addDays(cur, -7 * (n - 1 - i)), g: 0, s: 0, x: 0 }))
  const add = (h: Done) => {
    if (h.d > today) return
    const w = weeks.find(x => h.d >= x.week && h.d <= addDays(x.week, 6))
    if (w) w[h.by ?? 'x']++
  }
  tasks.forEach(t => doneOf(t, today).forEach(add))
  dogs.forEach(d => d.routines.forEach(r => doneOf(r, today).forEach(add)))
  return weeks
}

/** Por cômodo nos últimos `days` dias (as rotinas dos cães contam em "Cães"), do que mais teve ao que menos. */
export function byRoom({ tasks, dogs, today }: RetroInput, days = 28): Array<{ cat: string, label: string, n: number }> {
  const from = addDays(today, -(days - 1))
  const count = new Map<string, number>()
  const inWin = (h: Done) => h.d >= from && h.d <= today
  tasks.forEach(t => { const n = doneOf(t, today).filter(inWin).length; if (n) count.set(t.category, (count.get(t.category) || 0) + n) })
  const dogN = dogs.reduce((a, d) => a + d.routines.reduce((b, r) => b + doneOf(r, today).filter(inWin).length, 0), 0)
  if (dogN) count.set('dogs', (count.get('dogs') || 0) + dogN)
  return Array.from(count.entries()).map(([cat, n]) => ({ cat, label: CAT[cat] || cat, n })).sort((a, b) => b.n - a.n || plain(a.label).localeCompare(plain(b.label), 'pt-BR'))
}

/**
 * Tarefas mais esquecidas nos últimos `days` dias: quantas vezes deveriam ter sido feitas
 * (dias da diária, períodos da semanal/quinzenal/mensal, respeitando dias, período e pausa;
 * desde que a tarefa existe) contra quantas foram. Só as que ficaram abaixo, da pior para a melhor.
 */
export function forgotten({ tasks, today }: Pick<RetroInput, 'tasks' | 'today'>, days = 28, max = 5): Array<{ task: Task, done: number, expected: number, last: string | null }> {
  const winStart = addDays(today, -(days - 1))
  const out: Array<{ task: Task, done: number, expected: number, last: string | null }> = []
  for (const t of tasks) {
    if (t.frequency === 'once' || t.active === false) continue
    const created = t.created_at ? t.created_at.slice(0, 10) : winStart
    const from = created > winStart ? created : winStart
    // hoje ainda pode ser feita: conta só até ontem para as diárias
    const until = t.frequency === 'daily' ? addDays(today, -1) : today
    if (from > until) continue
    const expected = new Set<string>(), done = new Set<string>()
    for (let d = from; d <= until; d = addDays(d, 1)) if (scheduledOn(t, d)) expected.add(periodStart(t.frequency, d))
    // a semana/mês atual só conta se já foi feita (ainda há tempo)
    if (t.frequency !== 'daily') { const p = periodStart(t.frequency, today); if (!doneOf(t, today).some(h => h.d >= p)) expected.delete(p) }
    const hist = doneOf(t, today)
    for (const h of hist) if (h.d >= from && h.d <= today) { const p = periodStart(t.frequency, h.d); if (expected.has(p)) done.add(p) }
    if (expected.size >= 2 && done.size < expected.size) out.push({ task: t, done: done.size, expected: expected.size, last: hist.length ? hist.map(h => h.d).sort().pop()! : null })
  }
  return out.sort((a, b) => a.done / a.expected - b.done / b.expected || b.expected - a.expected || a.task.title.localeCompare(b.task.title, 'pt-BR')).slice(0, max)
}
