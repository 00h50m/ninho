'use client'
// Humor do mês: o humor do check-in de cada dia no calendário, o que mais se
// repete e o que costuma acompanhar os dias melhores (sono, treino, água).
import { useEffect, useState } from 'react'
import { addDays } from '@/lib/dates'
import { moodOf } from '@/lib/week'
import { monthGrid, moodInsights, moodStats, type MoodRow } from '@/lib/humor'
import { loadMoods } from '@/lib/services/meudia'
import type { PSettings } from '@/lib/meudia'
import type { MeuDiaProps } from './MeuDia'

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function MoodCard(p: MeuDiaProps & { s: PSettings }) {
  const [rows, setRows] = useState<MoodRow[] | null>(null)
  const [ym, setYm] = useState<[number, number]>([Number(p.today.slice(0, 4)), Number(p.today.slice(5, 7))])
  useEffect(() => { loadMoods(p.householdId, p.me, addDays(p.today, -400)).then(setRows).catch(() => setRows([])) }, [p.householdId, p.me, p.today])
  const [y, m] = ym
  const key = `${y}-${String(m).padStart(2, '0')}`
  const grid = monthGrid(y, m)
  const by = new Map((rows || []).map(r => [r.date, r.mood]))
  const st = moodStats(rows || [], p.today, `${key}-01`, `${key}-31`)
  const ins = moodInsights(rows || [], p.logs, p.me, p.s.sleep_goal_h, p.s.water_goal_ml)
  const move = (d: number) => setYm(([yy, mm]) => { const t = yy * 12 + (mm - 1) + d; return [Math.floor(t / 12), t % 12 + 1] })
  const isNow = key === p.today.slice(0, 7)
  return (
    <section className="card md-card md-wide" aria-labelledby="md-humor">
      <div className="slbl" id="md-humor">😊 Humor {!by.get(p.today) && p.onCheckin && <button className="lnk" onClick={p.onCheckin}>Como está hoje? →</button>}</div>
      <div className="hm-top">
        <div className="hm-cal">
          <div className="hm-nav">
            <button className="ib" onClick={() => move(-1)} aria-label="Mês anterior">‹</button>
            <b>{MONTHS[m - 1]} {y}</b>
            <button className="ib" onClick={() => move(1)} disabled={isNow} aria-label="Próximo mês">›</button>
          </div>
          <table className="hm-grid">
            <caption className="sr-only">Humor de {MONTHS[m - 1]} de {y}</caption>
            <thead><tr>{DOW.map((d, i) => <th key={i} scope="col" aria-hidden="true">{d}</th>)}</tr></thead>
            <tbody>{grid.map((w, i) => <tr key={i}>{w.map((d, j) => {
              if (!d) return <td key={j}/>
              const mo = moodOf(by.get(d))
              return <td key={j} className={`${d === p.today ? 'today' : ''} ${d > p.today ? 'fut' : ''}`}>
                <span className="hm-d"><span className="hm-e" aria-hidden="true">{mo ? mo.emoji : ''}</span><small aria-hidden="true">{Number(d.slice(8))}</small><span className="sr-only">{Number(d.slice(8))}: {mo ? mo.label : 'sem registro'}</span></span>
              </td>
            })}</tr>)}</tbody>
          </table>
        </div>
        <div className="hm-side">
          <dl className="sl-stats hm-stats">
            <div><dt>Dias registrados</dt><dd><b className="mono">{st.days30}</b><small>7 dias: {st.days7} · 30 dias: {st.days30}</small></dd></div>
            <div><dt>Humor predominante no mês</dt><dd>{st.top ? <><b>{st.top.emoji} {st.top.label}</b><small>{st.top.pct}% dos dias registrados ({st.top.n}x)</small></> : <small>Sem registros neste mês</small>}</dd></div>
          </dl>
          {ins.length > 0 && <ul className="hm-ins">{ins.map(x => <li key={x.text}>{x.better ? '✨' : '💡'} {x.text}</li>)}</ul>}
          {rows && rows.filter(r => r.mood).length < 6 && <p className="row-s">Faça o check-in da noite por alguns dias e o Ninho mostra o que acompanha os seus dias melhores.</p>}
        </div>
      </div>
    </section>
  )
}
