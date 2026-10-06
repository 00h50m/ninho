// Nós: desafios em dupla, histórico de check-ins, pauta da reunião e linha do tempo.
// Funções puras (testadas). Nada aqui compara uma com a outra: tudo é do casal.
import type { Who } from './types'
import { addDays, dayNum } from './dates'
import { MOODS, type MoodId } from './week'

export type ChallengeKind = 'livre' | 'rotina' | 'habito' | 'checkin' | 'tarefas' | 'sprint'
export type ChallengeStatus = 'active' | 'done' | 'missed' | 'cancelled'
export interface Challenge {
  id: string, title: string, kind: ChallengeKind, ref_id: string | null, per_day: number
  days: number, goal: number, start_date: string, status: ChallengeStatus, reward: string | null
  created_by: Who | null, created_at?: string, ended_at: string | null
}
export interface NosFacts {
  runs: Array<{ routine_id: string, date: string }>          // rotinas concluídas
  habitLogs: Array<{ habit_id: string, date: string }>
  checkins: Array<{ date: string, who: Who }>
  completions: Array<{ date: string }>                        // tarefas concluídas
  sprints: Array<{ date: string, status: string }>
  marks: Array<{ challenge_id: string, date: string, who: Who | null }>
}
export const EMPTY_FACTS: NosFacts = { runs: [], habitLogs: [], checkins: [], completions: [], sprints: [], marks: [] }

export const KIND_LABEL: Record<ChallengeKind, string> = {
  livre: 'Marcamos no app', rotina: 'Rotina concluída', habito: 'Hábito registrado',
  checkin: 'Check-in das duas', tarefas: 'Tarefas do dia', sprint: 'Sprint do Ninho',
}

export const endOf = (c: Pick<Challenge, 'start_date' | 'days'>) => addDays(c.start_date, c.days - 1)

/** O dia conta para o desafio? */
export function dayHit(c: Challenge, f: NosFacts, date: string): boolean {
  switch (c.kind) {
    case 'livre': return f.marks.some(m => m.challenge_id === c.id && m.date === date)
    case 'rotina': return f.runs.some(r => r.routine_id === c.ref_id && r.date === date)
    case 'habito': return f.habitLogs.some(h => h.habit_id === c.ref_id && h.date === date)
    case 'checkin': { const w = new Set(f.checkins.filter(x => x.date === date).map(x => x.who)); return w.has('g') && w.has('s') }
    case 'tarefas': return f.completions.filter(x => x.date === date).length >= (c.per_day || 1)
    case 'sprint': return f.sprints.some(s => s.date === date && s.status === 'done')
  }
}

export interface Progress {
  days: Array<{ date: string, hit: boolean, future: boolean, today: boolean }>
  hits: number, goal: number, left: number
  /** situação calculada (pode diferir do banco: aí o app atualiza) */
  state: ChallengeStatus
  todayHit: boolean
}

export function progress(c: Challenge, f: NosFacts, today: string): Progress {
  const days = Array.from({ length: c.days }, (_, i) => {
    const date = addDays(c.start_date, i)
    return { date, hit: date <= today && dayHit(c, f, date), future: date > today, today: date === today }
  })
  const hits = days.filter(d => d.hit).length
  // no desafio marcado à mão, dá para marcar ontem até o fim de hoje
  const yesterday = addDays(today, -1)
  const remaining = days.filter(d => d.future || (!d.hit && (d.today || (c.kind === 'livre' && d.date === yesterday)))).length
  let state: ChallengeStatus = c.status
  if (c.status === 'active') state = hits >= c.goal ? 'done' : hits + remaining < c.goal ? 'missed' : 'active'
  return { days, hits, goal: c.goal, left: Math.max(0, c.goal - hits), state, todayHit: !!days.find(d => d.today)?.hit }
}

/** Sugestões de desafio (o app liga rotina/hábito pelo nome quando existe). */
export interface ChallengeIdea { title: string, kind: ChallengeKind, days: number, goal: number, per_day?: number, match?: string, why: string }
export const CHALLENGE_IDEAS: ChallengeIdea[] = [
  { title: 'Cozinha fechada todas as noites', kind: 'rotina', match: 'cozinha', days: 7, goal: 7, why: 'Uma vitória visível por dia' },
  { title: 'Check-in das duas', kind: 'checkin', days: 7, goal: 6, why: 'Saber como a outra chega' },
  { title: '3 tarefas por dia', kind: 'tarefas', per_day: 3, days: 7, goal: 5, why: 'Um pouco todo dia, sem acumular' },
  { title: 'Dois sprints na semana', kind: 'sprint', days: 7, goal: 2, why: 'Mutirões curtos e juntas' },
  { title: 'Passeio dos cães no horário', kind: 'livre', days: 7, goal: 7, why: 'Penélope e Zelda agradecem' },
  { title: 'Uma noite sem telas', kind: 'livre', days: 7, goal: 2, why: 'Tempo de qualidade' },
]

/** Escolhe a rotina ou o hábito pelo nome (ex.: "cozinha"). */
export function matchRef<T extends { id: string, title: string }>(items: T[], word?: string): T | null {
  if (!word) return null
  const w = word.toLowerCase()
  return items.find(i => i.title.toLowerCase().includes(w)) || null
}

// ── Histórico de check-ins ───────────────────────────────────────────
export interface CheckinRow { date: string, who: Who, mood: MoodId | null, energy: string | null, note: string | null, good?: string | null, need?: string | null, thanks?: string | null }

/** Grade dos últimos N dias (mais antigo → hoje) para uma pessoa. */
export function moodGrid(rows: CheckinRow[], who: Who, today: string, n = 28): Array<{ date: string, mood: MoodId | null, energy: string | null }> {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    const r = rows.find(x => x.who === who && x.date === date)
    return { date, mood: r?.mood || null, energy: r?.energy || null }
  })
}

/** Quantos dias de cada humor (para o resumo; sem média "nota"). */
export function moodCounts(rows: CheckinRow[], who: Who, from: string, to: string): Array<{ id: MoodId, emoji: string, label: string, n: number }> {
  const mine = rows.filter(r => r.who === who && r.date >= from && r.date <= to && r.mood)
  return MOODS.map(m => ({ ...m, n: mine.filter(r => r.mood === m.id).length })).filter(m => m.n > 0)
}

/** Registros do dia (o que foi bom, do que precisei, agradeço), mais recentes primeiro. */
export function dayNotes(rows: CheckinRow[], from: string): CheckinRow[] {
  return rows.filter(r => r.date >= from && (r.good || r.need || r.thanks)).sort((a, b) => b.date.localeCompare(a.date) || a.who.localeCompare(b.who))
}

// ── Pauta da reunião (com o que aconteceu de verdade) ─────────────────
export interface WeekData {
  weekStart: string, today: string
  completions: Array<{ date: string, completed_by: Who | null }>
  helpAsked: number
  runs: Array<{ date: string }>
  habitLogs: Array<{ date: string }>
  sprints: Array<{ date: string, status: string, done: number }>
  checkins: CheckinRow[]
  dogNext: Array<{ title: string, date: string }>
  events: Array<{ title: string, date: string, kind: string }>
  challenges: Array<{ title: string, hits: number, goal: number, state: ChallengeStatus }>
  shared: string[]       // frases do Meu dia que cada uma compartilha
  lastAgreements: Agreement[]
}
export interface Agreement { text: string, who: Who | 'both', task_id: string | null, done: boolean }
export interface AgendaSection { icon: string, title: string, lines: string[] }

const inWeek = (d: string, ws: string) => d >= ws && d <= addDays(ws, 6)
const plural = (n: number, s: string, p = s + 's') => `${n} ${n === 1 ? s : p}`

export function meetingAgenda(w: WeekData, names: Record<Who, string>): AgendaSection[] {
  const first = (x: Who) => (names[x] || '').split(' ')[0]
  const out: AgendaSection[] = []
  const comp = w.completions.filter(c => inWeek(c.date, w.weekStart))
  const runs = w.runs.filter(r => inWeek(r.date, w.weekStart)).length
  const habits = w.habitLogs.filter(h => inWeek(h.date, w.weekStart)).length
  const sp = w.sprints.filter(s => inWeek(s.date, w.weekStart) && s.status === 'done')
  const casa = [`${plural(comp.length, 'tarefa feita', 'tarefas feitas')} pela casa${runs ? ` · ${plural(runs, 'rotina concluída', 'rotinas concluídas')}` : ''}${habits ? ` · ${plural(habits, 'registro de hábito', 'registros de hábito')}` : ''}`]
  if (sp.length) casa.push(`${plural(sp.length, 'sprint', 'sprints')} juntas (${sp.reduce((a, s) => a + s.done, 0)} tarefas)`)
  if (w.helpAsked) casa.push(`${plural(w.helpAsked, 'pedido de ajuda', 'pedidos de ajuda')} na semana`)
  out.push({ icon: '🏠', title: 'A casa nesta semana', lines: casa })
  const ch = w.challenges
  if (ch.length) out.push({ icon: '🤝', title: 'Desafios em dupla', lines: ch.map(c => `${c.title}: ${c.hits}/${c.goal}${c.state === 'done' ? ' ✓ conseguimos' : c.state === 'missed' ? ' · não deu desta vez' : ''}`) })
  const ck = w.checkins.filter(c => inWeek(c.date, w.weekStart))
  if (ck.length) {
    const lines = (['g', 's'] as Who[]).map(x => {
      const m = moodCounts(ck, x, w.weekStart, addDays(w.weekStart, 6))
      return m.length ? `${first(x)}: ${m.map(y => `${y.emoji}×${y.n}`).join(' ')}` : ''
    }).filter(Boolean)
    const needs = ck.filter(c => c.need).map(c => `${first(c.who)} precisou: ${c.need}`)
    const thanks = ck.filter(c => c.thanks).map(c => `${first(c.who)} agradeceu: ${c.thanks}`)
    out.push({ icon: '💬', title: 'Como chegamos', lines: [...lines, ...needs.slice(0, 3), ...thanks.slice(0, 3)] })
  }
  if (w.shared.length) out.push({ icon: '💧', title: 'Meu dia (o que cada uma compartilha)', lines: w.shared })
  const nextEnd = addDays(w.weekStart, 13)
  const ev = w.events.filter(e => e.date >= w.today && e.date <= nextEnd).sort((a, b) => a.date.localeCompare(b.date))
  const dogs = w.dogNext.filter(d => d.date <= nextEnd).sort((a, b) => a.date.localeCompare(b.date))
  if (ev.length || dogs.length) out.push({ icon: '📅', title: 'Vem por aí', lines: [...ev.map(e => `${fmt(e.date)} · ${e.title}`), ...dogs.map(d => `${fmt(d.date)} · 🐾 ${d.title}`)].slice(0, 8) })
  const open = w.lastAgreements.filter(a => !a.done)
  if (w.lastAgreements.length) out.push({ icon: '✅', title: 'Combinados da semana passada', lines: w.lastAgreements.map(a => `${a.done ? '✓' : '○'} ${a.text}${a.who === 'both' ? '' : ` (${first(a.who)})`}`).concat(open.length ? [] : ['Tudo cumprido 🎉']) })
  return out
}
const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

// ── Linha do tempo do casal ──────────────────────────────────────────
export interface TimelineItem { date: string, icon: string, text: string }
export function timeline(data: {
  challenges: Challenge[], meetings: Array<{ week_start: string, wins?: string | null }>, sprints: Array<{ date: string, status: string, area: string, done: number }>,
}): TimelineItem[] {
  const items: TimelineItem[] = [
    ...data.challenges.filter(c => c.status === 'done').map(c => ({ date: (c.ended_at || endOf(c)).slice(0, 10), icon: '🏆', text: `Desafio conquistado: ${c.title}` })),
    ...data.meetings.map(m => ({ date: m.week_start, icon: '📋', text: m.wins ? `Reunião da semana · 🎉 ${m.wins}` : 'Reunião da semana feita' })),
    ...data.sprints.filter(s => s.status === 'done').map(s => ({ date: s.date, icon: '⏱', text: `Sprint ${s.area}${s.done ? ` · ${plural(s.done, 'tarefa')}` : ''}` })),
  ]
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
}

/** Dias seguidos (até hoje) em que as duas fizeram check-in. */
export function bothCheckinStreak(rows: Array<{ date: string, who: Who }>, today: string): number {
  const both = (d: string) => { const w = new Set(rows.filter(r => r.date === d).map(r => r.who)); return w.has('g') && w.has('s') }
  let d = both(today) ? today : addDays(today, -1), n = 0
  while (both(d) && n < 400) { n++; d = addDays(d, -1) }
  return n
}

export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a)
