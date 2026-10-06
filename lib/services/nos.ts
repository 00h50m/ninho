// Nós (migration 022): desafios em dupla, registro do dia e combinados da reunião.
// Sem a migration, a área Nós continua com o que já existia.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import { addDays } from '@/lib/dates'
import type { Who } from '@/lib/types'
import type { Agreement, Challenge, CheckinRow, NosFacts } from '@/lib/nos'

function must<T>(r: { data: T | null, error: any }, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}
const soft = <T>(r: { data: T[] | null, error: any }, ctx: string): T[] => {
  if (r.error) { if (!isMissingTable(r.error)) logError(ctx, r.error); return [] }
  return r.data || []
}

const CH_COLS = 'id,title,kind,ref_id,per_day,days,goal,start_date,status,reward,created_by,created_at,ended_at'
export interface MeetingRow { week_start: string, wins: string | null, what_worked: string | null, agreements: Agreement[] }
export interface SprintRow { date: string, status: string, area: string, done: number }
export interface NosData {
  available: boolean, reason?: string
  challenges: Challenge[], facts: NosFacts, checkins: CheckinRow[], meetings: MeetingRow[], sprints: SprintRow[]
  completions: Array<{ date: string, completed_by: Who | null }>
}
export const EMPTY_NOS: NosData = { available: false, challenges: [], facts: { runs: [], habitLogs: [], checkins: [], completions: [], sprints: [], marks: [] }, checkins: [], meetings: [], sprints: [], completions: [] }

export async function loadNos(householdId: string, today: string): Promise<NosData> {
  const ch = await supabase.from('couple_challenges').select(CH_COLS).eq('household_id', householdId).order('start_date', { ascending: false }).limit(60)
  if (ch.error) {
    if (isMissingTable(ch.error)) return { ...EMPTY_NOS, reason: [ch.error.code, ch.error.message].filter(Boolean).join(' · ') }
    must(ch, 'carregar desafios')
  }
  const challenges = (ch.data || []) as Challenge[]
  // desde o começo do desafio ativo mais antigo (ou 5 semanas)
  const from = challenges.filter(c => c.status === 'active').reduce((m, c) => c.start_date < m ? c.start_date : m, addDays(today, -35))
  const hh = (t: string, cols: string) => supabase.from(t).select(cols).eq('household_id', householdId)
  const [marks, runs, habits, checkins, comps, sprints, meetings] = await Promise.all([
    hh('challenge_marks', 'challenge_id,date,who').gte('date', from),
    hh('routine_runs', 'routine_id,date').eq('status', 'done').gte('date', from),
    hh('ninho_habit_logs', 'habit_id,date').gte('date', from),
    hh('daily_checkins', 'date,who,mood,energy,note,good,need,thanks').gte('date', from),
    hh('task_completions', 'date,completed_by').gte('date', from).limit(5000),
    hh('sprints', 'date,status,area,done_task_ids').gte('date', addDays(today, -120)).order('date', { ascending: false }).limit(60),
    hh('weekly_meetings', 'week_start,wins,what_worked,agreements').order('week_start', { ascending: false }).limit(26),
  ])
  const ck = soft(checkins as any, 'carregar check-ins') as CheckinRow[]
  const cp = soft(comps as any, 'carregar conclusões') as Array<{ date: string, completed_by: Who | null }>
  const sp = (soft(sprints as any, 'carregar sprints') as any[]).map(s => ({ date: s.date, status: s.status, area: s.area, done: (s.done_task_ids || []).length }))
  return {
    available: true, challenges,
    facts: {
      marks: soft(marks as any, 'carregar marcações') as NosFacts['marks'],
      runs: soft(runs as any, 'carregar rotinas') as NosFacts['runs'],
      habitLogs: soft(habits as any, 'carregar hábitos') as NosFacts['habitLogs'],
      checkins: ck.map(c => ({ date: c.date, who: c.who })),
      completions: cp.map(c => ({ date: c.date })),
      sprints: sp,
    },
    checkins: ck, completions: cp, sprints: sp,
    meetings: (soft(meetings as any, 'carregar reuniões') as any[]).map(m => ({ ...m, agreements: Array.isArray(m.agreements) ? m.agreements : [] })),
  }
}

export async function createChallenge(householdId: string, v: Pick<Challenge, 'title' | 'kind' | 'ref_id' | 'per_day' | 'days' | 'goal' | 'start_date' | 'reward' | 'created_by'>): Promise<void> {
  must(await supabase.from('couple_challenges').insert({ household_id: householdId, ...v }).select('id'), 'criar desafio')
}
export async function setChallengeStatus(id: string, status: Challenge['status']): Promise<void> {
  must(await supabase.from('couple_challenges').update({ status, ended_at: status === 'active' ? null : new Date().toISOString() }).eq('id', id).select('id'), 'atualizar desafio')
}
export async function deleteChallenge(id: string): Promise<void> {
  must(await supabase.from('couple_challenges').delete().eq('id', id).select('id'), 'apagar desafio')
}
export async function markChallenge(householdId: string, challengeId: string, date: string, who: Who | null, on: boolean): Promise<void> {
  if (on) {
    const r = await supabase.from('challenge_marks').insert({ challenge_id: challengeId, household_id: householdId, date, who })
    if (r.error && r.error.code !== '23505') must(r, 'marcar desafio')
  } else must(await supabase.from('challenge_marks').delete().eq('challenge_id', challengeId).eq('date', date).select('date'), 'desmarcar desafio')
}

export async function saveDayNote(householdId: string, date: string, who: Who, v: { good: string, need: string, thanks: string }): Promise<void> {
  must(await supabase.rpc('ninho_day_note', { p_household_id: householdId, p_date: date, p_who: who, p_good: v.good, p_need: v.need, p_thanks: v.thanks }), 'salvar registro do dia')
}

export async function saveAgreements(householdId: string, weekStart: string, agreements: Agreement[]): Promise<void> {
  must(await supabase.from('weekly_meetings').upsert({ household_id: householdId, week_start: weekStart, agreements }, { onConflict: 'household_id,week_start' }).select('week_start'), 'salvar combinados')
}

/** Combinado que vira tarefa (uma vez, sem horário) em Casa › Tarefas. */
export async function taskFromAgreement(householdId: string, text: string, who: Who | 'both'): Promise<string> {
  const r = must(await supabase.from('tasks').insert({ household_id: householdId, title: text.slice(0, 80), category: 'general', weight: 'light', frequency: 'once', assigned_to: who === 'both' ? null : who, active: true }).select('id').single(), 'criar tarefa do combinado') as { id: string }
  return r.id
}
