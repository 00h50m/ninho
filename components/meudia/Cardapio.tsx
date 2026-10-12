'use client'
// Cardápio da semana (033): a IA monta 7 dias com o plano e os alimentos da pessoa;
// daqui dá para lançar a refeição de hoje e mandar os ingredientes para a lista de compras.
import { useState } from 'react'
import { buildMenu } from '@/lib/services/aiFiles'
import { dayTotals, shoppingList, type Menu, type MenuRow, type ShopLine } from '@/lib/cardapio'
import { MEALS, mealTotals, type MealItem } from '@/lib/nutricao'
import type { PKind } from '@/lib/meudia'
import type { Who } from '@/lib/types'

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const wd = (d: string) => WD[new Date(`${d}T12:00:00Z`).getUTCDay()]
const K = (v: number) => Math.round(v).toLocaleString('pt-BR')

export function MenuCard(p: {
  householdId: string, me: Who, today: string, menus: MenuRow[], menusReady?: boolean, kcal: number, protein: number, hide: boolean
  onSaveMenu: (start: string, menu: Menu, prefs: string | null) => Promise<void>
  onStopMenu: (m: MenuRow) => Promise<void>
  onMenuToShopping: (lines: ShopLine[]) => Promise<void>
  onAdd: (kind: PKind, value: number | null, data?: Record<string, any>) => Promise<void>
}) {
  const row = p.menus.find(m => m.who === p.me) || null
  const [prefs, setPrefs] = useState(row?.prefs || '')
  const [st, setSt] = useState<{ s: 'busy' } | { s: 'err', msg: string } | null>(null)
  const [redo, setRedo] = useState(false)
  const days = row?.menu.days || []
  const [sel, setSel] = useState<string | null>(null)
  const day = days.find(d => d.date === sel) || days.find(d => d.date === p.today) || days[0]
  const [shop, setShop] = useState<{ lines: ShopLine[], off: Set<string> } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  if (p.menusReady === false) return null

  async function build() {
    setSt({ s: 'busy' })
    const r = await buildMenu(p.householdId, { kcal: p.kcal, protein: p.protein, prefs, start: p.today })
    if (r.ok === false) { setSt({ s: 'err', msg: r.error }); return }
    try { await p.onSaveMenu(p.today, r.data, prefs); setSt(null); setRedo(false); setSel(null) } catch { setSt(null) }
  }
  async function launch(items: MealItem[], meal: string, name: string) {
    setBusy(meal)
    try { await p.onAdd('refeicao', mealTotals(items).kcal, { meal, text: `${name} (cardápio)`, items }) } catch { /* aviso já mostrado */ } finally { setBusy(null) }
  }

  const form = <div className="mn-form">
    <label className="onb-f"><span>Preferências para a semana (opcional)</span>
      <input className="fi" value={prefs} maxLength={300} onChange={e => setPrefs(e.target.value)} placeholder="ex.: marmita no almoço, sem peixe, jantar rápido"/></label>
    <div className="md-acts">
      <button className="btn btn-p" disabled={st?.s === 'busy'} onClick={build}>{st?.s === 'busy' ? 'Montando… (pode levar 1 minuto)' : row ? '↻ Montar de novo' : '🗓️ Montar cardápio da semana'}</button>
      {row && redo && <button className="btn btn-g" onClick={() => setRedo(false)}>Cancelar</button>}
    </div>
    {st?.s === 'err' && <p className="al-warn" role="alert">{st.msg}</p>}
  </div>

  return (
    <section className="card mn" aria-labelledby="mn-t">
      <div className="slbl" id="mn-t">🗓️ Cardápio da semana</div>
      {!row ? <>
        <p className="row-s">A IA monta 7 dias com o seu plano, os seus alimentos e as refeições salvas, perto da meta{p.hide ? '' : ` (${K(p.kcal)} kcal e ${p.protein} g de proteína por dia)`}. Depois você lança a refeição com um toque e manda os ingredientes para a lista de compras.</p>
        {form}
      </> : <>
        <div className="mn-days" role="tablist" aria-label="Dias do cardápio">
          {days.map(d => <button key={d.date} role="tab" aria-selected={d.date === day?.date} className={`mn-day ${d.date === day?.date ? 'on' : ''} ${d.date === p.today ? 'mn-today' : ''}`} onClick={() => setSel(d.date)}>
            <b>{wd(d.date)}</b><small>{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</small></button>)}
        </div>
        {day && <div className="mn-body" role="tabpanel">
          {!p.hide && (() => { const t = dayTotals(day); return <p className="row-s mn-tot">{day.date === p.today ? 'Hoje' : `${wd(day.date)}, ${day.date.slice(8, 10)}/${day.date.slice(5, 7)}`}: <b>{K(t.kcal)} kcal</b> · <b>{t.p} g</b> de proteína</p> })()}
          {day.meals.map(m => <div key={m.meal + m.name} className="mn-meal">
            <div className="mn-mh"><b>{MEALS.find(x => x[0] === m.meal)?.[1]} {m.name}</b>{!p.hide && <small className="mono">{K(mealTotals(m.items).kcal)} kcal</small>}
              {day.date === p.today && <button className="btn btn-s" disabled={busy === m.meal} onClick={() => launch(m.items, m.meal, m.name)}>{busy === m.meal ? 'Lançando…' : 'Lançar'}</button>}</div>
            <ul>{m.items.map((i, k) => <li key={k}>{i.name} <small>{i.text && i.text !== i.name ? `· ${i.text}` : `· ${i.g} g`}{p.hide ? '' : ` · ${i.kcal} kcal`}</small></li>)}</ul>
          </div>)}
        </div>}
        {row.menu.note && <p className="row-s">💡 {row.menu.note}</p>}
        {shop ? <div className="mn-shop" role="group" aria-label="Ingredientes para a lista de compras">
          <p className="row-s">Ingredientes de hoje até {wd(days[days.length - 1].date)}, somados. Desmarque o que já tem em casa:</p>
          <ul>{shop.lines.map(l => <li key={l.key}><label className="rt-toggle mn-chk"><input type="checkbox" checked={!shop.off.has(l.key)} onChange={e => setShop(s => { if (!s) return s; const off = new Set(s.off); if (e.target.checked) off.delete(l.key); else off.add(l.key); return { ...s, off } })}/><span>{l.title} <small>{l.qty}</small></span></label></li>)}</ul>
          <div className="md-acts">
            <button className="btn btn-p" disabled={busy === 'shop' || shop.lines.every(l => shop.off.has(l.key))} onClick={async () => { setBusy('shop'); try { await p.onMenuToShopping(shop.lines.filter(l => !shop.off.has(l.key))); setShop(null) } catch { /* aviso */ } finally { setBusy(null) } }}>
              {busy === 'shop' ? 'Mandando…' : `🛒 Mandar ${shop.lines.filter(l => !shop.off.has(l.key)).length} para Compras`}</button>
            <button className="btn btn-g" onClick={() => setShop(null)}>Cancelar</button>
          </div>
        </div> : <div className="md-acts">
          <button className="btn btn-s" onClick={() => setShop({ lines: shoppingList(row.menu, p.today), off: new Set() })}>🛒 Lista de compras</button>
          {!redo && <button className="btn btn-g" onClick={() => setRedo(true)}>↻ Montar outro</button>}
          <button className="lnk-inline" onClick={() => { if (confirm('Apagar este cardápio?')) p.onStopMenu(row).catch(() => {}) }}>apagar</button>
        </div>}
        {redo && form}
      </>}
    </section>
  )
}
