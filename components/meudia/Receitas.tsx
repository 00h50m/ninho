'use client'
// Receitas (035): ingredientes escritos em texto e conferidos na tabela, rendimento em porções e
// modo de preparo. "Lançar porção" registra a refeição com as calorias divididas pelo rendimento;
// "🛒 Ingredientes" manda tudo para a lista de compras da casa.
import { useMemo, useState } from 'react'
import { MEALS, mealForTime, mealTotals, parseMeal, type Meal, type MealItem } from '@/lib/nutricao'
import { perPortion, portionItems, recipeShopping, toRecipe, type Recipe } from '@/lib/receitas'
import type { FoodTabProps } from './Alimentacao'

const K = (v: number) => Math.round(v).toLocaleString('pt-BR')
const N1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
const num = (v: string) => v.trim() ? Number(v.replace(',', '.')) : NaN

export function RecipesCard(p: FoodTabProps & { hide: boolean }) {
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null)
  const mine = p.recipes.filter(r => r.who === p.me)
  if (p.recipesReady === false) return <section className="card" aria-labelledby="rc-t">
    <div className="slbl" id="rc-t">📖 Receitas</div>
    <div className="row-s">As receitas ainda não estão ativas: falta rodar a atualização do banco (migration 035) no Supabase.</div>
  </section>
  return (
    <section className="card" aria-labelledby="rc-t">
      <div className="slbl" id="rc-t">📖 Receitas <span className="mono" style={{ color: 'var(--faint)' }}>{mine.length}</span></div>
      {!editing && <>
        {mine.length === 0 && <p className="row-s">Guarde as receitas que vocês fazem sempre: o Ninho calcula as calorias por porção, lança no seu dia com um toque e manda os ingredientes para as compras.</p>}
        {mine.map(r => <RecipeRow key={r.id} r={r} {...p} onEdit={() => setEditing(r)}/>)}
        <button className="btn btn-s" style={{ marginTop: 8 }} onClick={() => setEditing('new')}>+ Nova receita</button>
      </>}
      {editing && <RecipeForm {...p} initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)}/>}
    </section>
  )
}

function RecipeRow({ r, hide, nowHM, onAdd, onStopRecipe, onRecipeToShopping, onEdit }: FoodTabProps & { r: Recipe, hide: boolean, onEdit: () => void }) {
  const [mode, setMode] = useState<'idle' | 'lancar' | 'ver'>('idle')
  const [meal, setMeal] = useState<Meal>(() => mealForTime(nowHM)), [portions, setPortions] = useState(1), [busy, setBusy] = useState(false)
  const pp = perPortion(r)
  async function launch() {
    setBusy(true)
    try {
      const items = portionItems(r, portions)
      await onAdd('refeicao', mealTotals(items).kcal, { meal, text: `${N1(portions)} porção(ões) de ${r.name}`.slice(0, 500), items, recipe_id: r.id })
      setMode('idle'); setPortions(1)
    } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  async function shop() {
    setBusy(true)
    try { await onRecipeToShopping(recipeShopping(r)) } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return <div className="rc-row">
    <div className="al-sv">
      <span className="al-sv-n"><b>{r.name}</b><small>rende {N1(r.servings)} porção(ões){hide ? '' : ` · ${K(pp.kcal)} kcal e ${N1(pp.p)} g de proteína por porção`}</small></span>
      <button className="btn btn-s" disabled={busy} aria-expanded={mode === 'lancar'} onClick={() => setMode(m => m === 'lancar' ? 'idle' : 'lancar')} aria-label={`Lançar porção de ${r.name}`}>Lançar</button>
      <button className="lnk-inline" aria-expanded={mode === 'ver'} onClick={() => setMode(m => m === 'ver' ? 'idle' : 'ver')}>ver</button>
    </div>
    {mode === 'lancar' && <div className="rc-launch">
      <div className="onb-days wrap" role="radiogroup" aria-label="Refeição">
        {MEALS.map(([k, ic, l]) => <button key={k} role="radio" aria-checked={meal === k} className={`onb-day wide ${meal === k ? 'on' : ''}`} onClick={() => setMeal(k)}>{ic} {l}</button>)}
      </div>
      <div className="onb-days wrap" role="radiogroup" aria-label="Quantas porções">
        {[0.5, 1, 1.5, 2].map(v => <button key={v} role="radio" aria-checked={portions === v} className={`onb-day ${portions === v ? 'on' : ''}`} onClick={() => setPortions(v)}>{N1(v)}</button>)}
      </div>
      <div className="md-acts">
        <button className="btn btn-p" disabled={busy} onClick={launch}>{busy ? 'Salvando…' : hide ? 'Lançar no meu dia' : `Lançar (${K(pp.kcal * portions)} kcal)`}</button>
        <button className="btn btn-g" onClick={() => setMode('idle')}>Cancelar</button>
      </div>
    </div>}
    {mode === 'ver' && <div className="rc-detail">
      <ul className="rc-ings">{r.items.map((i, k) => <li key={k}>{i.name}{i.g ? ` · ${i.g} ${i.unit === 'ml' ? 'ml' : 'g'}` : ''}{hide ? '' : ` · ${K(i.kcal)} kcal`}</li>)}</ul>
      {r.steps && <p className="rc-steps">{r.steps}</p>}
      <div className="md-acts">
        <button className="btn btn-s" disabled={busy} onClick={shop}>🛒 Ingredientes na lista</button>
        <button className="btn btn-g" onClick={onEdit}>Editar</button>
        <button className="btn btn-g" onClick={() => { if (confirm(`Remover a receita "${r.name}"?`)) onStopRecipe(r).catch(() => {}) }}>Remover</button>
      </div>
    </div>}
  </div>
}

/** Texto dos ingredientes de volta (para editar): "500 g de Frango, 200 g de Arroz…". */
const itemsText = (items: MealItem[]) => items.map(i => i.g ? `${i.g} ${i.unit === 'ml' ? 'ml' : 'g'} de ${i.name}` : i.name).join('\n')

function RecipeForm(p: FoodTabProps & { initial: Recipe | null, hide: boolean, onDone: () => void }) {
  const ini = p.initial
  const [name, setName] = useState(ini?.name || ''), [servings, setServings] = useState(ini ? N1(ini.servings) : '4')
  const [text, setText] = useState(ini ? itemsText(ini.items) : ''), [steps, setSteps] = useState(ini?.steps || '')
  const [items, setItems] = useState<MealItem[] | null>(ini ? ini.items : null), [busy, setBusy] = useState(false)
  const custom = useMemo(() => p.foods.filter(f => f.who === p.me), [p.foods, p.me])
  const valid = items?.filter(i => i.kcal > 0) || []
  const data = items ? toRecipe(name, num(servings), valid, steps) : null
  const pp = data ? perPortion(data) : null
  async function save() {
    if (!data) return
    setBusy(true)
    try { await p.onSaveRecipe({ id: ini?.id, ...data }); p.onDone() } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return <div className="rc-form">
    <div className="onb-row">
      <label className="onb-f"><span>Nome da receita</span><input className="fi" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Ex.: Escondidinho de frango"/></label>
      <label className="onb-f"><span>Rende (porções)</span><input className="fi" inputMode="decimal" value={servings} onChange={e => setServings(e.target.value)} placeholder="4"/></label>
    </div>
    <label className="onb-f"><span>Ingredientes (um por linha ou separados por vírgula)</span>
      <textarea className="fi rc-text" rows={4} maxLength={2000} value={text} onChange={e => { setText(e.target.value); setItems(null) }} placeholder={'500 g de peito de frango\n800 g de batata\n1 xícara de leite'}/></label>
    {!items && <div className="md-acts" style={{ marginTop: 0 }}><button className="btn btn-s" disabled={!text.trim()} onClick={() => setItems(parseMeal(text.replace(/\n+/g, ', '), custom))}>Conferir ingredientes</button></div>}
    {items && <>
      <ul className="al-items">{items.map((it, i) => <li key={`${i}:${it.name}`} className={`al-item ${it.kcal > 0 ? '' : 'miss'}`}>
        <span className="rc-in">{it.name}{it.g ? ` · ${it.g} ${it.unit === 'ml' ? 'ml' : 'g'}` : ''}</span>
        {it.kcal > 0 ? <span className="al-k mono">{p.hide ? '' : `${K(it.kcal)} kcal`}</span>
          : <>{!p.hide && <input className="fi al-q" inputMode="numeric" placeholder="kcal" aria-label={`Calorias de ${it.name}`} onBlur={e => { const k = num(e.target.value); setItems(l => l && l.map((x, j) => j === i ? { ...x, kcal: k > 0 ? Math.round(k) : 0 } : x)) }}/>}
            <span className="al-miss">Não achei na tabela{p.hide ? '' : ': informe as calorias'} ou fica de fora.</span></>}
        <button className="ib" aria-label={`Tirar ${it.name}`} onClick={() => setItems(l => l && l.filter((_, j) => j !== i))}>✕</button>
      </li>)}</ul>
      {pp && !p.hide && <p className="al-prev" aria-live="polite">Total <b>{K(data!.kcal)} kcal</b> · por porção <b>{K(pp.kcal)} kcal</b> e {N1(pp.p)} g de proteína.</p>}
    </>}
    <label className="onb-f"><span>Modo de preparo</span>
      <textarea className="fi" rows={3} maxLength={3000} value={steps} onChange={e => setSteps(e.target.value)} placeholder="opcional"/></label>
    {items && !(num(servings) >= 0.5 && num(servings) <= 50) && <small className="al-warn">O rendimento fica entre ½ e 50 porções.</small>}
    <div className="md-acts">
      <button className="btn btn-p" disabled={!data || busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar receita'}</button>
      <button className="btn btn-g" onClick={p.onDone}>Cancelar</button>
    </div>
  </div>
}
