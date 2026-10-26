import { describe, expect, it } from 'vitest'
import type { Task } from '@/lib/types'
import { dueToday, inPeriod, periodLabel, periodState, scheduledOn } from '@/lib/frequency'
import { planToday } from '@/lib/today'
import { suggestTasks } from '@/lib/sprint'

// Dados fictícios. 2026-10-26 é segunda-feira.
const MON = '2026-10-26'
const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'medium', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o })

describe('tarefa com período (De … até …)', () => {
  it('as duas pontas contam; sem ponta = sem limite', () => {
    const t = { starts_on: '2026-10-20', ends_on: '2026-10-30' }
    expect(inPeriod(t, '2026-10-19')).toBe(false)
    expect(inPeriod(t, '2026-10-20')).toBe(true)
    expect(inPeriod(t, '2026-10-30')).toBe(true)
    expect(inPeriod(t, '2026-10-31')).toBe(false)
    expect(inPeriod({ starts_on: null, ends_on: null }, '1999-01-01')).toBe(true)
    expect(inPeriod({ starts_on: '2026-11-01' }, '2030-01-01')).toBe(true)
    expect(inPeriod({ ends_on: '2026-11-01' }, '2000-01-01')).toBe(true)
  })

  it('rótulo e estado', () => {
    expect(periodLabel({ starts_on: '2026-12-01', ends_on: '2026-12-15' })).toBe('de 01/12 até 15/12')
    expect(periodLabel({ starts_on: '2026-12-01' })).toBe('a partir de 01/12')
    expect(periodLabel({ ends_on: '2026-12-15' })).toBe('até 15/12')
    expect(periodLabel({})).toBe('')
    expect(periodState({ starts_on: '2026-11-01' }, MON)).toBe('antes')
    expect(periodState({ ends_on: '2026-10-25' }, MON)).toBe('depois')
    expect(periodState({ starts_on: '2026-10-26', ends_on: '2026-10-26' }, MON)).toBeNull()
  })

  it('fora do período não aparece em Hoje; dentro, segue a frequência e os dias', () => {
    expect(dueToday(task('a', { starts_on: '2026-10-27' }), MON)).toBe(false)
    expect(dueToday(task('b', { ends_on: '2026-10-25' }), MON)).toBe(false)
    expect(dueToday(task('c', { starts_on: '2026-10-26', ends_on: '2026-11-08' }), MON)).toBe(true)
    // dentro do período, mas não é dia dela (só sexta)
    expect(scheduledOn(task('d', { weekdays: [5], ends_on: '2026-12-31' }), MON)).toBe(false)
    // semanal que começa no meio da semana: aparece a partir do início
    expect(dueToday(task('e', { frequency: 'weekly', starts_on: '2026-10-28' }), MON)).toBe(false)
    expect(dueToday(task('e', { frequency: 'weekly', starts_on: '2026-10-28' }), '2026-10-28')).toBe(true)
    // feita hoje continua aparecendo para poder desmarcar
    expect(dueToday(task('f', { ends_on: '2026-10-20', completed_today: true }), MON)).toBe(true)
  })

  it('planToday: fora do período sai da lista e não pesa na divisão', () => {
    const tasks = [task('dentro', { ends_on: '2026-11-30' }), task('depois', { ends_on: '2026-10-01', weight: 'heavy', assigned_to: 'g' }), task('antes', { starts_on: '2026-12-01' })]
    const p = planToday(tasks, [], MON, { split: 'smart' })
    expect(p.dueList.map(t => t.id)).toEqual(['dentro'])
    // a fixa pesada que já terminou não pesa: tanto faz se era de uma ou da outra
    const withFixed = (who: 'g' | 's', ends_on: string | null) => planToday([task('dentro'), task('fixa', { weight: 'heavy', assigned_to: who, ends_on })], [], MON, { split: 'smart' }).ownerOfTask(task('dentro'))
    expect(withFixed('g', '2026-10-01')).toBe(withFixed('s', '2026-10-01'))
    // dentro do período ela pesa (a outra fica com a tarefa)
    expect(withFixed('g', '2026-12-31')).toBe('s')
    expect(withFixed('s', '2026-12-31')).toBe('g')
  })

  it('sprint não sugere tarefa fora do período', () => {
    const s = suggestTasks([task('x', { starts_on: '2026-11-01' }), task('y')], 'casa', MON)
    expect(s.map(t => t.id)).toEqual(['y'])
  })
})
