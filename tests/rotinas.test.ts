// Redesign · Fase 4: rotina (checklist do dia) e hábito (constância) com comportamentos diferentes.
import { describe, expect, it } from 'vitest'
import { habitOnDay, habitState, routineHistory, routineOnDay, runProgress, stepsFor, type Habit, type HabitLog, type Routine, type Run } from '@/lib/rotinas'
import { turnBy } from '@/lib/rotation'
import { addDays } from '@/lib/dates'

const R: Routine = {
  id: 'r1', template_key: null, title: 'Fechar a cozinha', description: null, category: 'cozinha', weekdays: [1, 2, 3, 4, 5], scheduled_time: '21:30',
  duration_min: 15, assign_mode: 'rotation', essential: true, start_date: null, paused_until: null,
  routine_steps: [{ id: 's2', position: 1, title: 'Pia', survival: false }, { id: 's1', position: 0, title: 'Louça', survival: true }, { id: 's3', position: 2, title: 'Lixo', survival: true }],
}
const run = (date: string, status: Run['status'], ids: string[]): Run => ({ id: 'x' + date, routine_id: 'r1', date, status, survival: false, completed_by: 'g', checks: ids.map(step_id => ({ step_id, done_by: 'g' as const })) })
// quarta 07/10/2026
const TODAY = '2026-10-07'

describe('rotina', () => {
  it('acontece só nos dias certos, depois da data inicial e fora da pausa', () => {
    expect(routineOnDay(R, TODAY)).toBe(true)
    expect(routineOnDay(R, '2026-10-11')).toBe(false) // domingo
    expect(routineOnDay({ ...R, start_date: '2026-10-08' }, TODAY)).toBe(false)
    expect(routineOnDay({ ...R, paused_until: '2026-10-07' }, TODAY)).toBe(false)
    expect(routineOnDay({ ...R, paused_until: '2026-10-06' }, TODAY)).toBe(true)
  })
  it('passos em ordem; no modo sobrevivência só os 🛡 (ou todos, se nenhum tiver 🛡)', () => {
    expect(stepsFor(R, false).map(s => s.title)).toEqual(['Louça', 'Pia', 'Lixo'])
    expect(stepsFor(R, true).map(s => s.title)).toEqual(['Louça', 'Lixo'])
    const none = { ...R, routine_steps: R.routine_steps.map(s => ({ ...s, survival: false })) }
    expect(stepsFor(none, true)).toHaveLength(3)
    expect(stepsFor({ ...R, routine_steps: [...R.routine_steps, { id: 's4', position: 3, title: 'Arquivado', survival: true, active: false }] }, false)).toHaveLength(3)
  })
  it('conclusão parcial e versão reduzida', () => {
    expect(runProgress(R, run(TODAY, 'open', ['s1']), false)).toEqual({ done: 1, total: 3, complete: false, partial: true })
    expect(runProgress(R, run(TODAY, 'open', ['s1', 's3']), true)).toMatchObject({ done: 2, total: 2 })
    expect(runProgress(R, undefined, false)).toEqual({ done: 0, total: 3, complete: false, partial: false })
  })
  it('histórico: concluída, em parte, não feita e "não era dia"', () => {
    const h = routineHistory(R, [run('2026-10-05', 'done', ['s1', 's2', 's3']), run('2026-10-06', 'open', ['s1'])], TODAY)
    expect(h.map(x => x.state)).toEqual(['none', 'none', 'off', 'off', 'done', 'partial', 'none'])
  })
  it('rodízio: a vez alterna de um dia para o outro', () => {
    const slots = new Map<string, number>()
    const a = turnBy('routine:r1', 'daily', TODAY, slots), b = turnBy('routine:r1', 'daily', addDays(TODAY, 1), slots)
    expect(a).not.toBe(b)
    expect(turnBy('routine:r1', 'daily', addDays(TODAY, 2), slots)).toBe(a)
  })
})

describe('hábito', () => {
  const H: Habit = { id: 'h1', title: 'Preparar o dia seguinte', description: null, owner: 'shared', weekdays: [1, 2, 3, 4, 5], weekly_target: 5, paused_until: null, archived_at: null }
  const log = (date: string, who: 'g' | 's' = 'g'): HabitLog => ({ habit_id: 'h1', date, who })
  it('dia perdido não vira atraso: fica "sem registro" e a sequência recomeça, sem cobrança', () => {
    // seg feito, ter não, qua (hoje) ainda não
    const st = habitState(H, [log('2026-10-05')], TODAY)
    expect(st.last7.map(d => d.state)).toEqual(['miss', 'miss', 'off', 'off', 'done', 'miss', 'today'])
    expect(st.streak).toBe(0)
    expect(st).toMatchObject({ doneToday: false, dueToday: true, weekDone: 1, target: 5 })
  })
  it('sequência por dias certos ignora os dias livres e não quebra por hoje ainda não feito', () => {
    const logs = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'].map(d => log(d))
    expect(habitState(H, logs, TODAY).streak).toBe(4) // qui, sex, (fim de semana livre), seg, ter
    expect(habitState(H, [...logs, log(TODAY, 's')], TODAY)).toMatchObject({ streak: 5, doneToday: true, doneBy: 's' })
  })
  it('meta livre por semana: sequência em semanas; dias sem registro são neutros', () => {
    const F: Habit = { ...H, weekdays: null, weekly_target: 2 }
    const logs = ['2026-09-22', '2026-09-24', '2026-09-29', '2026-10-01', '2026-10-06'].map(d => log(d))
    const st = habitState(F, logs, TODAY)
    expect(st).toMatchObject({ weekDone: 1, target: 2, streak: 2, streakUnit: 'semanas' })
    expect(st.last7.filter(d => d.state === 'miss')).toHaveLength(0)
    expect(habitState(F, [...logs, log(TODAY)], TODAY).streak).toBe(3)
  })
  it('pausado não é esperado', () => {
    const P = { ...H, paused_until: '2026-10-10' }
    expect(habitOnDay(P, TODAY)).toBe(false)
    expect(habitState(P, [], TODAY)).toMatchObject({ paused: true, dueToday: false })
  })
})
