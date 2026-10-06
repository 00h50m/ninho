// Meu dia: água, sono, remédios, treinos e evolução física.
import { describe, expect, it } from 'vitest'
import { bodySeries, change, dosesToday, exerciseNames, loadSeries, selfcareDone, sleepAvg, sleepHours, waterOn, waterStreak, workoutsWeek, type PLog, type PMed } from '@/lib/meudia'

const TODAY = '2026-10-06'
let n = 0
const L = (kind: PLog['kind'], date: string, value: number | null, data: Record<string, any> = {}, who: 'g' | 's' = 'g'): PLog => ({ id: String(n++), who, date, kind, value, data })

describe('água', () => {
  const logs = [L('agua', TODAY, 500), L('agua', TODAY, 250), L('agua', TODAY, 999, {}, 's'), L('agua', '2026-10-05', 2000), L('agua', '2026-10-04', 2200), L('agua', '2026-10-02', 2500)]
  it('soma do dia, só da pessoa', () => { expect(waterOn(logs, 'g', TODAY)).toBe(750) })
  it('sequência de dias batendo a meta (hoje ainda não bateu: conta de ontem)', () => {
    expect(waterStreak(logs, 'g', 2000, TODAY)).toBe(2)
    expect(waterStreak([...logs, L('agua', TODAY, 1250)], 'g', 2000, TODAY)).toBe(3)
  })
})

describe('sono', () => {
  it('horas entre deitar e acordar, atravessando a meia-noite', () => {
    expect(sleepHours('23:30', '06:45')).toBe(7.25)
    expect(sleepHours('01:00', '09:00')).toBe(8)
    expect(sleepHours('14:00', '15:30')).toBe(1.5)
  })
  it('média dos últimos 7 dias', () => {
    expect(sleepAvg([L('sono', TODAY, 6), L('sono', '2026-10-05', 8), L('sono', '2026-09-01', 2)], 'g', TODAY)).toBe(7)
    expect(sleepAvg([], 'g', TODAY)).toBeNull()
  })
})

describe('autocuidado e remédios', () => {
  it('itens de autocuidado feitos hoje', () => {
    expect(Array.from(selfcareDone([L('autocuidado', TODAY, null, { item: 'Alongar' }), L('autocuidado', '2026-10-05', null, { item: 'Ler' })], 'g', TODAY))).toEqual(['Alongar'])
  })
  it('doses do dia: tomadas, pendentes e atrasadas por horário', () => {
    const meds: PMed[] = [{ id: 'd', who: 'g', name: 'Vitamina D', dose: null, times: ['08:00'], active: true }, { id: 'a', who: 'g', name: 'Antialérgico', dose: null, times: ['09:00', '21:00'], active: true }, { id: 'x', who: 'g', name: 'Parado', dose: null, times: ['10:00'], active: false }]
    const d = dosesToday(meds, [L('remedio', TODAY, null, { med_id: 'a', time: '09:00' })], 'g', TODAY, '12:00')
    expect(d.map(x => `${x.time} ${x.med.name} ${x.taken ? 'ok' : x.late ? 'atrasado' : 'pendente'}`)).toEqual(['08:00 Vitamina D atrasado', '09:00 Antialérgico ok', '21:00 Antialérgico pendente'])
  })
})

describe('treinos e evolução', () => {
  const logs = [
    L('treino', '2026-09-28', 50, { type: 'musculacao', exercises: [{ name: 'Agachamento', sets: 3, reps: 10, kg: 30 }] }),
    L('treino', '2026-10-05', 45, { type: 'musculacao', exercises: [{ name: 'agachamento', sets: 3, reps: 8, kg: 35 }, { name: 'Supino', kg: 15 }, { name: 'Agachamento', kg: 37.5 }] }),
    L('treino', TODAY, 30, { type: 'corrida' }),
  ]
  it('semana: treinos e minutos (segunda a hoje)', () => { expect(workoutsWeek(logs, 'g', TODAY)).toEqual({ count: 2, minutes: 75 }) })
  it('exercícios registrados sem repetir', () => { expect(exerciseNames(logs, 'g')).toEqual(['Agachamento', 'Supino']) })
  it('evolução da carga: maior carga de cada dia', () => {
    expect(loadSeries(logs, 'g', 'AGACHAMENTO')).toEqual([{ date: '2026-09-28', v: 30 }, { date: '2026-10-05', v: 37.5 }])
    expect(change(loadSeries(logs, 'g', 'Agachamento'))).toBe(7.5)
  })
  it('medidas do corpo: um valor por dia, mais antigo primeiro', () => {
    const b = [L('corpo', '2026-09-01', 66, { waist: 75 }), L('corpo', '2026-10-01', 64.2, { waist: 72 }), L('corpo', '2026-10-01', 64.0, {})]
    expect(bodySeries(b, 'g', 'weight')).toEqual([{ date: '2026-09-01', v: 66 }, { date: '2026-10-01', v: 64 }])
    expect(bodySeries(b, 'g', 'waist').map(x => x.v)).toEqual([75, 72])
    expect(change(bodySeries(b, 'g', 'weight'))).toBe(-2)
  })
})
