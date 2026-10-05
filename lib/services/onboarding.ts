// Configuração inicial e rotinas (migration 014). Sem a migration aplicada,
// tudo responde "indisponível" e o app segue como antes.
import { supabase } from '@/lib/supabase'
import { NinhoError, isMissingTable, logError } from '@/lib/errors'
import type { Who } from '@/lib/types'
import type { AssignMode } from '@/lib/onboarding'

export interface SetupState {
  /** false = migration 014 ainda não aplicada no Supabase */
  available: boolean
  completed: boolean
  answers: Record<string, unknown> | null
  progress: { step: number, answers: Record<string, unknown>, skipped_at: string | null } | null
}

export interface RoutineRow {
  id: string
  template_key: string | null
  title: string
  description: string | null
  category: string
  weekdays: number[] | null
  scheduled_time: string | null
  duration_min: number | null
  assign_mode: AssignMode
  essential: boolean
  routine_steps: Array<{ id: string, position: number, title: string, survival: boolean }>
}

export const UNAVAILABLE: SetupState = { available: false, completed: false, answers: null, progress: null }

export async function loadSetup(householdId: string, who: Who): Promise<SetupState> {
  const [setup, prog] = await Promise.all([
    supabase.from('household_setup').select('answers,completed_at').eq('household_id', householdId).maybeSingle(),
    supabase.from('onboarding_progress').select('step,answers,skipped_at').eq('household_id', householdId).eq('who', who).maybeSingle(),
  ])
  if (setup.error || prog.error) {
    const e = setup.error || prog.error
    if (isMissingTable(e)) return UNAVAILABLE
    logError('carregar configuração', e)
    throw new NinhoError(e, 'carregar configuração')
  }
  return {
    available: true,
    completed: !!(setup.data as any)?.completed_at,
    answers: ((setup.data as any)?.answers as Record<string, unknown>) || null,
    progress: (prog.data as SetupState['progress']) || null,
  }
}

/** Guarda o rascunho (etapa e respostas). skipped = pausou/pulou: não abre sozinho de novo. */
export async function saveProgress(householdId: string, who: Who, step: number, answers: unknown, skipped = false): Promise<void> {
  const { error } = await supabase.from('onboarding_progress').upsert(
    { household_id: householdId, who, step, answers, skipped_at: skipped ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
    { onConflict: 'household_id,who' })
  if (error) { logError('guardar progresso da configuração', error); throw new NinhoError(error, 'guardar progresso da configuração') }
}

export interface FinishResult { routines_created: number, routines_existing: number, essentials_marked: number, dogs_created: number }

export async function finishOnboarding(householdId: string, who: Who, payload: unknown): Promise<FinishResult> {
  const { data, error } = await supabase.rpc('ninho_finish_onboarding', { p_household_id: householdId, p_who: who, p_payload: payload })
  if (error) { logError('concluir configuração', error); throw new NinhoError(error, 'concluir configuração') }
  return data as FinishResult
}

/** Rotinas da casa com os passos em ordem. [] se a migration não foi aplicada. */
export async function loadRoutines(householdId: string): Promise<RoutineRow[]> {
  const { data, error } = await supabase.from('routines')
    .select('id,template_key,title,description,category,weekdays,scheduled_time,duration_min,assign_mode,essential,routine_steps(id,position,title,survival)')
    .eq('household_id', householdId).eq('active', true).order('scheduled_time', { ascending: true, nullsFirst: false }).limit(100)
  if (error) {
    if (isMissingTable(error)) return []
    logError('carregar rotinas', error)
    throw new NinhoError(error, 'carregar rotinas')
  }
  return ((data || []) as RoutineRow[]).map(r => ({ ...r, routine_steps: [...(r.routine_steps || [])].sort((a, b) => a.position - b.position) }))
}
