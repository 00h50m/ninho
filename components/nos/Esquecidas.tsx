'use client'
// Tarefas que ficaram para trás e o ajuste de um toque: frequência mais leve, pausar 2 semanas
// ou trocar quem faz. Usado na reunião semanal e no cartão de sugestão do Início.
import { useState } from 'react'
import type { Names, Task, Who } from '@/lib/types'
import { lighter, unitOf } from '@/lib/retro'
import { fmtDate } from '@/lib/dates'

export type RetroAction = { kind: 'lighter', patch: Partial<Task>, label: string } | { kind: 'pause' } | { kind: 'assign', to: Who }
export type Adjust = (t: Task, a: RetroAction) => Promise<string | null>
export interface ForgotItem { task: Task, done?: number, expected?: number, last?: string | null }

const first = (n: string) => (n || '').split(' ')[0]

/** Os botões de ajuste de uma tarefa. Depois de ajustar, mostra o que mudou. */
export function AdjustRow({ item, names, onAdjust, onDone }: { item: ForgotItem, names: Names, onAdjust: Adjust, onDone?: (msg: string) => void }) {
  const t = item.task, lt = lighter(t)
  const [busy, setBusy] = useState(false), [done, setDone] = useState<string | null>(null)
  const run = async (a: RetroAction) => { setBusy(true); const m = await onAdjust(t, a); setBusy(false); if (m) { setDone(m); onDone?.(m) } }
  const who: Who[] = t.assigned_to === 'g' ? ['s'] : t.assigned_to === 's' ? ['g'] : ['g', 's']
  return (
    <li className="adj">
      <span className="adj-t">{t.title}</span>
      {item.expected != null && <span className="adj-s">feita {item.done} de {item.expected} {unitOf(t.frequency, item.expected)} · {item.last ? `última em ${fmtDate(item.last)}` : 'sem registro em 2 meses'}</span>}
      {done ? <span className="adj-ok" role="status">✓ {done}</span> : <span className="adj-b">
        {lt && <button className="fc" disabled={busy} onClick={() => run({ kind: 'lighter', patch: lt.patch, label: lt.label })}>⇣ {lt.label}</button>}
        <button className="fc" disabled={busy} onClick={() => run({ kind: 'pause' })}>⏸ Pausar 2 semanas</button>
        {who.map(w => <button key={w} className="fc" disabled={busy} onClick={() => run({ kind: 'assign', to: w })}>{t.assigned_to ? '⇄ Passar para' : '👤 Só'} {first(names[w])}</button>)}
      </span>}
    </li>
  )
}

/** Reunião: o que ficou para trás nas últimas 4 semanas. */
export function ForgotSection({ items: now, names, onAdjust, onNote }: { items: ForgotItem[], names: Names, onAdjust: Adjust, onNote: (msg: string) => void }) {
  // a lista fica como estava ao abrir a reunião: a tarefa ajustada não some, mostra o que mudou
  const [items] = useState(now)
  if (!items.length) return null
  return (
    <section className="mt-agenda adj-sec" aria-labelledby="mt-esq">
      <div className="mt-ag-h" id="mt-esq">🧺 Ficou para trás (últimas 4 semanas)</div>
      <p className="row-s">Ajuste aqui mesmo: o que vocês escolherem já vale e entra no item 03.</p>
      <ul className="adj-l">{items.map(it => <AdjustRow key={it.task.id} item={it} names={names} onAdjust={onAdjust} onDone={onNote}/>)}</ul>
    </section>
  )
}

/** Início: uma tarefa esquecida 3 semanas seguidas, com a sugestão de ajuste. */
export function StuckCard({ task, more, names, onAdjust, onLater }: { task: Task, more: number, names: Names, onAdjust: Adjust, onLater: () => void }) {
  const lt = lighter(task)
  return (
    <section className="card adj-card" id="ajuste" aria-labelledby="adj-h">
      <div className="slbl" id="adj-h">💡 Sugestão de ajuste</div>
      <p className="adj-q">“{task.title}” ficou para trás nas últimas 3 semanas.{lt ? ` Que tal ${lt.label}?` : ' Que tal pausar um pouco ou trocar quem faz?'}</p>
      <ul className="adj-l"><AdjustRow item={{ task }} names={names} onAdjust={onAdjust} onDone={onLater}/></ul>
      <div className="adj-foot">
        <button className="lnk-inline" onClick={onLater}>Agora não</button>
        {more > 0 && <span className="row-s">+{more} na reunião da semana</span>}
      </div>
    </section>
  )
}
