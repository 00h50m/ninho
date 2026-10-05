// Tipos do domínio do Ninho. Espelham as colunas lidas do Supabase
// (ver supabase/migrations) mais os campos calculados no app.

/** Pessoa da casa: 'g' = Giovanna, 's' = Sabrina. */
export type Who = 'g' | 's'
export type Names = Record<Who, string>
export type Weight = 'light' | 'medium' | 'heavy'
export type Energy = 'high' | 'medium' | 'low'

/** Campos calculados a partir das conclusões (não existem na tabela). */
export interface CompletionState {
  completed_today?: boolean
  /** Quem concluiu hoje. null = registro antigo sem autoria ("não identificado"). */
  completed_by_today?: Who | null
  /** Última conclusão antes de hoje (YYYY-MM-DD). */
  prev_done?: string | null
  /** id da conclusão de hoje no banco (para reconhecer exclusões vindas do Realtime) */
  completion_id?: string | null
  /** Conclusões ANTES de hoje (mais recente primeiro), usadas pela divisão inteligente. */
  hist?: HistEntry[]
}

/** Uma conclusão anterior: data e quem fez (null = registro antigo sem autoria). */
export interface HistEntry { d: string, by: Who | null }

export interface Task extends CompletionState {
  id: string
  household_id?: string
  title: string
  category: string
  weight: Weight
  frequency: string
  /** Responsável planejada: 'g' | 's' fixa, ou null = rodízio. */
  assigned_to: string | null
  scheduled_time: string | null
  essential: boolean
  active: boolean
}

export interface DogRoutine extends CompletionState {
  id: string
  dog_id?: string
  household_id?: string | null
  title: string
  frequency: string
  scheduled_time: string | null
  active?: boolean
}

export interface Dog {
  id: string
  household_id?: string
  name: string
  breed: string | null
  is_puppy: boolean
  active?: boolean
  routines: DogRoutine[]
}

export interface Settings { energy: Energy; survival: boolean; bet?: string | null }

export interface Meeting {
  what_worked: string; what_overloaded: string; adjustments: string; priorities: string
  mood_g: string; mood_s: string; wins: string; next_mode: string; reward: string
}

export interface Accident {
  id: string
  dog_id: string
  household_id: string
  location: string
  date: string
  occurred_at: string
}

export interface HistoryWeek {
  week: string
  completions: number
  meeting: (Meeting & { week_start: string }) | null
}

/** Linha de conclusão lida do banco (task_completions ou dog_completions). */
export interface CompletionRow {
  id?: string
  date: string
  completed_by?: string | null
  task_id?: string
  routine_id?: string
}

/** Qualquer coisa que pode ser concluída e tem frequência. */
export type Doable = { frequency: string } & CompletionState

/** Rotinas iguais de cães diferentes viram um item só em Hoje. */
export interface DogItem {
  key: string
  title: string
  frequency: string
  scheduled_time: string | null
  completed_today: boolean
  owner: Who
  parts: Array<{ r: DogRoutine; dog: Dog }>
}

/** Item da tela Hoje: uma tarefa ou um grupo de rotinas dos cães. */
export interface HItem {
  id: string
  frequency: string
  scheduled_time: string | null
  completed_today?: boolean
  essential: boolean
  category: string
  task?: Task
  dog?: DogItem
}
