'use client'
// Meu dia: dados das duas (o banco já filtra o que é privado) com tempo real
// e atualização otimista que volta atrás se o banco recusar.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import { addDays } from '@/lib/dates'
import * as api from '@/lib/services/meudia'
import type { Who } from '@/lib/types'
import type { PKind, PLog } from '@/lib/meudia'

export function useMeuDia(householdId: string, today: string) {
  const [data, setData] = useState<api.MeuDiaData>({ available: false, settings: [], logs: [], meds: [], quits: [], profiles: [], foods: [] })
  const from = addDays(today, -180)
  const reload = useCallback(async () => {
    try { setData(await api.loadMeuDia(householdId, from)) } catch (e: any) { logError('carregar Meu dia', e); setData(d => d.available ? d : { ...d, reason: [e?.code, e?.message].filter(Boolean).join(' · ') || 'erro ao carregar' }) }
  }, [householdId, from])
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    if (!data.available) return
    const f = `household_id=eq.${householdId}`
    const ch = supabase.channel(`ninho-meudia:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_logs', filter: f }, () => { reload() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_settings', filter: f }, () => { reload() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_quits', filter: f }, () => { reload() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_food_profile', filter: f }, () => { reload() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_foods', filter: f }, () => { reload() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [householdId, data.available, reload])

  /** Registro com resposta na hora. */
  const add = useCallback(async (who: Who, kind: PKind, value: number | null, payload: Record<string, any> = {}, date = today) => {
    const tmp: PLog = { id: 'tmp:' + Math.random().toString(36).slice(2), who, date, kind, value, data: payload }
    setData(d => ({ ...d, logs: [...d.logs, tmp] }))
    try { const row = await api.addLog(householdId, who, date, kind, value, payload); setData(d => ({ ...d, logs: d.logs.map(l => l.id === tmp.id ? { ...row, value: row.value == null ? null : Number(row.value) } : l) })) }
    catch (e) { setData(d => ({ ...d, logs: d.logs.filter(l => l.id !== tmp.id) })); throw e }
  }, [householdId, today])

  const remove = useCallback(async (log: PLog) => {
    setData(d => ({ ...d, logs: d.logs.filter(l => l.id !== log.id) }))
    try { await api.deleteLog(log.id) } catch (e) { setData(d => ({ ...d, logs: [...d.logs, log] })); throw e }
  }, [])

  return { ...data, reload, add, remove, setData }
}
