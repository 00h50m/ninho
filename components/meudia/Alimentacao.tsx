'use client'
// Alimentação no Meu dia: perfil e meta, saldo do dia (comido × meta + treino),
// refeição escrita em texto e conferida item a item, semana e peso com previsão.
// Tudo é estimativa e fica só com a dona, a não ser que ela compartilhe.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Who } from '@/lib/types'
import { fmtDate } from '@/lib/dates'
import { bodySeries, type PKind, type PLog, type PMed, type PSettings } from '@/lib/meudia'
import type { DietPlan, PlanFood, PlanRow } from '@/lib/dietPlan'
import { readLabelPhoto, readPlatePhoto } from '@/lib/services/aiFiles'
import { catalogFoods, type CatalogFood, type CatalogResult } from '@/lib/foodCatalog'
import type { LabelRead } from '@/lib/foodLabel'
import { PlanCard } from './Plano'
import type { MdFocus } from './MeuDia'
import { toSaved, type SavedMeal } from '@/lib/savedMeals'
import { FOODS, type Food, type FoodUnit } from '@/lib/foods'
import {
  ACTIVITIES, GOALS, MEALS, SAFE_MIN, calorieTarget, customToFood, dayFood, dayWord, etaDate, itemFor, kcalWeek, mealForTime, mealTotals, mealsOn, norm, parseMeal, weightTrend,
  type Activity, type CustomFood, type FoodProfile, type Goal, type Meal, type MealItem,
} from '@/lib/nutricao'
import { LineChart } from './LineChart'
import { PROTEIN_DEFAULT, proteinTarget } from '@/lib/protein'
import { ProteinCard } from './Proteina'
import { MenuCard } from './Cardapio'
import { BarcodeBox } from './Barcode'
import type { Menu, MenuRow, ShopLine } from '@/lib/cardapio'
import { WeekBars } from './SleepBars'
import { RecipesCard } from './Receitas'
import type { Recipe } from '@/lib/receitas'

const K = (v: number) => Math.round(v).toLocaleString('pt-BR')
const N1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
const PACE = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')
const num = (v: string) => v.trim() ? Number(v.replace(',', '.')) : NaN
const UNIT_LABEL: Record<string, string> = {
  un: 'unidade', fatia: 'fatia', colher: 'colher (sopa)', colherinha: 'colher (chá)', xicara: 'xícara', concha: 'concha', copo: 'copo', lata: 'lata', taca: 'taça',
  escumadeira: 'escumadeira', pote: 'pote', medida: 'medida', bola: 'bola', porcao: 'porção', punhado: 'punhado', file: 'filé', tigela: 'tigela', g: 'g', ml: 'ml',
}

export interface FoodTabProps {
  householdId: string, me: Who, today: string, nowHM: string, logs: PLog[], profiles: FoodProfile[], foods: CustomFood[], foodReady?: boolean
  saved: SavedMeal[], savedReady?: boolean
  menus: MenuRow[], menusReady?: boolean
  recipes: Recipe[], recipesReady?: boolean
  meds: PMed[], settings: PSettings[], plans: PlanRow[], plansReady?: boolean, focus?: MdFocus
  onAdd: (kind: PKind, value: number | null, data?: Record<string, any>) => Promise<void>
  onRemove: (l: PLog) => Promise<void>
  onSaveProfile: (p: Omit<FoodProfile, 'who'>) => Promise<void>
  onSaveFood: (f: Omit<CustomFood, 'id' | 'who'> & { id?: string }) => Promise<void>
  onStopFood: (f: CustomFood) => Promise<void>
  onSaveFoods: (list: PlanFood[]) => Promise<void>
  onImportFoods: (list: CatalogFood[]) => Promise<void>
  onSaveMenu: (start: string, menu: Menu, prefs: string | null) => Promise<void>
  onStopMenu: (m: MenuRow) => Promise<void>
  onMenuToShopping: (lines: ShopLine[]) => Promise<void>
  onUpdateMenu: (m: MenuRow, menu: Menu) => Promise<void>
  onSaveMeal: (m: { id?: string, name: string, items: MealItem[], kcal: number }) => Promise<void>
  onStopMeal: (m: SavedMeal) => Promise<void>
  onUseMeal: (m: SavedMeal) => void
  onSaveRecipe: (r: { id?: string, name: string, servings: number, items: MealItem[], steps: string | null, kcal: number }) => Promise<void>
  onStopRecipe: (r: Recipe) => Promise<void>
  onRecipeToShopping: (lines: Array<{ title: string, qty: string }>) => Promise<void>
  onSavePlan: (plan: DietPlan, source: string | null) => Promise<void>
  onPlanRemind: (p: PlanRow, remind: boolean) => Promise<void>
  onStopPlan: (p: PlanRow) => Promise<void>
  onSaveMed: (m: { id?: string, name: string, dose: string | null, times: string[] }) => Promise<void>
  onSaveSettings: (s: Partial<Omit<PSettings, 'who'>>) => Promise<void>
}

export function FoodTab(p: FoodTabProps) {
  const [editing, setEditing] = useState(false)
  // atalho do menu / ação rápida: rola até o cartão pedido
  useEffect(() => {
    const w = p.focus?.what
    if (!w) return
    const t = setTimeout(() => {
      const id = w === 'refeicao' ? 'al-add' : w === 'cardapio' ? 'mn-t' : w === 'rotulo' ? 'al-meus' : 'pl-hoje'
      const el = document.getElementById(id) || document.getElementById('pl-novo')
      el?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (w === 'refeicao') (document.querySelector('.al-text') as HTMLTextAreaElement | null)?.focus({ preventScroll: true })
      // a câmera só abre com um toque da pessoa: deixa o botão da foto do rótulo pronto (em foco)
      if (w === 'rotulo') (document.querySelector('.fc-acts .btn') as HTMLButtonElement | null)?.focus({ preventScroll: true })
    }, 150)
    return () => clearTimeout(t)
  }, [p.focus?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  if (p.foodReady === false) return <div className="card empty"><span className="empty-icon">🍽️</span>A Alimentação ainda não está ativa: falta rodar a atualização do banco (migration 026) no Supabase.</div>
  const prof = p.profiles.find(x => x.who === p.me)
  const weights = bodySeries(p.logs, p.me, 'weight')
  const w = weights.length ? weights[weights.length - 1].v : null
  if (!prof || w == null || editing) return <>
    <ProfileForm {...p} prof={prof} weight={w} onDone={() => setEditing(false)} canCancel={!!prof && w != null}/>
    {/* o plano da nutricionista não depende da meta de calorias */}
    {!editing && <PlanCard {...p} hide={!!prof?.hide_numbers}/>}
  </>
  const t = calorieTarget(prof, w, Number(p.today.slice(0, 4)))
  const d = dayFood(p.logs, p.me, p.today, t.kcal, w)
  const hide = prof.hide_numbers
  const pctEaten = Math.min(100, Math.round(d.eaten / Math.max(1, d.target + d.exercise) * 100))
  return (
    <>
      <section className="card md-card" aria-labelledby="al-dia">
        <div className="slbl" id="al-dia">🍽️ Hoje</div>
        {hide ? <div className="al-big"><b>{dayWord(d)}</b><span>{d.meals} refeição(ões) registrada(s)</span></div>
          : <div className="al-big"><b className="mono">{d.left >= 0 ? K(d.left) : K(-d.left)} kcal</b><span>{d.left >= 0 ? 'restam para hoje' : 'acima da meta de hoje'}</span></div>}
        <div className="bar" role="progressbar" aria-valuenow={pctEaten} aria-valuemin={0} aria-valuemax={100} aria-label="Quanto já comeu da meta de hoje"><div className="barf" style={{ width: `${pctEaten}%`, background: 'var(--pri)' }}/></div>
        {!hide && <dl className="sl-stats al-stats">
          <div><dt>Meta</dt><dd><b className="mono">{K(d.target)}</b><small>kcal</small></dd></div>
          <div><dt>Comido</dt><dd><b className="mono">{K(d.eaten)}</b><small>kcal</small></dd></div>
          <div><dt>Treino</dt><dd><b className="mono">+{K(d.exercise)}</b><small>kcal (estimativa)</small></dd></div>
          <div><dt>Proteína · Carbo · Gordura</dt><dd><b className="mono al-mac">{d.p} · {d.c} · {d.f}</b><small>gramas</small></dd></div>
        </dl>}
      </section>
      <ProteinCard prof={prof} weight={w} eatenP={d.p} kcalLeft={d.left} foods={p.foods.filter(f => f.who === p.me)} nowHM={p.nowHM} onAdd={p.onAdd}/>

      <nav className="md-jump" aria-label="Ir para">
        {([['pl-hoje', '📋 Plano'], ['mn-t', '🗓️ Cardápio'], ['al-add', '✍️ Registrar'], ['al-hoje', '🍽️ Refeições de hoje'], ['rc-t', '📖 Receitas'], ['al-semana', '📊 Semana'], ['al-peso', '⚖️ Peso'], ['al-meus', '🥗 Meus alimentos']] as Array<[string, string]>)
          .map(([id, l]) => <button key={id} className="fc" onClick={() => (document.getElementById(id) || (id === 'pl-hoje' ? document.getElementById('pl-novo') : null))?.closest('.card, details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{l}</button>)}
      </nav>
      <PlanCard {...p} hide={hide}/>
      <MenuCard householdId={p.householdId} me={p.me} today={p.today} menus={p.menus} menusReady={p.menusReady} kcal={t.kcal} protein={proteinTarget(prof, w).g} hide={hide}
        onSaveMenu={p.onSaveMenu} onStopMenu={p.onStopMenu} onMenuToShopping={p.onMenuToShopping} onUpdateMenu={p.onUpdateMenu} onAdd={p.onAdd}/>
      <MealForm {...p} hide={hide}/>
      <MealsToday {...p} hide={hide}/>
      <RecipesCard {...p} hide={hide}/>

      {!hide && <section className="card" aria-labelledby="al-semana">
        <div className="slbl" id="al-semana">Calorias da semana</div>
        {kcalWeek(p.logs, p.me, p.today).some(x => x.h != null)
          ? <WeekBars days={kcalWeek(p.logs, p.me, p.today)} goal={t.kcal} today={p.today} unit="kcal" what="Calorias" col="Dia"/>
          : <div className="lc-empty">Registre as refeições para ver a semana.</div>}
      </section>}

      <WeightCard {...p} prof={prof} series={weights}/>

      <MyFoods {...p}/>

      <details className="card al-cfg">
        <summary>⚙️ Minha meta de calorias</summary>
      <section className="al-sub" aria-labelledby="al-meta">
        <div className="slbl" id="al-meta">Minha meta</div>
        <p className="row-s">
          {t.manual ? <>Meta definida por você: <b>{K(t.kcal)} kcal</b> por dia.</>
            : <>Gasto estimado: <b>{K(t.tdee)} kcal</b> por dia. Meta: <b>{K(t.kcal)} kcal</b> ({GOALS.find(g => g[0] === prof.goal)?.[1].toLowerCase()}{prof.goal !== 'manter' ? `, ${PACE(prof.pace_kg_week)} kg por semana` : ''}).</>}
          {' '}Os treinos que você registra somam à parte.
        </p>
        {t.clamped && <p className="row-s al-warn">Nesse ritmo a conta daria menos de {K(SAFE_MIN[prof.sex])} kcal, então a meta ficou nesse mínimo. Um ritmo mais leve costuma ser mais fácil de manter.</p>}
        {t.manual && t.kcal < SAFE_MIN[prof.sex] && <p className="row-s al-warn">Essa meta está abaixo de {K(SAFE_MIN[prof.sex])} kcal. Sem acompanhamento de nutricionista, não é recomendado.</p>}
        <button className="btn btn-s" onClick={() => setEditing(true)}>Editar perfil e meta</button>
        <p className="row-s" style={{ marginTop: 8 }}>São estimativas para o dia a dia. Para um plano individual, gestação ou alguma condição de saúde, fale com nutricionista ou médica.</p>
      </section>
      </details>
    </>
  )
}

function ProfileForm(p: FoodTabProps & { prof?: FoodProfile, weight: number | null, onDone: () => void, canCancel: boolean }) {
  const pr = p.prof
  const [sex, setSex] = useState<'f' | 'm'>(pr?.sex || 'f'), [year, setYear] = useState(String(pr?.birth_year || '')), [height, setHeight] = useState(pr ? N1(pr.height_cm) : '')
  const [weight, setWeight] = useState(p.weight != null ? N1(p.weight) : ''), [activity, setActivity] = useState<Activity>(pr?.activity || 'leve')
  const [goal, setGoal] = useState<Goal>(pr?.goal || 'perder'), [pace, setPace] = useState(pr?.pace_kg_week ?? 0.5)
  const [target, setTarget] = useState(pr?.target_kg != null ? N1(pr.target_kg) : ''), [manual, setManual] = useState(pr?.kcal_override ? String(pr.kcal_override) : '')
  const [hide, setHide] = useState(pr?.hide_numbers ?? false), [busy, setBusy] = useState(false)
  const [protKg, setProtKg] = useState(pr?.protein_g_kg != null ? N1(pr.protein_g_kg) : '')
  const nowYear = Number(p.today.slice(0, 4))
  const valid = Number(year) >= 1920 && Number(year) <= nowYear - 12 && num(height) >= 120 && num(height) <= 230 && num(weight) >= 30 && num(weight) <= 300
    && (!target.trim() || (num(target) >= 30 && num(target) <= 300)) && (!manual.trim() || (num(manual) >= 1000 && num(manual) <= 5000)) && (!protKg.trim() || (num(protKg) >= 0.5 && num(protKg) <= 3))
  const draft: Omit<FoodProfile, 'who'> = { sex, birth_year: Number(year), height_cm: num(height), activity, goal, pace_kg_week: goal === 'manter' ? 0 : pace, target_kg: target.trim() ? num(target) : null, kcal_override: manual.trim() ? Math.round(num(manual)) : null, hide_numbers: hide, protein_g_kg: protKg.trim() ? Math.round(num(protKg) * 10) / 10 : null }
  const preview = valid ? calorieTarget({ ...draft, who: p.me }, num(weight), nowYear) : null
  async function save() {
    setBusy(true)
    try {
      if (p.weight == null || Math.abs(num(weight) - p.weight) >= 0.05) await p.onAdd('corpo', Math.round(num(weight) * 10) / 10, {})
      await p.onSaveProfile(draft); p.onDone()
    } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return (
    <section className="card" aria-labelledby="al-perfil">
      <div className="slbl" id="al-perfil">🍽️ {pr ? 'Perfil e meta' : 'Vamos calcular sua meta'}</div>
      {!pr && <p className="row-s" style={{ marginBottom: 10 }}>Com estes dados o Ninho estima quanto você gasta por dia (fórmula de Mifflin-St Jeor) e sugere uma meta. Fica só com você.</p>}
      <div className="onb-q" style={{ marginTop: 0 }}>Sexo (para o cálculo)</div>
      <div className="onb-days" role="radiogroup" aria-label="Sexo para o cálculo">
        {([['f', 'Feminino'], ['m', 'Masculino']] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={sex === k} className={`onb-day wide ${sex === k ? 'on' : ''}`} onClick={() => setSex(k)}>{l}</button>)}
      </div>
      <div className="onb-row" style={{ marginTop: 10 }}>
        <label className="onb-f"><span>Ano de nascimento</span><input className="fi" inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} placeholder="1994"/></label>
        <label className="onb-f"><span>Altura (cm)</span><input className="fi" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} placeholder="165"/></label>
        <label className="onb-f"><span>Peso hoje (kg)</span><input className="fi" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} placeholder="70"/></label>
      </div>
      <div className="onb-q">No dia a dia, sem contar os treinos</div>
      <div className="al-opts" role="radiogroup" aria-label="Nível de atividade">
        {ACTIVITIES.map(([k, l, d]) => <button key={k} role="radio" aria-checked={activity === k} className={`opt ${activity === k ? 'on' : ''}`} onClick={() => setActivity(k)}><span className="opt-t">{l}</span><span className="opt-s">{d}</span></button>)}
      </div>
      <div className="onb-q">Objetivo</div>
      <div className="onb-days" role="radiogroup" aria-label="Objetivo">
        {GOALS.map(([k, l]) => <button key={k} role="radio" aria-checked={goal === k} className={`onb-day wide ${goal === k ? 'on' : ''}`} onClick={() => setGoal(k)}>{l}</button>)}
      </div>
      {goal !== 'manter' && <>
        <div className="onb-q">Ritmo</div>
        <div className="onb-days wrap" role="radiogroup" aria-label="Ritmo por semana">
          {[0.25, 0.5, 0.75, 1].map(v => <button key={v} role="radio" aria-checked={pace === v} className={`onb-day wide ${pace === v ? 'on' : ''}`} onClick={() => setPace(v)}>{PACE(v)} kg/semana</button>)}
        </div>
      </>}
      <div className="onb-row" style={{ marginTop: 10 }}>
        <label className="onb-f"><span>Peso desejado (kg)</span><input className="fi" inputMode="decimal" placeholder="opcional" value={target} onChange={e => setTarget(e.target.value)}/></label>
        <label className="onb-f"><span>Meta manual (kcal)</span><input className="fi" inputMode="numeric" value={manual} onChange={e => setManual(e.target.value)} placeholder="opcional (da nutri)"/></label>
        <label className="onb-f"><span>Proteína (g por kg)</span><input className="fi" inputMode="decimal" value={protKg} onChange={e => setProtKg(e.target.value)} placeholder={`padrão ${N1(PROTEIN_DEFAULT[goal])}`}/></label>
      </div>
      {protKg.trim() && !(num(protKg) >= 0.5 && num(protKg) <= 3) && <small className="al-warn">A proteína fica entre 0,5 e 3 g por kg.</small>}
      <label className="rt-toggle"><input type="checkbox" checked={hide} onChange={e => setHide(e.target.checked)}/><span><b>Esconder as calorias</b><small>Mostra só como foi o dia ("na medida", "ainda tem espaço"), sem números.</small></span></label>
      {preview && <p className="al-prev" aria-live="polite">{preview.manual ? <>Meta: <b>{K(preview.kcal)} kcal</b> por dia (manual).</> : <>Gasto estimado <b>{K(preview.tdee)} kcal</b> · meta <b>{K(preview.kcal)} kcal</b> por dia.</>}
        {preview.clamped && <> Ficou no mínimo seguro de {K(SAFE_MIN[sex])} kcal.</>} Proteína: <b>{proteinTarget(draft, num(weight)).g} g</b> por dia.</p>}
      <div className="md-acts">
        <button className="btn btn-p" disabled={!valid || busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</button>
        {p.canCancel && <button className="btn btn-g" onClick={p.onDone}>Cancelar</button>}
      </div>
    </section>
  )
}

function MealForm(p: FoodTabProps & { hide: boolean }) {
  const [meal, setMeal] = useState<Meal>(() => mealForTime(p.nowHM))
  const [text, setText] = useState(''), [items, setItems] = useState<MealItem[] | null>(null), [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<'idle' | 'busy'>('idle'), [note, setNote] = useState<string | null>(null), [err, setErr] = useState<string | null>(null)
  const [combo, setCombo] = useState(false)
  const [from, setFrom] = useState<SavedMeal | null>(null)
  const savedMine = p.saved.filter(m => m.who === p.me)
  async function launch(m: SavedMeal) {
    setBusy(true)
    try { await p.onAdd('refeicao', m.kcal, { meal, text: m.name, items: m.items, saved_id: m.id }); p.onUseMeal(m) }
    catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  const photoRef = useRef<HTMLInputElement>(null)
  async function fromPhoto(f: File | undefined) {
    if (!f) return
    setPhoto('busy'); setErr(null); setNote(null)
    const r = await readPlatePhoto(p.householdId, f, text)
    setPhoto('idle')
    if (photoRef.current) photoRef.current.value = ''
    if (r.ok === false) { setErr(r.error); return }
    setItems(r.data.items); setNote(r.data.note)
    if (!text.trim()) setText('Foto do prato')
  }
  const custom = useMemo(() => p.foods.filter(f => f.who === p.me), [p.foods, p.me])
  const all = useMemo(() => [...custom.map(customToFood), ...FOODS], [custom])
  const byName = (n: string) => all.find(f => norm(f.name) === norm(n))
  const set = (i: number, it: MealItem) => setItems(l => l && l.map((x, j) => j === i ? it : x))
  const total = items ? mealTotals(items) : null
  const unknown = items?.filter(i => !i.food_id && !(i.kcal > 0)).length || 0
  async function save() {
    if (!items || !total) return
    setBusy(true)
    try {
      await p.onAdd('refeicao', total.kcal, { meal, text: text.trim().slice(0, 500), items: items.filter(i => i.food_id || i.kcal > 0), ...(from ? { saved_id: from.id } : {}) })
      if (from) p.onUseMeal(from)
      setText(''); setItems(null); setNote(null); setFrom(null)
    } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return (
    <section className="card" aria-labelledby="al-add">
      <div className="slbl" id="al-add">Registrar refeição</div>
      <div className="onb-days wrap" role="radiogroup" aria-label="Refeição">
        {MEALS.map(([k, ic, l]) => <button key={k} role="radio" aria-checked={meal === k} className={`onb-day wide ${meal === k ? 'on' : ''}`} onClick={() => setMeal(k)}>{ic} {l}</button>)}
      </div>
      {p.savedReady !== false && savedMine.length > 0 && !items && <div className="al-saved" role="group" aria-label="Refeições salvas">
        <div className="al-saved-h">⭐ Refeições salvas</div>
        {savedMine.map(m => <div key={m.id} className="al-sv">
          <span className="al-sv-n"><b>{m.name}</b><small>{m.items.map(i => i.name).join(', ')}{p.hide ? '' : ` · ${K(m.kcal)} kcal`}</small></span>
          <button className="btn btn-s" disabled={busy} onClick={() => launch(m)} aria-label={`Lançar ${m.name}`}>Lançar</button>
          <button className="lnk-inline" onClick={() => { setItems(m.items); setText(m.name); setFrom(m) }} aria-label={`Ajustar ${m.name} antes de lançar`}>ajustar</button>
          <button className="ib" aria-label={`Remover ${m.name} das salvas`} onClick={() => { if (confirm(`Remover "${m.name}" das refeições salvas?`)) p.onStopMeal(m).catch(() => {}) }}>✕</button>
        </div>)}
      </div>}
      <label className="onb-f" style={{ marginTop: 10 }}><span>O que você comeu?</span>
        <textarea className="fi al-text" rows={2} value={text} maxLength={500} onChange={e => { setText(e.target.value); setItems(null) }} placeholder="2 ovos mexidos, 1 pão francês com manteiga e café com leite"/></label>
      {!items && <div className="md-acts" style={{ marginTop: 0 }}>
        <button className="btn btn-s" disabled={!text.trim()} onClick={() => setItems(parseMeal(text, custom))}>Conferir</button>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={e => fromPhoto(e.target.files?.[0])}/>
        <button className="btn btn-g" disabled={photo === 'busy'} onClick={() => photoRef.current?.click()}>{photo === 'busy' ? 'Olhando a foto…' : '📷 Foto do prato'}</button>
        {custom.length > 0 && <button className="btn btn-g" aria-expanded={combo} onClick={() => setCombo(v => !v)}>🧩 Montar com meus alimentos</button>}
      </div>}
      {!items && combo && <Combine foods={custom} hide={p.hide} onSaveMeal={p.onSaveMeal} onDone={async (its, label) => {
        await p.onAdd('refeicao', mealTotals(its).kcal, { meal, text: (text.trim() || label).slice(0, 500), items: its })
        setText(''); setCombo(false)
      }}/>}
      {!items && !combo && <p className="row-s">Na foto, o que você escrever acima ajuda a IA (ex.: "frango e arroz integral"). A foto não fica guardada.</p>}
      {err && <p className="row-s al-warn" role="alert">{err}</p>}
      {items && note && <p className="row-s">📷 {note}</p>}
      {items && <>
        <datalist id="al-foods">{all.map(f => <option key={f.id} value={f.name}/>)}</datalist>
        <ul className="al-items">{items.map((it, i) => {
          const food = it.food_id ? all.find(f => f.id === it.food_id) : undefined
          const units = food ? [...Object.keys(food.units), food.liquid ? 'ml' : 'g'] as Array<FoodUnit | 'g' | 'ml'> : []
          return <li key={`${i}:${it.food_id}:${it.unit}:${it.qty}`} className={`al-item ${food || it.kcal > 0 ? '' : 'miss'}`}>
            <input className="fi" list="al-foods" defaultValue={it.name} aria-label={`Alimento ${i + 1}`} onBlur={e => {
              const f = byName(e.target.value)
              if (f) set(i, itemFor(f, it.qty, f.units[it.unit as FoodUnit] || it.unit === 'g' || it.unit === 'ml' ? it.unit : null, it.text))
              else if (e.target.value.trim() !== it.name) set(i, { ...it, name: e.target.value.trim(), food_id: null, g: 0, kcal: 0, p: 0, c: 0, f: 0 })
            }}/>
            {food ? <>
              <input className="fi al-q" inputMode="decimal" defaultValue={N1(it.qty)} aria-label={`Quantidade de ${it.name}`} onBlur={e => { const q = num(e.target.value); if (q > 0) set(i, itemFor(food, q, it.unit, it.text)) }}/>
              <select className="fi al-u" value={it.unit} aria-label={`Medida de ${it.name}`} onChange={e => {
                const u = e.target.value as FoodUnit | 'g' | 'ml'
                // trocar a medida mantém a quantidade em gramas quando vira g/ml
                set(i, u === 'g' || u === 'ml' ? itemFor(food, it.g, u, it.text) : itemFor(food, 1, u, it.text))
              }}>{units.map(u => <option key={u} value={u}>{UNIT_LABEL[u] || u}</option>)}</select>
              <span className="al-k mono">{it.g} {food.liquid ? 'ml' : 'g'}{p.hide ? '' : ` · ${K(it.kcal)} kcal`}</span>
            </> : <>
              <span className={it.kcal > 0 ? 'al-k' : 'al-miss'}>{it.kcal > 0 ? `estimativa da IA${it.g ? ` · ${it.g} g` : ''}` : `Não achei na tabela. Escolha um parecido${p.hide ? '' : ' ou informe as calorias'}.`}</span>
              {!p.hide && <input className="fi al-q" inputMode="numeric" placeholder="kcal" defaultValue={it.kcal > 0 ? String(it.kcal) : ''} aria-label={`Calorias de ${it.name}`} onBlur={e => { const k = num(e.target.value); set(i, { ...it, kcal: k > 0 ? Math.round(k) : 0 }) }}/>}
            </>}
            {it.guess && food && <span className="al-miss">medida trocada por {UNIT_LABEL[it.unit]}</span>}
            <button className="ib" aria-label={`Tirar ${it.name}`} onClick={() => setItems(l => l && l.filter((_, j) => j !== i))}>✕</button>
          </li>
        })}</ul>
        {unknown > 0 && <p className="row-s al-warn">{unknown} item(ns) sem calorias: escolha um parecido ou ficam de fora.</p>}
        <SaveAs items={items} initial={from?.name || text.trim()} existing={from} onSave={p.onSaveMeal}/>
        <div className="md-acts">
          <button className="btn btn-p" disabled={busy || !items.some(i => i.food_id || i.kcal > 0)} onClick={save}>{busy ? 'Salvando…' : p.hide ? 'Salvar refeição' : `Salvar refeição (${K(total!.kcal)} kcal)`}</button>
          <button className="btn btn-g" onClick={() => { setItems(null); setFrom(null) }}>Voltar ao texto</button>
        </div>
      </>}
    </section>
  )
}

/** "⭐ Salvar como refeição": guarda a combinação com um nome para lançar depois. */
function SaveAs({ items, initial, existing, onSave }: { items: MealItem[], initial: string, existing?: SavedMeal | null, onSave: FoodTabProps['onSaveMeal'] }) {
  const [open, setOpen] = useState(false), [name, setName] = useState(initial), [busy, setBusy] = useState(false), [done, setDone] = useState(false)
  const data = toSaved(name, items)
  if (!items.some(i => i.kcal > 0)) return null
  if (done) return <p className="row-s" role="status">⭐ Salva em Refeições salvas.</p>
  if (!open) return <button className="lnk-inline al-saveas" onClick={() => { setName(initial); setOpen(true) }}>{existing ? '⭐ Atualizar a refeição salva' : '⭐ Salvar como refeição (para lançar depois)'}</button>
  return <div className="tk-add al-saveas-f">
    <input className="fi" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Ex.: Meu café de sempre" aria-label="Nome da refeição salva" autoFocus/>
    <button className="btn btn-s" disabled={!data || busy} onClick={async () => { if (!data) return; setBusy(true); try { await onSave({ id: existing?.id, ...data }); setDone(true) } catch { /* aviso já mostrado */ } finally { setBusy(false) } }}>{busy ? 'Salvando…' : 'Salvar'}</button>
    <button className="lnk-inline" onClick={() => setOpen(false)}>cancelar</button>
  </div>
}

/** Montar a refeição combinando "Meus alimentos" por porção (½ em ½), vendo o total. */
function Combine({ foods, hide, onDone, onSaveMeal }: { foods: CustomFood[], hide: boolean, onDone: (items: MealItem[], label: string) => Promise<void>, onSaveMeal: FoodTabProps['onSaveMeal'] }) {
  const [q, setQ] = useState(''), [sel, setSel] = useState<Record<string, number>>({}), [busy, setBusy] = useState(false)
  const shown = foods.filter(f => !q.trim() || norm(f.name).includes(norm(q))).slice(0, 40)
  const chosen = foods.filter(f => sel[f.id] > 0)
  const items = chosen.map(f => itemFor(customToFood(f), sel[f.id], 'porcao', `${N1(sel[f.id])} × ${f.portion} de ${f.name}`))
  const total = mealTotals(items)
  const step = (id: string, d: number) => setSel(x => ({ ...x, [id]: Math.max(0, Math.min(20, Math.round(((x[id] || 0) + d) * 2) / 2)) }))
  return <div className="al-combo">
    <input className="fi" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar em Meus alimentos" aria-label="Buscar em Meus alimentos"/>
    <div className="al-chips" role="group" aria-label="Meus alimentos">
      {shown.map(f => <button key={f.id} className={`al-chip ${sel[f.id] ? 'on' : ''}`} aria-pressed={!!sel[f.id]} onClick={() => step(f.id, sel[f.id] ? -sel[f.id] : 1)}>
        {f.name}<small>{f.portion}{hide ? '' : ` · ${K(f.kcal)} kcal`}</small></button>)}
      {!shown.length && <p className="row-s">Nada com esse nome em Meus alimentos.</p>}
    </div>
    {chosen.length > 0 && <>
      <ul className="al-items">{chosen.map((f, i) => <li key={f.id} className="al-item">
        <span className="al-cn"><b>{f.name}</b><small>{f.portion}</small></span>
        <span className="al-step">
          <button className="ib" aria-label={`Menos ${f.name}`} onClick={() => step(f.id, -0.5)}>−</button>
          <span className="mono" aria-live="polite">{N1(sel[f.id])}×</span>
          <button className="ib" aria-label={`Mais ${f.name}`} onClick={() => step(f.id, 0.5)}>+</button>
        </span>
        {!hide && <span className="al-k mono">{K(items[i].kcal)} kcal</span>}
      </li>)}</ul>
      <SaveAs items={items} initial={chosen.map(f => f.name).join(' + ').slice(0, 60)} onSave={onSaveMeal}/>
      {!hide && <p className="row-s al-tot">Total: <b>{K(total.kcal)} kcal</b> · P {N1(total.p)} g · C {N1(total.c)} g · G {N1(total.f)} g</p>}
      <div className="md-acts"><button className="btn btn-p" disabled={busy} onClick={async () => { setBusy(true); try { await onDone(items, chosen.map(f => f.name).join(', ')); setSel({}) } catch { /* aviso já mostrado */ } finally { setBusy(false) } }}>
        {busy ? 'Salvando…' : hide ? 'Salvar refeição' : `Salvar refeição (${K(total.kcal)} kcal)`}</button>
        <button className="btn btn-g" onClick={() => setSel({})}>Limpar</button></div>
    </>}
  </div>
}

function MealsToday(p: FoodTabProps & { hide: boolean }) {
  const ms = mealsOn(p.logs, p.me, p.today)
  return (
    <section className="card" aria-labelledby="al-hoje">
      <div className="slbl" id="al-hoje">Refeições de hoje <span className="mono" style={{ color: 'var(--faint)' }}>{ms.length}</span></div>
      {ms.length === 0 ? <div className="row-s">Nada registrado ainda hoje.</div> : ms.map(l => {
        const m = MEALS.find(x => x[0] === l.data?.meal) || MEALS[5]
        const its = (l.data?.items || []) as MealItem[]
        return <div key={l.id} className="md-row">
          <span className="md-t"><b>{m[1]} {m[2]}</b>{!p.hide && <span className="mono"> · {K(Number(l.value) || 0)} kcal</span>}
            <small>{its.map(i => `${i.name}${i.g ? ` (${i.g} ${FOODS.find(f => f.id === i.food_id)?.liquid ? 'ml' : 'g'})` : ''}`).join(' · ') || l.data?.text}</small></span>
          <button className="ib" aria-label={`Apagar ${m[2]}`} onClick={() => { if (confirm('Apagar esta refeição?')) p.onRemove(l).catch(() => {}) }}>✕</button>
        </div>
      })}
    </section>
  )
}

function WeightCard(p: FoodTabProps & { prof: FoodProfile, series: Array<{ date: string, v: number }> }) {
  const [w, setW] = useState('')
  const { prof, series } = p
  const last = series[series.length - 1]
  const trend = weightTrend(series, p.today)
  const dir = prof.goal === 'perder' ? -1 : prof.goal === 'ganhar' ? 1 : 0
  const planEta = prof.target_kg != null && dir ? etaDate(last, prof.target_kg, dir * prof.pace_kg_week) : null
  const trendEta = prof.target_kg != null && trend ? etaDate(last, prof.target_kg, trend) : null
  const proj = planEta && prof.target_kg != null ? { date: planEta, v: prof.target_kg } : null
  const todayLog = p.logs.some(l => l.who === p.me && l.kind === 'corpo' && l.date === p.today && l.value != null)
  return (
    <section className="card" aria-labelledby="al-peso">
      <div className="slbl" id="al-peso">⚖️ Peso{prof.target_kg != null && <span className="chip">desejado {N1(prof.target_kg)} kg</span>}</div>
      <LineChart title="Peso" unit="kg" data={series} proj={proj} goal={prof.target_kg}/>
      <ul className="al-proj">
        {trend != null && <li>Últimas 4 semanas: <b>{trend > 0 ? '+' : ''}{N1(trend)} kg por semana</b>{trendEta && <> · nesse ritmo, {N1(prof.target_kg!)} kg por volta de <b>{fmtDate(trendEta)}/{trendEta.slice(2, 4)}</b></>}.</li>}
        {planEta && <li>No ritmo planejado ({PACE(prof.pace_kg_week)} kg/semana): por volta de <b>{fmtDate(planEta)}/{planEta.slice(2, 4)}</b>.</li>}
        {trend == null && <li>Registre o peso pelo menos uma vez por semana para ver a tendência.</li>}
      </ul>
      <div className="tk-add">
        <input className="fi" inputMode="decimal" value={w} placeholder={todayLog ? 'Peso de hoje já registrado' : 'Peso de hoje (kg)'} aria-label="Peso de hoje em kg" onChange={e => setW(e.target.value)}/>
        <button className="btn btn-s" disabled={!(num(w) >= 30 && num(w) <= 300)} onClick={() => p.onAdd('corpo', Math.round(num(w) * 10) / 10, {}).then(() => setW('')).catch(() => {})}>Registrar</button>
      </div>
    </section>
  )
}

function MyFoods(p: FoodTabProps & { inner?: boolean }) {
  const [q, setQ] = useState('')
  const [only, setOnly] = useState(false)
  const [more, setMore] = useState(false)
  const all = p.foods.filter(f => f.who === p.me)
  const toCheck = all.filter(f => f.review)
  const list = all.filter(f => (!only || f.review) && (!q.trim() || norm(f.name).includes(norm(q))))
  const shown = more || q.trim() ? list : list.slice(0, 12)
  const blank = { name: '', portion: '1 unidade', portion_g: '', kcal: '', protein: '', carb: '', fat: '' }
  type Form = typeof blank & { id?: string, review?: string | null }
  const [f, setF] = useState<Form>(blank)
  const ok = f.name.trim() && num(f.portion_g) > 0 && num(f.kcal) >= 0 && !isNaN(num(f.kcal))
  const formRef = useRef<HTMLDivElement>(null)
  const edit = (x: CustomFood) => {
    setF({ id: x.id, review: x.review || null, name: x.name, portion: x.portion, portion_g: N1(x.portion_g), kcal: N1(x.kcal), protein: x.protein != null ? N1(x.protein) : '', carb: x.carb != null ? N1(x.carb) : '', fat: x.fat != null ? N1(x.fat) : '' })
    setLbl(null); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  const opt = (v: string) => v.trim() ? num(v) : null
  const save = () => p.onSaveFood({ id: f.id, name: f.name, portion: f.portion, portion_g: num(f.portion_g), kcal: num(f.kcal), protein: opt(f.protein), carb: opt(f.carb), fat: opt(f.fat), review: null })
    .then(() => { setF(blank); setLbl(null) }).catch(() => {})

  // 📷 foto do rótulo: a IA copia a tabela; a pessoa confere e salva
  const [lbl, setLbl] = useState<{ s: 'busy' } | { s: 'ok', note: string | null, src: 'rotulo' | 'codigo' } | { s: 'err', msg: string } | null>(null)
  const [bc, setBc] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const target = useRef<CustomFood | null>(null)
  const askPhoto = (x: CustomFood | null) => { target.current = x; photoRef.current?.click() }
  async function fromLabel(file: File | undefined) {
    if (photoRef.current) photoRef.current.value = ''
    if (!file) return
    const x = target.current
    if (x) edit(x)
    setLbl({ s: 'busy' })
    const r = await readLabelPhoto(p.householdId, file)
    if (r.ok === false) { setLbl({ s: 'err', msg: r.error }); return }
    fill(r.data, x, 'rotulo')
  }
  /** Rótulo lido (foto ou código de barras) → formulário para conferir. Num item "para conferir", o nome fica. */
  function fill(d: LabelRead, x: CustomFood | null, src: 'rotulo' | 'codigo') {
    const s1 = (v: number | null) => v != null ? N1(v) : ''
    setF(cur => ({ ...cur, name: x ? x.name : (d.name || cur.name), portion: d.portion, portion_g: N1(d.portion_g), kcal: N1(d.kcal), protein: s1(d.protein), carb: s1(d.carb), fat: s1(d.fat) }))
    setLbl({ s: 'ok', note: d.note, src })
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  // 📄 planilha (CSV): lida aqui no aparelho; mostra o que vai entrar antes de importar
  const csvRef = useRef<HTMLInputElement>(null)
  const [imp, setImp] = useState<CatalogResult | { err: string } | null>(null)
  const [busy, setBusy] = useState(false)
  async function fromCsv(file: File | undefined) {
    if (csvRef.current) csvRef.current.value = ''
    if (!file) return
    if (file.size > 2_000_000) { setImp({ err: 'A planilha passa de 2 MB.' }); return }
    const r = catalogFoods(await file.text(), all)
    setImp(r || { err: 'Não reconheci as colunas. A planilha precisa ter pelo menos nome, gramas (ou porção) e kcal. Salve como CSV.' })
  }

  return (
    <section className={p.inner ? 'al-sub' : 'card'} aria-labelledby="al-meus">
      <div className="slbl" id="al-meus">Meus alimentos</div>
      <p className="row-s" style={{ marginBottom: 8 }}>Para o que não está na tabela: copie do rótulo (por porção), tire foto da tabela nutricional ou importe uma planilha. Depois é só escrever o nome na refeição.</p>
      <div className="md-acts fc-acts">
        <button className="btn btn-g" disabled={lbl?.s === 'busy'} onClick={() => askPhoto(null)}>{lbl?.s === 'busy' ? 'Lendo o rótulo…' : '📷 Foto do rótulo'}</button>
        <button className="btn btn-g" aria-expanded={bc} onClick={() => setBc(v => !v)}>🔢 Código de barras</button>
        <button className="btn btn-g" onClick={() => csvRef.current?.click()}>📄 Importar planilha</button>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden aria-label="Foto da tabela nutricional" onChange={e => fromLabel(e.target.files?.[0])}/>
        <input ref={csvRef} type="file" accept=".csv,text/csv" hidden aria-label="Planilha de alimentos (CSV)" onChange={e => fromCsv(e.target.files?.[0])}/>
      </div>
      {bc && <BarcodeBox householdId={p.householdId} onClose={() => setBc(false)} onFound={d => { setBc(false); fill(d, f.id ? p.foods.find(x => x.id === f.id) || null : null, 'codigo') }}/>}
      {imp && <div className="fc-imp" role="status">
        {'err' in imp ? <p className="al-warn">{imp.err}</p> : <>
          <p><b>{imp.add.length} alimento(s) novo(s)</b>{imp.add.some(x => x.review) && <> · <span className="fc-flag">⚠ {imp.add.filter(x => x.review).length} para conferir</span></>}
            {imp.dup.length > 0 && <> · {imp.dup.length} já estava(m) em Meus alimentos</>}{imp.bad.length > 0 && <> · {imp.bad.length} com problema</>}</p>
          {imp.bad.length > 0 && <details><summary>Ver as linhas com problema</summary><ul className="fc-bad">{imp.bad.slice(0, 30).map((x, i) => <li key={i}>{x.line ? `Linha ${x.line}: ` : ''}{x.name} ({x.why})</li>)}</ul></details>}
          <p className="row-s">Os marcados para conferir entram com os valores da planilha e um aviso, até você conferir o rótulo.</p>
        </>}
        <div className="md-acts">
          {!('err' in imp) && imp.add.length > 0 && <button className="btn btn-p" disabled={busy} onClick={() => { setBusy(true); p.onImportFoods(imp.add).then(() => setImp(null)).catch(() => {}).finally(() => setBusy(false)) }}>{busy ? 'Importando…' : `Importar ${imp.add.length}`}</button>}
          <button className="btn btn-g" onClick={() => setImp(null)}>{'err' in imp || !imp.add.length ? 'Fechar' : 'Cancelar'}</button>
        </div>
      </div>}
      {toCheck.length > 0 && <div className="seg-mini fc-seg" role="group" aria-label="Mostrar">
        <button className={only ? '' : 'on'} aria-pressed={!only} onClick={() => setOnly(false)}>Todos ({all.length})</button>
        <button className={only ? 'on' : ''} aria-pressed={only} onClick={() => setOnly(true)}>⚠ Para conferir ({toCheck.length})</button>
      </div>}
      {all.length > 8 && <input className="fi" value={q} onChange={e => setQ(e.target.value)} placeholder={`Buscar entre ${all.length} alimentos`} aria-label="Buscar em Meus alimentos" style={{ marginBottom: 8 }}/>}
      {shown.map(x => <div key={x.id} className={`md-row ${x.review ? 'fc-chk' : ''}`}><span className="md-t"><b>{x.name}{x.review && <> <span className="fc-flag">⚠ conferir</span></>}</b><small>{x.portion} ({N1(x.portion_g)} g) · {K(x.kcal)} kcal{x.protein != null ? ` · ${N1(x.protein)} g de proteína` : ''}</small>{x.review && <small className="fc-why">{x.review}</small>}</span>
        {x.review && <button className="lnk-inline" onClick={() => askPhoto(x)} aria-label={`Foto do rótulo de ${x.name}`}>📷 rótulo</button>}
        <button className="lnk-inline" onClick={() => edit(x)}>editar</button>
        {x.review && <button className="lnk-inline" onClick={() => p.onSaveFood({ ...x, review: null }).catch(() => {})} aria-label={`Marcar ${x.name} como conferido`}>✓ conferido</button>}
        <button className="lnk-inline" onClick={() => { if (confirm(`Remover ${x.name}?`)) p.onStopFood(x).catch(() => {}) }}>remover</button></div>)}
      {!shown.length && (q.trim() || only) && <p className="row-s">Nada encontrado.</p>}
      {shown.length < list.length && <button className="lnk" onClick={() => setMore(true)}>Ver todos ({list.length})</button>}
      <div ref={formRef} className="fc-form">
        {f.id && <p className="row-s">Editando <b>{f.name}</b>{f.review ? <> · falta conferir: {f.review}. Ao salvar, fica conferido.</> : null} <button className="lnk-inline" onClick={() => { setF(blank); setLbl(null) }}>cancelar</button></p>}
        {lbl?.s === 'ok' && <p className="fc-ok" role="status">{lbl.src === 'codigo' ? '🔢 Encontrado pelo código de barras.' : '📷 Copiado do rótulo.'} Confira os números com a embalagem antes de salvar.{lbl.note && lbl.src === 'rotulo' ? ` ${lbl.note}` : ''}</p>}
        {lbl?.s === 'err' && <p className="al-warn" role="alert">{lbl.msg}</p>}
        <div className="onb-row fc-grid" style={{ marginTop: 8 }}>
          <label className="onb-f wide"><span>Nome</span><input className="fi" value={f.name} maxLength={60} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="Barrinha de proteína"/></label>
          <label className="onb-f"><span>Porção</span><input className="fi" value={f.portion} maxLength={30} onChange={e => setF(x => ({ ...x, portion: e.target.value }))}/></label>
          <label className="onb-f"><span>Gramas ou ml</span><input className="fi" inputMode="decimal" value={f.portion_g} onChange={e => setF(x => ({ ...x, portion_g: e.target.value }))}/></label>
          <label className="onb-f"><span>kcal da porção</span><input className="fi" inputMode="decimal" value={f.kcal} onChange={e => setF(x => ({ ...x, kcal: e.target.value }))}/></label>
          <label className="onb-f"><span>Proteína (g)</span><input className="fi" inputMode="decimal" placeholder="opcional" value={f.protein} onChange={e => setF(x => ({ ...x, protein: e.target.value }))}/></label>
          <label className="onb-f"><span>Carboidrato (g)</span><input className="fi" inputMode="decimal" placeholder="opcional" value={f.carb} onChange={e => setF(x => ({ ...x, carb: e.target.value }))}/></label>
          <label className="onb-f"><span>Gordura (g)</span><input className="fi" inputMode="decimal" placeholder="opcional" value={f.fat} onChange={e => setF(x => ({ ...x, fat: e.target.value }))}/></label>
        </div>
        <button className="btn btn-s" disabled={!ok} onClick={save}>{f.id ? (f.review ? 'Salvar conferido' : 'Salvar') : '+ Cadastrar'}</button>
      </div>
    </section>
  )
}

/** Resumo de uma linha (Início e "… hoje"). */
export function foodLine(logs: PLog[], profiles: FoodProfile[], who: Who, today: string): string | null {
  const prof = profiles.find(x => x.who === who)
  const ws = bodySeries(logs, who, 'weight')
  const ms = mealsOn(logs, who, today)
  if (!prof || !ws.length) return ms.length ? `🍽️ ${ms.length} refeição(ões)` : null
  const d = dayFood(logs, who, today, calorieTarget(prof, ws[ws.length - 1].v, Number(today.slice(0, 4))).kcal, ws[ws.length - 1].v)
  if (prof.hide_numbers) return `🍽️ ${dayWord(d).toLowerCase()}`
  return d.left >= 0 ? `🍽️ restam ${K(d.left)} kcal` : `🍽️ ${K(-d.left)} kcal acima`
}
