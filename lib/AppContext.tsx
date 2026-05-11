'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getTodayString, getWeekStart } from '@/lib/utils'

interface Profile {
  id: string
  name: string
  avatar_color: string
  household_id: string
}

interface Task {
  id: string
  title: string
  category: string
  weight: 'light' | 'medium' | 'heavy'
  frequency: string
  assigned_to: string | null
  scheduled_time: string | null
  xp_value: number
  active: boolean
  completed_today: boolean
  completed_by_me: boolean
}

interface Dog {
  id: string
  name: string
  is_puppy: boolean
  routines: DogRoutine[]
}

interface DogRoutine {
  id: string
  dog_id: string
  title: string
  frequency: string
  scheduled_time: string | null
  assigned_to: string | null
  completed_today: boolean
}

interface AppState {
  profile: Profile | null
  partner: Profile | null
  householdId: string | null
  tasks: Task[]
  dogs: Dog[]
  totalXP: number
  chaosLevel: number
  energyLevel: 'high' | 'medium' | 'low'
  isSurvivalMode: boolean
  loading: boolean
  refreshAll: () => Promise<void>
  completeTask: (taskId: string) => Promise<void>
  uncompleteTask: (taskId: string) => Promise<void>
  completeDogRoutine: (routineId: string, dogId: string) => Promise<void>
  setEnergy: (level: 'high' | 'medium' | 'low') => Promise<void>
  toggleSurvivalMode: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}

export function AppProvider({ children, userId }: { children: React.ReactNode; userId: string }) {
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [partner, setPartner]         = useState<Profile | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [tasks, setTasks]             = useState<Task[]>([])
  const [dogs, setDogs]               = useState<Dog[]>([])
  const [totalXP, setTotalXP]         = useState(0)
  const [chaosLevel, setChaosLevel]   = useState(0)
  const [energyLevel, setEnergyLevel] = useState<'high'|'medium'|'low'>('medium')
  const [isSurvivalMode, setIsSurvivalMode] = useState(false)
  const [loading, setLoading]         = useState(true)

  const today     = getTodayString()
  const weekStart = getWeekStart()

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      setProfile(data)
      setHouseholdId(data.household_id)
      return data.household_id as string
    }
    return null
  }, [userId])

  const loadPartner = useCallback(async (hid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('household_id', hid)
      .neq('id', userId)
      .single()
    if (data) setPartner(data)
  }, [userId])

  const loadTasks = useCallback(async (hid: string) => {
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('household_id', hid)
      .eq('active', true)
      .order('category')

    const { data: completions } = await supabase
      .from('task_completions')
      .select('task_id, completed_by')
      .eq('household_id', hid)
      .eq('date', today)

    const completedIds    = new Set(completions?.map(c => c.task_id) ?? [])
    const completedByMe   = new Set(completions?.filter(c => c.completed_by === userId).map(c => c.task_id) ?? [])

    setTasks((tasksData ?? []).map(t => ({
      ...t,
      completed_today: completedIds.has(t.id),
      completed_by_me: completedByMe.has(t.id),
    })))
  }, [today, userId])

  const loadDogs = useCallback(async (hid: string) => {
    const { data: dogsData } = await supabase
      .from('dogs')
      .select('*, dog_routines(*)')
      .eq('household_id', hid)
      .eq('active', true)

    const { data: completions } = await supabase
      .from('dog_routine_completions')
      .select('routine_id')
      .eq('date', today)

    const completedRoutines = new Set(completions?.map(c => c.routine_id) ?? [])

    setDogs((dogsData ?? []).map((dog: any) => ({
      ...dog,
      routines: (dog.dog_routines ?? []).map((r: any) => ({
        ...r,
        completed_today: completedRoutines.has(r.id),
      }))
    })))
  }, [today])

  const loadXP = useCallback(async (hid: string) => {
    const { data } = await supabase
      .rpc('household_xp', { hid })
    setTotalXP(data ?? 0)
  }, [])

  const loadChaos = useCallback(async (hid: string) => {
    const { data } = await supabase
      .rpc('household_chaos', { hid })
    setChaosLevel(data ?? 0)
  }, [])

  const loadEnergy = useCallback(async (hid: string) => {
    const { data } = await supabase
      .from('weekly_energy')
      .select('energy_level')
      .eq('profile_id', userId)
      .eq('household_id', hid)
      .eq('week_start', weekStart)
      .single()
    if (data) setEnergyLevel(data.energy_level as any)
  }, [userId, weekStart])

  const loadSurvival = useCallback(async (hid: string) => {
    const { data } = await supabase
      .from('survival_weeks')
      .select('id')
      .eq('household_id', hid)
      .eq('week_start', weekStart)
      .single()
    setIsSurvivalMode(!!data)
  }, [weekStart])

  const refreshAll = useCallback(async () => {
    const hid = householdId
    if (!hid) return
    await Promise.all([
      loadTasks(hid),
      loadDogs(hid),
      loadXP(hid),
      loadChaos(hid),
      loadEnergy(hid),
      loadSurvival(hid),
    ])
  }, [householdId, loadTasks, loadDogs, loadXP, loadChaos, loadEnergy, loadSurvival])

  // boot
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const hid = await loadProfile()
      if (!hid) { setLoading(false); return }
      await Promise.all([
        loadPartner(hid),
        loadTasks(hid),
        loadDogs(hid),
        loadXP(hid),
        loadChaos(hid),
        loadEnergy(hid),
        loadSurvival(hid),
      ])
      setLoading(false)
    }
    init()
  }, [loadProfile, loadPartner, loadTasks, loadDogs, loadXP, loadChaos, loadEnergy, loadSurvival])

  // realtime
  useEffect(() => {
    if (!householdId) return
    const channel = supabase
      .channel('ninho-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, () => {
        loadTasks(householdId)
        loadXP(householdId)
        loadChaos(householdId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dog_routine_completions' }, () => {
        loadDogs(householdId)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [householdId, loadTasks, loadXP, loadChaos, loadDogs])

  const completeTask = useCallback(async (taskId: string) => {
    if (!householdId) return
    await supabase.from('task_completions').insert({
      task_id: taskId,
      completed_by: userId,
      household_id: householdId,
      date: today,
    })
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed_today: true, completed_by_me: true } : t
    ))
    const task = tasks.find(t => t.id === taskId)
    if (task) setTotalXP(prev => prev + task.xp_value)
    setChaosLevel(prev => Math.max(0, prev - 4))
  }, [householdId, userId, today, tasks])

  const uncompleteTask = useCallback(async (taskId: string) => {
    if (!householdId) return
    await supabase
      .from('task_completions')
      .delete()
      .eq('task_id', taskId)
      .eq('completed_by', userId)
      .eq('date', today)
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed_today: false, completed_by_me: false } : t
    ))
    const task = tasks.find(t => t.id === taskId)
    if (task) setTotalXP(prev => Math.max(0, prev - task.xp_value))
    setChaosLevel(prev => Math.min(100, prev + 4))
  }, [householdId, userId, today, tasks])

  const completeDogRoutine = useCallback(async (routineId: string, dogId: string) => {
    await supabase.from('dog_routine_completions').insert({
      routine_id: routineId,
      completed_by: userId,
      date: today,
    })
    setDogs(prev => prev.map(dog =>
      dog.id === dogId ? {
        ...dog,
        routines: dog.routines.map(r =>
          r.id === routineId ? { ...r, completed_today: true } : r
        )
      } : dog
    ))
    setTotalXP(prev => prev + 1)
  }, [userId, today])

  const setEnergy = useCallback(async (level: 'high'|'medium'|'low') => {
    if (!householdId) return
    await supabase.from('weekly_energy').upsert({
      profile_id: userId,
      household_id: householdId,
      week_start: weekStart,
      energy_level: level,
    }, { onConflict: 'profile_id,week_start' })
    setEnergyLevel(level)
  }, [householdId, userId, weekStart])

  const toggleSurvivalMode = useCallback(async () => {
    if (!householdId) return
    if (isSurvivalMode) {
      await supabase.from('survival_weeks').delete()
        .eq('household_id', householdId).eq('week_start', weekStart)
      setIsSurvivalMode(false)
    } else {
      await supabase.from('survival_weeks').insert({
        household_id: householdId,
        week_start: weekStart,
        activated_by: userId,
      })
      setIsSurvivalMode(true)
    }
  }, [householdId, isSurvivalMode, weekStart, userId])

  return (
    <AppContext.Provider value={{
      profile, partner, householdId,
      tasks, dogs, totalXP, chaosLevel,
      energyLevel, isSurvivalMode, loading,
      refreshAll, completeTask, uncompleteTask,
      completeDogRoutine, setEnergy, toggleSurvivalMode,
    }}>
      {children}
    </AppContext.Provider>
  )
}
