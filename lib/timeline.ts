// Linha do tempo do dia de uma pessoa: tarefas, rotinas dos cães, rotinas com
// passos, compromissos da agenda e remédios, em ordem de horário, separados em
// Manhã / Tarde / Noite, com o "▷ agora" (o que está acontecendo ou vem em
// seguida). O que não tem hora fica em "Quando der". Puro, testado.
import type { HItem, Who } from './types'
import type { HouseEvent } from './agenda'
import type { Routine } from './rotinas'
import type { Dose } from './meudia'
import { hhmm } from './dates'

export type TlKind = 'tarefa' | 'caes' | 'rotina' | 'agenda' | 'remedio'
export type TlPeriod = 'manha' | 'tarde' | 'noite'
export interface TlEntry {
  key: string, kind: TlKind, time: string | null, end: string | null, title: string, sub: string | null
  done: boolean, late: boolean, essential: boolean
  item?: HItem, event?: HouseEvent, routine?: Routine, dose?: Dose
}
export interface Timeline {
  periods: Array<{ k: TlPeriod, label: string, entries: TlEntry[] }>
  loose: TlEntry[]
  /** o que está acontecendo agora ou vem em seguida */
  nowKey: string | null
  /** em qual posição do período a linha "agora" entra (antes de qual entrada) */
  nowAt: { period: TlPeriod, index: number } | null
  done: number, total: number
}

export const PERIOD_LABELS: Record<TlPeriod, string> = { manha: '🌅 Manhã', tarde: '☀️ Tarde', noite: '🌙 Noite' }
export const periodOfTime = (t: string): TlPeriod => { const h = Number(t.slice(0, 2)); return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite' }

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fromMin = (m: number) => { const x = Math.min(m, 23 * 60 + 59); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}` }
const plus = (t: string, min: number) => fromMin(toMin(t) + min)
const WEIGHT_MIN: Record<string, number> = { light: 10, medium: 20, heavy: 40 }

export interface TimelineInput {
  who: Who, nowHM: string
  /** tarefas e rotinas dos cães de hoje que são desta pessoa */
  items: HItem[]
  /** compromissos da agenda de hoje (vencimentos ficam fora) */
  events: HouseEvent[]
  /** rotinas com passos de hoje que são desta pessoa (ou das duas) */
  routines: Array<{ r: Routine, done: boolean, steps: string | null }>
  /** remédios de hoje (só de quem está usando o aparelho) */
  doses: Dose[]
}

export function buildTimeline(x: TimelineInput): Timeline {
  const all: TlEntry[] = []
  for (const i of x.items) {
    const time = hhmm(i.scheduled_time) || null
    const min = i.task ? WEIGHT_MIN[i.task.weight] ?? 15 : 10
    all.push({
      key: (i.task ? 't:' : 'd:') + i.id, kind: i.task ? 'tarefa' : 'caes', time, end: time ? plus(time, min) : null,
      title: i.task ? i.task.title : i.dog!.title, sub: i.dog ? i.dog.parts.map(p => p.dog.name).join(', ') : null,
      done: !!i.completed_today, late: false, essential: i.essential, item: i,
    })
  }
  for (const e of x.events) {
    if (e.kind === 'vencimento' || (e.who && e.who !== 'both' && e.who !== x.who)) continue
    const time = e.time ? e.time.slice(0, 5) : null
    all.push({ key: 'e:' + e.id, kind: 'agenda', time, end: time ? plus(time, 60) : null, title: e.title, sub: e.who === 'both' ? 'as duas' : e.notes, done: !!e.done_at, late: false, essential: false, event: e })
  }
  for (const { r, done, steps } of x.routines) {
    const time = hhmm(r.scheduled_time) || null
    all.push({ key: 'r:' + r.id, kind: 'rotina', time, end: time ? plus(time, r.duration_min || 15) : null, title: r.title, sub: steps, done, late: false, essential: r.essential, routine: r })
  }
  for (const d of x.doses) {
    all.push({ key: `m:${d.med.id}:${d.time}`, kind: 'remedio', time: d.time || null, end: d.time ? plus(d.time, 5) : null, title: d.med.name, sub: d.med.dose, done: !!d.taken, late: false, essential: true, dose: d })
  }
  // Atrasado: ainda não feito e o horário já passou (compromisso que passou não conta como atraso)
  for (const e of all) e.late = !e.done && !!e.time && e.kind !== 'agenda' && e.time < x.nowHM
  const timed = all.filter(e => e.time).sort((a, b) => a.time!.localeCompare(b.time!) || Number(b.essential) - Number(a.essential) || a.title.localeCompare(b.title))
  const loose = all.filter(e => !e.time).sort((a, b) => Number(a.done) - Number(b.done) || Number(b.essential) - Number(a.essential) || a.title.localeCompare(b.title))
  // ▷ agora: o primeiro pendente que ainda não terminou (em andamento ou o próximo)
  const now = timed.find(e => !e.done && !e.late && e.end! > x.nowHM) || null
  const periods = (['manha', 'tarde', 'noite'] as TlPeriod[]).map(k => ({ k, label: PERIOD_LABELS[k], entries: timed.filter(e => periodOfTime(e.time!) === k) })).filter(p => p.entries.length)
  // Linha "agora": antes do primeiro item que começa depois de agora
  let nowAt: Timeline['nowAt'] = null
  const np = periodOfTime(x.nowHM)
  const p = periods.find(q => q.k === np)
  if (p) { const i = p.entries.findIndex(e => e.time! > x.nowHM); nowAt = { period: np, index: i === -1 ? p.entries.length : i } }
  const countable = all.filter(e => e.kind !== 'agenda')
  return { periods, loose, nowKey: now?.key ?? null, nowAt, done: countable.filter(e => e.done).length, total: countable.length }
}
