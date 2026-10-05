import { describe, expect, it } from 'vitest'
import { buildSlots, dogKey, isFixed, ownerOf, turnBy } from '@/lib/rotation'
import { buildDogItems } from '@/lib/today'
import type { Dog, Task } from '@/lib/types'

const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'light', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o })

describe('rodízio', () => {
  const tasks = [task('a', { scheduled_time: '07:00' }), task('b', { scheduled_time: '12:00' }), task('c', { scheduled_time: '18:00' }), task('d')]
  const slots = buildSlots(tasks, [])

  it('fixa sempre fica com a responsável', () => {
    const t = task('x', { assigned_to: 's' })
    expect(isFixed(t)).toBe(true)
    expect(ownerOf(t, '2026-10-07', slots)).toBe('s')
    expect(ownerOf(t, '2026-10-08', slots)).toBe('s')
  })

  it('itens vizinhos (por horário) ficam com pessoas diferentes — divisão equilibrada', () => {
    const owners = tasks.map(t => ownerOf(t, '2026-10-07', slots))
    expect(owners.filter(o => o === 'g').length).toBe(2)
    expect(owners.filter(o => o === 's').length).toBe(2)
    expect(owners[0]).not.toBe(owners[1])
  })

  it('todos trocam no dia seguinte', () => {
    const d1 = tasks.map(t => ownerOf(t, '2026-10-07', slots))
    const d2 = tasks.map(t => ownerOf(t, '2026-10-08', slots))
    d1.forEach((o, i) => expect(d2[i]).not.toBe(o))
  })

  it('semanal só troca na segunda', () => {
    const w = task('w', { frequency: 'weekly' })
    const s = buildSlots([w], [])
    expect(ownerOf(w, '2026-10-05', s)).toBe(ownerOf(w, '2026-10-11', s))
    expect(ownerOf(w, '2026-10-12', s)).not.toBe(ownerOf(w, '2026-10-11', s))
  })

  it('é o mesmo resultado em qualquer aparelho (determinístico)', () => {
    expect(buildSlots([...tasks].reverse(), [])).toEqual(slots)
  })
})

describe('rotinas dos cães', () => {
  const dogs: Dog[] = [
    { id: 'p', name: 'Penélope', breed: null, is_puppy: false, routines: [{ id: 'r1', title: 'Ração manhã', frequency: 'daily', scheduled_time: '07:00' }] },
    { id: 'z', name: 'Zelda', breed: null, is_puppy: true, routines: [{ id: 'r2', title: 'Ração manhã ', frequency: 'daily', scheduled_time: '07:00:00', completed_today: true, completed_by_today: 's' }] },
  ]
  it('mesma rotina de cães diferentes vira um item só', () => {
    expect(dogKey(dogs[0].routines[0])).toBe(dogKey(dogs[1].routines[0]))
    const items = buildDogItems(dogs, '2026-10-07', buildSlots([], dogs))
    expect(items).toHaveLength(1)
    expect(items[0].parts).toHaveLength(2)
    expect(items[0].completed_today).toBe(false) // só um dos dois foi feito
  })
  it('a vez da rotina alterna por dia', () => {
    const s = buildSlots([], dogs)
    const k = 'dog:' + dogKey(dogs[0].routines[0])
    expect(turnBy(k, 'daily', '2026-10-07', s)).not.toBe(turnBy(k, 'daily', '2026-10-08', s))
  })
})
