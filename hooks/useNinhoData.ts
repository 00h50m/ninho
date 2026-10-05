'use client'
// Dados da casa + Realtime.
// · Carrega tudo uma vez (e de novo quando o dia ou a semana viram).
// · O Realtime escuta só a casa atual (filtro household_id) e atualiza
//   apenas o pedaço que mudou, em vez de recarregar o app inteiro.
// · Exclusões (DELETE) não podem ser filtradas pelo Supabase: são aceitas só
//   quando o id da conclusão é conhecido nesta casa.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import * as api from '@/lib/services/ninho'
import { summarizeCompletions } from '@/lib/completions'
import { isWho } from '@/lib/rotation'
import { byTime } from '@/lib/today'
import { DEFAULT_NAMES } from '@/lib/constants'
import { logError, toNinhoError, type NinhoError } from '@/lib/errors'
import type { Accident, CompletionRow, Dog, Names, Settings, Task } from '@/lib/types'

type Status = 'loading' | 'ready' | 'error'
type Row = Record<string, any>

function buildTasks(rows: Row[], comps: CompletionRow[], today: string): Task[] {
  const info = summarizeCompletions(comps, 'task_id', today)
  return rows.map(t => ({ ...(t as Task), ...info(t.id) }))
}

function buildDogs(rows: Row[], comps: CompletionRow[], today: string): Dog[] {
  const info = summarizeCompletions(comps, 'routine_id', today)
  return rows.map(d => ({
    ...(d as Dog),
    routines: (d.dog_routines || [])
      .filter((r: Row) => r.active !== false)
      .map((r: Row) => ({ ...r, ...info(r.id) }))
      .sort((a: Row, b: Row) => Number(a.frequency !== 'daily') - Number(b.frequency !== 'daily') || byTime(a as any, b as any)),
  }))
}

export function useNinhoData(householdId: string, today: string, weekStart: string, onError: (e: NinhoError) => void) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [dogs, setDogs] = useState<Dog[]>([])
  const [settings, setSettings] = useState<Settings>({ energy: 'medium', survival: false })
  const [xp, setXp] = useState(0)
  const [streak, setStreak] = useState(0)
  const [names, setNames] = useState<Names>(DEFAULT_NAMES)
  const [accidents, setAccidents] = useState<Accident[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [loadError, setLoadError] = useState<NinhoError | null>(null)

  // Valores atuais para os handlers do Realtime (que vivem mais que um render)
  const ctx = useRef({ today, weekStart, onError })
  ctx.current = { today, weekStart, onError }
  const loaded = useRef(false)
  /** id da conclusão → item e data (para reconhecer DELETE do Realtime) */
  const completionIndex = useRef(new Map<string, { kind: 'task' | 'dog', itemId: string, date: string }>())

  const indexCompletions = (kind: 'task' | 'dog', rows: CompletionRow[]) => {
    for (const k of Array.from(completionIndex.current.keys())) if (completionIndex.current.get(k)!.kind === kind) completionIndex.current.delete(k)
    rows.forEach(c => { if (c.id) completionIndex.current.set(c.id, { kind, itemId: (c.task_id || c.routine_id)!, date: c.date }) })
  }

  const reloadTasks = useCallback(async () => {
    const r = await api.loadTasks(householdId, ctx.current.today)
    indexCompletions('task', r.completions)
    setTasks(buildTasks(r.tasks, r.completions, ctx.current.today))
  }, [householdId])

  const reloadDogs = useCallback(async () => {
    const r = await api.loadDogs(householdId, ctx.current.today)
    indexCompletions('dog', r.completions)
    setDogs(buildDogs(r.dogs, r.completions, ctx.current.today))
  }, [householdId])

  const refreshStats = useCallback(async () => {
    const s = await api.loadStats(householdId, ctx.current.today)
    setXp(s.xp); setStreak(s.streak)
  }, [householdId])

  const reloadNames = useCallback(async () => {
    const n = await api.loadNames(householdId)
    if (n) setNames(n)
  }, [householdId])

  const reloadAccidents = useCallback(async () => {
    setAccidents(await api.loadAccidents(householdId))
  }, [householdId])

  const reloadSettings = useCallback(async () => {
    const s = await api.loadSettings(householdId, ctx.current.weekStart)
    setSettings(s || { energy: 'medium', survival: false })
  }, [householdId])

  const loadAll = useCallback(async () => {
    if (!loaded.current) setStatus('loading')
    try {
      await Promise.all([reloadTasks(), reloadDogs(), refreshStats(), reloadNames(), reloadAccidents(), reloadSettings()])
      loaded.current = true
      setLoadError(null)
      setStatus('ready')
    } catch (e) {
      const err = toNinhoError(e, 'carregar a casa')
      if (!loaded.current) { setLoadError(err); setStatus('error') }
      else ctx.current.onError(err)
    }
  }, [reloadTasks, reloadDogs, refreshStats, reloadNames, reloadAccidents, reloadSettings])

  // Recarrega quando o dia ou a semana viram
  useEffect(() => { loadAll() }, [loadAll, today, weekStart])

  // ── Realtime ────────────────────────────────────────────────────────
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const later = useCallback((key: string, fn: () => Promise<void>, ms = 300) => {
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => {
      fn().catch(e => logError(`realtime:${key}`, e))
    }, ms)
  }, [])

  const handlers = useRef<Record<string, (p: RealtimePostgresChangesPayload<Row>) => void>>({})
  handlers.current = {
    completion: (p) => {
      const kind: 'task' | 'dog' = (p.table === 'task_completions') ? 'task' : 'dog'
      const reload = kind === 'task' ? reloadTasks : reloadDogs
      if (p.eventType === 'DELETE') {
        const id = (p.old as Row)?.id
        const info = id && completionIndex.current.get(id)
        if (!info) return // exclusão de outra casa (ou já tratada)
        completionIndex.current.delete(id)
        if (info.date === ctx.current.today) {
          const off = (x: any) => x.completion_id === id ? { ...x, completed_today: false, completed_by_today: null, completion_id: null } : x
          if (kind === 'task') setTasks(ts => ts.map(off))
          else setDogs(ds => ds.map(d => ({ ...d, routines: d.routines.map(off) })))
        } else later(kind, reload)
        later('stats', refreshStats)
        return
      }
      const r = p.new as Row
      if (!r?.id) return
      const itemId = kind === 'task' ? r.task_id : r.routine_id
      completionIndex.current.set(r.id, { kind, itemId, date: r.date })
      if (r.date === ctx.current.today) {
        const on = (x: any) => x.id === itemId ? { ...x, completed_today: true, completed_by_today: isWho(r.completed_by) ? r.completed_by : null, completion_id: r.id } : x
        if (kind === 'task') setTasks(ts => ts.map(on))
        else setDogs(ds => ds.map(d => ({ ...d, routines: d.routines.map(on) })))
      } else later(kind, reload)
      later('stats', refreshStats)
    },
    task: (p) => {
      if (p.eventType === 'DELETE') { later('task', reloadTasks); return }
      const r = p.new as Row
      setTasks(ts => {
        const i = ts.findIndex(t => t.id === r.id)
        if (r.active === false) return i < 0 ? ts : ts.filter(t => t.id !== r.id)
        if (i < 0) { later('task', reloadTasks); return ts } // nova ou reativada: precisa das conclusões
        const n = [...ts]; n[i] = { ...ts[i], ...(r as Task) }; return n
      })
    },
    dogs: () => later('dog', reloadDogs),
    settings: (p) => {
      const r = p.new as Row
      if (r?.week_start === ctx.current.weekStart) setSettings({ energy: r.energy, survival: !!r.survival })
    },
    names: () => later('names', reloadNames),
    stats: () => later('stats', refreshStats),
    accidents: () => later('acc', reloadAccidents),
  }

  const [meetingTick, setMeetingTick] = useState(0)

  useEffect(() => {
    const f = `household_id=eq.${householdId}`
    const h = (k: string) => (p: RealtimePostgresChangesPayload<Row>) => handlers.current[k](p)
    const on = (ch: any, table: string, key: string, events: string[] = ['INSERT', 'UPDATE']) => {
      events.forEach(event => ch.on('postgres_changes', { event, schema: 'public', table, filter: f }, h(key)))
    }
    let errored = false
    const ch = supabase.channel(`ninho:${householdId}`)
    on(ch, 'task_completions', 'completion')
    on(ch, 'dog_completions', 'completion')
    // DELETE não aceita filtro: chega de qualquer casa e é conferido pelo id
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_completions' }, h('completion'))
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'dog_completions' }, h('completion'))
    on(ch, 'tasks', 'task')
    on(ch, 'dogs', 'dogs')
    on(ch, 'dog_routines', 'dogs')
    on(ch, 'weekly_settings', 'settings')
    on(ch, 'profiles', 'names')
    on(ch, 'xp_history', 'stats', ['INSERT', 'UPDATE', 'DELETE'])
    on(ch, 'puppy_accidents', 'accidents', ['INSERT', 'UPDATE'])
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_meetings', filter: f }, () => setMeetingTick(t => t + 1))
    ch.subscribe((s: string, err?: Error) => {
      if (s === 'SUBSCRIBED') {
        // Reconectou depois de uma queda: busca o que pode ter mudado no meio-tempo
        if (errored) { errored = false; later('all', loadAll as any, 100) }
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
        errored = true
        logError('realtime', err || { message: s })
      }
    })
    const t = timers.current
    return () => {
      Object.values(t).forEach(clearTimeout)
      supabase.removeChannel(ch)
    }
  }, [householdId, later, loadAll])

  return {
    status, loadError, loadAll,
    tasks, setTasks, dogs, setDogs, settings, setSettings, xp, setXp, streak, names, setNames, accidents, setAccidents,
    refreshStats, reloadTasks, reloadDogs, reloadAccidents, meetingTick,
    /** Registra uma conclusão criada por este aparelho (para reconhecer o DELETE depois). */
    rememberCompletion: (id: string, kind: 'task' | 'dog', itemId: string, date: string) => completionIndex.current.set(id, { kind, itemId, date }),
  }
}
