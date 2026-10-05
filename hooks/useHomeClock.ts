'use client'
import { useEffect, useState } from 'react'
import { homeClock, weekStartOf, weekdayIndex } from '@/lib/dates'

/**
 * Relógio da casa (America/Sao_Paulo). Atualiza a cada minuto e ao voltar para o app,
 * para "atrasadas" e a virada do dia funcionarem com o celular aberto.
 */
export function useHomeClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const i = setInterval(tick, 60000)
    const vis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', vis) }
  }, [])
  const c = homeClock(now)
  return { now, today: c.date, nowHM: c.hm, hour: c.hour, weekStart: weekStartOf(c.date), todayIndex: weekdayIndex(c.date) }
}
