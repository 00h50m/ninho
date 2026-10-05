import { describe, expect, it } from 'vitest'
import { doneInPeriod, dueToday, lastLabel, periodIdx, periodStart } from '@/lib/frequency'

const T = '2026-10-07' // quarta-feira

describe('periodStart', () => {
  it('diária = hoje', () => expect(periodStart('daily', T)).toBe(T))
  it('semanal = segunda da semana', () => expect(periodStart('weekly', T)).toBe('2026-10-05'))
  it('quinzenal = início do bloco fixo de 2 semanas (sempre uma segunda)', () => {
    // blocos: 28/09–11/10 e 12/10–25/10
    for (const d of ['2026-09-28', '2026-10-05', '2026-10-07', '2026-10-11']) expect(periodStart('biweekly', d)).toBe('2026-09-28')
    for (const d of ['2026-10-12', '2026-10-20', '2026-10-25']) expect(periodStart('biweekly', d)).toBe('2026-10-12')
    expect(periodIdx('biweekly', '2026-10-12') - periodIdx('biweekly', '2026-10-11')).toBe(1)
  })
  it('mensal = dia 1', () => expect(periodStart('monthly', T)).toBe('2026-10-01'))
  it('pontual = sempre', () => expect(periodStart('once', T)).toBe('0000-01-01'))
})

describe('dueToday / doneInPeriod', () => {
  it('diária feita ontem volta hoje', () => {
    expect(dueToday({ frequency: 'daily', prev_done: '2026-10-06' }, T)).toBe(true)
  })
  it('semanal feita na segunda some até a próxima segunda', () => {
    const x = { frequency: 'weekly', prev_done: '2026-10-05' }
    expect(doneInPeriod(x, T)).toBe(true)
    expect(dueToday(x, T)).toBe(false)
    expect(dueToday(x, '2026-10-12')).toBe(true)
  })
  it('semanal feita no domingo da semana passada volta na segunda', () => {
    expect(dueToday({ frequency: 'weekly', prev_done: '2026-10-04' }, '2026-10-05')).toBe(true)
  })
  it('feita hoje continua aparecendo (para poder desmarcar)', () => {
    expect(dueToday({ frequency: 'weekly', completed_today: true }, T)).toBe(true)
  })
  it('mensal feita no mês passado volta no dia 1', () => {
    expect(dueToday({ frequency: 'monthly', prev_done: '2026-09-30' }, '2026-10-01')).toBe(true)
    expect(dueToday({ frequency: 'monthly', prev_done: '2026-10-01' }, '2026-10-31')).toBe(false)
  })
  it('pontual feita há muito tempo não volta', () => {
    expect(dueToday({ frequency: 'once', prev_done: '2025-01-01' }, T)).toBe(false)
    expect(dueToday({ frequency: 'once', prev_done: null }, T)).toBe(true)
  })
})

describe('periodIdx e rótulos', () => {
  it('muda a cada dia / semana / mês', () => {
    expect(periodIdx('daily', '2026-10-08') - periodIdx('daily', T)).toBe(1)
    expect(periodIdx('weekly', '2026-10-11')).toBe(periodIdx('weekly', '2026-10-05'))
    expect(periodIdx('weekly', '2026-10-12') - periodIdx('weekly', '2026-10-11')).toBe(1)
    expect(periodIdx('monthly', '2027-01-01') - periodIdx('monthly', '2026-12-31')).toBe(1)
  })
  it('lastLabel', () => {
    expect(lastLabel(null, T)).toBe('nunca feita')
    expect(lastLabel(T, T)).toBe('hoje')
    expect(lastLabel('2026-10-06', T)).toBe('ontem')
    expect(lastLabel('2026-09-28', T)).toBe('há 9 dias')
  })
})
