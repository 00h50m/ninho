'use client'
// Dia fechado: quando a última tarefa do dia de quem usa o aparelho é concluída, uma comemoração curta
// (uma vez por dia). Com "menos animação", fica só a mensagem, sem os confetes.
import { useEffect, useRef, useState } from 'react'

const KEY = 'ninho.festa'

/** Comemorar? Só quando passa de "faltando" para "tudo feito", com algo no dia, e uma vez por dia. Puro, testado. */
export function shouldCelebrate(prev: { done: number, all: number } | null, now: { done: number, all: number }, lastDay: string | null, today: string): boolean {
  return !!prev && now.all > 0 && prev.done < prev.all && now.done === now.all && lastDay !== today
}

export function DayDone({ count, today, name }: { count: { done: number, all: number }, today: string, name: string }) {
  const prev = useRef<{ done: number, all: number } | null>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    let last: string | null = null
    try { last = localStorage.getItem(KEY) } catch { /* sem armazenamento */ }
    if (shouldCelebrate(prev.current, count, last, today)) {
      setShow(true)
      try { localStorage.setItem(KEY, today) } catch { /* ok */ }
      const t = setTimeout(() => setShow(false), 3200)
      prev.current = count
      return () => clearTimeout(t)
    }
    prev.current = count
  }, [count.done, count.all, today]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null
  return (
    <div className="festa" role="status" aria-live="polite" onClick={() => setShow(false)}>
      <div className="festa-c" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.12}s` }}/>)}</div>
      <div className="festa-card"><span className="festa-e" aria-hidden="true">🎉</span><b>Dia fechado, {name}!</b><small>Tudo o que era seu hoje está feito.</small></div>
    </div>
  )
}
