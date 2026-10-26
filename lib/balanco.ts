// Balanço da semana (Nós): quanto cada uma fez de tarefas e rotinas dos cães (em pontos de
// esforço: leve 1, médio 2, pesado 3; rotina de cão 1), quem cozinhou e as horas de compromisso.
// Compara com a semana passada. O rodízio já compensa sozinho (ver split.ts). Puro, testado.
import { addDays, weekStartOf } from './dates'
import { xpForWeight, DOG_ROUTINE_XP } from './xp'
import { busyMinutes, busyWindows } from './busy'
import { cookCount, type HouseMeal } from './jantar'
import type { Dog, HistEntry, Task, Who } from './types'

export interface PersonWeek { points: number, done: number, cooked: number, busyMin: number }
export interface WeekBalance { from: string, to: string, g: PersonWeek, s: PersonWeek, unknown: number, pctG: number | null, verdict: 'equilibrado' | 'g' | 's' | 'vazio' }

/** Conclusões (data e quem) de um item: histórico + hoje. */
const doneList = (x: { hist?: HistEntry[], completed_today?: boolean, completed_by_today?: Who | null }, today: string): HistEntry[] =>
  [...(x.hist || []), ...(x.completed_today ? [{ d: today, by: x.completed_by_today ?? null }] : [])]

export function weekBalance(o: { tasks: Task[], dogs: Dog[], meals: HouseMeal[], events: Parameters<typeof busyWindows>[0], anyDay: string, today: string }): WeekBalance {
  const from = weekStartOf(o.anyDay), end = addDays(from, 6), to = end < o.today ? end : o.today
  const p = (): PersonWeek => ({ points: 0, done: 0, cooked: 0, busyMin: 0 })
  const r = { g: p(), s: p(), unknown: 0 }
  const add = (h: HistEntry, w: number) => { if (h.d < from || h.d > to) return; if (h.by) { r[h.by].points += w; r[h.by].done++ } else r.unknown++ }
  for (const t of o.tasks) doneList(t, o.today).forEach(h => add(h, xpForWeight(t.weight)))
  for (const d of o.dogs) for (const rt of d.routines) doneList(rt, o.today).forEach(h => add(h, DOG_ROUTINE_XP))
  const cooked = cookCount(o.meals, from, to); r.g.cooked = cooked.g; r.s.cooked = cooked.s
  for (let d = from; d <= to; d = addDays(d, 1)) { const w = busyWindows(o.events, d); r.g.busyMin += busyMinutes(w, 'g'); r.s.busyMin += busyMinutes(w, 's') }
  // cozinhar conta 2 pontos (como uma tarefa média)
  const tot = (x: PersonWeek) => x.points + x.cooked * 2
  const sum = tot(r.g) + tot(r.s)
  const pctG = sum ? Math.round(tot(r.g) / sum * 100) : null
  const verdict = pctG == null ? 'vazio' : pctG >= 60 ? 'g' : pctG <= 40 ? 's' : 'equilibrado'
  return { from, to, g: r.g, s: r.s, unknown: r.unknown, pctG, verdict }
}

const first = (n: string) => (n || '').split(' ')[0]
/** Frase do balanço (sem placar: é para combinar, não competir). */
export function balanceLine(b: WeekBalance, names: Record<Who, string>, thisWeek: boolean): string {
  if (b.verdict === 'vazio') return thisWeek ? 'A semana está começando: nada concluído ainda.' : 'Nada registrado nessa semana.'
  const pg = b.pctG!, ps = 100 - pg
  const head = `${first(names.g)} ${pg}% · ${first(names.s)} ${ps}% do esforço`
  if (b.verdict === 'equilibrado') return `${head}. Bem dividido. 💛`
  const more = b.verdict, less: Who = more === 'g' ? 's' : 'g'
  const why = b[less].busyMin >= 240 ? ` (a ${first(names[less])} teve ${Math.round(b[less].busyMin / 60)} h de compromissos)` : ''
  return `${head}. A ${first(names[more])} puxou mais${why}${thisWeek ? '; o rodízio já passa um pouco mais para a outra.' : '; esta semana o rodízio compensa.'}`
}
