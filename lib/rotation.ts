// Rodízio atual: itens sem responsável fixa alternam entre as duas a cada período.
// Cada item ganha uma posição (ordenado por horário e nome); posições vizinhas ficam
// com pessoas diferentes e todas trocam a cada período. Igual nos dois aparelhos.
import type { Dog, Task, Who } from './types'
import { hhmm } from './dates'
import { periodIdx } from './frequency'

export type Slots = Map<string, number>

export function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function isWho(v: unknown): v is Who {
  return v === 'g' || v === 's'
}

export function isFixed(t: Pick<Task, 'assigned_to'>): boolean {
  return isWho(t.assigned_to)
}

/** Rotinas com mesmo nome, horário e frequência (de cães diferentes) são o mesmo item. */
export function dogKey(r: { title: string, scheduled_time: string | null, frequency: string }): string {
  return `${r.title.trim().toLowerCase()}|${hhmm(r.scheduled_time)}|${r.frequency}`
}

export function buildSlots(tasks: Task[], dogs: Dog[]): Slots {
  const units = new Map<string, { freq: string, time: string, title: string }>()
  tasks.filter(t => !isFixed(t)).forEach(t => units.set(t.id, { freq: t.frequency, time: hhmm(t.scheduled_time), title: t.title.toLowerCase() }))
  dogs.forEach(d => d.routines.forEach(r => units.set('dog:' + dogKey(r), { freq: r.frequency, time: hhmm(r.scheduled_time), title: r.title.toLowerCase() })))
  const byFreq: Record<string, string[]> = {}
  units.forEach((u, id) => (byFreq[u.freq] = byFreq[u.freq] || []).push(id))
  const slots: Slots = new Map()
  Object.values(byFreq).forEach(ids => ids
    .sort((a, b) => {
      const x = units.get(a)!, y = units.get(b)!
      return (x.time || '99').localeCompare(y.time || '99') || x.title.localeCompare(y.title) || a.localeCompare(b)
    })
    .forEach((id, i) => slots.set(id, i)))
  return slots
}

export function turnBy(id: string, freq: string, today: string, slots: Slots): Who {
  return ((slots.get(id) ?? hashStr(id)) + periodIdx(freq, today)) % 2 === 0 ? 'g' : 's'
}

export function turnOf(t: Task, today: string, slots: Slots): Who {
  return turnBy(t.id, t.frequency, today, slots)
}

/** Para quem a tarefa está planejada hoje (fixa ou pela vez do rodízio). */
export function ownerOf(t: Task, today: string, slots: Slots): Who {
  return isFixed(t) ? t.assigned_to as Who : turnOf(t, today, slots)
}
