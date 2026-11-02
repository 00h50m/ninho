'use client'
// Deslizar na tarefa (celular): para a direita conclui, para a esquerda abre as opções.
// Só com o dedo (no mouse nada muda); a rolagem da página continua normal (touch-action: pan-y).
import { useRef, useState, type ReactNode } from 'react'
import { swipeOf, swipeOffset } from '@/lib/gestos'

export function SwipeRow({ children, onRight, onLeft, rightLabel, leftLabel, disabled }: {
  children: ReactNode, onRight: () => void, onLeft: () => void, rightLabel: string, leftLabel: string, disabled?: boolean,
}) {
  const start = useRef<{ x: number, y: number, id: number } | null>(null)
  const moved = useRef(false)
  const [dx, setDx] = useState(0)
  const end = (fire: boolean, x = 0, y = 0) => {
    const s = start.current; start.current = null
    if (fire && s) { const a = swipeOf(x - s.x, y - s.y); if (a === 'right') onRight(); else if (a === 'left') onLeft() }
    setDx(0)
  }
  return (
    <div className={`sw ${dx > 0 ? 'sw-r' : dx < 0 ? 'sw-l' : ''}`}
      onPointerDown={e => { if (disabled || e.pointerType !== 'touch') return; start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; moved.current = false }}
      onPointerMove={e => {
        const s = start.current; if (!s || e.pointerId !== s.id) return
        const x = e.clientX - s.x, y = e.clientY - s.y
        if (!moved.current && Math.abs(y) > Math.abs(x)) { start.current = null; return } // é rolagem
        if (Math.abs(x) > 8) moved.current = true
        if (moved.current) setDx(swipeOffset(x))
      }}
      onPointerUp={e => end(moved.current, e.clientX, e.clientY)}
      onPointerCancel={() => end(false)}
      // depois de deslizar, o toque não vira "concluir" por engano
      onClickCapture={e => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false } }}>
      <span className="sw-bg sw-bg-r" aria-hidden="true">✓ {rightLabel}</span>
      <span className="sw-bg sw-bg-l" aria-hidden="true">{leftLabel} ⋯</span>
      <div className="sw-in" style={dx ? { transform: `translateX(${dx}px)` } : undefined}>{children}</div>
    </div>
  )
}
