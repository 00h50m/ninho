import { supabase } from '@/lib/supabase'
import { reportError, throwIfError } from '@/lib/errors'
import type {
  Dog,
  DogRoutine,
  Meeting,
  Names,
  PuppyAccident,
  Settings,
  Task,
  WeekHistory,
  Who,
} from '@/types/ninho'

export interface NinhoSnapshot {
  tasks: Task[]
  dogs: Dog[]
  settings: Settings
  xp: number
  streak: number
  names: Names
  accidents: PuppyAccident[]
}

export async function loadNinhoSnapshot(
  householdId: string,
  today: string,
  weekStart: string,
): Promise<NinhoSnapshot> {
  const [tasks, dogs, settings, taskCompletions, dogCompletions, xp, streak, profiles, accidents] =
    await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('household_id', householdId)
        .eq('active', true)
        .order('essential', { ascending: false })
        .order('category'),
      supabase
        .from('dogs')
        .select('*,dog_routines(*)')
        .eq('household_id', householdId)
        .eq('active', true),
      supabase
        .from('weekly_settings')
        .select('*')
        .eq('household_id', householdId)
        .eq('week_start', weekStart)
        .maybeSingle(),
      supabase
        .from('task_completions')
        .select('task_id')
        .eq('household_id', householdId)
        .eq('date', today),
      supabase
        .from('dog_completions')
        .select('routine_id')
        .eq('household_id', householdId)
        .eq('date', today),
      supabase.rpc('get_household_xp', { hid: householdId }),
      supabase.rpc('get_streak', { hid: householdId }),
      supabase
        .from('profiles')
        .select('display_name,role')
        .eq('household_id', householdId),
      supabase
        .from('puppy_accidents')
        .select('*')
        .eq('household_id', householdId)
        .order('occurred_at', { ascending: false })
        .limit(20),
    ])

  ;[
    ['carregar tarefas', tasks.error],
    ['carregar cães', dogs.error],
    ['carregar configuração semanal', settings.error],
    ['carregar conclusões de tarefas', taskCompletions.error],
    ['carregar conclusões dos cães', dogCompletions.error],
    ['carregar XP', xp.error],
    ['carregar sequência', streak.error],
    ['carregar integrantes', profiles.error],
    ['carregar acidentes', accidents.error],
  ].forEach(([context, error]) => throwIfError(String(context), error))

  const completedTaskIds = new Set((taskCompletions.data || []).map((item: any) => item.task_id))
  const completedDogIds = new Set((dogCompletions.data || []).map((item: any) => item.routine_id))
  const profileRows = profiles.data || []
  const giovanna = profileRows.find((profile: any) => profile.role === 'g')
  const sabrina = profileRows.find((profile: any) => profile.role === 's')

  return {
    tasks: (tasks.data || []).map((task: any) => ({
      ...task,
      completed_today: completedTaskIds.has(task.id),
    })),
    dogs: (dogs.data || []).map((dog: any) => ({
      ...dog,
      routines: (dog.dog_routines || []).map((routine: any) => ({
        ...routine,
        completed_today: completedDogIds.has(routine.id),
      })),
    })),
    settings: settings.data
      ? { energy: settings.data.energy, survival: settings.data.survival }
      : { energy: 'medium', survival: false },
    xp: Number(xp.data || 0),
    streak: Number(streak.data || 0),
    accidents: (accidents.data || []) as PuppyAccident[],
    names: {
      g: giovanna?.display_name || 'Giovanna',
      s: sabrina?.display_name || 'Sabrina',
    },
  }
}

export async function loadWeekHistory(householdId: string, weeks: string[]) {
  return Promise.all(
    weeks.map(async (weekStart): Promise<WeekHistory> => {
      const end = new Date(`${weekStart}T12:00:00.000Z`)
      end.setUTCDate(end.getUTCDate() + 6)
      const endDate = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`

      const [completions, meeting] = await Promise.all([
        supabase
          .from('task_completions')
          .select('task_id,date')
          .eq('household_id', householdId)
          .gte('date', weekStart)
          .lte('date', endDate),
        supabase
          .from('weekly_meetings')
          .select('*')
          .eq('household_id', householdId)
          .eq('week_start', weekStart)
          .maybeSingle(),
      ])

      throwIfError('carregar histórico de conclusões', completions.error)
      throwIfError('carregar reunião semanal', meeting.error)

      return {
        week: weekStart,
        completions: (completions.data || []).length,
        meeting: meeting.data as WeekHistory['meeting'],
      }
    }),
  )
}

export async function setTaskCompletion(input: {
  householdId: string
  taskId: string
  date: string
  completed: boolean
  completedBy?: Who | null
}) {
  const result = await supabase.rpc('set_task_completion', {
    p_household_id: input.householdId,
    p_task_id: input.taskId,
    p_date: input.date,
    p_completed: input.completed,
    p_completed_by: input.completedBy || null,
  })
  throwIfError('atualizar conclusão da tarefa', result.error)
  return result.data
}

export async function setDogRoutineCompletion(input: {
  householdId: string
  routineId: string
  date: string
  completed: boolean
  completedBy?: Who | null
}) {
  const result = await supabase.rpc('set_dog_completion', {
    p_household_id: input.householdId,
    p_routine_id: input.routineId,
    p_date: input.date,
    p_completed: input.completed,
    p_completed_by: input.completedBy || null,
  })
  throwIfError('atualizar rotina do cão', result.error)
  return result.data
}

export async function updateTaskAssignment(householdId: string, taskId: string, assignedTo: string | null) {
  const result = await supabase
    .from('tasks')
    .update({ assigned_to: assignedTo })
    .eq('id', taskId)
    .eq('household_id', householdId)
    .select('id')
    .single()
  throwIfError('alterar responsável', result.error)
}

export async function deactivateTask(householdId: string, taskId: string) {
  const result = await supabase
    .from('tasks')
    .update({ active: false })
    .eq('id', taskId)
    .eq('household_id', householdId)
    .select('id')
    .single()
  throwIfError('remover tarefa', result.error)
}

export async function persistTask(householdId: string, data: Partial<Task>, taskId?: string) {
  if (taskId) {
    const result = await supabase
      .from('tasks')
      .update(data)
      .eq('id', taskId)
      .eq('household_id', householdId)
      .select('id')
      .single()
    throwIfError('salvar tarefa', result.error)
    return
  }

  const result = await supabase
    .from('tasks')
    .insert({ ...data, household_id: householdId, active: true })
    .select('id')
    .single()
  throwIfError('criar tarefa', result.error)
}

export async function insertTasks(householdId: string, tasks: Array<Partial<Task>>) {
  if (!tasks.length) return
  const result = await supabase
    .from('tasks')
    .insert(tasks.map((task) => ({ ...task, household_id: householdId, active: true })))
  throwIfError('adicionar sugestões', result.error)
}

export async function createPet(
  householdId: string,
  data: Record<string, unknown>,
  routines: Array<Record<string, unknown>>,
) {
  const dogResult = await supabase
    .from('dogs')
    .insert({ ...data, household_id: householdId, active: true })
    .select('id')
    .single()
  throwIfError('cadastrar cão', dogResult.error)

  const dogId = dogResult.data.id
  if (!routines.length) return

  const routinesResult = await supabase.from('dog_routines').insert(
    routines.map((routine) => ({
      ...routine,
      dog_id: dogId,
      household_id: householdId,
      active: true,
    })),
  )

  if (routinesResult.error) {
    const rollback = await supabase
      .from('dogs')
      .delete()
      .eq('id', dogId)
      .eq('household_id', householdId)
    if (rollback.error) reportError('rollback do cadastro do cão', rollback.error)
    throwIfError('cadastrar rotinas do cão', routinesResult.error)
  }
}

export async function saveWeeklySettings(
  householdId: string,
  weekStart: string,
  settings: Settings,
) {
  const result = await supabase.from('weekly_settings').upsert(
    { household_id: householdId, week_start: weekStart, ...settings },
    { onConflict: 'household_id,week_start' },
  )
  throwIfError('salvar configuração semanal', result.error)
}

export async function saveProfileName(householdId: string, role: Who, displayName: string) {
  const result = await supabase
    .from('profiles')
    .update({ display_name: displayName, name: displayName })
    .eq('household_id', householdId)
    .eq('role', role)
    .select('id')
  throwIfError('atualizar nome', result.error)
  if (!result.data?.length) throw new Error('Integrante não encontrada.')
}

export async function persistMeeting(
  householdId: string,
  weekStart: string,
  meeting: Meeting,
) {
  const result = await supabase.from('weekly_meetings').upsert(
    { household_id: householdId, week_start: weekStart, ...meeting },
    { onConflict: 'household_id,week_start' },
  )
  throwIfError('salvar reunião semanal', result.error)
}

export async function createPuppyAccident(
  householdId: string,
  dogId: string,
  location: string,
  date: string,
) {
  const result = await supabase.from('puppy_accidents').insert({
    dog_id: dogId,
    household_id: householdId,
    location,
    date,
  })
  throwIfError('registrar acidente', result.error)
}

export async function applyTaskDistribution(
  householdId: string,
  assignments: Array<{ id: string; assigned_to: Who }>,
) {
  const result = await supabase.rpc('apply_task_assignments', {
    p_household_id: householdId,
    p_assignments: assignments,
  })
  throwIfError('distribuir tarefas', result.error)
}

export function subscribeToHouseholdChanges(
  householdId: string,
  onChange: () => void,
  onError: (error: unknown) => void,
) {
  const filter = `household_id=eq.${householdId}`
  const channel = supabase
    .channel(`ninho:${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dog_completions', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dogs', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'xp_history', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_settings', filter }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'puppy_accidents', filter }, onChange)
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError(error || new Error(status))
    })

  return () => {
    void supabase.removeChannel(channel)
  }
}

export type { DogRoutine }

