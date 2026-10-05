import { describe, expect, it } from 'vitest'
import { addDays, dayNum, fmtDate, homeClock, homeToday, monthStart, weekStartOf, weekdayIndex } from '@/lib/dates'

describe('dia doméstico em America/Sao_Paulo', () => {
  it('o processo de teste roda em outro fuso (Tóquio)', () => {
    expect(new Date('2026-10-05T03:00:00Z').getHours()).toBe(12)
  })

  it('antes da meia-noite em São Paulo ainda é o dia anterior', () => {
    // 23:59 de 04/10 em SP = 02:59 UTC de 05/10
    const c = homeClock(new Date('2026-10-05T02:59:00Z'))
    expect(c.date).toBe('2026-10-04')
    expect(c.hm).toBe('23:59')
    expect(c.hour).toBe(23)
  })

  it('à meia-noite vira o dia', () => {
    const c = homeClock(new Date('2026-10-05T03:00:00Z'))
    expect(c.date).toBe('2026-10-05')
    expect(c.hm).toBe('00:00')
    expect(c.hour).toBe(0)
  })

  it('domingo e segunda: a semana começa na segunda', () => {
    expect(homeClock(new Date('2026-10-05T02:30:00Z')).dow).toBe(0) // domingo 23:30 em SP
    expect(weekStartOf('2026-10-04')).toBe('2026-09-28') // domingo pertence à semana anterior
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05') // segunda abre a semana
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05')
    expect(weekdayIndex('2026-10-05')).toBe(0)
    expect(weekdayIndex('2026-10-11')).toBe(6)
  })

  it('domingo 23:30 em SP ainda é a semana anterior; segunda 00:00 já é a nova', () => {
    expect(weekStartOf(homeToday(new Date('2026-10-12T02:30:00Z')))).toBe('2026-10-05')
    expect(weekStartOf(homeToday(new Date('2026-10-12T03:00:00Z')))).toBe('2026-10-12')
  })

  it('virada do mês', () => {
    expect(homeToday(new Date('2026-11-01T02:59:00Z'))).toBe('2026-10-31')
    expect(homeToday(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(monthStart('2026-10-31')).toBe('2026-10-01')
  })

  it('virada do ano', () => {
    expect(homeToday(new Date('2027-01-01T02:59:00Z'))).toBe('2026-12-31')
    expect(homeToday(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
    expect(dayNum('2027-01-01') - dayNum('2026-12-31')).toBe(1)
  })

  it('formata DD/MM sem depender do fuso', () => {
    expect(fmtDate('2026-01-05')).toBe('05/01')
  })
})
