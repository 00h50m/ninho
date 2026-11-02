// Plano da semana: as tarefas da semana que não são diárias (faxina, lavanderia, mercado…) vão
// para os dias com menos agenda e menos carga de quem faz; as pesadas não se acumulam no mesmo
// dia da mesma pessoa. Vocês aprovam com um toque (app ou Telegram). Puro, testado.
import { addDays, dowOf, weekStartOf } from './dates'
import { doneInPeriod, periodStart, scheduledOn, skippedNow } from './frequency'
import type { Task, Who } from './types'

export interface PlanItem { task: Task, date: string, who: Who }
export interface PlanRow { id: string, task_id: string, week_start: string, date: string, by_who?: string | null }

const WEIGHT: Record<string, number> = { heavy: 3, medium: 2, light: 1 }
const monthEnd = (d: string) => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }

/**
 * Semana que o plano cobre: no domingo, a próxima (segunda a domingo); nos outros dias, de hoje
 * até domingo.
 */
export function planWeek(today: string): { start: string, from: string, end: string } {
  if (dowOf(today) === 0) { const start = addDays(today, 1); return { start, from: start, end: addDays(start, 6) } }
  const start = weekStartOf(today)
  return { start, from: today, end: addDays(start, 6) }
}

/**
 * Tarefas que entram no plano: semanais e quinzenais ainda não feitas no período, e as mensais
 * cujo mês termina até a semana seguinte (para não empurrar a mensal toda semana).
 */
export function planCandidates(tasks: Task[], today: string): Task[] {
  const w = planWeek(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(w.start, i)).filter(d => d >= w.from)
  return tasks.filter(t => {
    if (t.active === false || t.frequency === 'daily' || t.frequency === 'once') return false
    if (t.frequency === 'monthly' && monthEnd(w.from) > addDays(w.end, 7)) return false
    if (doneInPeriod(t, w.from) || skippedNow(t, w.from)) return false
    // feita depois do começo do período em que cai a semana (no domingo, olhando a próxima)
    if (t.prev_done && t.prev_done >= periodStart(t.frequency, w.from)) return false
    return days.some(d => scheduledOn(t, d))
  })
}

/**
 * Distribui: das mais pesadas para as mais leves, cada uma no dia permitido com menor custo:
 * compromissos da agenda no dia (×2), o que a mesma pessoa já tem planejado no dia (×3) e +6 se já
 * houver uma pesada dela no dia. Empate: o dia mais cedo.
 */
export function proposePlan(tasks: Task[], events: Array<{ date: string }>, today: string, ownerOf: (t: Task) => Who): PlanItem[] {
  const w = planWeek(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(w.start, i)).filter(d => d >= w.from)
  const ev = new Map<string, number>()
  for (const e of events) ev.set(e.date, (ev.get(e.date) || 0) + 1)
  const load = new Map<string, number>(), heavy = new Set<string>()
  const out: PlanItem[] = []
  const list = planCandidates(tasks, today).sort((a, b) => (WEIGHT[b.weight] || 1) - (WEIGHT[a.weight] || 1) || a.title.localeCompare(b.title, 'pt-BR'))
  for (const t of list) {
    const who = ownerOf(t), isHeavy = t.weight === 'heavy'
    const ok = days.filter(d => scheduledOn(t, d))
    if (!ok.length) continue
    let best = ok[0], bestCost = Infinity
    ok.forEach((d, i) => {
      const cost = 2 * (ev.get(d) || 0) + 3 * (load.get(`${who}:${d}`) || 0) + (isHeavy && heavy.has(`${who}:${d}`) ? 6 : 0) + i * 0.01
      if (cost < bestCost) { bestCost = cost; best = d }
    })
    out.push({ task: t, date: best, who })
    load.set(`${who}:${best}`, (load.get(`${who}:${best}`) || 0) + (WEIGHT[t.weight] || 1))
    if (isHeavy) heavy.add(`${who}:${best}`)
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.task.title.localeCompare(b.task.title, 'pt-BR'))
}

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const dowLabel = (d: string) => DOW[dowOf(d)]

/** Linhas do plano por dia: "seg · Faxina do banheiro (Giovanna), Lavar roupa (Sabrina)". */
export function planLines(items: PlanItem[], names: Record<Who, string>): string[] {
  const by = new Map<string, PlanItem[]>()
  for (const i of items) by.set(i.date, [...(by.get(i.date) || []), i])
  return Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([d, l]) => `${dowLabel(d)} · ${l.map(i => `${i.task.title} (${(names[i.who] || '').split(' ')[0]})`).join(', ')}`)
}

/** Dia planejado desta semana para a tarefa (o plano aprovado), se houver. */
export function plannedOn(rows: PlanRow[], taskId: string, today: string): string | null {
  const ws = weekStartOf(today)
  return rows.find(r => r.task_id === taskId && r.week_start === ws)?.date ?? null
}
