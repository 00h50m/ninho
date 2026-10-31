import { describe, expect, it } from 'vitest'
import { buildDogs } from '@/lib/build'
import { dueToday, pausedToday } from '@/lib/frequency'
import { planToday } from '@/lib/today'

// Dados fictícios. 2026-11-02 é segunda-feira.
const today = '2026-11-02'
const dogRows = [
  { id: 'd1', name: 'Cachorra A', dog_routines: [{ id: 'r1', title: 'Passeio manhã', frequency: 'daily', scheduled_time: '07:00', active: true }, { id: 'r2', title: 'Ração noite', frequency: 'daily', scheduled_time: '19:00', active: true }] },
  { id: 'd2', name: 'Cachorra B', dog_routines: [{ id: 'r3', title: 'Passeio manhã', frequency: 'daily', scheduled_time: '07:00', active: true }] },
]

describe('"não deu" nas rotinas dos cães (042)', () => {
  it('a rotina pulada hoje sai da lista; a de ontem não vale mais', () => {
    const dogs = buildDogs(dogRows, [], today, [{ id: 's1', routine_id: 'r1', date: today, skipped_by: 'g' }, { id: 's0', routine_id: 'r2', date: '2026-11-01', skipped_by: 's' }])
    const [r1, r2] = dogs[0].routines
    expect(r1.skip).toEqual({ id: 's1', date: today, kind: 'skip', by: 'g' })
    expect(dueToday(r1, today)).toBe(false)
    expect(pausedToday(r1, today)).toBe(true)
    expect(r2.skip).toBeNull()
    expect(dueToday(r2, today)).toBe(true)
  })
  it('na lista do dia: o passeio da cachorra A some, o da B continua', () => {
    const dogs = buildDogs(dogRows, [], today, [{ id: 's1', routine_id: 'r1', date: today, skipped_by: 'g' }])
    const plan = planToday([], dogs, today)
    const passeio = plan.dogItems.find(i => i.title === 'Passeio manhã')!
    expect(passeio.parts.map(p => p.dog.name)).toEqual(['Cachorra B'])
  })
  it('sem pulos (ou sem a migration), tudo como antes', () => {
    const dogs = buildDogs(dogRows, [], today)
    expect(dogs.flatMap(d => d.routines).every(r => r.skip === null && dueToday(r, today))).toBe(true)
  })
})
