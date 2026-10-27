import { describe, expect, it } from 'vitest'
import { dueReminders, forDevice, DEFAULT_RPREFS, type RemState } from '@/lib/reminders'
import { modeSettings, priorityList, weekPriorities } from '@/lib/reuniao'

// Dados fictícios. 2026-10-26 é segunda-feira.
const base = (o: Partial<RemState>): RemState => ({ date: '2026-10-26', hm: '07:01', nowMs: 0, names: { g: 'Giovanna', s: 'Sabrina' }, meds: [], medTaken: [], water: [], routines: [], routineDone: [], sprint: null, dogHealth: [], events: [], challenges: [], checkins: [], ...o } as RemState)
const item = (id: string, o: Partial<NonNullable<RemState['items']>[number]> = {}) => ({ id, title: id, time: '07:00', owner: 'g' as const, essential: false, done: false, ...o })

describe('reunião que vira ação', () => {
  it('prioridades: até 3, sem numeração nem marcadores', () => {
    expect(priorityList('1. Faxina do quarto\n2) Contas; mercado\n4. Sobra')).toEqual(['Faxina do quarto', 'Contas', 'mercado'])
    expect(priorityList('- Banho das cachorras\n• Vacina da Zelda')).toEqual(['Banho das cachorras', 'Vacina da Zelda'])
    expect(priorityList('')).toEqual([])
    expect(priorityList(null)).toEqual([])
  })
  it('valem na semana seguinte à reunião', () => {
    const ms = [{ week_start: '2026-10-19', priorities: 'Contas\nMercado' }, { week_start: '2026-10-26', priorities: 'Próxima' }]
    expect(weekPriorities(ms, '2026-10-26')).toEqual({ list: ['Contas', 'Mercado'], from: '2026-10-19' })
    expect(weekPriorities([{ week_start: '2026-10-12', priorities: 'Velha' }], '2026-10-26')).toBeNull()
  })
  it('modo da próxima semana vira os ajustes da semana', () => {
    expect(modeSettings('survival')).toEqual({ energy: 'low', survival: true })
    expect(modeSettings('boss')).toEqual({ energy: 'high', survival: false })
    expect(modeSettings('normal')).toEqual({ energy: 'medium', survival: false })
    expect(modeSettings('')).toBeNull()
  })
})

describe('lembrete de tarefa, atraso e resumo da noite', () => {
  it('na hora, só para quem é a vez; feita ou sem horário não avisa', () => {
    const r = dueReminders(base({ items: [item('Ração', { owner: 's' }), item('Louça', { done: true }), item('Lixo', { time: null })] }))
    expect(r.filter(x => x.kind === 'tarefa').map(x => [x.who, x.title])).toEqual([['s', '✅ Ração']])
  })
  it('essencial atrasada 1 h depois, para as duas; não essencial não', () => {
    const r = dueReminders(base({ hm: '08:02', items: [item('Remédio da Zelda', { essential: true }), item('Varrer')] }))
    expect(r.filter(x => x.kind === 'atraso').map(x => x.who)).toEqual(['g', 's'])
    expect(r.find(x => x.kind === 'atraso')!.body).toBe('Era às 07:00, com Giovanna. É essencial.')
    // perto da meia-noite não "vira" o dia
    expect(dueReminders(base({ hm: '00:10', items: [item('Tarde', { time: '23:30', essential: true })] })).some(x => x.kind === 'atraso')).toBe(false)
  })
  it('resumo da noite às 21h, de cada uma', () => {
    const s = base({ hm: '21:03', evening: { day: { g: { done: 3, total: 5, left: ['Louça', 'Lixo'] }, s: { done: 4, total: 4, left: [] } }, soon: ['💸 Luz (amanhã)', 'Dentista (qui)'] } })
    const r = dueReminders(s).filter(x => x.kind === 'noite')
    expect(r.map(x => x.who)).toEqual(['g', 's'])
    expect(r[0].body).toBe('Hoje: 3 de 5 feitas. Fica para amanhã: Louça, Lixo. Próximos dias: 💸 Luz (amanhã) · Dentista (qui).')
    expect(r[1].body).toBe('Hoje: 4 de 4 feitas. Tudo feito! 🎉 Próximos dias: 💸 Luz (amanhã) · Dentista (qui).')
  })
  it('ligados por padrão e respeitam o horário de silêncio', () => {
    expect(DEFAULT_RPREFS.tarefa && DEFAULT_RPREFS.atraso && DEFAULT_RPREFS.noite).toBe(true)
    const r = dueReminders(base({ hm: '21:03', evening: { day: { g: { done: 0, total: 0, left: [] }, s: { done: 0, total: 0, left: [] } }, soon: [] } }))
    const sub = (q: string) => ({ who: 'g' as const, reminders: {}, quiet_start: q, quiet_end: '07:00' })
    expect(forDevice(r, sub('22:00'), '21:03').length).toBe(1)
    expect(forDevice(r, sub('21:00'), '21:03').length).toBe(0)
    expect(forDevice(r, { ...sub('22:00'), reminders: { noite: false } }, '21:03').length).toBe(0)
  })
})
