'use client'
// 🔍 Busca em tudo: abre pela lupa do topo (ou Ctrl/⌘+K). Procura no que o app já carregou;
// tocar num resultado leva à tela certa.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { KIND_LABEL, searchAll, type SearchHit, type SearchItem, type SearchKind } from '@/lib/search'

export function Busca({ items, onPick, onClose }: { items: SearchItem[], onPick: (h: SearchHit) => void, onClose: () => void }) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 50) }, [])
  const hits = useMemo(() => searchAll(items, q), [items, q])
  const groups = useMemo(() => {
    const m = new Map<SearchKind, SearchHit[]>()
    hits.forEach(h => m.set(h.kind, [...(m.get(h.kind) || []), h]))
    return Array.from(m.entries())
  }, [hits])
  const pick = (h: SearchHit) => { onPick(h); onClose() }
  return (
    <Sheet title="🔍 Buscar no Ninho" onClose={onClose}>
      <input ref={ref} autoFocus className="fi bs-in" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tarefa, compra, alimento, compromisso…" aria-label="Buscar no Ninho"
        onKeyDown={e => { if (e.key === 'Enter' && hits[0]) pick(hits[0]) }}/>
      <div className="bs-res" role="region" aria-live="polite" aria-label="Resultados">
        {q.trim().length >= 2 && !hits.length && <p className="row-s">Nada encontrado para “{q.trim()}”.</p>}
        {q.trim().length < 2 && <p className="row-s">Digite pelo menos 2 letras. Procura em tarefas, compras, agenda, rotinas, cães, Meus alimentos e refeições salvas.</p>}
        {groups.map(([k, list]) => <section key={k} className="bs-g" aria-label={KIND_LABEL[k]}>
          <div className="slbl">{KIND_LABEL[k]}</div>
          <ul>{list.map(h => <li key={h.kind + h.id}><button className="bs-i" onClick={() => pick(h)}><b>{h.title}</b>{h.sub && <small>{h.sub}</small>}</button></li>)}</ul>
        </section>)}
      </div>
    </Sheet>
  )
}
