// Divisão inteligente: decide de quem é a vez nos itens sem responsável fixa.
//
// Regras (iguais nos dois aparelhos e no servidor, porque só usam dados do banco
// anteriores a hoje — a decisão não muda no meio do dia):
//  1. Quem fez por último passa a vez: se a Giovanna fez da última vez, agora é da Sabrina.
//  2. Equilíbrio: a escolha acima só vale se não deixar uma pessoa com carga bem maior
//     que a outra. A carga soma o esforço do que já é fixo de cada uma, o que cada uma
//     fez na semana (com peso menor) e o que já foi distribuído no mesmo cálculo.
//  3. Sem histórico e com carga empatada, vale o rodízio antigo (desempate estável).
//
// Diárias são decididas a cada dia. Semanais, quinzenais, mensais e pontuais são
// decididas uma vez por período (com o histórico de antes do período começar),
// para a tarefa da semana não trocar de dona no meio da semana.
import type { HistEntry, Who } from './types'
import { periodStart } from './frequency'
import { weekStartOf } from './dates'

export type SplitMode = 'smart' | 'rotation'
export const SPLIT_MODES: SplitMode[] = ['smart', 'rotation']

export type Why =
  | { kind: 'fixed' }
  | { kind: 'last', by: Who, date: string }
  | { kind: 'balance', load: Record<Who, number> }
  | { kind: 'rotation' }

export interface Decision { who: Who, why: Why }

export interface SplitUnit {
  id: string
  frequency: string
  /** 'HH:MM' ou '' */
  time: string
  title: string
  /** esforço (XP base): leve 1, médio 2, pesado 3; rotina de cão 1 por cão */
  weight: number
  hist: HistEntry[]
}

export interface FixedLoad { frequency: string, who: Who, weight: number }

/** Diferença de carga tolerada antes de o equilíbrio passar na frente de "quem fez por último". */
export const MAX_GAP = 3
/** Peso do que cada uma já fez na semana (amortece compensações exageradas). */
export const WEEK_HISTORY_FACTOR = 0.5

export const other = (w: Who): Who => (w === 'g' ? 's' : 'g')

/** Última conclusão com data anterior a `before`. Registro sem autoria = sem preferência. */
export function lastBefore(hist: HistEntry[], before: string): HistEntry | null {
  for (const h of hist) if (h.d < before) return h
  return null
}

/** Carga feita na semana (antes de hoje), por pessoa. */
export function weekLoad(units: Array<{ weight: number, hist: HistEntry[] }>, today: string): Record<Who, number> {
  const ws = weekStartOf(today)
  const l: Record<Who, number> = { g: 0, s: 0 }
  for (const u of units) for (const h of u.hist) if (h.by && h.d >= ws && h.d < today) l[h.by] += u.weight
  return l
}

const sortKey = (u: SplitUnit) => `${u.time || '99'}|${u.title.toLowerCase()}|${u.id}`

/**
 * Distribui os itens de um grupo (mesma frequência) a partir da carga inicial.
 * `fallback` é o rodízio antigo, usado como desempate.
 */
export function assignGroup(units: SplitUnit[], start: Record<Who, number>, since: string, fallback: (u: SplitUnit) => Who): Map<string, Decision> {
  const load = { ...start }
  const out = new Map<string, Decision>()
  for (const u of [...units].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) {
    const last = lastBefore(u.hist, since)
    let d: Decision
    if (last?.by) {
      const pref = other(last.by)
      if (load[pref] - load[other(pref)] <= MAX_GAP) d = { who: pref, why: { kind: 'last', by: last.by, date: last.d } }
      else d = { who: other(pref), why: { kind: 'balance', load: { ...load } } }
    } else if (Math.abs(load.g - load.s) >= Math.max(1, u.weight)) {
      const who: Who = load.g < load.s ? 'g' : 's'
      d = { who, why: { kind: 'balance', load: { ...load } } }
    } else {
      d = { who: fallback(u), why: { kind: 'rotation' } }
    }
    load[d.who] += u.weight
    out.set(u.id, d)
  }
  return out
}

/**
 * Decide a dona de cada item sem responsável fixa.
 * `units` = todos os itens ativos sem dona fixa (inclusive os já feitos no período, para a
 * decisão ficar estável); `fixed` = carga do que já é fixo; `allUnits` = tudo que conta
 * na carga da semana (fixos e não fixos, com histórico).
 */
export function smartSplit(units: SplitUnit[], fixed: FixedLoad[], allUnits: Array<{ weight: number, hist: HistEntry[] }>, today: string, fallback: (u: SplitUnit) => Who): Map<string, Decision> {
  const out = new Map<string, Decision>()
  const byFreq = new Map<string, SplitUnit[]>()
  units.forEach(u => byFreq.set(u.frequency, [...(byFreq.get(u.frequency) || []), u]))
  const fixedOf = (freq: string) => {
    const l: Record<Who, number> = { g: 0, s: 0 }
    fixed.filter(f => f.frequency === freq).forEach(f => { l[f.who] += f.weight })
    return l
  }
  byFreq.forEach((list, freq) => {
    const start = fixedOf(freq)
    if (freq === 'daily') {
      const wk = weekLoad(allUnits, today)
      start.g += wk.g * WEEK_HISTORY_FACTOR
      start.s += wk.s * WEEK_HISTORY_FACTOR
    }
    // Diárias: histórico até ontem. Período: histórico de antes do período começar.
    const since = freq === 'daily' ? today : periodStart(freq, today)
    assignGroup(list, start, since, fallback).forEach((d, id) => out.set(id, d))
  })
  return out
}

/** Frase curta explicando de quem é a vez. */
export function whyLabel(d: Decision | undefined, names: Record<Who, string>, today: string): string {
  if (!d) return ''
  const n = (w: Who) => (names[w] || '').split(' ')[0]
  const w = d.why
  if (w.kind === 'fixed') return `Sempre da ${n(d.who)}`
  if (w.kind === 'last') {
    const days = Math.round((Date.parse(today) - Date.parse(w.date)) / 86400000)
    const when = days <= 1 ? 'ontem' : `há ${days} dias`
    return `Vez da ${n(d.who)}: ${n(w.by)} fez da última vez (${when})`
  }
  if (w.kind === 'balance') return `Vez da ${n(d.who)}: equilibrando a carga da semana`
  return `Vez da ${n(d.who)} pelo rodízio`
}
