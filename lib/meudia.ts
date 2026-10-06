// Meu dia: água, sono, autocuidado, remédio pessoal, treinos e evolução física.
// Puro (sem React/Supabase). Sem dieta e sem calorias.
import { addDays, weekStartOf } from './dates'
import type { Who } from './types'

export type PKind = 'agua' | 'sono' | 'autocuidado' | 'remedio' | 'treino' | 'corpo'
export const PKINDS: Array<[PKind, string, string]> = [
  ['agua', '💧', 'Água'], ['sono', '😴', 'Sono'], ['autocuidado', '🌿', 'Autocuidado'],
  ['remedio', '💊', 'Remédios'], ['treino', '🏋️', 'Treinos'], ['corpo', '📏', 'Evolução física'],
]

export interface PSettings { who: Who, water_goal_ml: number, cup_ml: number, sleep_goal_h: number, share: Partial<Record<PKind, boolean>>, selfcare: string[] }
export interface PLog { id: string, who: Who, date: string, kind: PKind, value: number | null, data: Record<string, any>, created_at?: string }
export interface PMed { id: string, who: Who, name: string, dose: string | null, times: string[], active: boolean }

export const DEFAULT_SETTINGS = (who: Who): PSettings => ({ who, water_goal_ml: 2000, cup_ml: 250, sleep_goal_h: 8, share: {}, selfcare: ['Pausa de 5 minutos', 'Alongar', 'Tomar sol', 'Skincare', 'Ler 10 minutos'] })

const mine = (logs: PLog[], who: Who, kind: PKind) => logs.filter(l => l.who === who && l.kind === kind)

// ── Água ─────────────────────────────────────────────────────────────
export function waterOn(logs: PLog[], who: Who, date: string): number {
  return mine(logs, who, 'agua').filter(l => l.date === date).reduce((a, l) => a + Number(l.value || 0), 0)
}
/** Dias seguidos batendo a meta (hoje conta se já bateu; senão começa de ontem). */
export function waterStreak(logs: PLog[], who: Who, goal: number, today: string): number {
  let d = waterOn(logs, who, today) >= goal ? today : addDays(today, -1), n = 0
  for (let i = 0; i < 400 && waterOn(logs, who, d) >= goal; i++) { n++; d = addDays(d, -1) }
  return n
}

// ── Sono ─────────────────────────────────────────────────────────────
/** Horas entre deitar e acordar (atravessa a meia-noite), de 15 em 15 min. */
export function sleepHours(bed: string, wake: string): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  let diff = m(wake) - m(bed)
  if (diff <= 0) diff += 24 * 60
  return Math.round(diff / 15) / 4
}
export function sleepAvg(logs: PLog[], who: Who, today: string, days = 7): number | null {
  const from = addDays(today, -(days - 1))
  const v = mine(logs, who, 'sono').filter(l => l.date >= from && l.date <= today && l.value != null).map(l => Number(l.value))
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null
}

// ── Autocuidado ──────────────────────────────────────────────────────
export function selfcareDone(logs: PLog[], who: Who, date: string): Set<string> {
  return new Set(mine(logs, who, 'autocuidado').filter(l => l.date === date).map(l => String(l.data?.item || '')))
}

// ── Remédios ─────────────────────────────────────────────────────────
export interface Dose { med: PMed, time: string, taken: PLog | null, late: boolean }
export function dosesToday(meds: PMed[], logs: PLog[], who: Who, today: string, nowHM: string): Dose[] {
  const taken = mine(logs, who, 'remedio').filter(l => l.date === today)
  return meds.filter(m => m.who === who && m.active)
    .flatMap(m => (m.times.length ? m.times : ['']).map(time => {
      const t = taken.find(l => l.data?.med_id === m.id && (l.data?.time || '') === time) || null
      return { med: m, time, taken: t, late: !t && !!time && time < nowHM }
    }))
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.med.name.localeCompare(b.med.name))
}

// ── Treinos ──────────────────────────────────────────────────────────
export const WORKOUT_TYPES: Array<[string, string]> = [
  ['musculacao', '🏋️ Musculação'], ['corrida', '🏃 Corrida'], ['caminhada', '🚶 Caminhada'], ['bike', '🚴 Bike'],
  ['natacao', '🏊 Natação'], ['yoga', '🧘 Yoga'], ['pilates', '🤸 Pilates'], ['funcional', '⚡ Funcional'], ['outro', '✨ Outro'],
]
export const workoutLabel = (t: string) => WORKOUT_TYPES.find(x => x[0] === t)?.[1] || '✨ Treino'
export interface Exercise { name: string, sets?: number | null, reps?: number | null, kg?: number | null }

export function workoutsWeek(logs: PLog[], who: Who, today: string): { count: number, minutes: number } {
  const ws = weekStartOf(today)
  const w = mine(logs, who, 'treino').filter(l => l.date >= ws && l.date <= today)
  return { count: w.length, minutes: w.reduce((a, l) => a + Number(l.value || 0), 0) }
}

/** Exercícios já registrados (para sugerir e para ver a evolução da carga). */
export function exerciseNames(logs: PLog[], who: Who): string[] {
  const names = new Map<string, string>()
  for (const l of mine(logs, who, 'treino')) for (const e of (l.data?.exercises || []) as Exercise[]) {
    const k = e.name?.trim().toLowerCase(); if (k && !names.has(k)) names.set(k, e.name.trim())
  }
  return Array.from(names.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Evolução da carga: maior carga do exercício em cada dia de treino (mais antigo primeiro). */
export function loadSeries(logs: PLog[], who: Who, exercise: string): Array<{ date: string, v: number }> {
  const k = exercise.trim().toLowerCase(), by = new Map<string, number>()
  for (const l of mine(logs, who, 'treino')) for (const e of (l.data?.exercises || []) as Exercise[]) {
    if (e.name?.trim().toLowerCase() === k && e.kg != null && Number(e.kg) > 0) by.set(l.date, Math.max(by.get(l.date) || 0, Number(e.kg)))
  }
  return Array.from(by, ([date, v]) => ({ date, v })).sort((a, b) => a.date.localeCompare(b.date))
}

// ── Evolução física ──────────────────────────────────────────────────
export const BODY_FIELDS: Array<[string, string, string]> = [['weight', 'Peso', 'kg'], ['waist', 'Cintura', 'cm'], ['hip', 'Quadril', 'cm'], ['arm', 'Braço', 'cm'], ['chest', 'Peito', 'cm'], ['fat', '% de gordura', '%']]
export function bodySeries(logs: PLog[], who: Who, field: string): Array<{ date: string, v: number }> {
  return mine(logs, who, 'corpo')
    .map(l => ({ date: l.date, v: field === 'weight' ? Number(l.value) : Number(l.data?.[field]) }))
    .filter(x => Number.isFinite(x.v) && x.v > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || 0)
    .filter((x, i, arr) => i === arr.length - 1 || arr[i + 1].date !== x.date) // um valor por dia (o último)
}
export function change(series: Array<{ v: number }>): number | null {
  return series.length >= 2 ? Math.round((series[series.length - 1].v - series[0].v) * 10) / 10 : null
}
