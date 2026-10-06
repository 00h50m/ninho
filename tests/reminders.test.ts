import { describe, expect, it } from 'vitest'
import { dueReminders, forDevice, inQuiet, due, type RemState } from '@/lib/reminders'

const base = (p: Partial<RemState> = {}): RemState => ({
  date: '2026-10-06', hm: '08:05', nowMs: Date.parse('2026-10-06T11:05:00Z'), names: { g: 'Giovanna', s: 'Sabrina' },
  meds: [], medTaken: [], water: [], routines: [], routineDone: [], sprint: null, dogHealth: [], events: [], challenges: [], checkins: [], ...p,
})
const kinds = (r: ReturnType<typeof dueReminders>) => r.map(x => `${x.who}:${x.kind}:${x.ref}`)

describe('janela e silêncio', () => {
  it('vale do horário até a janela', () => {
    expect(due('08:00', '08:00', 20)).toBe(true); expect(due('08:00', '08:19', 20)).toBe(true)
    expect(due('08:00', '08:20', 20)).toBe(false); expect(due('08:00', '07:59', 20)).toBe(false)
  })
  it('silêncio atravessando a meia-noite', () => {
    expect(inQuiet('23:00', '22:00', '07:00')).toBe(true); expect(inQuiet('06:59', '22:00', '07:00')).toBe(true)
    expect(inQuiet('07:00', '22:00', '07:00')).toBe(false); expect(inQuiet('13:00', '12:00', '14:00')).toBe(true)
    expect(inQuiet('13:00', '00:00', '00:00')).toBe(false)
  })
})

describe('lembretes', () => {
  it('remédio na hora, só para a dona e só se não tomou', () => {
    const meds = [{ id: 'm1', who: 'g' as const, name: 'Vitamina D', dose: '1 cápsula', times: ['08:00', '20:00'] }]
    expect(kinds(dueReminders(base({ meds })))).toEqual(['g:remedio:med:m1:08:00'])
    expect(dueReminders(base({ meds }))[0].body).toContain('08:00 · 1 cápsula')
    expect(dueReminders(base({ meds, medTaken: [{ who: 'g', med_id: 'm1', time: '08:00' }] }))).toEqual([])
    expect(dueReminders(base({ meds, hm: '09:00' }))).toEqual([])
  })
  it('água só se estiver abaixo do esperado', () => {
    const water = [{ who: 'g' as const, ml: 500, goal: 2000 }, { who: 's' as const, ml: 1500, goal: 2000 }]
    expect(kinds(dueReminders(base({ hm: '15:02', water })))).toEqual(['g:agua:agua:15:00'])
  })
  it('rotina no horário, no dia certo, se não foi feita; dividida vai para as duas', () => {
    const routines = [
      { id: 'r1', title: 'Fechar a cozinha', scheduled_time: '21:00', weekdays: null, assign_mode: 'shared', reminder_min: 0 },
      { id: 'r2', title: 'Reset', scheduled_time: '21:00', weekdays: [0], assign_mode: 's', reminder_min: 0 },
      { id: 'r3', title: 'Plantas', scheduled_time: '21:00', weekdays: [2], assign_mode: 's', reminder_min: 0 },
    ]
    expect(kinds(dueReminders(base({ hm: '21:05', routines })))).toEqual(['g:rotina:rotina:r1', 's:rotina:rotina:r1', 's:rotina:rotina:r3'])
    expect(kinds(dueReminders(base({ hm: '21:05', routines, routineDone: ['r1', 'r3'] })))).toEqual([])
  })
  it('fim do sprint para quem participa', () => {
    const now = Date.parse('2026-10-06T11:05:00Z')
    const sprint = { id: 'sp', area: 'cozinha', participants: ['s' as const], endMs: now - 60000 }
    expect(kinds(dueReminders(base({ sprint })))).toEqual(['s:sprint:sprint:sp'])
    expect(dueReminders(base({ sprint: { ...sprint, endMs: now + 60000 } }))).toEqual([])
  })
  it('cães às 9h: véspera e dia', () => {
    const dogHealth = [{ id: 'h1', title: 'V10', dog: 'Zelda', next_date: '2026-10-07' }, { id: 'h2', title: 'Vermífugo', dog: 'Penélope', next_date: '2026-10-06' }]
    const r = dueReminders(base({ hm: '09:10', dogHealth }))
    expect(r.filter(x => x.who === 'g').map(x => x.body)).toEqual(['É amanhã.', 'É hoje.'])
  })
  it('agenda: 1 h antes, sem horário às 8h30, vencimento na véspera e no dia', () => {
    const events = [
      { id: 'e1', title: 'Consulta', date: '2026-10-06', time: '15:00', who: 's', kind: 'consulta_caes', paid: null, done_at: null },
      { id: 'e2', title: 'Visita', date: '2026-10-06', time: null, who: 'both', kind: 'visita', paid: null, done_at: null },
      { id: 'e3', title: 'Internet', date: '2026-10-07', time: null, who: 'g', kind: 'vencimento', paid: false, done_at: null },
      { id: 'e4', title: 'Luz', date: '2026-10-07', time: null, who: 'g', kind: 'vencimento', paid: true, done_at: null },
    ]
    expect(kinds(dueReminders(base({ hm: '14:00', events })))).toEqual(['s:agenda:ev:e1'])
    expect(kinds(dueReminders(base({ hm: '08:30', events })))).toEqual(['g:agenda:ev:e2', 's:agenda:ev:e2'])
    expect(kinds(dueReminders(base({ hm: '19:01', events })))).toEqual(['g:agenda:ev:e3:1'])
  })
  it('desafio às 21h e check-in às 21h30 para quem falta', () => {
    expect(kinds(dueReminders(base({ hm: '21:00', challenges: [{ id: 'c1', title: 'Cozinha' }] })))).toEqual(['g:desafio:desafio:c1', 's:desafio:desafio:c1'])
    expect(kinds(dueReminders(base({ hm: '21:31', checkins: ['g'] })))).toEqual(['s:checkin:checkin'])
  })
  it('por aparelho: pessoa, preferências e silêncio', () => {
    const list = dueReminders(base({ hm: '21:31', challenges: [{ id: 'c1', title: 'C' }], checkins: [], meds: [{ id: 'm', who: 'g', name: 'X', dose: null, times: ['21:30'] }] }))
    const sub = { who: 'g' as const, reminders: { checkin: true }, quiet_start: '22:00', quiet_end: '07:00' }
    expect(forDevice(list, sub, '21:31').map(r => r.kind).sort()).toEqual(['checkin', 'remedio'])
    expect(forDevice(list, { ...sub, reminders: { remedio: false } }, '21:31')).toEqual([])
    expect(forDevice(list, { ...sub, quiet_start: '21:00' }, '21:31')).toEqual([])
  })
})

describe('rotina com aviso antes', () => {
  it('reminder_min antecipa o lembrete', () => {
    const routines = [{ id: 'r1', title: 'Reunião', scheduled_time: '20:00', weekdays: null, assign_mode: 'g', reminder_min: 15 }]
    const r = dueReminders(base({ hm: '19:46', routines }))
    expect(r.map(x => x.who)).toEqual(['g']); expect(r[0].body).toContain('daqui a 15 min')
    expect(dueReminders(base({ hm: '20:06', routines }))).toEqual([])
    expect(dueReminders(base({ hm: '20:00', routines: [{ ...routines[0], reminder_min: null }] }))).toEqual([]) // sem lembrete escolhido
  })
})
