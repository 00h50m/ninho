// Lembretes com o app fechado: o que mandar agora para quem. Funções puras (testadas).
// O agendador chama a cada poucos minutos; cada lembrete vale dentro de uma janela
// (para tolerar atraso do agendador) e o registro de envio impede repetir.
import type { Names, Who } from './types'
import { addDays, dowOf } from './dates'

export type RKind = 'remedio' | 'agua' | 'rotina' | 'sprint' | 'caes' | 'agenda' | 'desafio' | 'checkin'
export const RKINDS: Array<[RKind, string, string, string]> = [
  ['remedio', '💊', 'Remédios e vitaminas', 'No horário de cada dose, se ainda não marcou'],
  ['rotina', '🔁', 'Rotinas', 'Das rotinas com lembrete escolhido (Rotinas › editar), se ainda não foi feita'],
  ['sprint', '⏱', 'Fim do sprint', 'Quando o tempo do Sprint do Ninho acaba'],
  ['caes', '🐾', 'Saúde dos cães', 'Vacina, vermífugo e consulta: na véspera e no dia, às 9h'],
  ['agenda', '📅', 'Agenda da casa', '1 hora antes; vencimentos na véspera e no dia'],
  ['desafio', '🤝', 'Desafio em dupla', 'Às 21h, se o dia ainda não foi marcado'],
  ['agua', '💧', 'Água', 'Às 11h, 15h e 19h, se estiver abaixo do esperado'],
  ['checkin', '💬', 'Check-in da noite', 'Às 21h30, se ainda não fez o check-in'],
]
export type RPrefs = Record<RKind, boolean>
export const DEFAULT_RPREFS: RPrefs = { remedio: true, rotina: true, sprint: true, caes: true, agenda: true, desafio: true, agua: false, checkin: false }
export const prefsOf = (x: unknown): RPrefs => ({ ...DEFAULT_RPREFS, ...(x && typeof x === 'object' ? x as Partial<RPrefs> : {}) })

export interface RemState {
  date: string, hm: string, nowMs: number, names: Names
  meds: Array<{ id: string, who: Who, name: string, dose: string | null, times: string[] }>
  medTaken: Array<{ who: Who, med_id: string, time: string | null }>
  water: Array<{ who: Who, ml: number, goal: number }>
  routines: Array<{ id: string, title: string, scheduled_time: string | null, weekdays: number[] | null, assign_mode: string, start_date?: string | null, paused_until?: string | null, reminder_min?: number | null }>
  routineDone: string[]
  sprint: { id: string, area: string, participants: Who[], endMs: number } | null
  dogHealth: Array<{ id: string, title: string, dog: string, next_date: string }>
  events: Array<{ id: string, title: string, date: string, time: string | null, who: string | null, kind: string, paid: boolean | null, done_at: string | null }>
  challenges: Array<{ id: string, title: string }>   // desafios "marcamos no app" ainda sem o dia de hoje
  checkins: Who[]                                     // quem já fez check-in hoje
}
export interface Reminder { who: Who, kind: RKind, ref: string, title: string, body: string, url: string }

export const toMin = (hm: string) => { const [h, m] = hm.slice(0, 5).split(':').map(Number); return h * 60 + m }
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
/** O horário t já chegou e faz menos de `win` minutos? */
export const due = (t: string, hm: string, win: number) => { const d = toMin(hm) - toMin(t); return d >= 0 && d < win }
/** Dentro do horário de silêncio (que pode atravessar a meia-noite)? */
export function inQuiet(hm: string, start: string, end: string): boolean {
  const n = toMin(hm), a = toMin(start), b = toMin(end)
  if (a === b) return false
  return a < b ? n >= a && n < b : n >= a || n < b
}
const both: Who[] = ['g', 's']
const whoList = (w: string | null | undefined): Who[] => w === 'g' || w === 's' ? [w] : both
const first = (n: string) => (n || '').split(' ')[0]

export function dueReminders(s: RemState, win = 20): Reminder[] {
  const out: Reminder[] = []
  const push = (who: Who[], kind: RKind, ref: string, title: string, body: string, url: string) => who.forEach(w => out.push({ who: w, kind, ref, title, body, url }))
  // Remédios
  for (const m of s.meds) for (const t of m.times) {
    if (!due(t, s.hm, win)) continue
    if (s.medTaken.some(x => x.who === m.who && x.med_id === m.id && x.time === t)) continue
    push([m.who], 'remedio', `med:${m.id}:${t}`, `💊 ${m.name}`, `Hora da dose das ${t}${m.dose ? ` · ${m.dose}` : ''}. Toque para marcar no Meu dia.`, '/?ir=meudia')
  }
  // Água: pontos do dia, se abaixo do esperado até ali
  for (const [t, frac] of [['11:00', 0.35], ['15:00', 0.6], ['19:00', 0.85]] as Array<[string, number]>) {
    if (!due(t, s.hm, win)) continue
    for (const w of s.water) if (w.ml < w.goal * frac) push([w.who], 'agua', `agua:${t}`, '💧 Um copo de água?', `Até agora ${(w.ml / 1000).toFixed(1).replace('.', ',')} L de ${(w.goal / 1000).toFixed(1).replace('.', ',')} L.`, '/?ir=meudia')
  }
  // Rotinas no horário
  const dow = dowOf(s.date)
  for (const r of s.routines) {
    // só rotinas com lembrete escolhido no editor (0 = na hora, N = N minutos antes)
    if (!r.scheduled_time || r.reminder_min == null || s.routineDone.includes(r.id)) continue
    const at = fromMin(Math.max(0, toMin(r.scheduled_time) - r.reminder_min))
    if (!due(at, s.hm, win)) continue
    if (r.weekdays && !r.weekdays.includes(dow)) continue
    if ((r.start_date && s.date < r.start_date) || (r.paused_until && s.date <= r.paused_until)) continue
    push(whoList(r.assign_mode), 'rotina', `rotina:${r.id}`, `🔁 ${r.title}`, r.reminder_min ? `Às ${r.scheduled_time.slice(0, 5)} (daqui a ${r.reminder_min} min).` : `Está na hora (${r.scheduled_time.slice(0, 5)}).`, '/?ir=rotinas')
  }
  // Fim do sprint
  if (s.sprint && s.sprint.endMs <= s.nowMs && s.nowMs - s.sprint.endMs < win * 60000) {
    push(s.sprint.participants.length ? s.sprint.participants : both, 'sprint', `sprint:${s.sprint.id}`, '⏱ Tempo!', `O sprint (${s.sprint.area}) acabou. Marquem o que fizeram e encerrem.`, '/?ir=sprint')
  }
  // Saúde dos cães: véspera e dia, às 9h
  if (due('09:00', s.hm, win)) {
    const tomorrow = addDays(s.date, 1)
    for (const h of s.dogHealth) {
      if (h.next_date === s.date) push(both, 'caes', `caes:${h.id}:${h.next_date}:0`, `🐾 ${h.dog}: ${h.title}`, 'É hoje.', '/?ir=caes')
      else if (h.next_date === tomorrow) push(both, 'caes', `caes:${h.id}:${h.next_date}:1`, `🐾 ${h.dog}: ${h.title}`, 'É amanhã.', '/?ir=caes')
    }
  }
  // Agenda: 1 h antes; sem horário às 8h30; vencimento na véspera (19h) e no dia (9h)
  for (const e of s.events) {
    if (e.done_at) continue
    if (e.kind === 'vencimento') {
      if (e.paid) continue
      if (e.date === addDays(s.date, 1) && due('19:00', s.hm, win)) push(whoList(e.who), 'agenda', `ev:${e.id}:1`, `📅 Vence amanhã: ${e.title}`, 'Ainda está pendente.', '/?ir=agenda')
      if (e.date === s.date && due('09:00', s.hm, win)) push(whoList(e.who), 'agenda', `ev:${e.id}:0`, `📅 Vence hoje: ${e.title}`, 'Ainda está pendente.', '/?ir=agenda')
      continue
    }
    if (e.date !== s.date) continue
    const at = e.time ? fromMin(Math.max(0, toMin(e.time) - 60)) : '08:30'
    if (due(at, s.hm, win)) push(whoList(e.who), 'agenda', `ev:${e.id}`, `📅 ${e.title}`, e.time ? `Hoje às ${e.time}.` : 'É hoje.', '/?ir=agenda')
  }
  // Desafio em dupla: às 21h, se o dia não foi marcado
  if (due('21:00', s.hm, win)) for (const c of s.challenges) push(both, 'desafio', `desafio:${c.id}`, `🤝 ${c.title}`, 'Conseguiram hoje? Marquem no app.', '/?ir=desafios')
  // Check-in: às 21h30 para quem ainda não fez
  if (due('21:30', s.hm, win)) for (const w of both) if (!s.checkins.includes(w)) push([w], 'checkin', 'checkin', `💬 Como foi o dia, ${first(s.names[w])}?`, 'Um toque no humor e na energia.', '/?ir=checkin')
  return out
}

/** O que vai para um aparelho: da pessoa dele, ligado nas preferências e fora do silêncio. */
export function forDevice(list: Reminder[], sub: { who: Who, reminders: unknown, quiet_start: string, quiet_end: string }, hm: string): Reminder[] {
  if (inQuiet(hm, sub.quiet_start || '22:00', sub.quiet_end || '07:00')) return []
  const p = prefsOf(sub.reminders)
  return list.filter(r => r.who === sub.who && p[r.kind])
}
