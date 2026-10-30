// Retrospectiva (Nós › Histórico): semana a semana por pessoa, por cômodo e as tarefas mais
// esquecidas. Usa o histórico que o app já carrega (62 dias de conclusões, com quem fez).
// Puro, testado.
import { addDays, weekStartOf } from './dates'
import { periodStart, scheduledOn } from './frequency'
import { CAT } from './constants'
import type { Dog, HistEntry, Names, Task, Who } from './types'

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
    // hoje ainda pode ser feita: conta só até ontem para as diárias
    const c = tally(t, winStart, t.frequency === 'daily' ? addDays(today, -1) : today, today)
    if (!c) continue
    // a semana/mês atual só conta se já foi feita (ainda há tempo)
    if (t.frequency !== 'daily') { const p = periodStart(t.frequency, today); if (!c.done.has(p)) c.expected.delete(p) }
    const hist = doneOf(t, today)
    if (c.expected.size >= 2 && c.done.size < c.expected.size) out.push({ task: t, done: c.done.size, expected: c.expected.size, last: hist.length ? hist.map(h => h.d).sort().pop()! : null })
  }
  return out.sort((a, b) => a.done / a.expected - b.done / b.expected || b.expected - a.expected || a.task.title.localeCompare(b.task.title, 'pt-BR')).slice(0, max)
}

/** Períodos em que a tarefa devia ser feita entre `from` e `until` (desde que existe) e em quais foi. */
function tally(t: Task, from: string, until: string, today: string): { expected: Set<string>, done: Set<string> } | null {
  const created = t.created_at ? t.created_at.slice(0, 10) : from
  if (created > from) from = created
  if (from > until) return null
  const expected = new Set<string>(), done = new Set<string>()
  for (let d = from; d <= until; d = addDays(d, 1)) if (scheduledOn(t, d)) expected.add(periodStart(t.frequency, d))
  for (const h of doneOf(t, today)) if (h.d >= from && h.d <= until) { const p = periodStart(t.frequency, h.d); if (expected.has(p)) done.add(p) }
  return { expected, done }
}

/** Um ajuste mais leve para a frequência da tarefa (null = já é a mais leve; aí sobra pausar ou trocar quem faz). */
export function lighter(t: Pick<Task, 'frequency' | 'weekdays'>): { label: string, patch: Partial<Task> } | null {
  if (t.frequency === 'daily') return !t.weekdays?.length || t.weekdays.length > 3
    ? { label: '3 vezes por semana (seg, qua e sex)', patch: { weekdays: [1, 3, 5] } }
    : { label: '1 vez por semana', patch: { frequency: 'weekly', weekdays: null } }
  if (t.frequency === 'weekly') return { label: 'a cada 2 semanas', patch: { frequency: 'biweekly' } }
  if (t.frequency === 'biweekly') return { label: '1 vez por mês', patch: { frequency: 'monthly' } }
  return null
}

/**
 * Esquecida nas últimas `weeks` semanas fechadas, uma atrás da outra (diárias e semanais):
 * em cada semana, feita menos da metade das vezes. Só tarefas que já existiam no começo.
 */
export function stuck({ tasks, today }: Pick<RetroInput, 'tasks' | 'today'>, weeks = 3): Task[] {
  const cur = weekStartOf(today)
  const starts = Array.from({ length: weeks }, (_, i) => addDays(cur, -7 * (i + 1)))
  const oldest = starts[starts.length - 1]
  return tasks.filter(t => {
    if ((t.frequency !== 'daily' && t.frequency !== 'weekly') || t.active === false) return false
    if (t.created_at && t.created_at.slice(0, 10) > oldest) return false
    return starts.every(ws => { const c = tally(t, ws, addDays(ws, 6), today); return !!c && c.expected.size > 0 && c.done.size * 2 < c.expected.size })
  }).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}

const first = (n: string) => (n || '').split(' ')[0]
const arrow = (a: number, b: number) => a > b ? ' ↑' : a < b ? ' ↓' : ''

/** Retrospectiva do resumo de domingo: a semana de cada uma contra a anterior, o cômodo que mais andou e a mais esquecida. */
export function retroWeekLines(input: RetroInput, names: Names): string[] {
  const [prev, cur] = weeksByPerson(input, 2)
  if (!cur.g && !cur.s && !cur.x && !prev.g && !prev.s && !prev.x) return []
  const lines = ['📊 Retrospectiva da semana']
  for (const w of ['g', 's'] as Who[]) lines.push(`• ${first(names[w])}: ${cur[w]} (semana passada ${prev[w]}${arrow(cur[w], prev[w])})`)
  const room = byRoom(input, 7)[0]
  if (room) lines.push(`🏠 Cômodo que mais andou: ${room.label} (${room.n})`)
  const f = forgotten(input, 28, 1)[0]
  if (f) lines.push(`🧺 Mais esquecida: ${f.task.title} · feita ${f.done} de ${f.expected} ${unitOf(f.task.frequency, f.expected)} em 4 semanas`)
  return lines
}

const UNIT: Record<string, [string, string]> = { daily: ['dia', 'dias'], weekly: ['semana', 'semanas'], biweekly: ['quinzena', 'quinzenas'], monthly: ['mês', 'meses'] }
/** "dias", "semanas"… conforme a frequência. */
export const unitOf = (freq: string, n: number) => (UNIT[freq] || ['vez', 'vezes'])[n === 1 ? 0 : 1]
