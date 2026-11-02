import { describe, expect, it } from 'vitest'
import { laterAt, laterOptions } from '@/lib/maisTarde'
import { buildTasks } from '@/lib/build'
import { dueReminders, type RemState } from '@/lib/reminders'
import { tgRef } from '@/lib/server/tgExtras'

// Dados fictícios.
const base = (o: Partial<RemState>): RemState => ({ date: '2026-10-26', hm: '10:31', nowMs: 0, names: { g: 'Giovanna', s: 'Sabrina' }, meds: [], medTaken: [], water: [], routines: [], routineDone: [], sprint: null, dogHealth: [], events: [], challenges: [], checkins: [], ...o } as RemState)
const ID = '11111111-2222-3333-4444-555555555555'

describe('mais tarde: horários', () => {
  it('agora + 1 h ou 2 h, arredondado para cima em 5 min', () => {
    expect(laterAt('09:12', 60)).toBe('10:15')
    expect(laterAt('09:15', 60)).toBe('10:15')
    expect(laterAt('09:12', 120)).toBe('11:15')
  })
  it('não passa do fim do dia', () => {
    expect(laterAt('22:20', 60)).toBe('23:20')
    expect(laterAt('22:40', 60)).toBeNull()
  })
  it('opções: +1 h, +2 h e à noite (só se faltar mais de 2 h para as 19h)', () => {
    expect(laterOptions('09:00').map(o => o.at)).toEqual(['10:00', '11:00', '19:00'])
    expect(laterOptions('17:30').map(o => o.at)).toEqual(['18:30', '19:30'])
    expect(laterOptions('21:45').map(o => o.at)).toEqual(['22:45', '23:45'].filter(x => x <= '23:30'))
    expect(laterOptions('23:00')).toEqual([])
  })
})

describe('mais tarde: a tarefa', () => {
  const rows = [{ id: ID, title: 'Varal', frequency: 'daily', scheduled_time: '08:00:00', active: true }, { id: 'b', title: 'Lixo', frequency: 'daily', scheduled_time: null, active: true }]
  it('ganha o horário de hoje e guarda o de sempre', () => {
    const [t, u] = buildTasks(rows, [], '2026-10-26', [], [], [{ id: 'l1', task_id: ID, date: '2026-10-26', at: '10:30:00', by_who: 'g' }, { id: 'l2', task_id: 'b', date: '2026-10-26', at: '19:00:00', by_who: 's' }])
    expect(t.scheduled_time).toBe('10:30')
    expect(t.later).toEqual({ id: 'l1', date: '2026-10-26', at: '10:30', orig: '08:00', by: 'g' })
    expect(u.scheduled_time).toBe('19:00')
    expect(u.later?.orig).toBeNull()
  })
  it('vale só no dia', () => {
    const [t] = buildTasks(rows, [], '2026-10-27', [], [], [{ id: 'l1', task_id: ID, date: '2026-10-26', at: '10:30', by_who: 'g' }])
    expect(t.scheduled_time).toBe('08:00:00')
    expect(t.later).toBeNull()
  })
})

describe('mais tarde: lembrete', () => {
  const item = { id: ID, title: 'Varal', time: '10:30', owner: 'g' as const, essential: true, done: false, later: true }
  it('avisa no horário novo, com referência própria (avisa de novo no mesmo dia)', () => {
    const [r] = dueReminders(base({ items: [item] }))
    expect(r).toMatchObject({ who: 'g', kind: 'tarefa', ref: `tarefa:${ID}:1030`, body: 'Você pediu para lembrar agora (10:30).' })
  })
  it('atrasada conta a partir do horário novo', () => {
    const r = dueReminders(base({ hm: '11:31', items: [item] }))
    expect(r.map(x => x.ref)).toEqual([`atraso:${ID}:1030`, `atraso:${ID}:1030`])
  })
  it('referência do Telegram cabe em 40 e não muda as de sempre', () => {
    expect(tgRef(`tarefa:${ID}`)).toBe(`tarefa:${ID}`.slice(0, 40))
    const long = tgRef(`tarefa:${ID}:1030`)
    expect(long).toBe('t:11111111222233334444555555555555:1030')
    expect(long.length).toBeLessThanOrEqual(40)
    expect(tgRef(`atraso:${ID}:1030`)).not.toBe(long)
  })
})
