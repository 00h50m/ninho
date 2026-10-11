// Humor do Meu dia: calendário do mês com o humor do check-in, o que mais se
// repete e o que acompanha os dias melhores. Puro (sem React/Supabase), testado.
import { addDays, dowOf } from './dates'
import { MOODS, type MoodId } from './week'
import { waterOn, type PLog } from './meudia'
import type { Who } from './types'

export interface MoodRow { date: string, mood: MoodId | null }
/** Nota de 1 (pesado) a 5 (ótimo), para comparar dias. */
export const MOOD_SCORE: Record<MoodId, number> = { otimo: 5, bem: 4, normal: 3, cansaco: 2, pesado: 1 }

/** Semanas do mês (domingo a sábado), com os dias de fora do mês como null. */
export function monthGrid(year: number, month: number): Array<Array<string | null>> {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const days: string[] = []
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) days.push(d)
  const cells: Array<string | null> = [...Array(dowOf(first)).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

export interface MoodStats { days7: number, days30: number, top: { id: MoodId, emoji: string, label: string, n: number, pct: number } | null }
export function moodStats(rows: MoodRow[], today: string, from?: string, to?: string): MoodStats {
  const has = rows.filter(r => r.mood)
  const inLast = (n: number) => has.filter(r => r.date > addDays(today, -n) && r.date <= today).length
  const period = has.filter(r => (!from || r.date >= from) && (!to || r.date <= to))
  let top: MoodStats['top'] = null
  for (const m of MOODS) {
    const n = period.filter(r => r.mood === m.id).length
    if (n && (!top || n > top.n)) top = { ...m, n, pct: Math.round(n / period.length * 100) }
  }
  return { days7: inLast(7), days30: inLast(30), top }
}

export interface MoodInsight { text: string, better: boolean }
/**
 * O que acompanha os dias melhores: sono na meta, treino, água na meta.
 * Só fala quando há pelo menos 3 dias de cada lado e a diferença é clara.
 */
export function moodInsights(rows: MoodRow[], logs: PLog[], who: Who, sleepGoal: number, waterGoal: number): MoodInsight[] {
  const scored = rows.filter(r => r.mood).map(r => ({ date: r.date, s: MOOD_SCORE[r.mood as MoodId] }))
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const out: MoodInsight[] = []
  const test = (label: string, yes: (d: string) => boolean) => {
    const a = scored.filter(x => yes(x.date)).map(x => x.s), b = scored.filter(x => !yes(x.date)).map(x => x.s)
    if (a.length < 3 || b.length < 3) return
    const diff = avg(a) - avg(b)
    if (Math.abs(diff) < 0.5) return
    out.push({ better: diff > 0, text: diff > 0 ? `Nos dias ${label}, seu humor costuma ser melhor.` : `Nos dias ${label}, seu humor costuma ser mais baixo.` })
  }
  const sleepOn = (d: string) => logs.find(l => l.who === who && l.kind === 'sono' && l.date === d)
  test('depois de dormir na meta', d => { const s = sleepOn(d); return !!s && Number(s.value) >= sleepGoal })
  test('com treino', d => logs.some(l => l.who === who && l.kind === 'treino' && l.date === d))
  test('com a água na meta', d => waterOn(logs, who, d) >= waterGoal)
  return out
}
