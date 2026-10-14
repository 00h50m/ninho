// Resumo do mês do casal (Nós): o que a casa fez junta no mês — tarefas e cuidados com os cães
// de cada uma, rotinas, sprints, check-ins das duas, reuniões, combinados e desafios cumpridos.
// Puro, testado. Sem placar de quem fez mais: mostra a parte de cada uma e o total.
import { addDays, dayNum } from './dates'
import { MOODS, type MoodId } from './week'
import type { Who } from './types'

export interface CoupleMonthInput {
  month: string, today: string
  tasks: Array<{ date: string, completed_by: Who | null }>
  dogs: Array<{ date: string, completed_by: Who | null }>
  runs: Array<{ date: string }>
  sprints: Array<{ date: string, status: string, done: number }>
  checkins: Array<{ date: string, who: Who, mood: MoodId | null }>
  meetings: Array<{ week_start: string, agreements: Array<{ done: boolean }> }>
  challenges: Array<{ title: string, status: string, ended_at: string | null }>
}
export interface CoupleMonth {
  from: string, to: string, days: number, label: string
  tasks: { total: number, g: number, s: number }
  dogs: { total: number, g: number, s: number }
  runs: number
  sprints: { n: number, done: number }
  checkins: { both: number, g: number, s: number, mood: Record<Who, { emoji: string, label: string } | null> }
  meetings: { n: number, agreements: number, kept: number }
  challenges: string[]
  bestDay: { date: string, n: number } | null
  empty: boolean
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`
/** Último dia do mês (AAAA-MM). */
export function monthEnd(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return addDays(`${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}-01`, -1)
}
/** Mês anterior / seguinte. */
export const shiftMonth = (m: string, n: number) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + (mo - 1) + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}` }

export function coupleMonth(i: CoupleMonthInput): CoupleMonth {
  const from = `${i.month}-01`, end = monthEnd(i.month)
  const to = i.today < end ? i.today : end
  const inM = (d: string | null | undefined) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to
  const split = (rows: Array<{ date: string, completed_by: Who | null }>) => {
    const r = rows.filter(x => inM(x.date))
    return { total: r.length, g: r.filter(x => x.completed_by === 'g').length, s: r.filter(x => x.completed_by === 's').length }
  }
  const tasks = split(i.tasks), dogs = split(i.dogs)
  const ck = i.checkins.filter(c => inM(c.date))
  const days = (w: Who) => new Set(ck.filter(c => c.who === w).map(c => c.date))
  const dg = days('g'), ds = days('s')
  const topMood = (w: Who) => {
    const n = new Map<MoodId, number>()
    ck.filter(c => c.who === w && c.mood).forEach(c => n.set(c.mood!, (n.get(c.mood!) || 0) + 1))
    const best = Array.from(n.entries()).sort((a, b) => b[1] - a[1] || MOODS.findIndex(m => m.id === a[0]) - MOODS.findIndex(m => m.id === b[0]))[0]
    const m = best && MOODS.find(x => x.id === best[0])
    return m ? { emoji: m.emoji, label: m.label } : null
  }
  const meets = i.meetings.filter(m => inM(m.week_start))
  const sp = i.sprints.filter(s => inM(s.date) && s.status !== 'cancelled')
  // dia com mais coisas feitas (tarefas + cães + rotinas)
  const perDay = new Map<string, number>()
  ;[...i.tasks, ...i.dogs, ...i.runs].filter(x => inM(x.date)).forEach(x => perDay.set(x.date, (perDay.get(x.date) || 0) + 1))
  const best = Array.from(perDay.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  const out: CoupleMonth = {
    from, to, days: dayNum(to) - dayNum(from) + 1, label: monthLabel(i.month),
    tasks, dogs, runs: i.runs.filter(r => inM(r.date)).length,
    sprints: { n: sp.length, done: sp.reduce((a, s) => a + s.done, 0) },
    checkins: { both: Array.from(dg).filter(d => ds.has(d)).length, g: dg.size, s: ds.size, mood: { g: topMood('g'), s: topMood('s') } },
    meetings: { n: meets.length, agreements: meets.reduce((a, m) => a + (m.agreements || []).length, 0), kept: meets.reduce((a, m) => a + (m.agreements || []).filter(x => x.done).length, 0) },
    challenges: i.challenges.filter(c => c.status === 'done' && inM(c.ended_at)).map(c => c.title),
    bestDay: best ? { date: best[0], n: best[1] } : null,
    empty: false,
  }
  out.empty = !tasks.total && !dogs.total && !out.runs && !sp.length && !ck.length && !meets.length
  return out
}

const first = (n: string) => (n || '').split(' ')[0]
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** Texto para mandar no WhatsApp / guardar. */
export function coupleMonthText(r: CoupleMonth, names: Record<Who, string>): string {
  const g = first(names.g), s = first(names.s)
  const L = [`🏡 Nosso ${r.label} no Ninho`]
  if (r.tasks.total) L.push(`✅ ${r.tasks.total} tarefas da casa (${g} ${r.tasks.g} · ${s} ${r.tasks.s})`)
  if (r.dogs.total) L.push(`🐾 ${r.dogs.total} cuidados com os cães (${g} ${r.dogs.g} · ${s} ${r.dogs.s})`)
  if (r.runs) L.push(`🔁 ${r.runs} rotinas feitas`)
  if (r.sprints.n) L.push(`⏱ ${r.sprints.n} sprint${r.sprints.n > 1 ? 's' : ''}, ${r.sprints.done} tarefas no mutirão`)
  if (r.checkins.both) L.push(`💬 ${r.checkins.both} dias com check-in das duas`)
  if (r.meetings.n) L.push(`📋 ${r.meetings.n} reunião(ões)${r.meetings.agreements ? ` · ${r.meetings.kept} de ${r.meetings.agreements} combinados cumpridos` : ''}`)
  if (r.challenges.length) L.push(`🤝 Desafios cumpridos: ${r.challenges.join(', ')}`)
  if (r.bestDay) L.push(`🌟 Dia mais produtivo: ${ddmm(r.bestDay.date)} (${r.bestDay.n} coisas feitas)`)
  if (r.empty) L.push('Ainda sem registros neste mês.')
  return L.join('\n')
}
