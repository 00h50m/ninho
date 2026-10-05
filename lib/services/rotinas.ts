// Rotinas (014 + 016) e hábitos (016). Sem a 016, rotinas aparecem só para leitura
// e a aba Hábitos avisa que falta atualizar o banco.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { Habit, HabitLog, Routine, Run } from '@/lib/rotinas'
import type { Template } from '@/lib/onboarding'

type Res<T> = { data: T | null, error: any }
function must<T>(r: Res<T>, ctx: string): T {
  if (r.error) { logError(ctx, r.error); throw new NinhoError(r.error, ctx) }
  return r.data as T
}
const missingColumn = (e: any) => e?.code === '42703' || e?.code === 'PGRST204' || /column .* does not exist/i.test(e?.message || '')

export interface RotinasData {
  /** 014 aplicada (rotinas existem) */
  routinesOk: boolean
  /** 016 aplicada (checklist, construtor e hábitos) */
  checklistOk: boolean
  routines: Routine[]
  runs: Run[]
  habits: Habit[]
  logs: HabitLog[]
}
export const EMPTY: RotinasData = { routinesOk: false, checklistOk: false, routines: [], runs: [], habits: [], logs: [] }

const R_COLS = 'id,template_key,title,description,category,weekdays,scheduled_time,duration_min,assign_mode,essential'
const R_COLS_16 = R_COLS + ',start_date,paused_until,reminder_min,routine_steps(id,position,title,survival,active)'

export async function loadRotinas(householdId: string, runsFrom: string, logsFrom: string): Promise<RotinasData> {
  let r = await supabase.from('routines').select(R_COLS_16).eq('household_id', householdId).eq('active', true).order('scheduled_time', { ascending: true, nullsFirst: false }).limit(100)
  let checklistOk = true
  if (r.error && missingColumn(r.error)) {
    checklistOk = false
    r = await supabase.from('routines').select(R_COLS + ',routine_steps(id,position,title,survival)').eq('household_id', householdId).eq('active', true).order('scheduled_time', { ascending: true, nullsFirst: false }).limit(100) as any
  }
  if (r.error) {
    if (isMissingTable(r.error)) return EMPTY
    must(r, 'carregar rotinas')
  }
  const routines = ((r.data || []) as any[]).map(x => ({ ...x, routine_steps: (x.routine_steps || []).filter((s: any) => s.active !== false).sort((a: any, b: any) => a.position - b.position) })) as Routine[]
  if (!checklistOk) return { ...EMPTY, routinesOk: true, routines }

  const [runs, habits, logs] = await Promise.all([
    supabase.from('routine_runs').select('id,routine_id,date,status,survival,completed_by,routine_step_checks(step_id,done_by)').eq('household_id', householdId).gte('date', runsFrom).limit(500),
    supabase.from('ninho_habits').select('id,title,description,owner,weekdays,weekly_target,paused_until,archived_at').eq('household_id', householdId).is('archived_at', null).order('created_at').limit(50),
    supabase.from('ninho_habit_logs').select('habit_id,date,who').eq('household_id', householdId).gte('date', logsFrom).limit(3000),
  ])
  const e = runs.error || habits.error || logs.error
  if (e) {
    if (isMissingTable(e)) return { ...EMPTY, routinesOk: true, routines }
    must({ data: null, error: e }, 'carregar checklist e hábitos')
  }
  return {
    routinesOk: true, checklistOk: true, routines,
    runs: ((runs.data || []) as any[]).map(x => ({ ...x, checks: x.routine_step_checks || [] })),
    habits: (habits.data || []) as Habit[],
    logs: (logs.data || []) as HabitLog[],
  }
}

export interface RunResult { run_id: string, status: 'open' | 'done', completed_by: Who | null, need?: number, have?: number }

export async function checkStep(routineId: string, stepId: string, date: string, who: Who, done: boolean, survival: boolean): Promise<RunResult> {
  return must(await supabase.rpc('ninho_routine_step', { p_routine_id: routineId, p_step_id: stepId, p_date: date, p_who: who, p_done: done, p_survival: survival }), done ? 'marcar passo' : 'desmarcar passo') as RunResult
}

export async function finishRoutine(routineId: string, date: string, who: Who, done: boolean, survival: boolean): Promise<RunResult> {
  return must(await supabase.rpc('ninho_routine_finish', { p_routine_id: routineId, p_date: date, p_who: who, p_done: done, p_survival: survival }), done ? 'concluir rotina' : 'reabrir rotina') as RunResult
}

// ── Construtor ───────────────────────────────────────────────────────
export interface RoutineDraft {
  id?: string
  title: string
  description: string
  category: string
  weekdays: number[]
  scheduled_time: string | null
  duration_min: number | null
  assign_mode: Routine['assign_mode']
  essential: boolean
  start_date: string | null
  paused_until: string | null
  reminder_min: number | null
  steps: Array<{ id?: string, title: string, survival: boolean }>
}

export async function saveRoutine(householdId: string, who: Who | null, d: RoutineDraft): Promise<string> {
  const row = {
    title: d.title.trim(), description: d.description.trim() || null, category: d.category,
    weekdays: d.weekdays.length === 7 ? null : [...d.weekdays].sort((a, b) => a - b),
    scheduled_time: d.scheduled_time || null, duration_min: d.duration_min, assign_mode: d.assign_mode, essential: d.essential,
    start_date: d.start_date || null, paused_until: d.paused_until || null, reminder_min: d.reminder_min,
  }
  let id = d.id
  if (id) {
    must(await supabase.from('routines').update(row).eq('id', id).select('id'), 'salvar rotina')
  } else {
    const r = must(await supabase.from('routines').insert({ ...row, household_id: householdId, created_by: who }).select('id').single(), 'criar rotina') as { id: string }
    id = r.id
  }
  // Passos: atualiza os existentes (ordem), cria os novos, arquiva os removidos (histórico fica)
  const keep = d.steps.filter(s => s.title.trim())
  const existing = must(await supabase.from('routine_steps').select('id').eq('routine_id', id).eq('active', true), 'carregar passos') as Array<{ id: string }>
  const keptIds = new Set(keep.filter(s => s.id).map(s => s.id))
  const removed = existing.filter(s => !keptIds.has(s.id)).map(s => s.id)
  if (removed.length) must(await supabase.from('routine_steps').update({ active: false }).in('id', removed).select('id'), 'arquivar passos')
  for (let i = 0; i < keep.length; i++) {
    const s = keep[i]
    if (s.id) must(await supabase.from('routine_steps').update({ title: s.title.trim(), survival: s.survival, position: i }).eq('id', s.id).select('id'), 'salvar passo')
    else must(await supabase.from('routine_steps').insert({ routine_id: id, household_id: householdId, title: s.title.trim(), survival: s.survival, position: i }).select('id'), 'criar passo')
  }
  return id!
}

/** Tirar da lista: a rotina fica guardada (inativa) com o histórico. */
export async function archiveRoutine(id: string): Promise<void> {
  must(await supabase.from('routines').update({ active: false }).eq('id', id).select('id'), 'arquivar rotina')
}

/** Cria a rotina de um modelo. Já existe na casa → { created: false } (não duplica). */
export async function addTemplate(householdId: string, who: Who | null, t: Template, essential: boolean): Promise<{ created: boolean }> {
  const ins = await supabase.from('routines').insert({
    household_id: householdId, template_key: t.key, title: t.title, description: t.description, category: t.category,
    weekdays: t.weekdays.length === 7 ? null : t.weekdays, scheduled_time: t.time, duration_min: t.duration, assign_mode: t.assign, essential, created_by: who,
  }).select('id').single()
  if (ins.error?.code === '23505') {
    // Já existe: se estava arquivada, volta para a lista (com os passos e o histórico de antes)
    const re = must(await supabase.from('routines').update({ active: true }).eq('household_id', householdId).eq('template_key', t.key).eq('active', false).select('id'), 'reativar rotina') as any[]
    return { created: re.length > 0 }
  }
  const r = must(ins, 'criar rotina do modelo') as { id: string }
  must(await supabase.from('routine_steps').insert(t.steps.map((s, i) => ({ routine_id: r.id, household_id: householdId, title: s.title, survival: !!s.survival, position: i }))).select('id'), 'criar passos do modelo')
  return { created: true }
}

// ── Hábitos ──────────────────────────────────────────────────────────
export interface HabitDraft { id?: string, title: string, description: string, owner: Habit['owner'], weekdays: number[] | null, weekly_target: number, paused_until: string | null }

export async function saveHabit(householdId: string, who: Who | null, d: HabitDraft): Promise<void> {
  const row = { title: d.title.trim(), description: d.description.trim() || null, owner: d.owner, weekdays: d.weekdays?.length ? [...d.weekdays].sort((a, b) => a - b) : null, weekly_target: d.weekdays?.length ? d.weekdays.length : d.weekly_target, paused_until: d.paused_until || null }
  if (d.id) must(await supabase.from('ninho_habits').update(row).eq('id', d.id).select('id'), 'salvar hábito')
  else must(await supabase.from('ninho_habits').insert({ ...row, household_id: householdId, created_by: who }).select('id'), 'criar hábito')
}

/** Abandonar: sai da lista, o histórico continua guardado. */
export async function archiveHabit(id: string): Promise<void> {
  must(await supabase.from('ninho_habits').update({ archived_at: new Date().toISOString() }).eq('id', id).select('id'), 'abandonar hábito')
}

export async function logHabit(householdId: string, habitId: string, date: string, who: Who, done: boolean): Promise<void> {
  if (done) {
    const r = await supabase.from('ninho_habit_logs').insert({ habit_id: habitId, household_id: householdId, date, who }).select('habit_id')
    if (r.error && r.error.code !== '23505') must(r, 'registrar hábito')
  } else {
    must(await supabase.from('ninho_habit_logs').delete().eq('habit_id', habitId).eq('date', date).select('habit_id'), 'desfazer registro do hábito')
  }
}
