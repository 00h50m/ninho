'use client'
// Mostra o conteúdo só quando chega perto da tela (o Início abre mais rápido; o que fica embaixo
// — Sobrou, Agenda, Atalhos — carrega depois). Sem IntersectionObserver, mostra logo.
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Deferred({ children, minHeight = 60 }: { children: ReactNode, minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (on) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setOn(true); io.disconnect() } }, { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [on])
  return on ? <>{children}</> : <div ref={ref} style={{ minHeight }} aria-hidden="true"/>
}
