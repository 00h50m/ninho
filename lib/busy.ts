// Compromissos que mexem no dia (migration 036): quem tem compromisso com horário na Agenda
// fica "ocupada" naquele intervalo. A divisão das tarefas usa isso para:
//  1. passar para a outra a tarefa sem dona fixa que cai no horário do compromisso;
//  2. avisar quando a tarefa é fixa (aí quem decide é a pessoa: passar só hoje, adiar, mudar a hora);
//  3. em dia cheio (4 h ou mais de compromisso), mandar para a outra as tarefas sem hora marcada.
// Puro, testado. Igual no app e no servidor (Telegram, notificações).
import type { Who } from './types'

export interface BusyWindow { id: string, who: Who, title: string, start: string, end: string }
/** Compromisso sem hora de fim conta 1 hora. */
export const DEFAULT_MIN = 60
/** Uma tarefa com hora marcada ocupa uns 30 minutos. */
export const TASK_MIN = 30
/** A partir de quantos minutos de compromisso o dia é "cheio". */
export const FULL_DAY_MIN = 240

const toMin = (hm: string) => { const [h, m] = hm.slice(0, 5).split(':').map(Number); return h * 60 + m }
const fromMin = (n: number) => `${String(Math.floor(Math.min(n, 1439) / 60)).padStart(2, '0')}:${String(Math.min(n, 1439) % 60).padStart(2, '0')}`
const isHM = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}/.test(v)

/** Janelas ocupadas do dia: compromissos com horário, de uma ou das duas, que não estão feitos (vencimentos não contam). */
export function busyWindows(events: Array<{ id: string, kind: string, title: string, date: string, time: string | null, end_time?: string | null, who: string | null, done_at: string | null }>, date: string): BusyWindow[] {
  const out: BusyWindow[] = []
  for (const e of events) {
    if (e.date !== date || e.kind === 'vencimento' || e.done_at || !isHM(e.time)) continue
    const start = e.time.slice(0, 5)
    const end = isHM(e.end_time) && toMin(e.end_time) > toMin(start) ? e.end_time.slice(0, 5) : fromMin(toMin(start) + DEFAULT_MIN)
    const whos: Who[] = e.who === 'g' || e.who === 's' ? [e.who] : e.who === 'both' ? ['g', 's'] : []
    whos.forEach(w => out.push({ id: e.id, who: w, title: e.title, start, end }))
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/** O compromisso da pessoa que se sobrepõe a uma tarefa às `time` (a tarefa ocupa ~30 min). */
export function conflictAt(windows: BusyWindow[], who: Who, time: string | null | undefined): BusyWindow | null {
  if (!isHM(time)) return null
  const a = toMin(time), b = a + TASK_MIN
  return windows.find(w => w.who === who && toMin(w.start) < b && a < toMin(w.end)) || null
}

/** Minutos ocupados no dia (juntando os compromissos que se sobrepõem). */
export function busyMinutes(windows: BusyWindow[], who: Who): number {
  const iv = windows.filter(w => w.who === who).map(w => [toMin(w.start), toMin(w.end)] as [number, number]).sort((x, y) => x[0] - y[0])
  let total = 0, cur: [number, number] | null = null
  for (const x of iv) {
    if (!cur || x[0] > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [x[0], x[1]] }
    else cur[1] = Math.max(cur[1], x[1])
  }
  if (cur) total += cur[1] - cur[0]
  return total
}
export const fullDay = (windows: BusyWindow[], who: Who) => busyMinutes(windows, who) >= FULL_DAY_MIN

/** "Dentista (14:00–16:00)" */
export const windowLabel = (w: BusyWindow) => `${w.title} (${w.start}–${w.end})`
export const hoursLabel = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${m} min` : `${h} h` }

export type BusyWhy = { kind: 'busy', from: Who, title: string, start: string, end: string } | { kind: 'full', from: Who, minutes: number } | { kind: 'handoff', from: Who, by: Who | null }

/**
 * Ajusta a dona do dia de um item.
 * `base` = quem seria (divisão de sempre); `fixed` = tem responsável fixa; `handoffTo` = "passar só hoje".
 * Devolve a dona final, o motivo da troca (se trocou) e o conflito que sobrou (para avisar).
 */
export function adjustOwner(o: { base: Who, fixed: boolean, time: string | null | undefined, windows: BusyWindow[], handoff?: { to: Who, by: Who | null } | null }): { who: Who, why: BusyWhy | null, conflict: BusyWindow | null } {
  const other: Who = o.base === 'g' ? 's' : 'g'
  if (o.handoff && o.handoff.to !== o.base) return { who: o.handoff.to, why: { kind: 'handoff', from: o.base, by: o.handoff.by }, conflict: conflictAt(o.windows, o.handoff.to, o.time) }
  const mine = conflictAt(o.windows, o.base, o.time)
  if (!o.fixed) {
    if (mine && !conflictAt(o.windows, other, o.time)) return { who: other, why: { kind: 'busy', from: o.base, title: mine.title, start: mine.start, end: mine.end }, conflict: null }
    if (!isHM(o.time) && fullDay(o.windows, o.base) && !fullDay(o.windows, other)) return { who: other, why: { kind: 'full', from: o.base, minutes: busyMinutes(o.windows, o.base) }, conflict: null }
  }
  return { who: o.base, why: null, conflict: mine }
}

export function busyWhyLabel(w: BusyWhy, names: Record<Who, string>): string {
  const n = (x: Who) => (names[x] || '').split(' ')[0]
  if (w.kind === 'busy') return `Hoje com a ${n(w.from === 'g' ? 's' : 'g')}: ${n(w.from)} tem ${w.title} (${w.start}–${w.end})`
  if (w.kind === 'full') return `Hoje com a ${n(w.from === 'g' ? 's' : 'g')}: ${n(w.from)} tem ${hoursLabel(w.minutes)} de compromissos`
  return `Só hoje com a ${n(w.from === 'g' ? 's' : 'g')}${w.by ? ` (passada pela ${n(w.by)})` : ''}`
}
