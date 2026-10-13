// Relatório do mês para a nutricionista: peso e medidas, calorias e proteína, plano seguido,
// água, sono, treinos e humor. Só os dados de quem gera. Puro, testado.
import { addDays } from './dates'
import { BODY_FIELDS, bodySeries, waterOn, type PLog } from './meudia'
import { mealsOn, type MealItem } from './nutricao'
import { moodOf } from './week'
import type { Who } from './types'

export interface MonthInput {
  logs: PLog[], who: Who, month: string, today: string, moods: Array<{ date: string, mood: string | null }>
  waterGoal: number, sleepGoal: number, kcalTarget: number | null, proteinTarget: number | null
  /** refeições por dia do plano da nutricionista (0 = sem plano) */
  planMealsPerDay: number
}
export interface MonthReport {
  month: string, from: string, to: string, days: number
  weight: { series: Array<{ date: string, v: number }>, first: number | null, last: number | null, change: number | null }
  measures: Array<{ label: string, unit: string, first: number, last: number, change: number }>
  food: { daysLogged: number, kcalAvg: number | null, proteinAvg: number | null, daysOnTarget: number, topFoods: Array<{ name: string, n: number }> }
  plan: { marked: number, expected: number, pct: number } | null
  water: { avgMl: number | null, daysOnGoal: number }
  sleep: { avgH: number | null, nights: number, onGoal: number }
  workouts: { count: number, minutes: number }
  mood: { label: string, emoji: string, n: number } | null
}

const r1 = (v: number) => Math.round(v * 10) / 10
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null

export function monthReport(x: MonthInput): MonthReport {
  const from = `${x.month}-01`
  const last = addDays(`${addDays(from, 32).slice(0, 7)}-01`, -1)
  const to = last < x.today ? last : x.today
  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  const inM = (l: PLog) => l.who === x.who && l.date >= from && l.date <= to
  const L = x.logs.filter(inM)

  const ws = bodySeries(L, x.who, 'weight')
  const measures = BODY_FIELDS.filter(([k]) => k !== 'weight').flatMap(([k, label, unit]) => {
    const s = bodySeries(L, x.who, k)
    return s.length >= 2 ? [{ label, unit, first: s[0].v, last: s[s.length - 1].v, change: r1(s[s.length - 1].v - s[0].v) }] : []
  })

  const fed = days.filter(d => mealsOn(L, x.who, d).length)
  const kcal = fed.map(d => mealsOn(L, x.who, d).reduce((a, l) => a + (Number(l.value) || 0), 0))
  const prot = fed.map(d => mealsOn(L, x.who, d).flatMap(l => (l.data?.items || []) as MealItem[]).reduce((a, i) => a + (Number(i.p) || 0), 0))
  const count = new Map<string, number>()
  L.filter(l => l.kind === 'refeicao').forEach(l => ((l.data?.items || []) as MealItem[]).forEach(i => { if (i?.name) count.set(i.name, (count.get(i.name) || 0) + 1) }))

  const marked = L.filter(l => l.kind === 'refeicao' && l.data?.plan?.meal_id).length
  const expected = x.planMealsPerDay * days.length

  const water = days.map(d => waterOn(L, x.who, d)).filter(v => v > 0)
  const nights = L.filter(l => l.kind === 'sono' && l.value != null).map(l => Number(l.value))
  const tr = L.filter(l => l.kind === 'treino')
  const moods = x.moods.filter(m => m.mood && m.date >= from && m.date <= to).map(m => m.mood as string)
  const top = moods.length ? Object.entries(moods.reduce<Record<string, number>>((a, m) => ({ ...a, [m]: (a[m] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0] : null
  const mo = top ? moodOf(top[0]) : null

  return {
    month: x.month, from, to, days: days.length,
    weight: { series: ws, first: ws[0]?.v ?? null, last: ws[ws.length - 1]?.v ?? null, change: ws.length >= 2 ? r1(ws[ws.length - 1].v - ws[0].v) : null },
    measures,
    food: {
      daysLogged: fed.length, kcalAvg: kcal.length ? Math.round(avg(kcal)!) : null, proteinAvg: prot.some(v => v > 0) ? Math.round(avg(prot)!) : null,
      daysOnTarget: x.kcalTarget ? kcal.filter(k => Math.abs(k - x.kcalTarget!) <= x.kcalTarget! * 0.1).length : 0,
      topFoods: Array.from(count.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 8).map(([name, n]) => ({ name, n })),
    },
    plan: expected > 0 ? { marked, expected, pct: Math.min(100, Math.round(marked / expected * 100)) } : null,
    water: { avgMl: water.length ? Math.round(avg(water)!) : null, daysOnGoal: days.filter(d => waterOn(L, x.who, d) >= x.waterGoal).length },
    sleep: { avgH: nights.length ? r1(avg(nights)!) : null, nights: nights.length, onGoal: nights.filter(h => h >= x.sleepGoal).length },
    workouts: { count: tr.length, minutes: tr.reduce((a, l) => a + (Number(l.value) || 0), 0) },
    mood: mo && top ? { label: mo.label, emoji: mo.emoji, n: top[1] } : null,
  }
}
