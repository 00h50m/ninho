'use client'
// Despensa e jantar das duas (038), com tempo real em canal próprio (sem a tabela, nada cai).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import { addDays } from '@/lib/dates'
import * as api from '@/lib/services/despensaJantar'

export function useCasaExtra(householdId: string, today: string) {
  const [data, setData] = useState<api.CasaExtra>({ ready: false, pantry: [], meals: [] })
  const from = addDays(today, -14), to = addDays(today, 21)
  const reload = useCallback(async () => {
    try { setData(await api.loadCasaExtra(householdId, from, to)) } catch (e) { logError('carregar despensa e jantar', e) }
  }, [householdId, from, to])
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    if (!data.ready) return
    const f = `household_id=eq.${householdId}`
    const ch = supabase.channel(`ninho-despensa:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pantry_items', filter: f }, () => { reload() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_meals', filter: f }, () => { reload() })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'house_meals' }, () => { reload() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [householdId, data.ready, reload])
  return { ...data, reload, setData }
}
