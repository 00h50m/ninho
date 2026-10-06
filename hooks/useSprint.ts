'use client'
// Sprint ativo da casa (o mesmo nos dois aparelhos) e relógio que anda a cada segundo
// só enquanto há sprint correndo e a tela está visível.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import * as api from '@/lib/services/sprint'

export function useSprint(householdId: string) {
  const [data, setData] = useState<api.SprintData>({ available: false, active: null, recent: [] })
  const [now, setNow] = useState(() => Date.now())
  const reload = useCallback(async () => {
    try { setData(await api.loadSprints(householdId)) } catch (e) { logError('carregar sprints', e) }
  }, [householdId])
  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (!data.available) return
    const ch = supabase.channel(`ninho-sprint:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter: `household_id=eq.${householdId}` }, () => { reload() })
      .subscribe()
    // Voltou para o app (desbloqueou o celular): recalcula pelo horário e recarrega
    const vis = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); reload() } }
    document.addEventListener('visibilitychange', vis)
    return () => { supabase.removeChannel(ch); document.removeEventListener('visibilitychange', vis) }
  }, [householdId, data.available, reload])

  const running = !!data.active && !data.active.paused_at
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  return { ...data, now, reload, setData }
}
