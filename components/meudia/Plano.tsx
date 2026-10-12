'use client'
// Plano alimentar no Meu dia: enviar o PDF/foto do plano da nutricionista, conferir
// o que a IA organizou, e seguir no dia a dia ("Comi"), com dia de treino ou descanso,
// suplementos, água e lembretes. O arquivo não fica guardado.
import { useEffect, useRef, useState } from 'react'
import type { Who } from '@/lib/types'
import { Sheet } from '@/components/ui/Sheet'
import type { PKind, PLog, PMed, PSettings } from '@/lib/meudia'
import { altToItem, defaultItems, planFoods, planForDay, scaleItem, slotOf, type DietPlan, type PlanFood, type PlanMeal, type PlanRow } from '@/lib/dietPlan'
import { mealTotals, mealsOn, norm, parseMeal, type CustomFood, type MealItem } from '@/lib/nutricao'
import { readPlanFile } from '@/lib/services/aiFiles'
import type { MdFocus } from './MeuDia'

const K = (v: number) => Math.round(v).toLocaleString('pt-BR')
const WHEN_TXT: Record<string, string> = { treino: 'só em dia de treino', descanso: 'só em dia sem treino', fim_de_semana: 'fim de semana' }

export interface PlanProps {
  householdId: string, me: Who, today: string, nowHM: string, logs: PLog[], foods: CustomFood[], meds: PMed[], settings: PSettings[]
  plans: PlanRow[], plansReady?: boolean, hide: boolean
  onAdd: (kind: PKind, value: number | null, data?: Record<string, any>) => Promise<void>
  onSavePlan: (plan: DietPlan, source: string | null) => Promise<void>
  onSaveFoods: (list: PlanFood[]) => Promise<void>
  onPlanRemind: (p: PlanRow, remind: boolean) => Promise<void>
  onStopPlan: (p: PlanRow) => Promise<void>
  onSaveMed: (m: { id?: string, name: string, dose: string | null, times: string[] }) => Promise<void>
  onSaveSettings: (s: Partial<Omit<PSettings, 'who'>>) => Promise<void>
  onRemove: (l: PLog) => Promise<void>
  focus?: MdFocus
}

export function PlanCard(p: PlanProps) {
  const row = p.plans.find(x => x.who === p.me)
  const [preview, setPreview] = useState<{ plan: DietPlan, source: string } | null>(null)
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  if (p.plansReady === false) return null
  async function upload(f: File | undefined) {
    if (!f) return
    setBusy(true); setErr(null)
    const r = await readPlanFile(p.householdId, f)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
    if (r.ok === false) setErr(r.error); else setPreview({ plan: r.data.plan, source: f.name })
  }
  const picker = <>
    <input ref={fileRef} type="file" accept="application/pdf,image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={e => upload(e.target.files?.[0])}/>
    <button className="btn btn-s" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Lendo o plano… (até 1 minuto)' : row ? 'Trocar plano' : '📄 Enviar plano (PDF ou foto)'}</button>
  </>
  if (preview) return <PlanPreview plan={preview.plan} onCancel={() => setPreview(null)} onSave={() => p.onSavePlan(preview.plan, preview.source).then(() => setPreview(null)).catch(() => {})}/>
  if (!row) return (
    <section className="card" aria-labelledby="pl-novo">
      <div className="slbl" id="pl-novo">📋 Plano alimentar</div>
      <p className="row-s" style={{ marginBottom: 10 }}>Tem um plano da nutricionista? Mande o PDF ou uma foto: a IA organiza as refeições, as opções e as regras, e você marca o que comeu com um toque. O arquivo vai só para a leitura e não fica guardado.</p>
      {picker}
      {err && <p className="row-s al-warn" role="alert">{err}</p>}
    </section>
  )
  return <PlanToday {...p} row={row} picker={picker} err={err}/>
}

function PlanPreview({ plan, onSave, onCancel }: { plan: DietPlan, onSave: () => void, onCancel: () => void }) {
  return (
    <section className="card" aria-labelledby="pl-conf">
      <div className="slbl" id="pl-conf">📋 Confira o plano</div>
      <p className="row-s" style={{ marginBottom: 8 }}>Compare com o original. Se algo veio errado, descarte e tente de novo (uma foto nítida de cada página costuma ajudar).</p>
      <b className="pl-title">{plan.title}</b>
      {plan.meals.map(m => <div key={m.id} className="pl-meal">
        <div className="pl-mh"><b>{m.name}</b>{m.time && <span className="mono">{m.time}</span>}{m.when !== 'sempre' && <span className="chip">{WHEN_TXT[m.when]}</span>}</div>
        {m.note && <small className="pl-note">{m.note}</small>}
        {m.options.map(o => <div key={o.label} className="pl-opt">
          {m.options.length > 1 && <span className="pl-ol">{o.label}</span>}
          <ul>{o.items.map((it, i) => <li key={i}>{it.alts.map(a => `${a.qty ? a.qty + ' ' : ''}${a.food}`).join(' ou ')}{it.when !== 'sempre' && <em> ({WHEN_TXT[it.when]})</em>}{it.note && <small> · {it.note}</small>}</li>)}</ul>
        </div>)}
      </div>)}
      {plan.supplements.length > 0 && <p className="row-s"><b>Suplementos:</b> {plan.supplements.map(s => `${s.name}${s.dose ? ` (${s.dose})` : ''}${s.time ? ` às ${s.time}` : ''}`).join(' · ')}</p>}
      {plan.water_l && <p className="row-s"><b>Água:</b> {String(plan.water_l).replace('.', ',')} L por dia</p>}
      {plan.rules.length > 0 && <ul className="pl-rules">{plan.rules.map((r, i) => <li key={i}>{r.text}{r.when !== 'sempre' && <em> ({WHEN_TXT[r.when]})</em>}</li>)}</ul>}
      {plan.lists.length > 0 && <p className="row-s"><b>Listas:</b> {plan.lists.map(l => `${l.name} (${l.items.length})`).join(' · ')}</p>}
      <div className="md-acts"><button className="btn btn-p" onClick={onSave}>Salvar plano</button><button className="btn btn-g" onClick={onCancel}>Descartar</button></div>
    </section>
  )
}

function PlanToday(p: PlanProps & { row: PlanRow, picker: React.ReactNode, err: string | null }) {
  const { row } = p
  const trained = p.logs.some(l => l.who === p.me && l.kind === 'treino' && l.date === p.today)
  const [training, setTraining] = useState<boolean | null>(null)
  const isTraining = training ?? trained
  const [open, setOpen] = useState<PlanMeal | null>(null)
  const [quick, setQuick] = useState<string | null>(null)
  const [remind, setRemind] = useState(row.remind)
  useEffect(() => setRemind(row.remind), [row.remind])
  const meals = planForDay(row.plan, isTraining)
  const logged = mealsOn(p.logs, p.me, p.today)
  const logOf = (m: PlanMeal) => logged.find(x => x.data?.plan?.meal_id === m.id && x.data?.plan?.plan_id === row.id)
  const custom = p.foods.filter(f => f.who === p.me)
  // "Comi" das ações rápidas: abre a próxima refeição ainda não marcada
  const seen = useRef(0)
  useEffect(() => {
    if (p.focus?.what !== 'comi' || p.focus.n === seen.current) return
    seen.current = p.focus.n
    const pending = meals.filter(m => !logOf(m))
    const next = pending.find(m => !m.time || m.time >= p.nowHM.slice(0, 5)) || pending[pending.length - 1]
    if (next) setOpen(next)
  })
  async function eat(m: PlanMeal) {
    setQuick(m.id)
    const items = defaultItems(m, custom)
    try { await p.onAdd('refeicao', mealTotals(items).kcal, { meal: slotOf(m, p.nowHM), text: `Plano: ${m.name}`, items, plan: { plan_id: row.id, meal_id: m.id, option: m.options[0].label } }) }
    catch { /* aviso já mostrado */ } finally { setQuick(null) }
  }
  const myMeds = p.meds.filter(m => m.who === p.me)
  const pendingFoods = planFoods(row.plan, custom)
  const [launching, setLaunching] = useState(false)
  // plano salvo antes desta versão: na primeira vez que abre, lança os alimentos sozinho (uma vez por plano, neste aparelho)
  useEffect(() => {
    if (!pendingFoods.length || launching) return
    const key = `ninho.planFoods.${row.id}`
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1') } catch { return }
    setLaunching(true)
    p.onSaveFoods(pendingFoods).catch(() => {}).finally(() => setLaunching(false))
  }, [row.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const missingSup = row.plan.supplements.filter(s => !myMeds.some(m => norm(m.name) === norm(s.name)))
  const goal = (p.settings.find(s => s.who === p.me)?.water_goal_ml) ?? 2000
  const water = row.plan.water_l ? Math.round(row.plan.water_l * 1000) : null
  return (
    <section className="card" aria-labelledby="pl-hoje">
      <div className="slbl" id="pl-hoje">📋 {row.title}</div>
      <div className="onb-days" role="radiogroup" aria-label="Hoje é dia de treino?">
        <button role="radio" aria-checked={isTraining} className={`onb-day wide ${isTraining ? 'on' : ''}`} onClick={() => setTraining(true)}>🏋️ Dia de treino</button>
        <button role="radio" aria-checked={!isTraining} className={`onb-day wide ${!isTraining ? 'on' : ''}`} onClick={() => setTraining(false)}>🛋️ Dia sem treino</button>
      </div>
      <ul className="pl-day">{meals.map(m => {
        const l = logOf(m)
        const items = l ? [] : defaultItems(m, custom)
        return <li key={m.id} className={l ? 'on' : ''}>
          <span className="mono pl-t">{m.time || '—'}</span>
          <span className="pl-n"><b>{m.name}</b>
            {l ? <small>✓ registrado{p.hide ? '' : ` · ${K(Number(l.value) || 0)} kcal`}{l.data?.plan?.option && m.options.length > 1 ? ` · ${l.data.plan.option}` : ''}</small>
              : <small className="pl-pre">{(m.options[0]?.items || []).map(it => `${it.alts[0].qty ? it.alts[0].qty + ' ' : ''}${it.alts[0].food}`).join(' · ')}{!p.hide && ` · ≈ ${K(mealTotals(items).kcal)} kcal`}</small>}
          </span>
          {!l && <span className="pl-btns">
            <button className="btn btn-p" disabled={quick === m.id} onClick={() => eat(m)} aria-label={`Comi ${m.name} como no plano`}>{quick === m.id ? '…' : '✓ Comi'}</button>
            <button className="btn btn-g" onClick={() => setOpen(m)} aria-label={`Ajustar ${m.name}`}>Ajustar</button>
          </span>}
          {l && <button className="lnk-inline" onClick={() => { if (confirm(`Desfazer o registro de ${m.name}?`)) p.onRemove(l).catch(() => {}) }}>desfazer</button>}
        </li>
      })}</ul>
      {missingSup.length > 0 && <div className="pl-sup">
        <span>💊 Suplementos do plano: {row.plan.supplements.map(s => s.name).join(', ')}</span>
        <button className="lnk-inline" onClick={async () => { for (const s of missingSup) await p.onSaveMed({ name: s.name, dose: s.dose, times: s.time ? [s.time] : [] }).catch(() => {}) }}>Adicionar aos meus remédios e lembretes</button>
      </div>}
      {pendingFoods.length > 0 && <div className="pl-sup pl-foods">
        <span>🥗 {pendingFoods.length} alimento(s) do plano ainda não estão em <b>Meus alimentos</b>. Lance todos, um por um, com a porção do plano{p.hide ? '' : ' e as calorias'}, para combinar as refeições como quiser.</span>
        <button className="btn btn-s" disabled={launching} onClick={async () => { setLaunching(true); try { await p.onSaveFoods(pendingFoods) } catch { /* aviso já mostrado */ } finally { setLaunching(false) } }}>{launching ? 'Lançando…' : `Lançar ${pendingFoods.length} alimento(s)`}</button>
        <details><summary>Ver a lista</summary><ul className="pl-fl">{pendingFoods.map(f => <li key={f.name}><b>{f.name}</b> · {f.portion}{p.hide ? '' : ` · ${K(f.kcal)} kcal`}<small> ({f.from})</small></li>)}</ul></details>
      </div>}
      {water && water !== goal && <div className="pl-sup"><span>💧 O plano pede {String(row.plan.water_l).replace('.', ',')} L de água por dia.</span>
        <button className="lnk-inline" onClick={() => p.onSaveSettings({ water_goal_ml: Math.min(8000, water) }).catch(() => {})}>Usar como minha meta</button></div>}
      {(row.plan.rules.length > 0 || row.plan.lists.length > 0) && <details className="pl-more">
        <summary>Regras e listas do plano</summary>
        {row.plan.rules.length > 0 && <ul className="pl-rules">{row.plan.rules.map((r, i) => <li key={i}>{r.text}{r.when !== 'sempre' && <em> ({WHEN_TXT[r.when]})</em>}</li>)}</ul>}
        {row.plan.lists.map(l => <p key={l.name} className="row-s"><b>{l.name}:</b> {l.items.join(', ')}</p>)}
      </details>}
      <details className="pl-more">
        <summary>Lembretes e trocar o plano</summary>
        <label className="rt-toggle"><input type="checkbox" checked={remind} onChange={e => { const v = e.target.checked; setRemind(v); p.onPlanRemind(row, v).catch(() => setRemind(!v)) }}/><span><b>Lembrar das refeições</b><small>Notificação no horário de cada refeição do plano, se ainda não marcou.</small></span></label>
        <div className="md-acts">{p.picker}<button className="lnk-inline" onClick={() => { if (confirm('Remover este plano? As refeições já registradas ficam.')) p.onStopPlan(row).catch(() => {}) }}>Remover plano</button></div>
      </details>
      {p.err && <p className="row-s al-warn" role="alert">{p.err}</p>}
      {open && <PlanMealSheet {...p} row={row} meal={open} onClose={() => setOpen(null)}/>}
    </section>
  )
}

/** Ajustar a refeição do plano: opção, alternativa, quantidade de cada item e algo a mais. */
function PlanMealSheet(p: PlanProps & { row: PlanRow, meal: PlanMeal, onClose: () => void }) {
  const { meal } = p
  const custom = p.foods.filter(f => f.who === p.me)
  const [opt, setOpt] = useState(0)
  const [pick, setPick] = useState<Record<string, number>>({})
  const [grams, setGrams] = useState<Record<string, number>>({})
  const [extras, setExtras] = useState<MealItem[]>([]), [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)
  const o = meal.options[Math.min(opt, meal.options.length - 1)]
  const key = (i: number) => `${opt}:${i}:${pick[`${opt}:${i}`] ?? 0}`
  const base = o.items.map((it, i) => altToItem(it.alts[pick[`${opt}:${i}`] ?? 0] || it.alts[0], custom))
  const items = base.map((it, i) => grams[key(i)] != null ? scaleItem(it, grams[key(i)]) : it)
  const all = [...items, ...extras]
  const total = mealTotals(all)
  const setG = (i: number, g: number) => setGrams(x => ({ ...x, [key(i)]: Math.max(0, Math.min(2000, Math.round(g))) }))
  async function save() {
    setBusy(true)
    try {
      await p.onAdd('refeicao', total.kcal, { meal: slotOf(meal, p.nowHM), text: `Plano: ${meal.name}`, items: all.filter(i => i.g > 0 || i.kcal > 0), plan: { plan_id: p.row.id, meal_id: meal.id, option: o.label, adjusted: true } })
      p.onClose()
    } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  const unit = (it: MealItem) => it.unit === 'ml' ? 'ml' : 'g'
  return (
    <Sheet title={meal.name} onClose={p.onClose} footer={<button className="btn btn-p" disabled={busy || !all.length} onClick={save}>{busy ? 'Salvando…' : p.hide ? 'Registrar' : `Registrar (${K(total.kcal)} kcal)`}</button>}>
      {meal.options.length > 1 && <div className="onb-days wrap" role="radiogroup" aria-label="Opção">
        {meal.options.map((x, i) => <button key={x.label} role="radio" aria-checked={opt === i} className={`onb-day wide ${opt === i ? 'on' : ''}`} onClick={() => setOpt(i)}>{x.label}</button>)}
      </div>}
      <ul className="pl-items">{o.items.map((it, i) => {
        const cur = items[i], step = Math.max(5, Math.round((base[i].g || 100) * 0.25 / 5) * 5)
        return <li key={`${opt}:${i}`}>
          {it.alts.length > 1 && <fieldset className="pl-alts"><legend className="sr-only">Escolha do item {i + 1}</legend>{it.alts.map((a, j) => {
            const sel = (pick[`${opt}:${i}`] ?? 0) === j
            return <label key={j} className={`pl-alt ${sel ? 'on' : ''}`}><input type="radio" name={`alt-${opt}-${i}`} checked={sel} onChange={() => setPick(x => ({ ...x, [`${opt}:${i}`]: j }))}/>
              <span>{a.qty ? `${a.qty} ` : ''}{a.food}</span></label>
          })}</fieldset>}
          <div className="pl-qty">
            <span className="pl-qn">{it.alts.length === 1 ? `${it.alts[0].qty ? it.alts[0].qty + ' ' : ''}${it.alts[0].food}` : cur.name}</span>
            {cur.g > 0 ? <span className="pl-step">
              <button className="ib" aria-label={`Menos ${cur.name}`} onClick={() => setG(i, cur.g - step)}>−</button>
              <input className="fi" inputMode="numeric" value={String(cur.g)} aria-label={`Quantidade de ${cur.name} em ${unit(cur)}`} onChange={e => { const v = Number(e.target.value.replace(/\D/g, '')); setG(i, v) }}/>
              <span className="mono">{unit(cur)}</span>
              <button className="ib" aria-label={`Mais ${cur.name}`} onClick={() => setG(i, cur.g + step)}>+</button>
            </span> : <span className="row-s">quantidade livre</span>}
            {!p.hide && <span className="mono pl-k">{K(cur.kcal)} kcal</span>}
          </div>
          {it.note && <small className="pl-note">{it.note}</small>}
        </li>
      })}
        {extras.map((x, i) => <li key={`x${i}`}><div className="pl-qty"><span className="pl-qn">+ {x.name}{x.g ? ` (${x.g} ${unit(x)})` : ''}</span>{!p.hide && <span className="mono pl-k">{K(x.kcal)} kcal</span>}<button className="ib" aria-label={`Tirar ${x.name}`} onClick={() => setExtras(l => l.filter((_, j) => j !== i))}>✕</button></div></li>)}
      </ul>
      <div className="tk-add" style={{ marginTop: 10 }}>
        <input className="fi" value={extra} placeholder="Comeu algo a mais? Ex.: 1 colher de azeite" aria-label="Algo a mais nesta refeição" onChange={e => setExtra(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && extra.trim()) { setExtras(l => [...l, ...parseMeal(extra, custom).filter(x => x.food_id)]); setExtra('') } }}/>
        <button className="btn btn-g" disabled={!extra.trim()} onClick={() => { setExtras(l => [...l, ...parseMeal(extra, custom).filter(x => x.food_id)]); setExtra('') }}>+</button>
      </div>
      {all.some(i => i.guess) && !p.hide && <p className="row-s">Alguns itens usam a estimativa da IA (não estão na tabela do Ninho).</p>}
    </Sheet>
  )
}
