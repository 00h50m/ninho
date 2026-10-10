'use client'
// Alimentação no Meu dia: perfil e meta, saldo do dia (comido × meta + treino),
// refeição escrita em texto e conferida item a item, semana e peso com previsão.
// Tudo é estimativa e fica só com a dona, a não ser que ela compartilhe.
import { useMemo, useState } from 'react'
import type { Who } from '@/lib/types'
import { fmtDate } from '@/lib/dates'
import { bodySeries, type PKind, type PLog } from '@/lib/meudia'
import { FOODS, type Food, type FoodUnit } from '@/lib/foods'
import {
  ACTIVITIES, GOALS, MEALS, SAFE_MIN, calorieTarget, customToFood, dayFood, dayWord, etaDate, itemFor, kcalWeek, mealForTime, mealTotals, mealsOn, norm, parseMeal, weightTrend,
  type Activity, type CustomFood, type FoodProfile, type Goal, type Meal, type MealItem,
} from '@/lib/nutricao'
import { LineChart } from './LineChart'
import { WeekBars } from './SleepBars'

const K = (v: number) => Math.round(v).toLocaleString('pt-BR')
const N1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
const num = (v: string) => v.trim() ? Number(v.replace(',', '.')) : NaN
const UNIT_LABEL: Record<string, string> = {
  un: 'unidade', fatia: 'fatia', colher: 'colher (sopa)', colherinha: 'colher (chá)', xicara: 'xícara', concha: 'concha', copo: 'copo', lata: 'lata', taca: 'taça',
  escumadeira: 'escumadeira', pote: 'pote', medida: 'medida', bola: 'bola', porcao: 'porção', punhado: 'punhado', file: 'filé', tigela: 'tigela', g: 'g', ml: 'ml',
}

export interface FoodTabProps {
  me: Who, today: string, nowHM: string, logs: PLog[], profiles: FoodProfile[], foods: CustomFood[], foodReady?: boolean
  onAdd: (kind: PKind, value: number | null, data?: Record<string, any>) => Promise<void>
  onRemove: (l: PLog) => Promise<void>
  onSaveProfile: (p: Omit<FoodProfile, 'who'>) => Promise<void>
  onSaveFood: (f: Omit<CustomFood, 'id' | 'who'> & { id?: string }) => Promise<void>
  onStopFood: (f: CustomFood) => Promise<void>
}

export function FoodTab(p: FoodTabProps) {
  const [editing, setEditing] = useState(false)
  if (p.foodReady === false) return <div className="card empty"><span className="empty-icon">🍽️</span>A Alimentação ainda não está ativa: falta rodar a atualização do banco (migration 026) no Supabase.</div>
  const prof = p.profiles.find(x => x.who === p.me)
  const weights = bodySeries(p.logs, p.me, 'weight')
  const w = weights.length ? weights[weights.length - 1].v : null
  if (!prof || w == null || editing) return <ProfileForm {...p} prof={prof} weight={w} onDone={() => setEditing(false)} canCancel={!!prof && w != null}/>
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

      <MealForm {...p} hide={hide}/>
      <MealsToday {...p} hide={hide}/>

      {!hide && <section className="card" aria-labelledby="al-semana">
        <div className="slbl" id="al-semana">Calorias da semana</div>
        {kcalWeek(p.logs, p.me, p.today).some(x => x.h != null)
          ? <WeekBars days={kcalWeek(p.logs, p.me, p.today)} goal={t.kcal} today={p.today} unit="kcal" what="Calorias" col="Dia"/>
          : <div className="lc-empty">Registre as refeições para ver a semana.</div>}
      </section>}

      <WeightCard {...p} prof={prof} series={weights}/>

      <section className="card" aria-labelledby="al-meta">
        <div className="slbl" id="al-meta">Minha meta</div>
        <p className="row-s">
          {t.manual ? <>Meta definida por você: <b>{K(t.kcal)} kcal</b> por dia.</>
            : <>Gasto estimado: <b>{K(t.tdee)} kcal</b> por dia. Meta: <b>{K(t.kcal)} kcal</b> ({GOALS.find(g => g[0] === prof.goal)?.[1].toLowerCase()}{prof.goal !== 'manter' ? `, ${N1(prof.pace_kg_week)} kg por semana` : ''}).</>}
          {' '}Os treinos que você registra somam à parte.
        </p>
        {t.clamped && <p className="row-s al-warn">Nesse ritmo a conta daria menos de {K(SAFE_MIN[prof.sex])} kcal, então a meta ficou nesse mínimo. Um ritmo mais leve costuma ser mais fácil de manter.</p>}
        {t.manual && t.kcal < SAFE_MIN[prof.sex] && <p className="row-s al-warn">Essa meta está abaixo de {K(SAFE_MIN[prof.sex])} kcal. Sem acompanhamento de nutricionista, não é recomendado.</p>}
        <button className="btn btn-s" onClick={() => setEditing(true)}>Editar perfil e meta</button>
        <p className="row-s" style={{ marginTop: 8 }}>São estimativas para o dia a dia. Para um plano individual, gestação ou alguma condição de saúde, fale com nutricionista ou médica.</p>
      </section>

      <MyFoods {...p}/>
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
  const nowYear = Number(p.today.slice(0, 4))
  const valid = Number(year) >= 1920 && Number(year) <= nowYear - 12 && num(height) >= 120 && num(height) <= 230 && num(weight) >= 30 && num(weight) <= 300
    && (!target.trim() || (num(target) >= 30 && num(target) <= 300)) && (!manual.trim() || (num(manual) >= 1000 && num(manual) <= 5000))
  const draft: Omit<FoodProfile, 'who'> = { sex, birth_year: Number(year), height_cm: num(height), activity, goal, pace_kg_week: goal === 'manter' ? 0 : pace, target_kg: target.trim() ? num(target) : null, kcal_override: manual.trim() ? Math.round(num(manual)) : null, hide_numbers: hide }
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
          {[0.25, 0.5, 0.75, 1].map(v => <button key={v} role="radio" aria-checked={pace === v} className={`onb-day wide ${pace === v ? 'on' : ''}`} onClick={() => setPace(v)}>{N1(v)} kg/semana</button>)}
        </div>
      </>}
      <div className="onb-row" style={{ marginTop: 10 }}>
        <label className="onb-f"><span>Peso desejado (kg, opcional)</span><input className="fi" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)}/></label>
        <label className="onb-f"><span>Meta manual (kcal, opcional)</span><input className="fi" inputMode="numeric" value={manual} onChange={e => setManual(e.target.value)} placeholder="da nutricionista"/></label>
      </div>
      <label className="rt-toggle"><input type="checkbox" checked={hide} onChange={e => setHide(e.target.checked)}/><span><b>Esconder as calorias</b><small>Mostra só como foi o dia ("na medida", "ainda tem espaço"), sem números.</small></span></label>
      {preview && <p className="al-prev" aria-live="polite">{preview.manual ? <>Meta: <b>{K(preview.kcal)} kcal</b> por dia (manual).</> : <>Gasto estimado <b>{K(preview.tdee)} kcal</b> · meta <b>{K(preview.kcal)} kcal</b> por dia.</>}
        {preview.clamped && <> Ficou no mínimo seguro de {K(SAFE_MIN[sex])} kcal.</>}</p>}
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
      await p.onAdd('refeicao', total.kcal, { meal, text: text.trim().slice(0, 500), items: items.filter(i => i.food_id || i.kcal > 0) })
      setText(''); setItems(null)
    } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return (
    <section className="card" aria-labelledby="al-add">
      <div className="slbl" id="al-add">Registrar refeição</div>
      <div className="onb-days wrap" role="radiogroup" aria-label="Refeição">
        {MEALS.map(([k, ic, l]) => <button key={k} role="radio" aria-checked={meal === k} className={`onb-day wide ${meal === k ? 'on' : ''}`} onClick={() => setMeal(k)}>{ic} {l}</button>)}
      </div>
      <label className="onb-f" style={{ marginTop: 10 }}><span>O que você comeu?</span>
        <textarea className="fi al-text" rows={2} value={text} maxLength={500} onChange={e => { setText(e.target.value); setItems(null) }} placeholder="2 ovos mexidos, 1 pão francês com manteiga e café com leite"/></label>
      {!items && <button className="btn btn-s" disabled={!text.trim()} onClick={() => setItems(parseMeal(text, custom))}>Conferir</button>}
      {items && <>
        <datalist id="al-foods">{all.map(f => <option key={f.id} value={f.name}/>)}</datalist>
        <ul className="al-items">{items.map((it, i) => {
          const food = it.food_id ? all.find(f => f.id === it.food_id) : undefined
          const units = food ? [...Object.keys(food.units), food.liquid ? 'ml' : 'g'] as Array<FoodUnit | 'g' | 'ml'> : []
          return <li key={`${i}:${it.food_id}:${it.unit}:${it.qty}`} className={`al-item ${food ? '' : 'miss'}`}>
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
              <span className="al-miss">Não achei na tabela. Escolha um parecido{p.hide ? '' : ' ou informe as calorias'}.</span>
              {!p.hide && <input className="fi al-q" inputMode="numeric" placeholder="kcal" aria-label={`Calorias de ${it.name}`} onBlur={e => { const k = num(e.target.value); set(i, { ...it, kcal: k > 0 ? Math.round(k) : 0 }) }}/>}
            </>}
            {it.guess && <span className="al-miss">medida trocada por {UNIT_LABEL[it.unit]}</span>}
            <button className="ib" aria-label={`Tirar ${it.name}`} onClick={() => setItems(l => l && l.filter((_, j) => j !== i))}>✕</button>
          </li>
        })}</ul>
        {unknown > 0 && <p className="row-s al-warn">{unknown} item(ns) sem calorias: escolha um parecido ou ficam de fora.</p>}
        <div className="md-acts">
          <button className="btn btn-p" disabled={busy || !items.some(i => i.food_id || i.kcal > 0)} onClick={save}>{busy ? 'Salvando…' : p.hide ? 'Salvar refeição' : `Salvar refeição (${K(total!.kcal)} kcal)`}</button>
          <button className="btn btn-g" onClick={() => setItems(null)}>Voltar ao texto</button>
        </div>
      </>}
    </section>
  )
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
        {planEta && <li>No ritmo planejado ({N1(prof.pace_kg_week)} kg/semana): por volta de <b>{fmtDate(planEta)}/{planEta.slice(2, 4)}</b>.</li>}
        {trend == null && <li>Registre o peso pelo menos uma vez por semana para ver a tendência.</li>}
      </ul>
      <div className="tk-add">
        <input className="fi" inputMode="decimal" value={w} placeholder={todayLog ? 'Peso de hoje já registrado' : 'Peso de hoje (kg)'} aria-label="Peso de hoje em kg" onChange={e => setW(e.target.value)}/>
        <button className="btn btn-s" disabled={!(num(w) >= 30 && num(w) <= 300)} onClick={() => p.onAdd('corpo', Math.round(num(w) * 10) / 10, {}).then(() => setW('')).catch(() => {})}>Registrar</button>
      </div>
    </section>
  )
}

function MyFoods(p: FoodTabProps) {
  const mine = p.foods.filter(f => f.who === p.me)
  const blank = { name: '', portion: '1 unidade', portion_g: '', kcal: '', protein: '' }
  const [f, setF] = useState<{ id?: string, name: string, portion: string, portion_g: string, kcal: string, protein: string }>(blank)
  const ok = f.name.trim() && num(f.portion_g) > 0 && num(f.kcal) >= 0 && !isNaN(num(f.kcal))
  return (
    <section className="card" aria-labelledby="al-meus">
      <div className="slbl" id="al-meus">Meus alimentos</div>
      <p className="row-s" style={{ marginBottom: 8 }}>Para o que não está na tabela: copie do rótulo (por porção). Depois é só escrever o nome na refeição.</p>
      {mine.map(x => <div key={x.id} className="md-row"><span className="md-t"><b>{x.name}</b><small>{x.portion} ({N1(x.portion_g)} g) · {K(x.kcal)} kcal{x.protein != null ? ` · ${N1(x.protein)} g de proteína` : ''}</small></span>
        <button className="lnk-inline" onClick={() => setF({ id: x.id, name: x.name, portion: x.portion, portion_g: N1(x.portion_g), kcal: N1(x.kcal), protein: x.protein != null ? N1(x.protein) : '' })}>editar</button>
        <button className="lnk-inline" onClick={() => { if (confirm(`Remover ${x.name}?`)) p.onStopFood(x).catch(() => {}) }}>remover</button></div>)}
      <div className="onb-row" style={{ marginTop: 8 }}>
        <label className="onb-f"><span>Nome</span><input className="fi" value={f.name} maxLength={60} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="Barrinha de proteína"/></label>
        <label className="onb-f"><span>Porção</span><input className="fi" value={f.portion} maxLength={30} onChange={e => setF(x => ({ ...x, portion: e.target.value }))}/></label>
        <label className="onb-f"><span>Gramas da porção</span><input className="fi" inputMode="decimal" value={f.portion_g} onChange={e => setF(x => ({ ...x, portion_g: e.target.value }))}/></label>
        <label className="onb-f"><span>kcal da porção</span><input className="fi" inputMode="decimal" value={f.kcal} onChange={e => setF(x => ({ ...x, kcal: e.target.value }))}/></label>
        <label className="onb-f"><span>Proteína (g, opcional)</span><input className="fi" inputMode="decimal" value={f.protein} onChange={e => setF(x => ({ ...x, protein: e.target.value }))}/></label>
      </div>
      <button className="btn btn-s" disabled={!ok} onClick={() => p.onSaveFood({ id: f.id, name: f.name, portion: f.portion, portion_g: num(f.portion_g), kcal: num(f.kcal), protein: f.protein.trim() ? num(f.protein) : null, carb: null, fat: null }).then(() => setF(blank)).catch(() => {})}>{f.id ? 'Salvar' : '+ Cadastrar'}</button>
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
