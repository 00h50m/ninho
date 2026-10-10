'use client'
// Sono da semana: uma barra por noite (série única, sem legenda), valor escrito
// em cima, linha da meta tracejada, detalhe ao passar o dedo/mouse ou com o
// teclado, e tabela com os valores.
import { useState } from 'react'
import { dowOf, fmtDate } from '@/lib/dates'

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const fmtH = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')

export function SleepBars({ days, goal, today }: { days: Array<{ date: string, h: number | null }>, goal: number, today: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const top = Math.max(goal + 1, ...days.map(d => d.h || 0))
  const pct = (v: number) => `${Math.min(100, v / top * 100)}%`
  const h = hover != null ? days[hover] : null
  const logged = days.filter(d => d.h != null).length
  return (
    <figure className="sb">
      <div className="sb-key" aria-hidden="true"><i/>meta {fmtH(goal)} h</div>
      <div className="sb-plot" role="group" aria-label={`Sono dos últimos 7 dias: ${logged} noite(s) registrada(s), meta de ${fmtH(goal)} h`} onMouseLeave={() => setHover(null)}>
        <div className="sb-goal" style={{ bottom: pct(goal) }} aria-hidden="true"/>
        {days.map((d, i) => (
          <button key={d.date} type="button" className={`sb-col ${hover === i ? 'on' : ''}`} aria-label={`${d.date === today ? 'Hoje' : fmtDate(d.date)}: ${d.h != null ? `${fmtH(d.h)} h` : 'sem registro'}`}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            {d.h != null
              ? <span className="sb-bar" style={{ height: pct(d.h) }}><span className="sb-v">{fmtH(d.h)}</span></span>
              : <span className="sb-none" aria-hidden="true">–</span>}
          </button>
        ))}
      </div>
      <div className="sb-x" aria-hidden="true">{days.map(d => <span key={d.date} className={d.date === today ? 'on' : ''}>{d.date === today ? 'hoje' : DOW[dowOf(d.date)]}</span>)}</div>
      {h && <div className="lc-tip" aria-hidden="true">{fmtDate(h.date)} · <b>{h.h != null ? `${fmtH(h.h)} h` : 'sem registro'}</b></div>}
      <button className="lnk-inline lc-tbl" onClick={() => setTable(t => !t)} aria-expanded={table}>{table ? 'Esconder valores' : 'Ver valores'}</button>
      {table && <table className="lc-table"><thead><tr><th>Noite</th><th>Horas</th></tr></thead>
        <tbody>{[...days].reverse().map(d => <tr key={d.date}><td>{fmtDate(d.date)}</td><td>{d.h != null ? `${fmtH(d.h)} h` : '—'}</td></tr>)}</tbody></table>}
    </figure>
  )
}
