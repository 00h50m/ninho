'use client'
// Cardápio da semana (033): a IA monta 7 dias com o plano e os alimentos da pessoa;
// daqui dá para lançar a refeição de hoje e mandar os ingredientes para a lista de compras.
import { useState } from 'react'
import { buildMenu } from '@/lib/services/aiFiles'
import { dayTotals, shoppingList, type Menu, type MenuRow, type ShopLine } from '@/lib/cardapio'
import { MEALS, mealTotals, type Meal, type MealItem } from '@/lib/nutricao'
import { addDays } from '@/lib/dates'
import { marmitaPlan } from '@/lib/marmita'
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
  onUpdateMenu: (m: MenuRow, menu: Menu) => Promise<void>
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
  // ↻ trocar uma refeição (a IA sugere outra dentro do plano)
  const [swap, setSwap] = useState<{ key: string, reason: string, err?: string } | null>(null)
  // 🥡 modo marmita
  const [mar, setMar] = useState<{ from: string, days: number, meals: Meal[] } | null>(null)
  if (p.menusReady === false) return null

  async function doSwap(date: string, meal: Meal) {
    if (!row || !swap) return
    setBusy('swap:' + meal)
    const r = await buildMenu(p.householdId, { kcal: p.kcal, protein: p.protein, prefs: row.prefs || '', start: row.week_start, swap: { date, meal, reason: swap.reason } })
    if (r.ok === false) { setSwap(s => s && { ...s, err: r.error }); setBusy(null); return }
    try { await p.onUpdateMenu(row, r.data); setSwap(null) } catch { /* aviso já mostrado */ } finally { setBusy(null) }
  }

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
              <button className="lnk-inline" aria-expanded={swap?.key === day.date + m.meal} onClick={() => setSwap(swap?.key === day.date + m.meal ? null : { key: day.date + m.meal, reason: '' })} aria-label={`Trocar ${m.name}`}>↻ trocar</button>
              {day.date === p.today && <button className="btn btn-s" disabled={busy === m.meal} onClick={() => launch(m.items, m.meal, m.name)}>{busy === m.meal ? 'Lançando…' : 'Lançar'}</button>}</div>
            <ul>{m.items.map((i, k) => <li key={k}>{i.name} <small>{i.text && i.text !== i.name ? `· ${i.text}` : `· ${i.g} g`}{p.hide ? '' : ` · ${i.kcal} kcal`}</small></li>)}</ul>
            {swap?.key === day.date + m.meal && <div className="mn-swap">
              <label className="onb-f"><span>O que quer mudar? (opcional)</span>
                <input className="fi" value={swap.reason} maxLength={200} onChange={e => setSwap({ ...swap, reason: e.target.value, err: undefined })} placeholder="ex.: sem ovo, algo mais rápido, com peixe"/></label>
              <div className="md-acts">
                <button className="btn btn-p" disabled={busy === 'swap:' + m.meal} onClick={() => doSwap(day.date, m.meal)}>{busy === 'swap:' + m.meal ? 'Trocando…' : `↻ Trocar ${m.name.toLowerCase()}`}</button>
                <button className="btn btn-g" onClick={() => setSwap(null)}>Cancelar</button>
              </div>
              {swap.err && <p className="al-warn" role="alert">{swap.err}</p>}
            </div>}
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
          <button className="btn btn-s" aria-expanded={!!mar} onClick={() => setMar(mar ? null : { from: days.some(d => d.date === addDays(p.today, 1)) ? addDays(p.today, 1) : p.today, days: 4, meals: ['almoco', 'jantar'] })}>🥡 Modo marmita</button>
          {!redo && <button className="btn btn-g" onClick={() => setRedo(true)}>↻ Montar outro</button>}
          <button className="lnk-inline" onClick={() => { if (confirm('Apagar este cardápio?')) p.onStopMenu(row).catch(() => {}) }}>apagar</button>
        </div>}
        {mar && <Marmitas menu={row.menu} hide={p.hide} st={mar} onChange={setMar}/>}
        {redo && form}
      </>}
    </section>
  )
}

/** 🥡 Modo marmita: o que cozinhar de uma vez, quanto (pronto e cru), os potes e a ordem. */
function Marmitas({ menu, hide, st, onChange }: { menu: Menu, hide: boolean, st: { from: string, days: number, meals: Meal[] }, onChange: (s: { from: string, days: number, meals: Meal[] } | null) => void }) {
  const plan = marmitaPlan(menu, st.from, st.days, st.meals)
  const G = (g: number) => g >= 1000 ? `${String(Math.round(g / 100) / 10).replace('.', ',')} kg` : `${g} g`
  const toggle = (m: Meal) => onChange({ ...st, meals: st.meals.includes(m) ? st.meals.filter(x => x !== m) : [...st.meals, m] })
  return (
    <div className="mn-mar" role="group" aria-labelledby="mn-mar-t">
      <div className="mn-mh"><b id="mn-mar-t">🥡 Marmitas</b><button className="lnk-inline" onClick={() => onChange(null)}>fechar</button></div>
      <div className="mn-mar-opts">
        <span className="row-s">Começando</span>
        {menu.days.slice(0, 3).map(d => <button key={d.date} className={`onb-day ${st.from === d.date ? 'on' : ''}`} aria-pressed={st.from === d.date} onClick={() => onChange({ ...st, from: d.date })}>{wd(d.date)} {d.date.slice(8, 10)}</button>)}
        <span className="row-s">por</span>
        {[3, 4, 5].map(n => <button key={n} className={`onb-day ${st.days === n ? 'on' : ''}`} aria-pressed={st.days === n} onClick={() => onChange({ ...st, days: n })}>{n} dias</button>)}
      </div>
      <div className="mn-mar-opts">
        {(['almoco', 'jantar', 'lanche'] as Meal[]).map(m => <label key={m} className="rt-toggle mn-chk"><input type="checkbox" checked={st.meals.includes(m)} onChange={() => toggle(m)}/><span>{MEALS.find(x => x[0] === m)?.[2]}</span></label>)}
      </div>
      {!plan.potes.length ? <p className="row-s">Nada para preparar nesses dias e refeições.</p> : <>
        <p className="row-s"><b>{plan.potes.length} pote{plan.potes.length > 1 ? 's' : ''}</b> · cozinhe tudo de uma vez:</p>
        <ul className="mn-cook">{plan.cook.map(c => <li key={c.key}><b>{c.name}</b> <span className="mono">{G(c.g)}</span>{c.rawG ? <small> pronto · ≈ {G(c.rawG)} cru</small> : <small> pronto</small>}<small> · {c.portions} porç{c.portions > 1 ? 'ões' : 'ão'}</small></li>)}</ul>
        <ol className="mn-steps">{plan.steps.map(s => <li key={s}>{s}</li>)}</ol>
        <details className="mn-potes"><summary>Ver os potes ({plan.potes.length})</summary>
          <ul>{plan.potes.map(pt => <li key={pt.date + pt.meal}><b>{pt.label}</b>{pt.date >= (plan.freezeFrom || '9999') ? <small> · congelar</small> : null}<small> · {pt.items.map(i => `${i.name}${hide ? '' : ` ${i.g} g`}`).join(' + ')}</small></li>)}</ul>
        </details>
        {plan.fresh.length > 0 && <p className="row-s">Na hora (não vai no pote): {plan.fresh.join(', ')}.</p>}
      </>}
    </div>
  )
}
