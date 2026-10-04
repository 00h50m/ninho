import { describe, expect, it } from 'vitest'
import {
  addDaysToIsoDate,
  isoDateInTimeZone,
  todayInSaoPaulo,
  weekStartForIsoDate,
} from '@/lib/date'

describe('datas do Ninho', () => {
  it('mantém o dia de São Paulo antes da virada local', () => {
    const instant = new Date('2026-10-03T02:30:00.000Z')
    expect(todayInSaoPaulo(instant)).toBe('2026-10-02')
  })

  it('vira o dia de São Paulo à meia-noite local', () => {
    const instant = new Date('2026-10-03T03:00:00.000Z')
    expect(todayInSaoPaulo(instant)).toBe('2026-10-03')
  })

  it('não depende do fuso do processo', () => {
    const instant = new Date('2026-01-01T01:00:00.000Z')
    expect(isoDateInTimeZone(instant, 'America/Sao_Paulo')).toBe('2025-12-31')
  })

  it('calcula segunda-feira como início da semana, inclusive no domingo', () => {
    expect(weekStartForIsoDate('2026-10-04')).toBe('2026-09-28')
    expect(weekStartForIsoDate('2026-10-05')).toBe('2026-10-05')
  })

  it('atravessa mês e ano sem depender de horário de verão', () => {
    expect(addDaysToIsoDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToIsoDate('2026-03-01', -1)).toBe('2026-02-28')
  })
})

