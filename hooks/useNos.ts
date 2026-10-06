'use client'
// Nós: desafios, registros e combinados, com tempo real. Quando um desafio
// chega na meta (ou não dá mais), o app grava o resultado uma vez.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import { progress } from '@/lib/nos'
import * as api from '@/lib/services/nos'

export function useNos(householdId: string, today: string) {
  const [data, setData] = useState<api.NosData>(api.EMPTY_NOS)
  const [ready, setReady] = useState(false)
  const reload = useCallback(async () => {
    try { setData(await api.loadNos(householdId, today)) } catch (e: any) { logError('carregar Nós', e); setData(d => d.available ? d : { ...d, reason: [e?.code, e?.message].filter(Boolean).join(' · ') || 'erro ao carregar' }) }
    finally { setReady(true) }
  }, [householdId, today])
  useEffect(() => { reload() }, [reload])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!data.available) return
    const f = `household_id=eq.${householdId}`
    const soon = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(reload, 400) }
    const ch = supabase.channel(`ninho-nos:${householdId}`)
    for (const t of ['couple_challenges', 'challenge_marks', 'weekly_meetings', 'daily_checkins', 'routine_runs', 'ninho_habit_logs', 'sprints']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: f }, soon)
    }
    ch.subscribe()
    return () => { if (timer.current) clearTimeout(timer.current); supabase.removeChannel(ch) }
  }, [householdId, data.available, reload])

  // Resultado do desafio: grava "conseguimos" / "não deu" quando o cálculo muda
  const settled = useRef(new Set<string>())
  useEffect(() => {
    for (const c of data.challenges) {
      if (c.status !== 'active' || settled.current.has(c.id)) continue
      const p = progress(c, data.facts, today)
      if (p.state !== 'active') {
        settled.current.add(c.id)
        api.setChallengeStatus(c.id, p.state).then(reload).catch(e => { settled.current.delete(c.id); logError('encerrar desafio', e) })
      }
    }
  }, [data, today, reload])

  return { ...data, ready, reload, setData }
}
