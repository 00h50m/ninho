'use client'
// Dados da Fase 3 (divisão, compras, manutenção) + Realtime próprio.
// Fica separado de useNinhoData: se a migration 007 ainda não foi aplicada,
// só estas partes mostram aviso — Hoje, Tarefas e Cães continuam funcionando.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as casa from '@/lib/services/casa'
import { logError, toNinhoError, type NinhoError } from '@/lib/errors'
import type { SplitMode } from '@/lib/split'
import type { ShoppingItem } from '@/lib/shopping'
import type { MaintenanceItem, MaintenanceLog } from '@/lib/maintenance'
import { readSnapshot, saveSnapshot } from '@/lib/offline'

type Part = 'loading' | 'ready' | 'error'
type Row = Record<string, any>

interface CasaSnap { split: SplitMode, open: ShoppingItem[], history: ShoppingItem[], items: MaintenanceItem[], log: MaintenanceLog[] }

export function useCasa(householdId: string, today: string) {
  const [split, setSplit] = useState<SplitMode>('smart')
  const [splitReady, setSplitReady] = useState(false)
  const [shop, setShop] = useState<ShoppingItem[]>([])
  const [shopHistory, setShopHistory] = useState<ShoppingItem[]>([])
  const [shopState, setShopState] = useState<Part>('loading')
  const [shopError, setShopError] = useState<NinhoError | null>(null)
  const [shopExtras, setShopExtras] = useState(false)
  const [maintExtras, setMaintExtras] = useState(false)
  const [maint, setMaint] = useState<MaintenanceItem[]>([])
  const [maintLog, setMaintLog] = useState<MaintenanceLog[]>([])
  const [maintState, setMaintState] = useState<Part>('loading')
  const [maintError, setMaintError] = useState<NinhoError | null>(null)
  const latest = useRef<CasaSnap>({ split: 'smart', open: [], history: [], items: [], log: [] })
  const snapKey = 'casa:' + householdId

  const persist = (patch: Partial<CasaSnap>) => {
    latest.current = { ...latest.current, ...patch }
    saveSnapshot<CasaSnap>(snapKey, today, latest.current)
  }

  const reloadSplit = useCallback(async () => {
    const m = await casa.loadSplitMode(householdId)
    setSplit(m); setSplitReady(true); persist({ split: m })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  const reloadShopping = useCallback(async () => {
    try {
      const r = await casa.loadShopping(householdId)
      setShop(r.open); setShopHistory(r.history); setShopState('ready'); setShopError(null); setShopExtras(r.extras)
      persist({ open: r.open, history: r.history })
    } catch (e) {
      const snap = readSnapshot<CasaSnap>(snapKey)
      if (snap) { setShop(snap.data.open); setShopHistory(snap.data.history); setShopState('ready') }
      else { setShopError(toNinhoError(e, 'carregar lista de compras')); setShopState('error') }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  const reloadMaintenance = useCallback(async () => {
    try {
      const r = await casa.loadMaintenance(householdId)
      setMaint(r.items); setMaintLog(r.log); setMaintState('ready'); setMaintError(null); setMaintExtras(r.extras)
      persist({ items: r.items, log: r.log })
    } catch (e) {
      const snap = readSnapshot<CasaSnap>(snapKey)
      if (snap) { setMaint(snap.data.items); setMaintLog(snap.data.log); setMaintState('ready') }
      else { setMaintError(toNinhoError(e, 'carregar manutenções')); setMaintState('error') }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  const loadAll = useCallback(() => Promise.all([reloadSplit(), reloadShopping(), reloadMaintenance()]), [reloadSplit, reloadShopping, reloadMaintenance])

  useEffect(() => {
    const snap = readSnapshot<CasaSnap>(snapKey)
    if (snap) { latest.current = snap.data; setSplit(snap.data.split) }
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAll, today])

  useEffect(() => {
    const on = () => { loadAll() }
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [loadAll])

  // ── Realtime ──
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const later = useCallback((k: string, fn: () => Promise<unknown>) => {
    clearTimeout(timers.current[k])
    timers.current[k] = setTimeout(() => { fn().catch(e => logError('realtime:' + k, e)) }, 250)
  }, [])

  useEffect(() => {
    const f = `household_id=eq.${householdId}`
    const ch = supabase.channel(`ninho-casa:${householdId}`)
    // Compras: aplica a linha direto (resposta instantânea na outra tela)
    const applyShop = (r: Row) => {
      if (!r?.id || r.household_id !== householdId) return
      setShop(list => {
        const others = list.filter(x => x.id !== r.id)
        return r.done_at ? others : [...others, r as ShoppingItem]
      })
      if (r.done_at) later('shopHist', reloadShopping)
    }
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shopping_items', filter: f }, p => applyShop(p.new as Row))
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shopping_items', filter: f }, p => applyShop(p.new as Row))
    // DELETE não aceita filtro: remove só se o id é desta lista
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shopping_items' }, p => {
      const id = (p.old as Row)?.id
      if (id) setShop(list => list.some(x => x.id === id) ? list.filter(x => x.id !== id) : list)
    })
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_items', filter: f }, () => later('maint', reloadMaintenance))
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'maintenance_log', filter: f }, () => later('maint', reloadMaintenance))
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'maintenance_log' }, () => later('maint', reloadMaintenance))
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, p => {
      const m = (p.new as Row)?.split_mode
      if (m === 'smart' || m === 'rotation') setSplit(m)
    })
    let errored = false
    ch.subscribe((s: string, err?: Error) => {
      if (s === 'SUBSCRIBED') { if (errored) { errored = false; later('all', loadAll as any) } }
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { errored = true; logError('realtime casa', err || { message: s }) }
    })
    const t = timers.current
    return () => { Object.values(t).forEach(clearTimeout); supabase.removeChannel(ch) }
  }, [householdId, later, loadAll, reloadShopping, reloadMaintenance])

  return {
    split, setSplit, splitReady,
    shop, setShop, shopHistory, shopState, shopError, shopExtras, reloadShopping,
    maint, setMaint, maintLog, maintState, maintError, maintExtras, reloadMaintenance,
  }
}
