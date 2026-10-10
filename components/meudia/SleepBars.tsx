'use client'
// Gráfico da semana: uma barra por dia (série única, sem legenda), valor escrito
// em cima, linha da meta tracejada, detalhe ao passar o dedo/mouse ou com o
// teclado, e tabela com os valores. Usado no sono (horas) e na alimentação (kcal).
import { useState } from 'react'
import { dowOf, fmtDate } from '@/lib/dates'

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const fmtH = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')
const fmtK = (v: number) => Math.round(v).toLocaleString('pt-BR')

interface WeekBarsProps { days: Array<{ date: string, h: number | null }>, goal: number, today: string, unit: 'h' | 'kcal', what: string, col: string }

export function WeekBars({ days, goal, today, unit, what, col }: WeekBarsProps) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const fmt = unit === 'h' ? fmtH : fmtK
  const top = unit === 'h' ? Math.max(goal + 1, ...days.map(d => d.h || 0)) : Math.max(goal * 1.15, ...days.map(d => d.h || 0))
  const pct = (v: number) => `${Math.min(100, v / top * 100)}%`
  const h = hover != null ? days[hover] : null
  const logged = days.filter(d => d.h != null).length
  return (
    <figure className="sb">
      <div className="sb-key" aria-hidden="true"><i/>meta {fmt(goal)} {unit}</div>
      <div className="sb-plot" role="group" aria-label={`${what} dos últimos 7 dias: ${logged} dia(s) registrado(s), meta de ${fmt(goal)} ${unit}`} onMouseLeave={() => setHover(null)}>
        <div className="sb-goal" style={{ bottom: pct(goal) }} aria-hidden="true"/>
        {days.map((d, i) => (
          <button key={d.date} type="button" className={`sb-col ${hover === i ? 'on' : ''}`} aria-label={`${d.date === today ? 'Hoje' : fmtDate(d.date)}: ${d.h != null ? `${fmt(d.h)} ${unit}` : 'sem registro'}`}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            {d.h != null
              ? <span className="sb-bar" style={{ height: pct(d.h) }}><span className="sb-v">{fmt(d.h)}</span></span>
              : <span className="sb-none" aria-hidden="true">–</span>}
          </button>
        ))}
      </div>
      <div className="sb-x" aria-hidden="true">{days.map(d => <span key={d.date} className={d.date === today ? 'on' : ''}>{d.date === today ? 'hoje' : DOW[dowOf(d.date)]}</span>)}</div>
      {h && <div className="lc-tip" aria-hidden="true">{fmtDate(h.date)} · <b>{h.h != null ? `${fmt(h.h)} ${unit}` : 'sem registro'}</b></div>}
      <button className="lnk-inline lc-tbl" onClick={() => setTable(t => !t)} aria-expanded={table}>{table ? 'Esconder valores' : 'Ver valores'}</button>
      {table && <table className="lc-table"><thead><tr><th>{col}</th><th>{unit === 'h' ? 'Horas' : 'kcal'}</th></tr></thead>
        <tbody>{[...days].reverse().map(d => <tr key={d.date}><td>{fmtDate(d.date)}</td><td>{d.h != null ? `${fmt(d.h)} ${unit}` : '—'}</td></tr>)}</tbody></table>}
    </figure>
  )
}

export const SleepBars = ({ days, goal, today }: { days: Array<{ date: string, h: number | null }>, goal: number, today: string }) =>
  <WeekBars days={days} goal={goal} today={today} unit="h" what="Sono" col="Noite"/>
