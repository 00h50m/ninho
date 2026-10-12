// Resumo da semana do Meu dia (domingo, no Telegram de cada uma: só os dados dela).
// Sono, água, comida, treino, peso e humor dos últimos 7 dias, com o destaque do que melhorou
// em relação aos 7 anteriores. Puro, testado.
import { addDays } from './dates'
import { bodySeries, waterOn, type PLog } from './meudia'
import { mealsOn } from './nutricao'
import { moodOf } from './week'
import type { Who } from './types'

export interface WeekInput {
  logs: PLog[], who: Who, today: string, moods: Array<{ date: string, mood: string | null }>
  waterGoal: number, sleepGoal: number, kcalTarget: number | null, proteinTarget: number | null, hideNumbers: boolean
}

const N1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
const K = (v: number) => Math.round(v).toLocaleString('pt-BR')

function stats(x: WeekInput, end: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(end, -6 + i))
  const mine = (k: string) => x.logs.filter(l => l.who === x.who && l.kind === k && days.includes(l.date))
  const sleep = mine('sono').filter(l => l.value != null).map(l => Number(l.value))
  const water = days.filter(d => waterOn(x.logs, x.who, d) >= x.waterGoal).length
  const fed = days.filter(d => mealsOn(x.logs, x.who, d).length)
  const kcal = fed.map(d => mealsOn(x.logs, x.who, d).reduce((a, l) => a + (Number(l.value) || 0), 0))
  const prot = fed.map(d => mealsOn(x.logs, x.who, d).flatMap(l => (l.data?.items || []) as Array<{ p?: number }>).reduce((a, i) => a + (Number(i.p) || 0), 0))
  const tr = mine('treino')
  const moods = x.moods.filter(m => m.mood && days.includes(m.date)).map(m => m.mood as string)
  return {
    sleepAvg: sleep.length ? sleep.reduce((a, b) => a + b, 0) / sleep.length : null, sleepNights: sleep.length, sleepGoal: sleep.filter(h => h >= x.sleepGoal).length,
    water, fedDays: fed.length, kcalAvg: kcal.length ? kcal.reduce((a, b) => a + b, 0) / kcal.length : null,
    protAvg: prot.length ? prot.reduce((a, b) => a + b, 0) / prot.length : null,
    workouts: tr.length, minutes: tr.reduce((a, l) => a + (Number(l.value) || 0), 0),
    mood: moods.length ? Object.entries(moods.reduce<Record<string, number>>((a, m) => ({ ...a, [m]: (a[m] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0][0] : null,
  }
}

/** As linhas do resumo (vazio = nada registrado na semana, então não manda nada). */
export function weekReport(x: WeekInput): string[] {
  const now = stats(x, x.today), before = stats(x, addDays(x.today, -7))
  const lines: string[] = []
  if (now.sleepAvg != null) lines.push(`😴 Sono: média de ${N1(now.sleepAvg)} h em ${now.sleepNights} noite(s) · ${now.sleepGoal} na meta`)
  const anyWater = Array.from({ length: 7 }, (_, i) => waterOn(x.logs, x.who, addDays(x.today, -i))).some(v => v > 0)
  if (anyWater) lines.push(`💧 Água: meta batida em ${now.water} de 7 dias`)
  if (now.fedDays) {
    if (x.hideNumbers || now.kcalAvg == null) lines.push(`🍽️ Refeições registradas em ${now.fedDays} de 7 dias`)
    else lines.push(`🍽️ Comida: ${now.fedDays} dia(s) registrados · média de ${K(now.kcalAvg)} kcal${x.kcalTarget ? ` (meta ${K(x.kcalTarget)})` : ''}` +
      (now.protAvg != null && now.protAvg > 0 ? ` · ${K(now.protAvg)} g de proteína${x.proteinTarget ? ` (meta ${K(x.proteinTarget)})` : ''}` : ''))
  }
  if (now.workouts) lines.push(`🏋️ Treinos: ${now.workouts} (${K(now.minutes)} min)`)
  const w = bodySeries(x.logs, x.who, 'weight')
  const wNow = w.filter(p => p.date <= x.today && p.date > addDays(x.today, -7)).pop()
  const wBefore = w.filter(p => p.date <= addDays(x.today, -7)).pop()
  if (wNow && !x.hideNumbers) lines.push(`⚖️ Peso: ${N1(wNow.v)} kg${wBefore ? ` (${wNow.v - wBefore.v > 0 ? '+' : ''}${N1(wNow.v - wBefore.v)} kg na semana)` : ''}`)
  const mo = moodOf(now.mood)
  if (mo) lines.push(`${mo.emoji} Humor que mais apareceu: ${mo.label.toLowerCase()}`)
  if (!lines.length) return []
  // destaque: o que mais melhorou em relação à semana anterior
  const ups: string[] = []
  if (now.sleepAvg != null && before.sleepAvg != null && now.sleepAvg - before.sleepAvg >= 0.3) ups.push(`dormiu ${N1(now.sleepAvg - before.sleepAvg)} h a mais por noite`)
  if (now.water > before.water) ups.push(`bateu a meta de água em ${now.water - before.water} dia(s) a mais`)
  if (now.workouts > before.workouts) ups.push(`treinou ${now.workouts - before.workouts} vez(es) a mais`)
  if (now.fedDays > before.fedDays) ups.push(`registrou a comida em ${now.fedDays - before.fedDays} dia(s) a mais`)
  lines.push(ups.length ? `✨ Melhorou: ${ups.slice(0, 2).join(' e ')} que na semana anterior.` : '✨ Semana registrada. Cada dia anotado ajuda a ver o que funciona.')
  return lines
}

