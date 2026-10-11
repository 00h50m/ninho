'use client'
// Faxinão da casa com tempo real: o que uma marca aparece na hora para a outra.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/errors'
import * as api from '@/lib/services/faxinao'
import type { Faxinao } from '@/lib/faxinao'

export function useFaxinao(householdId: string) {
  const [list, setList] = useState<Faxinao[] | null | undefined>(undefined)
  const reload = useCallback(async () => {
    try { setList(await api.loadFax(householdId)) } catch (e) { logError('carregar faxinão', e); setList(l => l ?? []) }
  }, [householdId])
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    if (!list && list !== undefined) return
    const ch = supabase.channel(`ninho-faxinao:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faxinoes', filter: `household_id=eq.${householdId}` }, () => { reload() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [householdId, list === null, reload]) // eslint-disable-line react-hooks/exhaustive-deps
  // Plano B do tempo real: com faxinão em andamento, confere a cada 8 s (no celular a conexão às vezes cai)
  const live = !!list?.some(f => f.status === 'andamento')
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload() }, 8000)
    return () => clearInterval(t)
  }, [live, reload])
  return { available: list !== null, ready: list !== undefined, list: list || [], reload, setList }
}
