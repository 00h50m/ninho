import { describe, expect, it } from 'vitest'
import { heatLevel, heatmap, taskStreaks } from '@/lib/historico'
import { focusList } from '@/lib/foco'
import type { HItem, Task } from '@/lib/types'

// Dados fictícios. 2026-11-04 é quarta-feira.
const TODAY = '2026-11-04'
const task = (o: Partial<Task>): Task => ({ id: o.title || 'x', title: 'x', category: 'general', frequency: 'daily', assigned_to: 'g', weight: 'light', scheduled_time: null, essential: false, active: true, created_at: '2026-08-01T00:00:00Z', hist: [], completed_today: false, ...o } as Task)
const days = (from: string, n: number, by: 'g' | 's' = 'g') => Array.from({ length: n }, (_, i) => { const d = new Date(from + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - i); return { d: d.toISOString().slice(0, 10), by } })

describe('mapa de calor', () => {
  it('5 semanas de segunda a domingo, por pessoa', () => {
    const h = heatmap({ tasks: [task({ title: 'A', hist: [{ d: '2026-11-03', by: 'g' }, { d: '2026-11-03', by: 's' }, { d: '2026-10-27', by: 'g' }], completed_today: true, completed_by_today: 's' } as any)], dogs: [], today: TODAY })
    expect(h.length).toBe(35)
    expect(h[0].date).toBe('2026-10-05')
    expect(h[34].date).toBe('2026-11-08')
    expect(h.find(x => x.date === '2026-11-03')).toMatchObject({ g: 1, s: 1 })
    expect(h.find(x => x.date === TODAY)).toMatchObject({ g: 0, s: 1, future: false })
    expect(h.find(x => x.date === '2026-11-05')!.future).toBe(true)
  })
  it('níveis de 0 a 4', () => {
    expect([0, 1, 2, 3, 4, 8].map(n => heatLevel(n, 8))).toEqual([0, 1, 1, 2, 2, 4])
    expect(heatLevel(3, 0)).toBe(0)
  })
})

describe('sequências por tarefa', () => {
  it('diária: dias seguidos até ontem (hoje ainda não feito não quebra)', () => {
    const [s] = taskStreaks({ tasks: [task({ title: 'Regar', hist: days('2026-11-03', 12) })], today: TODAY })
    expect(s).toMatchObject({ n: 12, unit: 'dias' })
  })
  it('feita hoje conta junto', () => {
    const [s] = taskStreaks({ tasks: [task({ title: 'Regar', hist: days('2026-11-03', 4), completed_today: true })], today: TODAY })
    expect(s.n).toBe(5)
  })
  it('um dia sem fazer quebra; dias fora da agenda não', () => {
    expect(taskStreaks({ tasks: [task({ title: 'Regar', hist: days('2026-11-02', 10) })], today: TODAY })).toEqual([])
    // só seg/qua/sex: 04 (qua, hoje, pendente), 02 seg, 30 sex, 28 qua
    const t = task({ title: 'Lixo', weekdays: [1, 3, 5], hist: [{ d: '2026-11-02', by: 'g' }, { d: '2026-10-30', by: 's' }, { d: '2026-10-28', by: 'g' }] } as any)
    expect(taskStreaks({ tasks: [t], today: TODAY })[0]).toMatchObject({ n: 3, unit: 'dias' })
  })
  it('semanal conta semanas', () => {
    const t = task({ title: 'Faxina', frequency: 'weekly', hist: [{ d: '2026-11-01', by: 'g' }, { d: '2026-10-25', by: 's' }, { d: '2026-10-18', by: 'g' }, { d: '2026-10-11', by: 'g' }] } as any)
    expect(taskStreaks({ tasks: [t], today: TODAY })[0]).toMatchObject({ n: 4, unit: 'semanas' })
  })
  it('só a partir de 3, das maiores para as menores, no máximo 5', () => {
    const ts = [5, 3, 2, 9, 4, 6, 7].map((n, i) => task({ title: `T${i}`, hist: days('2026-11-03', n) }))
    expect(taskStreaks({ tasks: ts, today: TODAY }).map(s => s.n)).toEqual([9, 7, 6, 5, 4])
  })
  it('não conta antes de a tarefa existir', () => {
    expect(taskStreaks({ tasks: [task({ title: 'Nova', created_at: '2026-11-02T10:00:00Z', hist: days('2026-11-03', 2) })], today: TODAY })).toEqual([])
  })
})

describe('modo foco', () => {
  const it_ = (id: string, o: Partial<HItem> = {}): HItem => ({ id, frequency: 'daily', scheduled_time: null, essential: false, category: 'general', completed_today: false, ...o })
  const owner = (i: HItem) => (i.id.startsWith('s') ? 's' : 'g') as 'g' | 's'
  it('atrasadas, essenciais e próximas, só as minhas', () => {
    const items = [it_('g-prox', { scheduled_time: '15:00' }), it_('g-ess', { essential: true }), it_('g-late2', { scheduled_time: '09:00' }), it_('g-late1', { scheduled_time: '07:00', essential: true }), it_('s-late', { scheduled_time: '07:00' }), it_('g-feita', { scheduled_time: '07:00', completed_today: true }), it_('g-livre')]
    const f = focusList(items, 'g', owner, '10:00')
    expect(f.list.map(x => `${x.item.id}:${x.why}`)).toEqual(['g-late1:late', 'g-late2:late', 'g-ess:essential', 'g-prox:next'])
    expect(f.rest).toBe(1)
  })
  it('no máximo 5', () => {
    const items = Array.from({ length: 8 }, (_, i) => it_(`g${i}`, { scheduled_time: `0${i}:00` }))
    const f = focusList(items, 'g', owner, '09:00')
    expect(f.list.length).toBe(5)
    expect(f.rest).toBe(3)
  })
})
