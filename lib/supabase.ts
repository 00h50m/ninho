import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  profiles: {
    id: string
    household_id: string
    name: string
    avatar_color: string
    role: string
    created_at: string
  }
  households: {
    id: string
    name: string
    created_at: string
  }
  tasks: {
    id: string
    household_id: string
    title: string
    category: string
    weight: 'light' | 'medium' | 'heavy'
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once'
    assigned_to: string | null
    scheduled_time: string | null
    xp_value: number
    active: boolean
    created_at: string
  }
  task_completions: {
    id: string
    task_id: string
    completed_by: string
    household_id: string
    completed_at: string
    date: string
  }
  dogs: {
    id: string
    household_id: string
    name: string
    breed: string | null
    birth_date: string | null
    is_puppy: boolean
    avatar: string | null
    created_at: string
  }
  dog_routines: {
    id: string
    dog_id: string
    title: string
    frequency: string
    scheduled_time: string | null
    assigned_to: string | null
    active: boolean
  }
  dog_routine_completions: {
    id: string
    routine_id: string
    completed_by: string
    completed_at: string
    date: string
  }
  weekly_energy: {
    id: string
    profile_id: string
    household_id: string
    week_start: string
    energy_level: 'high' | 'medium' | 'low'
  }
}
