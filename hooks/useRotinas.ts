'use client'
// Rotinas, ocorrências do dia e hábitos, com tempo real e atualização otimista
// (volta atrás se o banco recusar).
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import { addDays } from '@/lib/dates'
import * as api from '@/lib/services/rotinas'
import type { Who } from '@/lib/types'
import type { Run } from '@/lib/rotinas'

export function useRotinas(householdId: string, today: string) {
  const [data, setData] = useState<api.RotinasData>(api.EMPTY)
  const [ready, setReady] = useState(false)
  const runsFrom = addDays(today, -13), logsFrom = addDays(today, -120)
  const reload = useCallback(async () => {
    try { setData(await api.loadRotinas(householdId, runsFrom, logsFrom)) } catch (e) { logError('carregar rotinas', e) } finally { setReady(true) }
  }, [householdId, runsFrom, logsFrom])
  useEffect(() => { reload() }, [reload])

  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!data.routinesOk) return
    const later = () => { clearTimeout(timer.current); timer.current = setTimeout(() => { reload() }, 300) }
    const f = `household_id=eq.${householdId}`
    const ch = supabase.channel(`ninho-rotinas:${householdId}`)
    for (const t of ['routines', 'routine_steps', 'routine_runs', 'routine_step_checks', 'ninho_habits', 'ninho_habit_logs'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: f }, later)
    // DELETE não aceita filtro
    for (const t of ['routine_step_checks', 'ninho_habit_logs']) ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, later)
    ch.subscribe()
    return () => { clearTimeout(timer.current); supabase.removeChannel(ch) }
  }, [householdId, data.routinesOk, reload])

  /** Aplica a mudança na hora; se o banco recusar, desfaz e repassa o erro. */
  async function optimistic(change: (d: api.RotinasData) => api.RotinasData, run: () => Promise<unknown>) {
    const before = data
    setData(change)
    try { await run() } catch (e) { setData(before); throw e }
    reload()
  }

  const upsertRun = (d: api.RotinasData, routineId: string, date: string, f: (r: Run) => Run): api.RotinasData => {
    const cur = d.runs.find(r => r.routine_id === routineId && r.date === date) || { id: 'tmp', routine_id: routineId, date, status: 'open' as const, survival: false, completed_by: null, checks: [] }
    return { ...d, runs: [...d.runs.filter(r => r !== cur), f(cur)] }
  }

  const checkStep = (routineId: string, stepId: string, who: Who, done: boolean, survival: boolean) =>
    optimistic(d => upsertRun(d, routineId, today, r => ({ ...r, checks: done ? [...r.checks.filter(c => c.step_id !== stepId), { step_id: stepId, done_by: who }] : r.checks.filter(c => c.step_id !== stepId) })),
      () => api.checkStep(routineId, stepId, today, who, done, survival))

  const finish = (routineId: string, who: Who, done: boolean, survival: boolean, stepIds: string[]) =>
    optimistic(d => upsertRun(d, routineId, today, r => ({
      ...r, status: done ? 'done' : 'open', completed_by: done ? who : null,
      checks: done ? [...r.checks, ...stepIds.filter(id => !r.checks.some(c => c.step_id === id)).map(id => ({ step_id: id, done_by: who }))] : r.checks,
    })), () => api.finishRoutine(routineId, today, who, done, survival))

  const logHabit = (habitId: string, who: Who, done: boolean, date = today) =>
    optimistic(d => ({ ...d, logs: done ? [...d.logs.filter(l => !(l.habit_id === habitId && l.date === date)), { habit_id: habitId, date, who }] : d.logs.filter(l => !(l.habit_id === habitId && l.date === date)) }),
      () => api.logHabit(householdId, habitId, date, who, done))

  return { ...data, ready, reload, checkStep, finish, logHabit }
}
