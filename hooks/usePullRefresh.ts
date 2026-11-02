'use client'
// Puxar para atualizar (celular): no topo da página, puxe para baixo e solte para recarregar.
import { useEffect, useRef, useState } from 'react'
import { pullOf } from '@/lib/gestos'

export function usePullRefresh(onRefresh: () => Promise<unknown>, enabled = true): { shown: number, ready: boolean, busy: boolean } {
  const [st, setSt] = useState({ shown: 0, ready: false, busy: false })
  const y0 = useRef<number | null>(null), cur = useRef({ shown: 0, ready: false }), busy = useRef(false)
  useEffect(() => {
    if (!enabled) return
    const down = (e: TouchEvent) => {
      // só começa no topo da página e fora de janelas abertas
      if (busy.current || window.scrollY > 0 || document.querySelector('.modal')) return
      y0.current = e.touches[0].clientY
    }
    const move = (e: TouchEvent) => {
      if (y0.current === null) return
      const p = pullOf(e.touches[0].clientY - y0.current)
      if (window.scrollY > 0) { y0.current = null; p.shown = 0; p.ready = false }
      cur.current = p; setSt(s => ({ ...s, ...p }))
    }
    const up = async () => {
      if (y0.current === null) return
      y0.current = null
      if (!cur.current.ready) { setSt({ shown: 0, ready: false, busy: false }); return }
      busy.current = true; setSt({ shown: 44, ready: true, busy: true })
      try { await onRefresh() } finally { busy.current = false; cur.current = { shown: 0, ready: false }; setSt({ shown: 0, ready: false, busy: false }) }
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', up)
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up) }
  }, [onRefresh, enabled])
  return st
}
