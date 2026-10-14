// Meu dia: água, sono, autocuidado, remédio pessoal, treinos e evolução física.
// Puro (sem React/Supabase).
import { addDays, dayNum, weekStartOf } from './dates'
import type { Who } from './types'

/** 'fotos' só existe no compartilhamento (as fotos ficam em personal_photos, não em registros). */
export type PKind = 'agua' | 'sono' | 'autocuidado' | 'remedio' | 'treino' | 'corpo' | 'parar' | 'refeicao' | 'fotos' | 'objetivo'
export const PKINDS: Array<[PKind, string, string]> = [
  ['agua', '💧', 'Água'], ['sono', '😴', 'Sono'], ['autocuidado', '🌿', 'Autocuidado'],
  ['remedio', '💊', 'Remédios'], ['treino', '🏋️', 'Treinos'], ['corpo', '📏', 'Evolução física'],
  ['parar', '🚭', 'Parar de…'], ['refeicao', '🍽️', 'Alimentação'], ['fotos', '📸', 'Fotos de evolução'], ['objetivo', '🎯', 'Objetivos'],
]

export interface PSettings { who: Who, water_goal_ml: number, cup_ml: number, sleep_goal_h: number, share: Partial<Record<PKind, boolean>>, selfcare: string[] }
export interface PLog { id: string, who: Who, date: string, kind: PKind, value: number | null, data: Record<string, any>, created_at?: string }
export interface PQuit { id: string, who: Who, title: string, reason: string | null, started_on: string, active: boolean }
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
export const BODY_FIELDS: Array<[string, string, string]> = [
  ['weight', 'Peso', 'kg'], ['fat', '% de gordura', '%'], ['muscle', 'Massa muscular', 'kg'], ['visceral', 'Gordura visceral', 'nível'], ['water', 'Água corporal', '%'],
  ['waist', 'Cintura', 'cm'], ['hip', 'Quadril', 'cm'], ['chest', 'Peito', 'cm'], ['arm', 'Braço', 'cm'], ['thigh', 'Coxa', 'cm'], ['calf', 'Panturrilha', 'cm'], ['neck', 'Pescoço', 'cm'],
]
export function bodySeries(logs: PLog[], who: Who, field: string): Array<{ date: string, v: number }> {
  return mine(logs, who, 'corpo')
    .map(l => ({ date: l.date, v: field === 'weight' ? Number(l.value) : Number(l.data?.[field]) }))
    .filter(x => Number.isFinite(x.v) && x.v > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || 0)
    .filter((x, i, arr) => i === arr.length - 1 || arr[i + 1].date !== x.date) // um valor por dia (o último)
}
/** Valor mais perto da data (até `gap` dias antes ou depois; empate fica com o anterior). */
export function nearest(series: Array<{ date: string, v: number }>, date: string, gap = 14): { date: string, v: number } | null {
  let best: { date: string, v: number } | null = null, bd = Infinity
  for (const x of series) {
    const d = Math.abs(dayNum(x.date) - dayNum(date))
    if (d <= gap && (d < bd || (d === bd && x.date < date))) { best = x; bd = d }
  }
  return best
}

/**
 * Fotos lado a lado: peso e medidas perto de cada data (até 14 dias) e a diferença.
 * Só entram as medidas que existem nas duas pontas.
 */
export function photoCompare(logs: PLog[], who: Who, before: string, after: string): { days: number, rows: Array<{ key: string, label: string, unit: string, a: number, b: number, diff: number }> } {
  const rows = BODY_FIELDS.flatMap(([key, label, unit]) => {
    const s = bodySeries(logs, who, key)
    const a = nearest(s, before), b = nearest(s, after)
    if (!a || !b || a.date === b.date) return []
    return [{ key, label, unit, a: a.v, b: b.v, diff: Math.round((b.v - a.v) * 10) / 10 }]
  })
  return { days: Math.abs(dayNum(after) - dayNum(before)), rows }
}

export function change(series: Array<{ v: number }>): number | null {
  return series.length >= 2 ? Math.round((series[series.length - 1].v - series[0].v) * 10) / 10 : null
}

// ── Sono: painel da semana ───────────────────────────────────────────
export interface SleepWeek {
  days: Array<{ date: string, h: number | null }>   // últimos 7 dias (mais antigo → hoje)
  avg: number | null, best: { date: string, h: number } | null
  onGoal: number        // noites na meta seguidas (hoje conta se já registrou; senão desde ontem)
  debt: number          // horas que faltaram para a meta nas noites registradas da semana
  logged: number
}
const sleepOn = (logs: PLog[], who: Who, date: string) => { const l = mine(logs, who, 'sono').find(x => x.date === date && x.value != null); return l ? Number(l.value) : null }
export function sleepWeek(logs: PLog[], who: Who, today: string, goal: number): SleepWeek {
  const days = Array.from({ length: 7 }, (_, i) => { const date = addDays(today, i - 6); return { date, h: sleepOn(logs, who, date) } })
  const got = days.filter(d => d.h != null) as Array<{ date: string, h: number }>
  const avg = got.length ? Math.round(got.reduce((a, d) => a + d.h, 0) / got.length * 10) / 10 : null
  const best = got.reduce<{ date: string, h: number } | null>((b, d) => !b || d.h > b.h ? d : b, null)
  let d = sleepOn(logs, who, today) != null ? today : addDays(today, -1), onGoal = 0
  for (let i = 0; i < 400; i++) { const h = sleepOn(logs, who, d); if (h == null || h < goal) break; onGoal++; d = addDays(d, -1) }
  const debt = Math.round(got.reduce((a, x) => a + Math.max(0, goal - x.h), 0) * 4) / 4
  return { days, avg, best, onGoal, debt, logged: got.length }
}

// ── "Parar de…" ─────────────────────────────────────────────────────
export interface QuitStats { days: number, record: number, since: string, relapses30: number, lastRelapse: string | null }
/** Dias desde a última recaída (ou desde o começo) e o maior trecho já feito. */
export function quitStats(q: PQuit, logs: PLog[], today: string): QuitStats {
  const rel = mine(logs, q.who, 'parar').filter(l => l.data?.quit_id === q.id && l.date >= q.started_on && l.date <= today).map(l => l.date).sort()
  const marks = [q.started_on, ...rel]
  const since = marks[marks.length - 1]
  const days = Math.max(0, dayNum(today) - dayNum(since))
  let record = days
  for (let i = 1; i < marks.length; i++) record = Math.max(record, dayNum(marks[i]) - dayNum(marks[i - 1]))
  return { days, record, since, relapses30: rel.filter(d => d > addDays(today, -30)).length, lastRelapse: rel.length ? rel[rel.length - 1] : null }
}
