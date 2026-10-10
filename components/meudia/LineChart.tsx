'use client'
// Gráfico de evolução de uma série só (peso, cintura, carga): linha fina, pontos
// com valor ao passar o dedo/mouse ou com o teclado, último valor escrito e tabela.
import { useEffect, useRef, useState } from 'react'
import { fmtDate } from '@/lib/dates'

/** proj: ponto previsto (linha tracejada a partir do último valor). goal: linha de referência. */
export function LineChart({ title, unit, data, proj, goal }: { title: string, unit: string, data: Array<{ date: string, v: number }>, proj?: { date: string, v: number } | null, goal?: number | null }) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  // a largura do desenho acompanha a do cartão (o texto fica sempre do mesmo tamanho)
  const ref = useRef<HTMLElement>(null), [W, setW] = useState(320)
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el); return () => ro.disconnect()
  }, [data.length > 0])
  if (data.length === 0) return <div className="lc-empty">Sem registros de {title.toLowerCase()} ainda.</div>
  const H = 150, P = { l: 38, r: 44, t: 12, b: 24 }
  const vs = [...data.map(d => d.v), ...(proj ? [proj.v] : []), ...(goal ? [goal] : [])], min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1
  const end = proj ? proj.date : data[data.length - 1].date
  const t0 = Date.parse(data[0].date), t1 = Date.parse(end), tspan = t1 - t0 || 1
  const x = (d: string) => data.length === 1 && !proj ? (P.l + W - P.r) / 2 : P.l + (Date.parse(d) - t0) / tspan * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - min) / span) * (H - P.t - P.b)
  const fmt = (v: number) => `${String(Math.round(v * 10) / 10).replace('.', ',')} ${unit}`
  const last = data[data.length - 1]
  const h = hover != null ? data[hover] : null
  return (
    <figure className="lc" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${title}: de ${fmt(data[0].v)} em ${fmtDate(data[0].date)} para ${fmt(last.v)} em ${fmtDate(last.date)}`} onMouseLeave={() => setHover(null)}>
        <line className="lc-grid" x1={P.l} x2={W - P.r} y1={y(max)} y2={y(max)}/>
        <line className="lc-grid" x1={P.l} x2={W - P.r} y1={y(min)} y2={y(min)}/>
        <text className="lc-ax" x={P.l - 4} y={y(max) + 3} textAnchor="end">{String(Math.round(max * 10) / 10).replace('.', ',')}</text>
        {max !== min && <text className="lc-ax" x={P.l - 4} y={y(min) + 3} textAnchor="end">{String(Math.round(min * 10) / 10).replace('.', ',')}</text>}
        <text className="lc-ax" x={P.l} y={H - 6}>{fmtDate(data[0].date)}</text>
        {(data.length > 1 || proj) && <text className="lc-ax" x={W - P.r} y={H - 6} textAnchor="end">{fmtDate(end)}</text>}
        {goal != null && <line className="lc-goal" x1={P.l} x2={W - P.r} y1={y(goal)} y2={y(goal)}/>}
        {proj && <line className="lc-proj" x1={x(last.date)} y1={y(last.v)} x2={x(proj.date)} y2={y(proj.v)}/>}
        {proj && <text className="lc-ax" x={x(proj.date)} y={y(proj.v) - 8} textAnchor="end">previsão {String(Math.round(proj.v * 10) / 10).replace('.', ',')}</text>}
        {data.length > 1 && <polyline className="lc-line" points={data.map(d => `${x(d.date)},${y(d.v)}`).join(' ')}/>}
        {data.map((d, i) => (
          <g key={d.date} tabIndex={0} role="button" aria-label={`${fmtDate(d.date)}: ${fmt(d.v)}`} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onMouseEnter={() => setHover(i)}>
            <circle className="lc-hit" cx={x(d.date)} cy={y(d.v)} r={12}/>
            <circle className={`lc-dot ${hover === i ? 'on' : ''}`} cx={x(d.date)} cy={y(d.v)} r={4}/>
          </g>
        ))}
        <text className="lc-last" x={x(last.date) + 7} y={y(last.v) + 4}>{String(Math.round(last.v * 10) / 10).replace('.', ',')}</text>
      </svg>
      {h && <div className="lc-tip" aria-hidden="true">{fmtDate(h.date)} · <b>{fmt(h.v)}</b></div>}
      <button className="lnk-inline lc-tbl" onClick={() => setTable(t => !t)} aria-expanded={table}>{table ? 'Esconder valores' : 'Ver valores'}</button>
      {table && <table className="lc-table"><thead><tr><th>Data</th><th>{title}</th></tr></thead>
        <tbody>{[...data].reverse().map(d => <tr key={d.date}><td>{fmtDate(d.date)}</td><td>{fmt(d.v)}</td></tr>)}</tbody></table>}
    </figure>
  )
}
