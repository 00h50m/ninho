'use client'
// Agenda da casa com tempo real.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import { addDays } from '@/lib/dates'
import * as api from '@/lib/services/agenda'

export function useAgenda(householdId: string, today: string) {
  const [data, setData] = useState<api.AgendaData>({ available: false, events: [], sobrouUrl: null })
  const from = addDays(today, -45)
  const reload = useCallback(async () => {
    try { setData(await api.loadAgenda(householdId, from)) } catch (e) { logError('carregar agenda', e) }
  }, [householdId, from])
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    if (!data.available) return
    const ch = supabase.channel(`ninho-agenda:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_events', filter: `household_id=eq.${householdId}` }, () => { reload() })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'house_events' }, () => { reload() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [householdId, data.available, reload])
  return { ...data, reload, setData }
}
