'use client'
// Casa › 🍲 Jantar: o cardápio da casa da semana, quem cozinha cada dia e os ingredientes
// (das receitas) juntos na lista de compras. As duas veem e editam.
import { useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { addDays, fmtDate, weekStartOf } from '@/lib/dates'
import { cookLabel, weekPlan, weekShopping, type Cook, type HouseMeal } from '@/lib/jantar'
import { recipeShopping, type Recipe } from '@/lib/receitas'
import type { MealInput } from '@/lib/services/despensaJantar'

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const first = (n: string) => (n || '').split(' ')[0]

export function DinnerView({ ready, meals, recipes, names, today, onSave, onDelete, onShopping }: {
  ready: boolean, meals: HouseMeal[], recipes: Recipe[], names: Names, today: string
  onSave: (x: MealInput) => Promise<void>, onDelete: (m: HouseMeal) => Promise<void>, onShopping: (lines: Array<{ title: string, qty: string }>) => Promise<void>
}) {
  const [week, setWeek] = useState(weekStartOf(today))
  const [edit, setEdit] = useState<MealInput | null>(null)
  const [busy, setBusy] = useState(false)
  if (!ready) return <div className="narrow"><div className="card empty"><span className="empty-icon">🍲</span>O jantar das duas precisa da atualização do banco (migration 038).</div></div>
  const plan = weekPlan(meals, week)
  const planned = plan.flatMap(d => d.meal ? [d.meal] : [])
  const lines = weekShopping(planned.filter(m => m.date >= today))
  const cooks = planned.reduce((a, m) => { if (m.cook === 'g' || m.cook === 's') a[m.cook]++; return a }, { g: 0, s: 0 } as Record<Who, number>)
  const cur = weekStartOf(today)
  return (
    <div className="narrow jt">
      <div className="sh"><div><h2>Jantar das duas</h2><p>Quem cozinha cada dia{planned.length ? ` · ${first(names.g)} ${cooks.g} · ${first(names.s)} ${cooks.s}` : ''}</p></div></div>
      <div className="cm-nav">
        <button className="ib" aria-label="Semana anterior" onClick={() => setWeek(w => addDays(w, -7))}>‹</button>
        <b className="cm-m">{week === cur ? 'Esta semana' : week === addDays(cur, 7) ? 'Próxima semana' : `Semana de ${fmtDate(week)}`}</b>
        <button className="ib" aria-label="Próxima semana" onClick={() => setWeek(w => addDays(w, 7))}>›</button>
      </div>
      {edit && <MealForm value={edit} recipes={recipes} names={names} onCancel={() => setEdit(null)} onSave={async v => { await onSave(v); setEdit(null) }}/>}
      <section className="card">
        <ul className="jt-list">{plan.map(({ date, meal }) => <li key={date} className={`jt-d ${date === today ? 'jt-today' : ''} ${date < today ? 'jt-past' : ''}`}>
          <span className="jt-day"><b>{DOW[new Date(`${date}T12:00:00Z`).getUTCDay()]}</b><small className="mono">{fmtDate(date)}</small></span>
          {meal ? <button className="jt-m" onClick={() => setEdit({ date, title: meal.title, cook: meal.cook, recipe_id: meal.recipe_id, ingredients: meal.ingredients, notes: meal.notes })} aria-label={`Editar o jantar de ${fmtDate(date)}`}>
            <b>{meal.title}</b><small>🍳 {cookLabel(meal.cook, names)}{meal.ingredients.length ? ` · ${meal.ingredients.length} ingrediente(s)` : ''}{meal.notes ? ` · ${meal.notes}` : ''}</small></button>
            : <button className="jt-m jt-empty" onClick={() => setEdit({ date, title: '', cook: null, recipe_id: null, ingredients: [], notes: null })}>+ planejar</button>}
          {meal && <button className="ib" aria-label={`Tirar o jantar de ${fmtDate(date)}`} onClick={() => { if (confirm(`Tirar "${meal.title}" de ${fmtDate(date)}?`)) onDelete(meal).catch(() => {}) }}>✕</button>}
        </li>)}</ul>
      </section>
      {lines.length > 0 && <div className="md-acts">
        <button className="btn btn-s" disabled={busy} onClick={async () => { setBusy(true); try { await onShopping(lines) } catch { /* aviso já mostrado */ } finally { setBusy(false) } }}>🛒 Ingredientes da semana ({lines.length})</button>
      </div>}
      <p className="row-s">Escolha uma receita (as suas e as que a outra compartilhou) para os ingredientes irem juntos; ou escreva o prato. O jantar de hoje aparece no Início e no bom dia do Telegram.</p>
    </div>
  )
}

function MealForm({ value, recipes, names, onSave, onCancel }: { value: MealInput, recipes: Recipe[], names: Names, onSave: (v: MealInput) => Promise<void>, onCancel: () => void }) {
  const [v, setV] = useState(value), [busy, setBusy] = useState(false)
  const pick = (title: string) => {
    const r = recipes.find(x => x.name.toLowerCase() === title.trim().toLowerCase())
    setV(x => ({ ...x, title, recipe_id: r ? r.id : null, ingredients: r ? recipeShopping(r) : x.recipe_id ? [] : x.ingredients }))
  }
  const rec = v.recipe_id ? recipes.find(r => r.id === v.recipe_id) : null
  return <section className="card jt-form" aria-label={`Jantar de ${fmtDate(v.date)}`}>
    <div className="slbl">🍲 Jantar de {fmtDate(v.date)}</div>
    <datalist id="jt-rec">{recipes.map(r => <option key={r.id} value={r.name}/>)}</datalist>
    <label className="onb-f"><span>O que vai ter</span><input className="fi" list="jt-rec" value={v.title} maxLength={80} autoFocus placeholder={recipes.length ? 'Escolha uma receita ou escreva' : 'Ex.: Escondidinho de frango'} onChange={e => pick(e.target.value)}/></label>
    {rec && <small className="row-s">📖 Receita da {first(names[rec.who])} · {v.ingredients.length} ingrediente(s) para as compras</small>}
    <div className="onb-q">Quem cozinha</div>
    <div className="onb-days wrap" role="radiogroup" aria-label="Quem cozinha">
      {([['g', first(names.g)], ['s', first(names.s)], ['both', 'As duas'], [null, 'A combinar']] as Array<[Cook, string]>).map(([k, l]) =>
        <button key={String(k)} role="radio" aria-checked={v.cook === k} className={`onb-day wide ${v.cook === k ? 'on' : ''}`} onClick={() => setV(x => ({ ...x, cook: k }))}>{l}</button>)}
    </div>
    <label className="onb-f"><span>Observação</span><input className="fi" value={v.notes || ''} maxLength={300} placeholder="opcional: tirar a carne do freezer de manhã" onChange={e => setV(x => ({ ...x, notes: e.target.value }))}/></label>
    <div className="md-acts">
      <button className="btn btn-p" disabled={!v.title.trim() || busy} onClick={async () => { setBusy(true); try { await onSave(v) } catch { /* aviso já mostrado */ } finally { setBusy(false) } }}>{busy ? 'Salvando…' : 'Salvar'}</button>
      <button className="btn btn-g" onClick={onCancel}>Cancelar</button>
    </div>
  </section>
}
