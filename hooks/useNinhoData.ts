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
import { buildDogs, buildTasks } from '@/lib/build'
import { applyCompletionDeleted, applyCompletionToday, applyTaskRow, isForHousehold } from '@/lib/realtime'
import { DEFAULT_NAMES } from '@/lib/constants'
import { logError, toNinhoError, type NinhoError } from '@/lib/errors'
import type { Accident, CompletionRow, Dog, Names, Settings, Task } from '@/lib/types'
import { EMPTY_SCORES, EMPTY_STREAKS } from '@/lib/gamification'
import { isOfflineError, readSnapshot, saveSnapshot } from '@/lib/offline'

interface OfflineData {
  tasks: Task[], dogs: Dog[], xp: number, streak: number, game: api.Gamification
  names: Names | null, accidents: Accident[], settings: Settings
}

type Status = 'loading' | 'ready' | 'error'
type Row = Record<string, any>

export function useNinhoData(householdId: string, today: string, weekStart: string, onError: (e: NinhoError) => void) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [dogs, setDogs] = useState<Dog[]>([])
  const [settings, setSettings] = useState<Settings>({ energy: 'medium', survival: false })
  const [xp, setXp] = useState(0)
  const [streak, setStreak] = useState(0)
  const [names, setNames] = useState<Names>(DEFAULT_NAMES)
  const [accidents, setAccidents] = useState<Accident[]>([])
  const [game, setGame] = useState<api.Gamification>({ scores: EMPTY_SCORES, lastWeek: EMPTY_SCORES, lastWeekBet: null, streaks: EMPTY_STREAKS, stats: {} })
  const [status, setStatus] = useState<Status>('loading')
  /** Abriu sem internet com dados guardados no aparelho */
  const [offline, setOffline] = useState<{ savedAt: string } | null>(null)
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
    const t = buildTasks(r.tasks, r.completions, ctx.current.today, r.skips)
    setTasks(t)
    return t
  }, [householdId])

  const reloadDogs = useCallback(async () => {
    const r = await api.loadDogs(householdId, ctx.current.today)
    indexCompletions('dog', r.completions)
    const d = buildDogs(r.dogs, r.completions, ctx.current.today)
    setDogs(d)
    return d
  }, [householdId])

  const refreshStats = useCallback(async () => {
    const [s, g] = await Promise.all([
      api.loadStats(householdId, ctx.current.today),
      api.loadGamification(householdId, ctx.current.today, ctx.current.weekStart),
    ])
    setXp(s.xp); setStreak(s.streak); setGame(g)
    return { ...s, game: g }
  }, [householdId])

  const reloadNames = useCallback(async () => {
    const n = await api.loadNames(householdId)
    if (n) setNames(n)
    return n
  }, [householdId])

  const reloadAccidents = useCallback(async () => {
    const a = await api.loadAccidents(householdId)
    setAccidents(a)
    return a
  }, [householdId])

  const reloadSettings = useCallback(async () => {
    const s = await api.loadSettings(householdId, ctx.current.weekStart)
    const v = s || { energy: 'medium' as const, survival: false, bet: null }
    setSettings(v)
    return v
  }, [householdId])

  const loadAll = useCallback(async () => {
    if (!loaded.current) setStatus('loading')
    try {
      const [t, d, st, n, a, se] = await Promise.all([reloadTasks(), reloadDogs(), refreshStats(), reloadNames(), reloadAccidents(), reloadSettings()])
      saveSnapshot<OfflineData>(householdId, ctx.current.today, { tasks: t, dogs: d, xp: st.xp, streak: st.streak, game: st.game, names: n, accidents: a, settings: se })
      loaded.current = true
      setOffline(null)
      setLoadError(null)
      setStatus('ready')
    } catch (e) {
      // Sem internet: mostra o último carregamento guardado no aparelho (só leitura)
      const snap = isOfflineError(e) ? readSnapshot<OfflineData>(householdId) : null
      if (snap && !loaded.current) {
        const sd = snap.data
        // Conclusões de outro dia não valem para hoje
        const fresh = snap.today === ctx.current.today
        const clear = <T extends object>(x: T) => fresh ? x : { ...x, completed_today: false, completed_by_today: null, completion_id: null }
        setTasks(sd.tasks.map(clear)); setDogs(sd.dogs.map(dg => ({ ...dg, routines: dg.routines.map(clear) })))
        setXp(sd.xp); setStreak(sd.streak); setGame(sd.game); if (sd.names) setNames(sd.names); setAccidents(sd.accidents); setSettings(sd.settings)
        setOffline({ savedAt: snap.savedAt })
        loaded.current = true
        setStatus('ready')
        return
      }
      const err = toNinhoError(e, 'carregar a casa')
      if (!loaded.current) { setLoadError(err); setStatus('error') }
      else ctx.current.onError(err)
    }
  }, [householdId, reloadTasks, reloadDogs, refreshStats, reloadNames, reloadAccidents, reloadSettings])

  // Recarrega quando o dia ou a semana viram
  useEffect(() => { loadAll() }, [loadAll, today, weekStart])

  // Voltou a internet: busca tudo de novo
  useEffect(() => {
    const on = () => { loadAll() }
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [loadAll])

  // ── Realtime ────────────────────────────────────────────────────────
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const later = useCallback((key: string, fn: () => Promise<unknown>, ms = 300) => {
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
          if (kind === 'task') setTasks(ts => applyCompletionDeleted(ts, id))
          else setDogs(ds => ds.map(d => ({ ...d, routines: applyCompletionDeleted(d.routines, id) })))
        } else later(kind, reload)
        later('stats', refreshStats)
        return
      }
      const r = p.new as Row
      if (!r?.id || !isForHousehold(r, householdId)) return
      const itemId = kind === 'task' ? r.task_id : r.routine_id
      completionIndex.current.set(r.id, { kind, itemId, date: r.date })
      if (r.date === ctx.current.today) {
        if (kind === 'task') setTasks(ts => applyCompletionToday(ts, itemId, r as any))
        else setDogs(ds => ds.map(d => ({ ...d, routines: applyCompletionToday(d.routines, itemId, r as any) })))
      } else later(kind, reload)
      later('stats', refreshStats)
    },
    task: (p) => {
      if (p.eventType === 'DELETE') { later('task', reloadTasks); return }
      const r = p.new as Row
      setTasks(ts => {
        const out = applyTaskRow(ts, r as any)
        if (out.needsReload) later('task', reloadTasks) // nova ou reativada: precisa das conclusões
        return out.tasks
      })
    },
    dogs: () => later('dog', reloadDogs),
    settings: (p) => {
      const r = p.new as Row
      if (r?.week_start === ctx.current.weekStart) setSettings({ energy: r.energy, survival: !!r.survival, bet: r.bet ?? null })
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
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'task_skips' }, () => later('task', reloadTasks))
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
    status, loadError, loadAll, offline,
    game,
    tasks, setTasks, dogs, setDogs, settings, setSettings, xp, setXp, streak, names, setNames, accidents, setAccidents,
    refreshStats, reloadTasks, reloadDogs, reloadAccidents, meetingTick,
    /** Registra uma conclusão criada por este aparelho (para reconhecer o DELETE depois). */
    rememberCompletion: (id: string, kind: 'task' | 'dog', itemId: string, date: string) => completionIndex.current.set(id, { kind, itemId, date }),
  }
}
