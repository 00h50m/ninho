export type Who = 'g' | 's'

export type Names = Record<Who, string>

export type TaskWeight = 'light' | 'medium' | 'heavy'

export type TaskRecurrence =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'interval_days'
  | 'after_completion'
  | 'once'

export type TaskOccurrenceStatus = 'pending' | 'completed' | 'postponed' | 'skipped' | 'cancelled'

export interface Task {
  id: string
  household_id?: string
  title: string
  category: string
  weight: TaskWeight
  frequency: string
  recurrence_type?: TaskRecurrence
  recurrence_interval?: number
  recurrence_weekdays?: number[]
  recurrence_day_of_month?: number | null
  starts_on?: string
  ends_on?: string | null
  paused_until?: string | null
  assigned_to: string | null
  scheduled_time: string | null
  essential: boolean
  active: boolean
  completed_today?: boolean
  occurrence_id?: string
  occurrence_status?: TaskOccurrenceStatus
  original_scheduled_date?: string
  occurrence_date?: string
  completed_by?: Who | null
  completed_at?: string | null
  resolution_reason?: string | null
  is_overdue?: boolean
}

export interface DogRoutine {
  id: string
  dog_id?: string
  household_id?: string
  title: string
  frequency: string
  scheduled_time: string | null
  active?: boolean
  completed_today?: boolean
}

export interface Dog {
  id: string
  household_id?: string
  name: string
  breed: string | null
  is_puppy: boolean
  routines: DogRoutine[]
}

export interface Settings {
  energy: 'high' | 'medium' | 'low'
  survival: boolean
}

export interface Meeting {
  what_worked: string
  what_overloaded: string
  adjustments: string
  priorities: string
  mood_g: string
  mood_s: string
  wins: string
  next_mode: string
  reward: string
}

export interface PuppyAccident {
  id: string
  dog_id: string
  household_id: string
  location: string
  date: string
  occurred_at: string
}

export interface WeekHistory {
  week: string
  completions: number
  meeting: (Meeting & { week_start: string }) | null
}
