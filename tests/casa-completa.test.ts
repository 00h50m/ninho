// Redesign · Fase 6: Casa completa (agenda, vencimentos, compras).
import { describe, expect, it } from 'vitest'
import { agendaEntries, billLink, bills, dayLabel, groupByDay, type HouseEvent } from '@/lib/agenda'
import { groupOpen, qtyLabel, urgency, type ShoppingItem } from '@/lib/shopping'

const TODAY = '2026-10-06' // terça
const ev = (id: string, o: Partial<HouseEvent>): HouseEvent => ({ id, kind: 'compromisso', title: id, date: TODAY, time: null, who: null, notes: null, link: null, paid: null, done_at: null, ...o })

describe('agenda', () => {
  const events = [
    ev('vet', { kind: 'consulta_caes', date: '2026-10-08', time: '10:30' }),
    ev('entrega', { kind: 'entrega', date: TODAY, time: '14:00' }),
    ev('antigo', { date: '2026-10-01' }),
    ev('feito', { date: '2026-10-07', done_at: '2026-10-06T10:00:00Z' }),
    ev('longe', { date: '2027-03-01' }),
    ev('luz', { kind: 'vencimento', date: '2026-10-07', paid: false }),
  ]
  const maint = [{ id: 'm1', title: 'Filtro do ar', next_due: '2026-10-07', category: 'casa' }, { id: 'm2', title: 'Vermífugo', next_due: '2026-09-30', category: 'caes' }]
  it('próximos 60 dias: eventos e manutenções; sem feitos, sem vencimentos, atrasados marcados', () => {
    const e = agendaEntries(events, maint, TODAY)
    expect(e.map(x => x.title)).toEqual(['Vermífugo', 'antigo', 'entrega', 'Filtro do ar', 'vet'])
    expect(e.filter(x => x.late).map(x => x.title)).toEqual(['Vermífugo', 'antigo'])
  })
  it('agrupa: atrasados, hoje, amanhã, dia da semana', () => {
    const g = groupByDay(agendaEntries(events, maint, TODAY), TODAY)
    expect(g.map(x => x.label)).toEqual(['Atrasados', 'Hoje', 'Amanhã', 'qui, 08/10'])
    expect(dayLabel('2026-10-11', TODAY)).toBe('dom, 11/10')
  })
  it('vencimentos: pendentes por data, atrasados contados, pagos recentes à parte', () => {
    const b = bills([...events, ev('agua', { kind: 'vencimento', date: '2026-10-02', paid: false }), ev('net', { kind: 'vencimento', date: '2026-10-01', paid: true })], TODAY)
    expect(b.pending.map(x => x.id)).toEqual(['agua', 'luz'])
    expect(b.overdue).toBe(1)
    expect(b.paid.map(x => x.id)).toEqual(['net'])
  })
  it('link do Sobrou!: o do item, senão o da casa; só http(s)', () => {
    expect(billLink({ link: null }, 'https://sobrou.app')).toBe('https://sobrou.app')
    expect(billLink({ link: 'https://banco.com/x' }, 'https://sobrou.app')).toBe('https://banco.com/x')
    expect(billLink({ link: 'javascript:alert(1)' }, null)).toBeNull()
    expect(billLink({ link: null }, null)).toBeNull()
  })
})

describe('compras', () => {
  const it0 = (id: string, o: Partial<ShoppingItem>): ShoppingItem => ({ id, household_id: 'h', title: id, qty: null, category: 'mercearia', note: null, added_by: null, checked_at: null, checked_by: null, done_at: null, created_at: '', ...o })
  it('"está acabando" e prioridade sobem no corredor; riscados no fim', () => {
    const g = groupOpen([it0('arroz', {}), it0('cafe', { running_low: true }), it0('azeite', { priority: 'alta' }), it0('acucar', { checked_at: 'x', running_low: true })])
    expect(g[0].items.map(i => i.id)).toEqual(['cafe', 'azeite', 'arroz', 'acucar'])
    expect(urgency({ running_low: true, priority: 'alta' })).toBe(3)
  })
  it('quantidade com unidade', () => {
    expect(qtyLabel({ qty: '2', unit: 'kg' })).toBe('2 kg')
    expect(qtyLabel({ qty: null, unit: null })).toBe('')
  })
})
