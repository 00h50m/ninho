import { describe, expect, it } from 'vitest'
import { isOccurrenceDate, occurrenceDatesBetween } from '@/lib/recurrence'

describe('motor de recorrência', () => {
  it('gera tarefas diárias no intervalo solicitado', () => {
    expect(occurrenceDatesBetween(
      { type: 'daily', startsOn: '2026-10-02' },
      '2026-10-02',
      '2026-10-04',
    )).toEqual(['2026-10-02', '2026-10-03', '2026-10-04'])
  })

  it('respeita dias específicos, inclusive domingo', () => {
    expect(occurrenceDatesBetween(
      { type: 'weekdays', startsOn: '2026-09-28', weekdays: [1, 7] },
      '2026-09-28',
      '2026-10-05',
    )).toEqual(['2026-09-28', '2026-10-04', '2026-10-05'])
  })

  it('ancora recorrências semanais e quinzenais na data inicial', () => {
    expect(isOccurrenceDate({ type: 'weekly', startsOn: '2026-12-28' }, '2027-01-04')).toBe(true)
    expect(isOccurrenceDate({ type: 'biweekly', startsOn: '2026-12-28' }, '2027-01-04')).toBe(false)
    expect(isOccurrenceDate({ type: 'biweekly', startsOn: '2026-12-28' }, '2027-01-11')).toBe(true)
  })

  it('ajusta o dia mensal ao último dia de meses curtos', () => {
    expect(occurrenceDatesBetween(
      { type: 'monthly', startsOn: '2027-01-31', dayOfMonth: 31 },
      '2027-01-01',
      '2027-03-31',
    )).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
  })

  it('suporta intervalo fixo de X dias', () => {
    expect(occurrenceDatesBetween(
      { type: 'interval_days', startsOn: '2026-12-29', interval: 3 },
      '2026-12-29',
      '2027-01-07',
    )).toEqual(['2026-12-29', '2027-01-01', '2027-01-04', '2027-01-07'])
  })

  it('agenda uma única próxima ocorrência após a conclusão', () => {
    expect(occurrenceDatesBetween(
      { type: 'after_completion', startsOn: '2026-10-01', interval: 5 },
      '2026-10-01',
      '2026-10-31',
      '2026-10-07',
    )).toEqual(['2026-10-12'])
  })

  it('encerra tarefa pontual e respeita data final e pausa', () => {
    expect(occurrenceDatesBetween(
      { type: 'once', startsOn: '2026-10-04' },
      '2026-10-01',
      '2026-10-10',
    )).toEqual(['2026-10-04'])

    expect(occurrenceDatesBetween(
      {
        type: 'daily',
        startsOn: '2026-10-01',
        endsOn: '2026-10-06',
        pausedUntil: '2026-10-04',
      },
      '2026-10-01',
      '2026-10-10',
    )).toEqual(['2026-10-05', '2026-10-06'])
  })
})
