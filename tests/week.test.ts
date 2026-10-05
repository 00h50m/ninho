// Redesign · Fase 3: Início com dados reais da semana.
import { describe, expect, it } from 'vitest'
import { completionsByDay, dogCare, nowSummary, routineNow, weekDays, MOODS } from '@/lib/week'
import type { Dog, HItem, Task } from '@/lib/types'

const task = (id: string, hist: string[], doneToday = false, extra: Partial<Task> = {}): Task =>
  ({ id, title: id, category: 'general', weight: 'light', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, hist: hist.map(d => ({ d, by: 'g' })), completed_today: doneToday, ...extra })
const routine = (id: string, title: string, time: string, hist: string[], doneToday = false) =>
  ({ id, title, frequency: 'daily', scheduled_time: time, hist: hist.map(d => ({ d, by: null })), completed_today: doneToday })
const dogs: Dog[] = [
  { id: 'p', name: 'Penélope', breed: null, is_puppy: false, routines: [routine('r1', 'Ração', '07:00', ['2026-10-05']), routine('r3', 'Passeio', '18:00', ['2026-10-06'])] },
  { id: 'z', name: 'Zelda', breed: null, is_puppy: true, routines: [routine('r2', 'Ração', '07:00', ['2026-10-05'], true)] },
]
// semana de segunda 05/10/2026; hoje = quarta 07/10
const WS = '2026-10-05', TODAY = '2026-10-07'

describe('semana com dados reais', () => {
  it('conta conclusões por dia; a mesma rotina de dois cães conta uma vez', () => {
    const m = completionsByDay([task('a', ['2026-10-05', '2026-10-06']), task('b', [], true)], dogs, TODAY)
    expect(m.get('2026-10-05')).toBe(2) // tarefa a + ração (dos dois cães, uma vez)
    expect(m.get('2026-10-06')).toBe(2) // tarefa a + passeio
    expect(m.get(TODAY)).toBe(2) // tarefa b + ração da Zelda hoje
  })
  it('sete dias: hoje, futuros, humor, energia (a menor), sobrevivência e dias sem registro', () => {
    const days = weekDays(WS, TODAY, {
      tasks: [task('a', ['2026-10-05'])], dogs: [],
      checkins: [
        { date: '2026-10-05', who: 'g', mood: 'bem', energy: 'high', note: null },
        { date: '2026-10-05', who: 's', mood: 'cansaco', energy: 'low', note: null },
      ],
      days: [{ date: '2026-10-05', survival: true }],
      survivalNow: true,
    })
    expect(days).toHaveLength(7)
    expect(days[0]).toMatchObject({ date: '2026-10-05', done: 1, moods: { g: 'bem', s: 'cansaco' }, energy: 'low', survival: true, empty: false })
    expect(days[1]).toMatchObject({ date: '2026-10-06', done: 0, empty: true, survival: false })
    expect(days[2]).toMatchObject({ date: TODAY, isToday: true, empty: false, survival: true })
    expect(days[3]).toMatchObject({ future: true, done: 0, empty: false })
    expect(days[6].date).toBe('2026-10-11')
  })
  it('dia sem conclusão mas com check-in não conta como "sem registro"', () => {
    const d = weekDays(WS, TODAY, { tasks: [], dogs: [], checkins: [{ date: '2026-10-06', who: 'g', mood: null, energy: 'medium', note: null }], days: [], survivalNow: false })
    expect(d[1]).toMatchObject({ empty: false, energy: 'medium' })
  })
  it('cinco humores com nome (sem depender só do emoji)', () => {
    expect(MOODS.map(m => m.label)).toEqual(['Ótimo', 'Bem', 'Normal', 'Cansaço', 'Pesado'])
  })
})

describe('rotina do momento', () => {
  const R = (id: string, time: string | null, dur: number | null, weekdays: number[] | null = null) => ({ id, title: id, scheduled_time: time, duration_min: dur, weekdays, assign_mode: 'shared' })
  const list = [R('manha', '07:30', 20), R('cozinha', '21:30', 15), R('domingo', '10:00', 60, [0]), R('livre', null, 15)]
  it('agora = dentro do horário + duração; próxima = a seguinte de hoje; só os dias certos', () => {
    expect(routineNow(list, TODAY, '07:40')).toMatchObject({ now: { id: 'manha' }, next: { id: 'cozinha' } })
    expect(routineNow(list, TODAY, '08:00')).toMatchObject({ now: null, next: { id: 'cozinha' } })
    expect(routineNow(list, TODAY, '22:00')).toMatchObject({ now: null, next: null })
    expect(routineNow(list, TODAY, '09:00').today.map(r => r.id)).toEqual(['manha', 'cozinha', 'livre'])
    expect(routineNow(list, '2026-10-11', '10:30').now?.id).toBe('domingo')
  })
})

describe('para agora', () => {
  const item = (id: string, time: string | null, o: Partial<HItem> = {}): HItem => ({ id, frequency: 'daily', scheduled_time: time, completed_today: false, essential: false, category: 'general', ...o })
  it('só o que é de quem usa o aparelho: atrasadas, essenciais e a próxima com horário', () => {
    const items = [item('a', '08:00'), item('b', '20:00', { essential: true }), item('c', '19:00'), item('d', '07:00', { completed_today: true }), item('e', '06:00')]
    const owner = (i: HItem) => i.id === 'e' ? 's' as const : 'g' as const
    const s = nowSummary(items, 'g', owner, '18:30')
    expect(s).toMatchObject({ late: 1, essentials: 1 })
    expect(s.next?.id).toBe('c')
  })
})

describe('cuidados dos cães', () => {
  it('manutenções de Cães nos próximos 14 dias, atrasadas primeiro', () => {
    const items = [
      { id: '1', category: 'caes', title: 'Vacina', next_due: '2026-10-15' },
      { id: '2', category: 'caes', title: 'Vermífugo', next_due: '2026-10-01' },
      { id: '3', category: 'casa', title: 'Filtro', next_due: '2026-10-08' },
      { id: '4', category: 'caes', title: 'Antipulgas', next_due: '2026-12-01' },
    ]
    expect(dogCare(items, TODAY).map(i => i.title)).toEqual(['Vermífugo', 'Vacina'])
  })
})
