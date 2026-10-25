import { describe, expect, it } from 'vitest'
import { cellsFromDb, nextWho, periodOf, scheduleLoad, scheduleOwner, type DogPlan } from '@/lib/escala'
import { buildDogs } from '@/lib/build'
import { planToday } from '@/lib/today'
import { whyLabel } from '@/lib/split'
import { busyWindows } from '@/lib/busy'

// Dados fictícios. 2026-10-26 é segunda-feira.
const MON = '2026-10-26', SAT = '2026-10-31'
const plan = (mode: DogPlan['mode'] = 'escala'): DogPlan => ({ mode, cells: [
  { dow: 1, period: 'manha', who: 'g' }, { dow: 1, period: 'noite', who: 's' }, { dow: 6, period: 'manha', who: 's' },
] })
const dogs = buildDogs([
  { id: 'p', name: 'Pen', active: true, dog_routines: [{ id: 'r1', title: 'Ração manhã', frequency: 'daily', scheduled_time: '07:00' }, { id: 'r2', title: 'Ração noite', frequency: 'daily', scheduled_time: '18:00' }, { id: 'r3', title: 'Água fresca', frequency: 'daily', scheduled_time: null }, { id: 'r4', title: 'Passeio tarde', frequency: 'daily', scheduled_time: '17:30' }] },
  { id: 'z', name: 'Zel', active: true, dog_routines: [{ id: 'r5', title: 'Ração manhã', frequency: 'daily', scheduled_time: '07:00' }] },
], [], MON)
const names = { g: 'Giovanna', s: 'Sabrina' }

describe('escala fixa dos cães', () => {
  it('período pelo horário; sem horário fica no rodízio', () => {
    expect(['06:30', '11:59', '12:00', '17:59', '18:00', '23:00'].map(periodOf)).toEqual(['manha', 'manha', 'tarde', 'tarde', 'noite', 'noite'])
    expect(periodOf(null)).toBeNull()
  })
  it('dona pela escala só no modo escala e no turno marcado', () => {
    expect(scheduleOwner(plan(), MON, '07:00')).toEqual({ who: 'g', dow: 1, period: 'manha' })
    expect(scheduleOwner(plan(), MON, '19:00')?.who).toBe('s')
    expect(scheduleOwner(plan(), MON, '14:00')).toBeNull()
    expect(scheduleOwner(plan(), SAT, '07:00')?.who).toBe('s')
    expect(scheduleOwner(plan('rodizio'), MON, '07:00')).toBeNull()
    expect(scheduleOwner(plan(), MON, null)).toBeNull()
  })
  it('contagem, toque e leitura do banco', () => {
    expect(scheduleLoad(plan().cells)).toEqual({ g: 1, s: 2, free: 18 })
    expect([nextWho(null), nextWho('g'), nextWho('s')]).toEqual(['g', 's', null])
    expect(cellsFromDb([{ dow: 1, period: 'manha', who: 'g' }, { dow: 9, period: 'manha', who: 'g' }, { dow: 2, period: 'madrugada', who: 's' }, { dow: 3, period: 'tarde', who: 'x' }])).toEqual([{ dow: 1, period: 'manha', who: 'g' }])
  })
  it('no dia: as rotinas dos dois cães do mesmo turno seguem a escala; o resto continua alternando', () => {
    const p = planToday([], dogs, MON, { split: 'smart', dogPlan: plan() })
    const owner = (title: string) => p.dogItems.find(d => d.title === title)!.owner
    expect(owner('Ração manhã')).toBe('g')
    expect(owner('Ração noite')).toBe('s')
    expect(p.dogItems.find(d => d.title === 'Ração manhã')!.parts).toHaveLength(2)
    const r = planToday([], dogs, MON, { split: 'smart' })
    expect(p.dogItems.find(d => d.title === 'Água fresca')!.owner).toBe(r.dogItems.find(d => d.title === 'Água fresca')!.owner)
    const id = 'dog:' + p.dogItems.find(d => d.title === 'Ração manhã')!.key
    expect(whyLabel(p.whyOf(id), names, MON)).toBe('Escala dos cães: segunda de manhã é da Giovanna')
  })
  it('compromisso no turno da escala: avisa, não troca', () => {
    const busy = busyWindows([{ id: 'd', kind: 'compromisso', title: 'Dentista', date: MON, time: '06:30', end_time: '08:00', who: 'g', done_at: null }], MON)
    const p = planToday([], dogs, MON, { split: 'smart', dogPlan: plan(), busy })
    const it_ = p.dogItems.find(d => d.title === 'Ração manhã')!
    expect(it_.owner).toBe('g')
    expect(p.conflictOf('dog:' + it_.key)?.title).toBe('Dentista')
  })
  it('modo alternada: igual a antes (escala guardada, mas não usada)', () => {
    const a = planToday([], dogs, MON, { split: 'smart', dogPlan: plan('rodizio') }), b = planToday([], dogs, MON, { split: 'smart' })
    expect(a.dogItems.map(d => d.owner)).toEqual(b.dogItems.map(d => d.owner))
  })
})
