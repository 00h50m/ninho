'use client'
// Check-ins e dias da semana, com tempo real (a outra vê o check-in na hora).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import * as daysApi from '@/lib/services/days'
import type { Checkin } from '@/lib/week'

export function useDays(householdId: string, from: string) {
  const [data, setData] = useState<daysApi.DaysData>({ available: false, checkins: [], days: [] })
  const reload = useCallback(async () => {
    try { setData(await daysApi.loadDays(householdId, from)) } catch (e) { logError('carregar semana', e) }
  }, [householdId, from])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (!data.available) return
    const f = `household_id=eq.${householdId}`
    const ch = supabase.channel(`ninho-dias:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_checkins', filter: f }, p => {
        const r = p.new as Checkin & { household_id?: string }
        if (!r?.date || r.date < from) return
        setData(d => ({ ...d, checkins: [...d.checkins.filter(c => !(c.date === r.date && c.who === r.who)), { date: r.date, who: r.who, mood: r.mood, energy: r.energy, note: r.note }] }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_days', filter: f }, () => { reload() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [householdId, from, data.available, reload])

  /** Atualiza na hora (otimista) e confirma com o banco; volta atrás se falhar. */
  const checkin = useCallback(async (date: string, who: Checkin['who'], v: Partial<Pick<Checkin, 'mood' | 'energy' | 'note'>>) => {
    const before = data.checkins
    const cur = before.find(c => c.date === date && c.who === who) || { date, who, mood: null, energy: null, note: null }
    const next = { ...cur, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) } as Checkin
    setData(d => ({ ...d, checkins: [...d.checkins.filter(c => !(c.date === date && c.who === who)), next] }))
    try {
      const saved = await daysApi.saveCheckin(householdId, date, who, v)
      setData(d => ({ ...d, checkins: [...d.checkins.filter(c => !(c.date === date && c.who === saved.who)), { date: saved.date, who: saved.who, mood: saved.mood, energy: saved.energy, note: saved.note }] }))
    } catch (e) {
      setData(d => ({ ...d, checkins: before }))
      throw e
    }
  }, [data.checkins, householdId])

  return { ...data, reload, checkin }
}
