// Montagem da tela Hoje: grupos por horário e rotinas dos cães agrupadas.
import type { Dog, DogItem, Doable, HItem, Task, Who } from './types'
import { hhmm } from './dates'
import { dueToday } from './frequency'
import { buildSlots, dogKey, ownerOf, turnBy, type Slots } from './rotation'

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

/**
 * A conta da tela Hoje, usada pelo app e pela notificação da manhã:
 * · com cães cadastrados, tarefas da categoria Cães ficam fora (as rotinas as substituem);
 * · só o que é devido hoje (frequência);
 * · com foco (modo sobrevivência ou energia baixa), só essenciais — rotinas dos cães sempre aparecem;
 * · cada item tem dona: fixa ou pela vez do rodízio.
 */
export function planToday(tasks: Task[], dogs: Dog[], today: string, opts: { focus?: boolean } = {}) {
  const slots = buildSlots(tasks.filter(t => !(dogs.length && t.category === 'dogs')), dogs)
  const dogTasks = dogs.length ? tasks.filter(t => t.category === 'dogs') : []
  const homeTasks = dogs.length ? tasks.filter(t => t.category !== 'dogs') : tasks
  const dueList = homeTasks.filter(t => dueToday(t, today))
  const todayTasks = opts.focus ? dueList.filter(t => t.essential) : dueList
  const dogItems = buildDogItems(dogs, today, slots)
  const items: HItem[] = [
    ...todayTasks.map(t => ({ id: t.id, frequency: t.frequency, scheduled_time: t.scheduled_time, completed_today: t.completed_today, essential: t.essential, category: t.category, task: t })),
    ...dogItems.map(d => ({ id: 'dog:' + d.key, frequency: d.frequency, scheduled_time: d.scheduled_time, completed_today: d.completed_today, essential: false, category: 'dogs', dog: d })),
  ]
  const ownerOfItem = (i: HItem): Who => i.task ? ownerOf(i.task, today, slots) : i.dog!.owner
  return { slots, dogTasks, homeTasks, dueList, todayTasks, dogItems, items, ownerOfItem }
}
