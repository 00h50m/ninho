// Montagem da tela Hoje: grupos por horário e rotinas dos cães agrupadas.
import type { Dog, DogItem, Doable, HItem } from './types'
import { hhmm } from './dates'
import { dueToday } from './frequency'
import { dogKey, turnBy, type Slots } from './rotation'

export const GROUPS: Array<[string, string]> = [['late', '⚠ Atrasadas'], ['morning', '🌅 Manhã'], ['afternoon', '☀️ Tarde'], ['night', '🌙 Noite'], ['any', 'Hoje, a qualquer hora'], ['weekly', 'Até o fim da semana'], ['biweekly', 'Até o fim da quinzena'], ['monthly', 'Até o fim do mês'], ['once', 'Pontuais']]

export function bucketOf(time: string): string {
  const h = Number(time.slice(0, 2))
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'night'
}

/** Diária com horário que já passou e ainda não foi feita. */
export function isLate(x: Doable & { scheduled_time: string | null }, nowHM: string): boolean {
  return x.frequency === 'daily' && !!x.scheduled_time && !x.completed_today && hhmm(x.scheduled_time) < nowHM
}

export function byTime(a: { scheduled_time: string | null }, b: { scheduled_time: string | null }): number {
  return (hhmm(a.scheduled_time) || '99').localeCompare(hhmm(b.scheduled_time) || '99')
}

export function buildDogItems(dogs: Dog[], today: string, slots: Slots): DogItem[] {
  const m = new Map<string, DogItem>()
  dogs.forEach(dog => dog.routines.filter(r => dueToday(r, today)).forEach(r => {
    const key = dogKey(r)
    let it = m.get(key)
    if (!it) {
      it = { key, title: r.title, frequency: r.frequency, scheduled_time: r.scheduled_time, completed_today: true, owner: turnBy('dog:' + key, r.frequency, today, slots), parts: [] }
      m.set(key, it)
    }
    it.parts.push({ r, dog })
    if (!r.completed_today) it.completed_today = false
  }))
  return Array.from(m.values())
}

export function groupToday(list: HItem[], nowHM: string) {
  const g: Record<string, HItem[]> = {}
  list.forEach(t => {
    let k: string
    if (t.frequency === 'daily') k = !t.scheduled_time ? 'any' : isLate(t, nowHM) ? 'late' : bucketOf(hhmm(t.scheduled_time))
    else k = GROUPS.some(x => x[0] === t.frequency) ? t.frequency : 'any'
    ;(g[k] = g[k] || []).push(t)
  })
  return GROUPS.filter(([k]) => g[k]).map(([k, l]) => ({
    k, label: l,
    items: g[k].sort((a, b) => byTime(a, b) || Number(b.essential) - Number(a.essential) || a.category.localeCompare(b.category)),
  }))
}
