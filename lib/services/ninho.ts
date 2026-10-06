// Acesso ao Supabase. Toda função confere `error` e lança NinhoError quando o banco recusa.
// Nenhuma usa service_role: só a chave anon do app e o login anônimo atual.
import { supabase } from '@/lib/supabase'
import { NinhoError, logError } from '@/lib/errors'
import { addDays } from '@/lib/dates'
import type { Accident, CompletionRow, Dog, Energy, HistoryWeek, Meeting, Names, Task, Who } from '@/lib/types'
import { DEFAULT_NAMES } from '@/lib/constants'
import type { SkipRow } from '@/lib/build'
import { EMPTY_SCORES, EMPTY_STREAKS, type AchievementStats, type Streaks, type WeeklyScores } from '@/lib/gamification'

type Res<T> = { data: T | null, error: unknown }

function check<T>(res: Res<T>, context: string): T {
  if (res.error) {
    logError(context, res.error)
    throw new NinhoError(res.error, context)
  }
  return res.data as T
}

async function run<T>(context: string, p: PromiseLike<Res<T>>): Promise<T> {
  let res: Res<T>
  try { res = await p } catch (e) { logError(context, e); throw new NinhoError(e, context) }
  return check(res, context)
}

// ── Leitura ─────────────────────────────────────────────────────────────

import { COMPLETION_WINDOW_DAYS } from '@/lib/constants'
export { COMPLETION_WINDOW_DAYS }

export interface Snapshot {
  tasks: any[]
  taskCompletions: CompletionRow[]
  dogs: any[]
  dogCompletions: CompletionRow[]
  settings: { energy: Energy, survival: boolean } | null
  names: Names | null
  accidents: Accident[]
}

export async function loadTasks(householdId: string, today: string) {
  const since = addDays(today, -COMPLETION_WINDOW_DAYS)
  const [tasks, comps] = await Promise.all([
    run('carregar tarefas', supabase.from('tasks').select('*').eq('household_id', householdId).eq('active', true).order('essential', { ascending: false }).order('category')),
    run('carregar conclusões', supabase.from('task_completions').select('id,task_id,date,completed_by').eq('household_id', householdId).gte('date', since)),
  ])
  // Pontuais valem para sempre: busca as conclusões antigas só delas
  const onceIds = (tasks as any[]).filter(t => t.frequency === 'once').map(t => t.id)
  const old = onceIds.length
    ? await run('carregar conclusões antigas', supabase.from('task_completions').select('id,task_id,date,completed_by').eq('household_id', householdId).in('task_id', onceIds).lt('date', since))
    : []
  return { tasks: tasks as any[], completions: [...(comps as CompletionRow[]), ...(old as CompletionRow[])], skips: await loadSkips(householdId, today) }
}

/** Pular/adiar do último mês (o período mais longo). Sem a migration 008, segue sem pausas. */
export async function loadSkips(householdId: string, today: string): Promise<SkipRow[]> {
  const r = await supabase.from('task_skips').select('id,task_id,date,kind,skipped_by').eq('household_id', householdId).gte('date', addDays(today, -31))
  if (r.error) { logError('carregar tarefas puladas', r.error); return [] }
  return (r.data || []) as SkipRow[]
}

/** Pular (skip) ou deixar para amanhã (snooze). Um registro por tarefa por dia. */
export async function skipTask(householdId: string, taskId: string, date: string, kind: 'snooze' | 'skip', by: Who | null): Promise<SkipRow> {
  return await run(kind === 'skip' ? 'pular tarefa' : 'adiar tarefa', supabase.from('task_skips')
    .upsert({ household_id: householdId, task_id: taskId, date, kind, skipped_by: by }, { onConflict: 'task_id,date' }).select('id,task_id,date,kind,skipped_by').single()) as SkipRow
}

export async function unskipTask(id: string) {
  await run('desfazer pausa', supabase.from('task_skips').delete().eq('id', id).select('id'))
}

export async function loadDogs(householdId: string, today: string) {
  const since = addDays(today, -COMPLETION_WINDOW_DAYS)
  const [dogs, comps] = await Promise.all([
    run('carregar cães', supabase.from('dogs').select('*,dog_routines(*)').eq('household_id', householdId).eq('active', true)),
    run('carregar rotinas concluídas', supabase.from('dog_completions').select('id,routine_id,date,completed_by').eq('household_id', householdId).gte('date', since)),
  ])
  return { dogs: dogs as any[], completions: comps as CompletionRow[] }
}

export async function loadSettings(householdId: string, weekStart: string) {
  const row = await run('carregar ajustes da semana', supabase.from('weekly_settings').select('*').eq('household_id', householdId).eq('week_start', weekStart).maybeSingle())
  return row ? { energy: (row as any).energy as Energy, survival: !!(row as any).survival, bet: (row as any).bet ?? null } : null
}

export async function loadNames(householdId: string): Promise<Names | null> {
  const rows = await run('carregar nomes', supabase.from('profiles').select('display_name,role').eq('household_id', householdId)) as any[]
  if (!rows?.length) return null
  const g = rows.find(p => p.role === 'g'), s = rows.find(p => p.role === 's')
  return { g: g?.display_name || DEFAULT_NAMES.g, s: s?.display_name || DEFAULT_NAMES.s }
}

export async function loadAccidents(householdId: string): Promise<Accident[]> {
  return await run('carregar acidentes', supabase.from('puppy_accidents').select('*').eq('household_id', householdId).order('occurred_at', { ascending: false }).limit(20)) as Accident[]
}

export async function loadStats(householdId: string, today: string) {
  const [xp, streak] = await Promise.all([
    run('carregar XP', supabase.rpc('ninho_household_xp', { p_household_id: householdId })),
    run('carregar sequência', supabase.rpc('ninho_streak', { p_household_id: householdId, p_today: today })),
  ])
  return { xp: Number(xp) || 0, streak: Number(streak) || 0 }
}

export async function loadHistory(householdId: string, weekStarts: string[]): Promise<HistoryWeek[]> {
  const first = weekStarts[weekStarts.length - 1], last = addDays(weekStarts[0], 6)
  const [comps, meets] = await Promise.all([
    run('carregar histórico', supabase.from('task_completions').select('date').eq('household_id', householdId).gte('date', first).lte('date', last)),
    run('carregar reuniões', supabase.from('weekly_meetings').select('*').eq('household_id', householdId).gte('week_start', first).lte('week_start', weekStarts[0])),
  ])
  return weekStarts.map(ws => ({
    week: ws,
    completions: (comps as any[]).filter(c => c.date >= ws && c.date <= addDays(ws, 6)).length,
    meeting: (meets as any[]).find(m => m.week_start === ws) || null,
  }))
}

// ── Conclusões (transacionais, no banco) ───────────────────────────────

export interface CompleteTaskResult { created: boolean, completed_by: Who | null, completion_id: string, xp: number, base_xp?: number, on_time?: boolean }

export async function completeTask(taskId: string, date: string, by: Who): Promise<CompleteTaskResult> {
  return await run('concluir tarefa', supabase.rpc('ninho_complete_task', { p_task_id: taskId, p_date: date, p_by: by })) as CompleteTaskResult
}

export async function uncompleteTask(taskId: string, date: string): Promise<{ removed: boolean }> {
  return await run('desfazer tarefa', supabase.rpc('ninho_uncomplete_task', { p_task_id: taskId, p_date: date })) as { removed: boolean }
}

export interface CompleteRoutinesResult {
  created: number, xp_added: number, on_time?: boolean
  completions: Array<{ routine_id: string, completion_id: string, completed_by: Who | null }>
}

export async function completeDogRoutines(ids: string[], date: string, by: Who): Promise<CompleteRoutinesResult> {
  return await run('concluir rotina', supabase.rpc('ninho_complete_dog_routines', { p_routine_ids: ids, p_date: date, p_by: by })) as CompleteRoutinesResult
}

export async function uncompleteDogRoutines(ids: string[], date: string): Promise<{ removed: number }> {
  return await run('desfazer rotina', supabase.rpc('ninho_uncomplete_dog_routines', { p_routine_ids: ids, p_date: date })) as { removed: number }
}

// ── Tarefas ────────────────────────────────────────────────────────────

export async function updateTask(id: string, data: Partial<Task>) {
  await run('atualizar tarefa', supabase.from('tasks').update(data).eq('id', id).select('id'))
}

/** Histórico de uma tarefa: conclusões (com quem fez) e pausas, mais recentes primeiro. */
export async function taskHistory(taskId: string): Promise<Array<{ date: string, kind: 'done' | 'skip' | 'snooze', by: Who | null }>> {
  const [c, k] = await Promise.all([
    run('carregar histórico da tarefa', supabase.from('task_completions').select('date,completed_by').eq('task_id', taskId).order('date', { ascending: false }).limit(12)),
    supabase.from('task_skips').select('date,kind,skipped_by').eq('task_id', taskId).order('date', { ascending: false }).limit(6),
  ])
  const done = ((c || []) as any[]).map(x => ({ date: x.date, kind: 'done' as const, by: (x.completed_by === 'g' || x.completed_by === 's') ? x.completed_by : null }))
  const skips = ((k.data || []) as any[]).map(x => ({ date: x.date, kind: x.kind as 'skip' | 'snooze', by: x.skipped_by ?? null }))
  return [...done, ...skips].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
}

/** Pedir ajuda numa tarefa (who) ou cancelar o pedido (null). */
export async function setTaskHelp(id: string, who: Who | null) {
  await run(who ? 'pedir ajuda' : 'cancelar pedido de ajuda', supabase.from('tasks').update({ help_by: who, help_at: who ? new Date().toISOString() : null }).eq('id', id).select('id'))
}

export async function updateTasks(ids: string[], data: Partial<Task>) {
  if (!ids.length) return
  await run('atualizar tarefas', supabase.from('tasks').update(data).in('id', ids).select('id'))
}

export async function insertTasks(householdId: string, rows: Array<Partial<Task>>) {
  if (!rows.length) return
  await run('criar tarefa', supabase.from('tasks').insert(rows.map(r => ({ ...r, household_id: householdId, active: true }))))
}

// ── Cães ───────────────────────────────────────────────────────────────

export async function insertDog(householdId: string, data: Partial<Dog>, routines: Array<{ title: string, frequency: string, scheduled_time: string | null }>) {
  const dog = await run('cadastrar pet', supabase.from('dogs').insert({ ...data, household_id: householdId, active: true }).select().single()) as any
  if (routines.length) {
    try {
      await run('criar rotinas', supabase.from('dog_routines').insert(routines.map(r => ({ ...r, dog_id: dog.id, household_id: householdId, active: true }))))
    } catch (e) {
      // o pet foi criado; avisa que as rotinas não
      throw Object.assign(e as NinhoError, { userMessage: `${data.name} foi cadastrado, mas as rotinas não foram salvas. Adicione pela aba Cães.` })
    }
  }
  return dog
}

export async function updateDog(id: string, data: Partial<Dog>) {
  await run('atualizar pet', supabase.from('dogs').update(data).eq('id', id).select('id'))
}

export async function upsertRoutine(householdId: string, dogId: string, data: { title: string, frequency: string, scheduled_time: string | null }, id?: string) {
  if (id) await run('atualizar rotina', supabase.from('dog_routines').update(data).eq('id', id).select('id'))
  else await run('criar rotina', supabase.from('dog_routines').insert({ ...data, dog_id: dogId, household_id: householdId, active: true }))
}

export async function setRoutineActive(id: string, active: boolean) {
  await run('remover rotina', supabase.from('dog_routines').update({ active }).eq('id', id).select('id'))
}

export async function insertAccident(householdId: string, dogId: string, location: string, date: string) {
  return await run('registrar acidente', supabase.from('puppy_accidents').insert({ dog_id: dogId, household_id: householdId, location, date }).select().single()) as Accident
}

// ── Semana, nomes, reunião ─────────────────────────────────────────────

export async function saveWeeklySettings(householdId: string, weekStart: string, s: { energy: Energy, survival: boolean }) {
  await run('salvar ajustes da semana', supabase.from('weekly_settings').upsert({ household_id: householdId, week_start: weekStart, ...s }, { onConflict: 'household_id,week_start' }))
}

export async function updateName(householdId: string, role: Who, name: string) {
  await run('atualizar nome', supabase.from('profiles').update({ display_name: name }).eq('household_id', householdId).eq('role', role).select('id'))
}

export async function saveMeeting(householdId: string, weekStart: string, m: Meeting) {
  await run('salvar reunião', supabase.from('weekly_meetings').upsert({ household_id: householdId, week_start: weekStart, ...m }, { onConflict: 'household_id,week_start' }))
}

// ── Gamificação (migration 005) ───────────────────────────────────────

export interface Gamification {
  scores: WeeklyScores
  lastWeek: WeeklyScores
  lastWeekBet: string | null
  streaks: Streaks
  stats: AchievementStats
}

const normScores = (r: any): WeeklyScores => ({
  g: { ...EMPTY_SCORES.g, ...(r?.g || {}) },
  s: { ...EMPTY_SCORES.s, ...(r?.s || {}) },
  unknown: { ...EMPTY_SCORES.unknown, ...(r?.unknown || {}) },
})

export async function loadGamification(householdId: string, today: string, weekStart: string): Promise<Gamification> {
  const lastWeekStart = addDays(weekStart, -7)
  const [scores, lastWeek, streaks, stats, last] = await Promise.all([
    run('carregar placar', supabase.rpc('ninho_weekly_scores', { p_household_id: householdId, p_week_start: weekStart })),
    run('carregar placar anterior', supabase.rpc('ninho_weekly_scores', { p_household_id: householdId, p_week_start: lastWeekStart })),
    run('carregar sequências', supabase.rpc('ninho_streaks', { p_household_id: householdId, p_today: today })),
    run('carregar conquistas', supabase.rpc('ninho_achievement_stats', { p_household_id: householdId, p_today: today })),
    run('carregar aposta anterior', supabase.from('weekly_settings').select('bet').eq('household_id', householdId).eq('week_start', lastWeekStart).maybeSingle()),
  ])
  return {
    scores: normScores(scores),
    lastWeek: normScores(lastWeek),
    lastWeekBet: (last as any)?.bet ?? null,
    streaks: { ...EMPTY_STREAKS, ...((streaks as any) || {}) },
    stats: (stats as AchievementStats) || {},
  }
}

export async function saveBet(householdId: string, weekStart: string, bet: string | null) {
  await run('salvar aposta', supabase.from('weekly_settings').upsert({ household_id: householdId, week_start: weekStart, bet }, { onConflict: 'household_id,week_start' }))
}

// ── Notificações (migration 006) ──────────────────────────────────────

export interface PushRow { who: Who, morning: boolean, weekly: boolean, active: boolean, reminders?: Record<string, boolean>, quiet_start?: string, quiet_end?: string }

export async function savePushSubscription(householdId: string, who: Who, keys: { endpoint: string, p256dh: string, auth: string }, prefs: { morning: boolean, weekly: boolean }) {
  return await run('ativar notificações', supabase.rpc('ninho_save_push_subscription', {
    p_household_id: householdId, p_who: who, p_endpoint: keys.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null, p_morning: prefs.morning, p_weekly: prefs.weekly,
  }))
}

export async function loadPushSubscription(endpoint: string): Promise<PushRow | null> {
  // Lembretes (migration 023): sem ela, só bom dia e domingo
  const r = await supabase.from('push_subscriptions').select('who,morning,weekly,active,reminders,quiet_start,quiet_end').eq('endpoint', endpoint).maybeSingle()
  if (r.error && (r.error.code === '42703' || r.error.code === 'PGRST204' || /column/i.test(r.error.message || '')))
    return await run('carregar notificações', supabase.from('push_subscriptions').select('who,morning,weekly,active').eq('endpoint', endpoint).maybeSingle()) as PushRow | null
  return await run('carregar notificações', Promise.resolve(r) as any) as PushRow | null
}

export async function updatePushPrefs(endpoint: string, prefs: Partial<Pick<PushRow, 'morning' | 'weekly' | 'active' | 'reminders' | 'quiet_start' | 'quiet_end'>>) {
  await run('salvar notificações', supabase.from('push_subscriptions').update(prefs).eq('endpoint', endpoint).select('id'))
}
