// Fase 4: dias da semana, pular / deixar para amanhã e pontuais com data.
import { describe, expect, it } from 'vitest'
import { dueToday, pausedToday, scheduledOn, skippedNow, weekdaysLabel } from '@/lib/frequency'
import { buildTasks } from '@/lib/build'
import { groupToday, planToday } from '@/lib/today'
import type { Task } from '@/lib/types'

// 2026-10-05 = segunda (dow 1) … 2026-10-11 = domingo (dow 0)
const MON = '2026-10-05', TUE = '2026-10-06', WED = '2026-10-07', SAT = '2026-10-10', SUN = '2026-10-11'
const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, category: 'general', weight: 'light', frequency: 'daily', assigned_to: null, scheduled_time: null, essential: false, active: true, ...o })

describe('dias da semana', () => {
  it('diária só nos dias escolhidos', () => {
    const lixo = task('lixo', { weekdays: [1, 3, 5] })
    expect(scheduledOn(lixo, MON)).toBe(true)
    expect(scheduledOn(lixo, TUE)).toBe(false)
    expect(dueToday(lixo, TUE)).toBe(false)
    expect(dueToday(lixo, WED)).toBe(true)
  })

  it('semanal aparece a partir do primeiro dia escolhido e fica até ser feita', () => {
    const faxina = task('faxina', { frequency: 'weekly', weekdays: [6] }) // sábado
    expect(dueToday(faxina, MON)).toBe(false)
    expect(dueToday(faxina, SAT)).toBe(true)
    expect(dueToday(faxina, SUN)).toBe(true) // domingo ainda é a mesma semana
  })

  it('sem dias = qualquer dia (como antes); mensal ignora dias', () => {
    expect(scheduledOn(task('a'), TUE)).toBe(true)
    expect(scheduledOn(task('m', { frequency: 'monthly', weekdays: [6] }), MON)).toBe(true)
  })

  it('rótulo dos dias', () => {
    expect(weekdaysLabel([5, 1, 3])).toBe('seg, qua, sex')
    expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe('dias úteis')
    expect(weekdaysLabel([0, 6])).toBe('fim de semana')
    expect(weekdaysLabel(null)).toBe('')
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('')
  })
})

describe('pular e deixar para amanhã', () => {
  it('pular a diária some só hoje', () => {
    const t = task('louca', { skip: { id: 's1', date: MON, kind: 'skip', by: 'g' } })
    expect(dueToday(t, MON)).toBe(false)
    expect(pausedToday(t, MON)).toBe(true)
    expect(dueToday(t, TUE)).toBe(true)
  })

  it('pular a semanal resolve a semana inteira', () => {
    const t = task('banheiro', { frequency: 'weekly', skip: { id: 's1', date: TUE, kind: 'skip', by: 's' } })
    expect(dueToday(t, WED)).toBe(false)
    expect(dueToday(t, SUN)).toBe(false)
    expect(dueToday(t, '2026-10-12')).toBe(true) // segunda seguinte
  })

  it('deixar para amanhã some só no dia', () => {
    const t = task('banheiro', { frequency: 'weekly', skip: { id: 's1', date: TUE, kind: 'snooze', by: 's' } })
    expect(dueToday(t, TUE)).toBe(false)
    expect(skippedNow(t, WED)).toBe(false)
    expect(dueToday(t, WED)).toBe(true)
  })

  it('feita hoje continua aparecendo (para desmarcar), mesmo pulada', () => {
    const t = task('a', { completed_today: true, skip: { id: 's', date: MON, kind: 'skip', by: 'g' } })
    expect(dueToday(t, MON)).toBe(true)
    expect(pausedToday(t, MON)).toBe(false)
  })

  it('buildTasks usa a pausa mais recente até hoje', () => {
    const [t] = buildTasks([task('a', { frequency: 'weekly' })], [], WED, [
      { id: 'x', task_id: 'a', date: MON, kind: 'snooze', skipped_by: 'g' },
      { id: 'y', task_id: 'a', date: TUE, kind: 'skip', skipped_by: 's' },
      { id: 'z', task_id: 'a', date: SAT, kind: 'skip', skipped_by: 's' }, // futuro: ignora
    ])
    expect(t.skip).toEqual({ id: 'y', date: TUE, kind: 'skip', by: 's' })
    expect(dueToday(t, WED)).toBe(false)
  })

  it('a tela Hoje (e o bom dia) deixam de fora as pausadas e as fora do dia', () => {
    const tasks = buildTasks([task('lixo', { weekdays: [1, 3, 5] }), task('louca'), task('pulada')], [], TUE,
      [{ id: 's', task_id: 'pulada', date: TUE, kind: 'skip', skipped_by: 'g' }])
    expect(planToday(tasks, [], TUE).items.map(i => i.id)).toEqual(['louca'])
  })
})

describe('pontual com data', () => {
  it('aparece a partir da data e fica atrasada depois dela', () => {
    const t = task('vet', { frequency: 'once', due_date: WED })
    expect(dueToday(t, TUE)).toBe(false)
    expect(dueToday(t, WED)).toBe(true)
    const g = groupToday([{ id: 'vet', frequency: 'once', scheduled_time: null, essential: false, category: 'general', task: t }], '10:00', SAT)
    expect(g[0].k).toBe('late')
    const g2 = groupToday([{ id: 'vet', frequency: 'once', scheduled_time: null, essential: false, category: 'general', task: t }], '10:00', WED)
    expect(g2[0].k).toBe('once')
  })
  it('sem data: aparece até ser feita (como antes)', () => {
    expect(dueToday(task('x', { frequency: 'once' }), MON)).toBe(true)
  })
})
