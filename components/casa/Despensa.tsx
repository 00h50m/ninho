'use client'
// Casa › 🥫 Despensa: o que tem em casa, onde fica e quando vence. "Usar logo" no topo;
// "acabou" manda para a lista de compras; o que veio da última compra entra com um toque.
import { useState } from 'react'
import { PLACES, byPlace, guessPlace, fromShopping, urgency, urgencyLabel, useSoon, type PantryItem, type Place } from '@/lib/despensa'
import type { PantryInput } from '@/lib/services/despensaJantar'

export function PantryView({ ready, items, history, today, ideas = 0, onIdeas, onSave, onRemove, onFinished }: {
  ready: boolean, items: PantryItem[], today: string
  /** quantas receitas usam o que vence logo (vai para Casa › Jantar) */
  ideas?: number, onIdeas?: () => void
  history: Array<{ title: string, done_at: string | null }>
  onSave: (x: PantryInput) => Promise<void>, onRemove: (it: PantryItem) => Promise<void>, onFinished: (it: PantryItem) => Promise<void>
}) {
  const [form, setForm] = useState<PantryInput | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  if (!ready) return <div className="narrow"><div className="card empty"><span className="empty-icon">🥫</span>A despensa precisa da atualização do banco (migration 038).</div></div>
  const soon = useSoon(items, today)
  const groups = byPlace(items, today)
  const recent = fromShopping(history, items, today)
  const blank = (name = ''): PantryInput => ({ name, place: name ? guessPlace(name) : 'despensa', qty: null, expires_on: null })
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn() } catch { /* aviso já mostrado */ } finally { setBusy(null) } }
  return (
    <div className="narrow dp">
      <div className="sh"><div><h2>Despensa</h2><p>{items.length} item(ns) em casa{soon.length ? ` · ${soon.length} para usar logo` : ''}</p></div>
        {!form && <div className="sh-a"><button className="btn btn-p" onClick={() => setForm(blank())}>+ Item</button></div>}</div>
      {form && <PantryForm value={form} onCancel={() => setForm(null)} onSave={async v => { await onSave(v); setForm(null) }}/>}
      {!form && recent.length > 0 && <section className="card" aria-labelledby="dp-r">
        <div className="slbl" id="dp-r">📥 Da última compra</div>
        <p className="row-s">Toque para guardar na despensa (dá para pôr a validade).</p>
        <div className="fchips">{recent.map(t => <button key={t} className="fc" onClick={() => setForm(blank(t))}>+ {t}</button>)}</div>
      </section>}
      {soon.length > 0 && <section className="card dp-soon" aria-labelledby="dp-s">
        <div className="slbl" id="dp-s">⏰ Usar logo</div>
        <ul className="dp-list">{soon.map(it => <li key={it.id} className="dp-i"><span className="dp-t"><b>{it.name}</b><small className={`dp-u dp-${urgency(it, today).u}`}>{urgencyLabel(it, today)}{it.qty ? ` · ${it.qty}` : ''}</small></span></li>)}</ul>
        {ideas > 0 && onIdeas && <button className="btn btn-s" onClick={onIdeas}>🍲 {ideas} ideia{ideas === 1 ? '' : 's'} de jantar com isso</button>}
      </section>}
      {groups.length === 0 && !form && <div className="card empty"><span className="empty-icon">🥫</span>Nada anotado ainda. Comece pelo que vence: iogurte, carne, frios.</div>}
      {groups.map(g => <section key={g.place} className="card" aria-labelledby={`dp-${g.place}`}>
        <div className="slbl" id={`dp-${g.place}`}>{g.label} <span className="mono" style={{ color: 'var(--faint)' }}>{g.items.length}</span></div>
        <ul className="dp-list">{g.items.map(it => { const u = urgency(it, today).u; return <li key={it.id} className="dp-i">
          <button className="dp-t dp-edit" onClick={() => setForm({ id: it.id, name: it.name, place: it.place, qty: it.qty, expires_on: it.expires_on })} aria-label={`Editar ${it.name}`}>
            <b>{it.name}</b><small className={`dp-u dp-${u}`}>{urgencyLabel(it, today)}{it.qty ? ` · ${it.qty}` : ''}</small></button>
          <button className="btn btn-s" disabled={busy === it.id} onClick={() => run(it.id, () => onFinished(it))} aria-label={`${it.name} acabou: pôr na lista de compras`}>Acabou → 🛒</button>
          <button className="ib" disabled={busy === it.id} onClick={() => run(it.id, () => onRemove(it))} aria-label={`Tirar ${it.name} da despensa`} title="Usei / tirar">✕</button>
        </li> })}</ul>
      </section>)}
      <p className="row-s" style={{ textAlign: 'center' }}>"Acabou" tira da despensa e põe na lista de compras. ✕ só tira (usou, jogou fora).</p>
    </div>
  )
}

function PantryForm({ value, onSave, onCancel }: { value: PantryInput, onSave: (v: PantryInput) => Promise<void>, onCancel: () => void }) {
  const [v, setV] = useState(value), [busy, setBusy] = useState(false), [placeTouched, setPlaceTouched] = useState(!!value.id || !!value.name)
  return <section className="card dp-form" aria-label={v.id ? 'Editar item' : 'Novo item'}>
    <label className="onb-f"><span>O quê</span><input className="fi" value={v.name} maxLength={80} autoFocus placeholder="Ex.: iogurte natural"
      onChange={e => setV(x => ({ ...x, name: e.target.value, place: placeTouched ? x.place : guessPlace(e.target.value) }))}/></label>
    <div className="onb-q">Onde fica</div>
    <div className="onb-days wrap" role="radiogroup" aria-label="Onde fica">
      {PLACES.map(([k, l]) => <button key={k} role="radio" aria-checked={v.place === k} className={`onb-day wide ${v.place === k ? 'on' : ''}`} onClick={() => { setPlaceTouched(true); setV(x => ({ ...x, place: k as Place })) }}>{l}</button>)}
    </div>
    <div className="onb-row">
      <label className="onb-f"><span>Quantidade</span><input className="fi" value={v.qty || ''} maxLength={30} placeholder="opcional: 2 potes" onChange={e => setV(x => ({ ...x, qty: e.target.value }))}/></label>
      <label className="onb-f"><span>Validade</span><input className="fi" type="date" value={v.expires_on || ''} onChange={e => setV(x => ({ ...x, expires_on: e.target.value || null }))}/></label>
    </div>
    <div className="md-acts">
      <button className="btn btn-p" disabled={!v.name.trim() || busy} onClick={async () => { setBusy(true); try { await onSave(v) } catch { /* aviso já mostrado */ } finally { setBusy(false) } }}>{busy ? 'Salvando…' : v.id ? 'Salvar' : 'Guardar'}</button>
      <button className="btn btn-g" onClick={onCancel}>Cancelar</button>
    </div>
  </section>
}
