import { describe, expect, it } from 'vitest'
import { localHM, usualTime, type Stamp } from '@/lib/horario'
import { dueReminders, DEFAULT_RPREFS, RKINDS, type RemState } from '@/lib/reminders'

// Dados fictícios. Horários em UTC; a casa é America/Sao_Paulo (UTC−3).
const at = (d: number, hm: string) => `2026-10-${String(d).padStart(2, '0')}T${hm}:00Z`
const g = (hm: string, d = 10): Stamp => ({ at: at(d, hm), by: 'g' })
const base = (o: Partial<RemState>): RemState => ({ date: '2026-10-26', hm: '08:01', nowMs: 0, names: { g: 'Giovanna', s: 'Sabrina' }, meds: [], medTaken: [], water: [], routines: [], routineDone: [], sprint: null, dogHealth: [], events: [], challenges: [], checkins: [], ...o } as RemState)
const item = (o: Partial<NonNullable<RemState['items']>[number]> = {}) => ({ id: 't1', title: 'Regar plantas', time: null, owner: 'g' as const, essential: false, done: false, usual: '08:00', ...o })

describe('hora local', () => {
  it('converte para o fuso da casa', () => {
    expect(localHM('2026-10-10T11:07:00Z')).toBe('08:07')
    expect(localHM('2026-10-10T02:30:00Z')).toBe('23:30')
  })
})

describe('horário de costume', () => {
  it('mediana das vezes da própria pessoa, arredondada para 5 min', () => {
    expect(usualTime([g('11:02', 1), g('11:10', 2), g('11:21', 3)], 'g')).toBe('08:10')
    expect(usualTime([g('11:00', 1), g('11:10', 2), g('11:20', 3), g('11:40', 4)], 'g')).toBe('08:15')
  })
  it('precisa de pelo menos 3 vezes', () => {
    expect(usualTime([g('11:00', 1), g('11:05', 2)], 'g')).toBeNull()
    expect(usualTime([], 'g')).toBeNull()
  })
  it('só conta o que a própria pessoa fez', () => {
    const st: Stamp[] = [g('11:00', 1), g('11:05', 2), { at: at(3, '22:00'), by: 's' }, { at: at(4, '22:10'), by: 's' }, { at: at(5, '22:20'), by: 's' }]
    expect(usualTime(st, 'g')).toBeNull()
    expect(usualTime(st, 's')).toBe('19:10')
  })
  it('horários espalhados demais: sem costume', () => {
    expect(usualTime([g('10:00', 1), g('16:00', 2), g('22:00', 3)], 'g')).toBeNull()
  })
  it('uma vez fora da curva (entre 5 ou mais) não estraga', () => {
    expect(usualTime([g('11:00', 1), g('11:05', 2), g('11:10', 3), g('11:15', 4), g('22:00', 5)], 'g')).toBe('08:10')
  })
  it('madrugada não conta (costuma ser "marquei depois")', () => {
    expect(usualTime([g('04:00', 1), g('04:30', 2), g('05:00', 3)], 'g')).toBeNull()
  })
})

describe('lembrete no horário de costume', () => {
  it('avisa a dona na hora de costume, se ainda não fez', () => {
    const r = dueReminders(base({ items: [item()] }))
    expect(r).toEqual([expect.objectContaining({ who: 'g', kind: 'costume', ref: 'costume:t1', title: '🕰 Regar plantas', body: 'Você costuma fazer por volta das 08:00.' })])
  })
  it('feita, fora da hora, com horário marcado ou sem costume: nada', () => {
    expect(dueReminders(base({ items: [item({ done: true })] }))).toEqual([])
    expect(dueReminders(base({ hm: '09:30', items: [item()] }))).toEqual([])
    expect(dueReminders(base({ items: [item({ usual: null })] }))).toEqual([])
    // com horário marcado vale o lembrete de "tarefa", não o de costume
    expect(dueReminders(base({ items: [item({ time: '08:00' })] })).map(x => x.kind)).toEqual(['tarefa'])
  })
  it('vem ligado e aparece nos Ajustes', () => {
    expect(DEFAULT_RPREFS.costume).toBe(true)
    expect(RKINDS.some(k => k[0] === 'costume')).toBe(true)
  })
})
