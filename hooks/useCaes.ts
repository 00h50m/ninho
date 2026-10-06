'use client'
// Saúde dos cães e acidentes do filhote (60 dias), com tempo real.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import { addDays } from '@/lib/dates'
import * as api from '@/lib/services/caes'
import type { AccidentRow, HealthRecord } from '@/lib/caes'

export function useCaes(householdId: string, today: string) {
  const [available, setAvailable] = useState(false)
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [accidents, setAccidents] = useState<AccidentRow[]>([])
  const from = addDays(today, -60)
  const reload = useCallback(async () => {
    try {
      const [h, a] = await Promise.all([api.loadHealth(householdId), api.loadAccidents(householdId, from)])
      setAvailable(h.available); setRecords(h.records); setAccidents(a)
    } catch (e) { logError('carregar cães', e) }
  }, [householdId, from])
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    const f = `household_id=eq.${householdId}`
    const ch = supabase.channel(`ninho-caes:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puppy_accidents', filter: f }, () => { reload() })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'puppy_accidents' }, () => { reload() })
    if (available) ch.on('postgres_changes', { event: '*', schema: 'public', table: 'dog_health', filter: f }, () => { reload() })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'dog_health' }, () => { reload() })
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [householdId, available, reload])
  return { available, records, accidents, setAccidents, reload }
}
