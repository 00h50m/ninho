// Progressão de carga ("dupla progressão"): primeiro sobe as repetições até o topo da faixa;
// quando faz o topo em 2 treinos seguidos com a mesma carga, sobe a carga. Parou há 3 semanas:
// volta um pouco mais leve. Puro, testado. É sugestão; quem decide é a pessoa (e o professor).
import { addDays } from './dates'
import type { Exercise, PLog } from './meudia'
import type { Who } from './types'

export const TOP_REPS = 12
export type CargaKind = 'subir' | 'quase' | 'reps' | 'retomar'
export interface CargaTip { name: string, kind: CargaKind, kg: number, reps: number | null, nextKg: number, nextReps: number | null, text: string, last: string }

const N = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
/** Degrau de carga: halteres leves sobem de 1 em 1; até 40 kg, de 2 em 2; acima, 2,5 (anilhas). */
export const step = (kg: number) => kg < 10 ? 1 : kg < 40 ? 2 : 2.5
const roundTo = (kg: number, s: number) => Math.round(kg / s) * s

interface Session { date: string, kg: number, reps: number | null, sets: number | null }

/** Sessões de um exercício (a série mais pesada de cada dia), mais recente primeiro. */
function sessions(logs: PLog[], who: Who, key: string): Session[] {
  const by = new Map<string, Session>()
  for (const l of logs) {
    if (l.who !== who || l.kind !== 'treino') continue
    for (const e of (l.data?.exercises || []) as Exercise[]) {
      if (e.name?.trim().toLowerCase() !== key || !(Number(e.kg) > 0)) continue
      const cur = by.get(l.date), s = { date: l.date, kg: Number(e.kg), reps: e.reps ? Number(e.reps) : null, sets: e.sets ? Number(e.sets) : null }
      if (!cur || s.kg > cur.kg || (s.kg === cur.kg && (s.reps ?? 0) > (cur.reps ?? 0))) by.set(l.date, s)
    }
  }
  return Array.from(by.values()).sort((a, b) => b.date.localeCompare(a.date))
}

/** A sugestão para um exercício (null = sem carga registrada). */
export function cargaTip(logs: PLog[], who: Who, name: string, today: string): CargaTip | null {
  const key = name.trim().toLowerCase(), s = sessions(logs, who, key)
  if (!s.length) return null
  const L = s[0], P = s.slice(1).find(x => x.kg === L.kg) || null
  const last = `${L.sets && L.reps ? `${L.sets}×${L.reps} ` : L.reps ? `${L.reps} reps ` : ''}com ${N(L.kg)} kg`
  const base = { name: name.trim(), kg: L.kg, reps: L.reps, last }
  if (L.date < addDays(today, -21)) {
    const kg = Math.max(step(L.kg), roundTo(L.kg * 0.9, step(L.kg)))
    return { ...base, kind: 'retomar', nextKg: kg, nextReps: L.reps, text: `Faz mais de 3 semanas: retome com ${N(kg)} kg e suba de novo.` }
  }
  if (L.reps == null) return { ...base, kind: 'reps', nextKg: L.kg, nextReps: null, text: `Anote as repetições para o Ninho sugerir a próxima carga.` }
  if (L.reps >= TOP_REPS && P && (P.reps ?? 0) >= TOP_REPS) {
    const kg = roundTo(L.kg + step(L.kg), step(L.kg) === 2.5 ? 2.5 : 1)
    return { ...base, kind: 'subir', nextKg: kg, nextReps: 8, text: `Fez ${TOP_REPS} repetições em 2 treinos seguidos: suba para ${N(kg)} kg (comece com 8).` }
  }
  if (L.reps >= TOP_REPS) return { ...base, kind: 'quase', nextKg: L.kg, nextReps: TOP_REPS, text: `Repita ${TOP_REPS} com ${N(L.kg)} kg mais uma vez e pode subir a carga.` }
  return { ...base, kind: 'reps', nextKg: L.kg, nextReps: L.reps + 1, text: `Tente ${L.reps + 1} repetições com ${N(L.kg)} kg.` }
}

/** Sugestões de todos os exercícios com carga (subir primeiro), dos últimos 60 dias. */
export function cargaTips(logs: PLog[], who: Who, today: string): CargaTip[] {
  const names = new Map<string, string>()
  for (const l of logs) if (l.who === who && l.kind === 'treino' && l.date >= addDays(today, -60))
    for (const e of (l.data?.exercises || []) as Exercise[]) { const k = e.name?.trim().toLowerCase(); if (k && Number(e.kg) > 0 && !names.has(k)) names.set(k, e.name.trim()) }
  const order: CargaKind[] = ['subir', 'quase', 'retomar', 'reps']
  return Array.from(names.values()).map(n => cargaTip(logs, who, n, today)).filter((x): x is CargaTip => !!x)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name, 'pt-BR'))
}
