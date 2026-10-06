// Redesign · Fase 7: Cães (saúde, alimentação, filhote).
import { describe, expect, it } from 'vitest'
import { ageLabel, currentWeight, foodDaysLeft, periodOf, puppyStats, suggestNext, upcomingCare, type HealthRecord } from '@/lib/caes'

const TODAY = '2026-10-06'
const rec = (id: string, o: Partial<HealthRecord>): HealthRecord => ({ id, dog_id: 'z', kind: 'vacina', title: 'V10', date: '2026-01-01', next_date: null, every_days: null, dose: null, vet: null, weight_kg: null, notes: null, link: null, done_by: 'g', ...o })

describe('saúde', () => {
  it('próximas aplicações: vale o registro mais recente de cada cuidado; atrasados primeiro', () => {
    const r = [
      rec('v-antiga', { date: '2025-01-01', next_date: '2026-01-01' }),   // substituída pela de 2026
      rec('v-nova', { date: '2026-01-01', next_date: '2026-10-20' }),
      rec('verme', { kind: 'vermifugo', title: 'Vermífugo', date: '2026-06-01', next_date: '2026-09-30' }),
      rec('longe', { kind: 'antipulgas', title: 'Antipulgas', date: '2026-10-01', next_date: '2026-12-31' }),
      rec('penelope', { dog_id: 'p', date: '2026-01-01', next_date: '2026-10-07' }),
    ]
    const u = upcomingCare(r, TODAY)
    expect(u.map(x => x.id)).toEqual(['verme', 'penelope', 'v-nova'])
    expect(u[0]).toMatchObject({ late: true, inDays: -6 })
    expect(u[1].inDays).toBe(1)
  })
  it('próxima data sugerida pelo intervalo', () => {
    expect(suggestNext('2026-10-06', 90)).toBe('2027-01-04')
    expect(suggestNext('2026-10-06', null)).toBeNull()
  })
  it('peso atual = registro de peso mais recente', () => {
    expect(currentWeight([rec('a', { kind: 'peso', date: '2026-08-01', weight_kg: 7 }), rec('b', { kind: 'peso', date: '2026-10-01', weight_kg: 8.4 })], 'z')).toEqual({ kg: 8.4, date: '2026-10-01' })
    expect(currentWeight([], 'z')).toBeNull()
  })
  it('idade em dias, meses ou anos', () => {
    expect(ageLabel('2026-09-20', TODAY)).toBe('16 dias')
    expect(ageLabel('2026-03-10', TODAY)).toBe('6 meses')
    expect(ageLabel('2021-10-07', TODAY)).toBe('4 anos')
    expect(ageLabel(null, TODAY)).toBeNull()
  })
})

describe('alimentação', () => {
  it('estoque: dias que restam descontando o consumo desde o registro', () => {
    expect(foodDaysLeft({ food_stock_kg: 7.5, food_stock_on: '2026-10-01', food_g_day: 180 }, TODAY)).toBe(41 - 5)
    expect(foodDaysLeft({ food_stock_kg: 1, food_stock_on: '2026-09-01', food_g_day: 200 }, TODAY)).toBe(0)
    expect(foodDaysLeft({ food_stock_kg: null, food_stock_on: null, food_g_day: 180 }, TODAY)).toBeNull()
  })
})

describe('filhote', () => {
  const a = (id: string, date: string, time: string, location: string) => ({ id, dog_id: 'z', location, date, occurred_at: `${date}T${time}:00-03:00` })
  it('período do dia no horário da casa', () => {
    expect(periodOf('2026-10-06T02:30:00-03:00')).toBe('madrugada')
    expect(periodOf('2026-10-06T09:00:00-03:00')).toBe('manha')
    expect(periodOf('2026-10-06T21:00:00-03:00')).toBe('noite')
  })
  it('evolução por semana, locais mais frequentes, períodos e tendência', () => {
    const s = puppyStats([
      a('1', '2026-09-28', '08:00', 'Sala'), a('2', '2026-09-29', '20:00', 'Sala'), a('3', '2026-09-30', '14:00', 'Cozinha'),
      a('4', '2026-10-05', '08:30', 'Sala'), a('5', '2026-08-01', '08:00', 'Quarto'),
    ], TODAY)
    expect(s.perWeek.map(w => w.count)).toEqual([0, 0, 0, 0, 3, 1])
    expect(s.topPlaces).toEqual([['Sala', 3], ['Cozinha', 1]])
    expect(s.periods).toEqual({ madrugada: 0, manha: 2, tarde: 1, noite: 1 })
    expect(s.trend).toBe('down')
  })
})
