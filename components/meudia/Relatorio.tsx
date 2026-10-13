'use client'
// Relatório do mês (para a nutricionista): abre por cima do app, imprime ou salva em PDF pelo
// próprio celular/computador e compartilha um resumo em texto (WhatsApp). Só os dados de quem gera.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays } from '@/lib/dates'
import { monthReport, type MonthReport } from '@/lib/monthReport'
import { calorieTarget, type FoodProfile } from '@/lib/nutricao'
import { proteinTarget } from '@/lib/protein'
import { bodySeries, type PSettings } from '@/lib/meudia'
import type { PlanRow } from '@/lib/dietPlan'
import { allMyLogs, loadMoods } from '@/lib/services/meudia'
import { LineChart } from './LineChart'
import type { Who } from '@/lib/types'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesNome = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`
const N1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
const K = (v: number) => Math.round(v).toLocaleString('pt-BR')
const sg = (v: number) => `${v > 0 ? '+' : ''}${N1(v)}`
const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export function MonthReportView({ householdId, me, name, today, prof, settings, plans, onClose }: {
  householdId: string, me: Who, name: string, today: string, prof: FoodProfile | null, settings: PSettings | null, plans: PlanRow[], onClose: () => void
}) {
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7) })
  const [month, setMonth] = useState(months[0])
  const [r, setR] = useState<MonthReport | null | 'err'>(null)
  useEffect(() => {
    let off = false
    setR(null)
    Promise.all([allMyLogs(householdId, me), loadMoods(householdId, me, `${month}-01`)]).then(([logs, moods]) => {
      if (off) return
      const w = bodySeries(logs, me, 'weight').filter(p => p.date <= addDays(`${month}-28`, 4)).pop()?.v ?? null
      const plan = plans.find(p => p.who === me)
      setR(monthReport({
        logs, who: me, month, today, moods,
        waterGoal: settings?.water_goal_ml || 2000, sleepGoal: settings?.sleep_goal_h || 8,
        kcalTarget: prof && w ? calorieTarget(prof, w, Number(month.slice(0, 4))).kcal : null,
        proteinTarget: prof && w ? proteinTarget(prof, w).g : null,
        planMealsPerDay: plan ? plan.plan.meals.filter(m => m.when === 'sempre').length : 0,
      }))
    }).catch(() => { if (!off) setR('err') })
    return () => { off = true }
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.classList.add('rp-open'); return () => document.documentElement.classList.remove('rp-open') }, [])

  const text = (x: MonthReport) => [
    `📄 Relatório de ${mesNome(x.month)} · ${name}`,
    x.weight.last != null && `⚖️ Peso: ${N1(x.weight.last)} kg${x.weight.change != null ? ` (${sg(x.weight.change)} kg no mês)` : ''}`,
    ...x.measures.map(m => `📏 ${m.label}: ${N1(m.last)} ${m.unit} (${sg(m.change)})`),
    x.food.kcalAvg != null && `🍽️ ${x.food.daysLogged} dias registrados · média ${K(x.food.kcalAvg)} kcal${x.food.proteinAvg != null ? ` · ${x.food.proteinAvg} g de proteína` : ''}`,
    x.plan && `📋 Plano: ${x.plan.pct}% das refeições marcadas (${x.plan.marked} de ${x.plan.expected})`,
    x.water.avgMl != null && `💧 Água: média ${N1(x.water.avgMl / 1000)} L · meta em ${x.water.daysOnGoal} dias`,
    x.sleep.avgH != null && `😴 Sono: média ${N1(x.sleep.avgH)} h (${x.sleep.nights} noites)`,
    x.workouts.count > 0 && `🏋️ Treinos: ${x.workouts.count} (${K(x.workouts.minutes)} min)`,
  ].filter(Boolean).join('\n')

  // fica direto no <body>: ao imprimir, só o relatório aparece
  return createPortal(
    <div className="rp-wrap" role="dialog" aria-modal="true" aria-labelledby="rp-t">
      <div className="rp-bar">
        <label className="rp-sel"><span className="sr-only">Mês</span>
          <select className="fi" value={month} onChange={e => setMonth(e.target.value)}>{months.map(m => <option key={m} value={m}>{mesNome(m)}</option>)}</select></label>
        <button className="btn btn-p" disabled={!r || r === 'err'} onClick={() => window.print()}>🖨️ Salvar em PDF</button>
        {typeof navigator !== 'undefined' && 'share' in navigator && <button className="btn btn-g" disabled={!r || r === 'err'} onClick={() => { if (r && r !== 'err') navigator.share({ title: `Relatório de ${mesNome(r.month)}`, text: text(r) }).catch(() => {}) }}>Compartilhar resumo</button>}
        <button className="btn btn-g" onClick={onClose}>Fechar</button>
      </div>
      <article className="rp-print">
        <header className="rp-h">
          <h1 id="rp-t">Relatório de {mesNome(month)}</h1>
          <p>{name}{r && r !== 'err' ? ` · ${fmt(r.from)} a ${fmt(r.to)} (${r.days} dias)` : ''} · gerado pelo Ninho em {fmt(today)}/{today.slice(0, 4)}</p>
        </header>
        {r === null && <p className="row-s">Montando o relatório…</p>}
        {r === 'err' && <p className="al-warn" role="alert">Não foi possível montar agora. Tente de novo.</p>}
        {r && r !== 'err' && <>
          <section className="rp-s"><h2>⚖️ Peso e medidas</h2>
            {r.weight.series.length ? <>
              <p><b>{N1(r.weight.last!)} kg</b> no fim do período{r.weight.change != null ? <> · <b>{sg(r.weight.change)} kg</b> no mês (de {N1(r.weight.first!)} kg)</> : null}{prof?.target_kg ? ` · peso desejado ${N1(prof.target_kg)} kg` : ''}</p>
              {r.weight.series.length >= 2 && <LineChart title="Peso no mês" unit="kg" data={r.weight.series} goal={prof?.target_kg ?? null}/>}
            </> : <p className="row-s">Sem pesagens no mês.</p>}
            {r.measures.length > 0 && <table className="rp-t"><thead><tr><th scope="col">Medida</th><th scope="col">Início</th><th scope="col">Fim</th><th scope="col">Diferença</th></tr></thead>
              <tbody>{r.measures.map(m => <tr key={m.label}><th scope="row">{m.label}</th><td>{N1(m.first)} {m.unit}</td><td>{N1(m.last)} {m.unit}</td><td>{sg(m.change)} {m.unit}</td></tr>)}</tbody></table>}
          </section>
          <section className="rp-s"><h2>🍽️ Alimentação</h2>
            {r.food.daysLogged ? <ul>
              <li>Refeições registradas em <b>{r.food.daysLogged} de {r.days} dias</b></li>
              {r.food.kcalAvg != null && <li>Média de <b>{K(r.food.kcalAvg)} kcal</b> por dia registrado{r.food.daysOnTarget ? ` · ${r.food.daysOnTarget} dia(s) dentro da meta (±10%)` : ''}</li>}
              {r.food.proteinAvg != null && <li>Proteína: média de <b>{r.food.proteinAvg} g</b> por dia</li>}
              {r.plan && <li>Plano da nutricionista: <b>{r.plan.pct}%</b> das refeições marcadas ({r.plan.marked} de {r.plan.expected})</li>}
              {r.food.topFoods.length > 0 && <li>Mais frequentes: {r.food.topFoods.map(f => `${f.name} (${f.n}x)`).join(', ')}</li>}
            </ul> : <p className="row-s">Sem refeições registradas no mês.</p>}
          </section>
          <section className="rp-s"><h2>🌿 Rotina</h2><ul>
            <li>💧 Água: {r.water.avgMl != null ? <>média de <b>{N1(r.water.avgMl / 1000)} L</b> nos dias registrados · meta batida em {r.water.daysOnGoal} dia(s)</> : 'sem registros'}</li>
            <li>😴 Sono: {r.sleep.avgH != null ? <>média de <b>{N1(r.sleep.avgH)} h</b> em {r.sleep.nights} noite(s) · {r.sleep.onGoal} na meta</> : 'sem registros'}</li>
            <li>🏋️ Treinos: {r.workouts.count ? <><b>{r.workouts.count}</b> ({K(r.workouts.minutes)} min)</> : 'nenhum registrado'}</li>
            {r.mood && <li>{r.mood.emoji} Humor que mais apareceu: {r.mood.label.toLowerCase()} ({r.mood.n} dias)</li>}
          </ul></section>
          <p className="rp-foot">Valores estimados a partir dos registros no app. Não substituem avaliação profissional.</p>
        </>}
      </article>
    </div>, document.body)
}
