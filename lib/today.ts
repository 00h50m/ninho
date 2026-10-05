// Montagem da tela Hoje: grupos por horário e rotinas dos cães agrupadas.
import type { Dog, DogItem, DogRoutine, Doable, HistEntry, HItem, Task, Who } from './types'
import { hhmm } from './dates'
import { dueToday } from './frequency'
import { buildSlots, dogKey, isFixed, ownerOf, turnBy, type Slots } from './rotation'
import { smartSplit, type Decision, type FixedLoad, type SplitMode, type SplitUnit } from './split'
import { DOG_ROUTINE_XP, xpForWeight } from './xp'

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
 * · cada item tem dona: fixa, ou pela divisão da casa ('smart' = inteligente, 'rotation' = rodízio fixo).
 */
export function planToday(tasks: Task[], dogs: Dog[], today: string, opts: { focus?: boolean, split?: SplitMode } = {}) {
  const dogTasks = dogs.length ? tasks.filter(t => t.category === 'dogs') : []
  const homeTasks = dogs.length ? tasks.filter(t => t.category !== 'dogs') : tasks
  const slots = buildSlots(homeTasks, dogs)
  const dueList = homeTasks.filter(t => dueToday(t, today))
  const todayTasks = opts.focus ? dueList.filter(t => t.essential) : dueList

  // Divisão: decide a dona de cada item sem responsável fixa
  const decisions = new Map<string, Decision>()
  if (opts.split === 'smart') {
    const units: SplitUnit[] = homeTasks.filter(t => !isFixed(t)).map(t => ({
      id: t.id, frequency: t.frequency, time: hhmm(t.scheduled_time), title: t.title, weight: xpForWeight(t.weight), hist: t.hist || [],
    }))
    const groups = new Map<string, { r: DogRoutine, n: number, hist: HistEntry[] }>()
    dogs.forEach(d => d.routines.forEach(r => {
      const k = 'dog:' + dogKey(r)
      const g = groups.get(k) || { r, n: 0, hist: [] }
      g.n++
      g.hist = mergeHist(g.hist, r.hist || [])
      groups.set(k, g)
    }))
    groups.forEach((g, id) => units.push({ id, frequency: g.r.frequency, time: hhmm(g.r.scheduled_time), title: g.r.title, weight: g.n * DOG_ROUTINE_XP, hist: g.hist }))
    const fixed: FixedLoad[] = homeTasks.filter(isFixed).map(t => ({ frequency: t.frequency, who: t.assigned_to as Who, weight: xpForWeight(t.weight) }))
    const all = [
      ...homeTasks.map(t => ({ weight: xpForWeight(t.weight), hist: t.hist || [] })),
      ...dogs.flatMap(d => d.routines.map(r => ({ weight: DOG_ROUTINE_XP, hist: r.hist || [] }))),
    ]
    smartSplit(units, fixed, all, today, u => turnBy(u.id, u.frequency, today, slots)).forEach((d, id) => decisions.set(id, d))
  }
  const dogOwner = (key: string, freq: string): Who => decisions.get('dog:' + key)?.who ?? turnBy('dog:' + key, freq, today, slots)
  const ownerOfTask = (t: Task): Who => isFixed(t) ? t.assigned_to as Who : decisions.get(t.id)?.who ?? ownerOf(t, today, slots)
  const ownerOfRoutine = (r: DogRoutine): Who => dogOwner(dogKey(r), r.frequency)
  /** Dona e motivo (para "por que é minha vez?"). */
  const whyOf = (id: string): Decision | undefined => {
    const t = homeTasks.find(x => x.id === id)
    if (t && isFixed(t)) return { who: t.assigned_to as Who, why: { kind: 'fixed' } }
    if (decisions.has(id)) return decisions.get(id)
    if (t) return { who: ownerOf(t, today, slots), why: { kind: 'rotation' } }
    if (id.startsWith('dog:')) return { who: turnBy(id, 'daily', today, slots), why: { kind: 'rotation' } }
    return undefined
  }

  const dogItems = buildDogItems(dogs, today, slots).map(d => ({ ...d, owner: dogOwner(d.key, d.frequency) }))
  const items: HItem[] = [
    ...todayTasks.map(t => ({ id: t.id, frequency: t.frequency, scheduled_time: t.scheduled_time, completed_today: t.completed_today, essential: t.essential, category: t.category, task: t })),
    ...dogItems.map(d => ({ id: 'dog:' + d.key, frequency: d.frequency, scheduled_time: d.scheduled_time, completed_today: d.completed_today, essential: false, category: 'dogs', dog: d })),
  ]
  const ownerOfItem = (i: HItem): Who => i.task ? ownerOfTask(i.task) : i.dog!.owner
  return { slots, dogTasks, homeTasks, dueList, todayTasks, dogItems, items, ownerOfItem, ownerOfTask, ownerOfRoutine, whyOf, split: opts.split ?? 'rotation' }
}

/** Junta históricos de rotinas agrupadas (mesmo dia = uma entrada; vale quem tiver autoria). */
function mergeHist(a: HistEntry[], b: HistEntry[]): HistEntry[] {
  const m = new Map<string, Who | null>()
  for (const h of [...a, ...b]) if (!m.has(h.d) || (!m.get(h.d) && h.by)) m.set(h.d, h.by)
  return Array.from(m, ([d, by]) => ({ d, by })).sort((x, y) => y.d.localeCompare(x.d))
}
