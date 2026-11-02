'use client'
// Nós › Histórico: mapa de calor das últimas 5 semanas (um para cada uma, na cor dela, do claro
// ao escuro) e as sequências de cada tarefa. A leitura do dia escolhido aparece em texto e há a
// tabela, para não depender só da cor.
import { useMemo, useState } from 'react'
import type { Dog, Names, Task, Who } from '@/lib/types'
import { heatLevel, heatmap, taskStreaks } from '@/lib/historico'
import { fmtDate } from '@/lib/dates'

const first = (n: string) => (n || '').split(' ')[0]
const DOW = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const dowName = (date: string) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(date + 'T12:00:00Z').getUTCDay()]

export function HeatCard({ tasks, dogs, today, names }: { tasks: Task[], dogs: Dog[], today: string, names: Names }) {
  const days = useMemo(() => heatmap({ tasks, dogs, today }), [tasks, dogs, today])
  const [pick, setPick] = useState<string>(today)
  const max = Math.max(1, ...days.flatMap(d => [d.g, d.s]))
  const sel = days.find(d => d.date === pick) || days[days.length - 1]
  const total = (w: Who) => days.reduce((a, d) => a + d[w], 0)
  const best = (w: Who) => days.reduce((b, d) => (d[w] > b[w] ? d : b), days[0])
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))

  const grid = (w: Who) => (
    <figure className={`heat heat-p-${w}`} aria-label={`${first(names[w])}: ${total(w)} feitas em 5 semanas`}>
      <figcaption><span className={`heat-dot heat-dot-${w}`} aria-hidden="true"/>{first(names[w])} <span className="mono">{total(w)}</span></figcaption>
      <div className="heat-g" role="presentation">
        {DOW.map(d => <span key={d} className="heat-dow" aria-hidden="true">{d[0]}</span>)}
        {days.map(d => (
          <button key={d.date} type="button" tabIndex={-1} aria-hidden="true"
            className={`heat-c l${d.future ? 'f' : heatLevel(d[w], max)}${d.date === sel.date ? ' sel' : ''}${d.date === today ? ' today' : ''}`}
            title={d.future ? '' : `${dowName(d.date)} ${fmtDate(d.date)} · ${first(names[w])}: ${d[w]}`}
            onClick={() => !d.future && setPick(d.date)}/>
        ))}
      </div>
    </figure>
  )

  return (
    <section className="card heat-card" aria-labelledby="heat-h">
      <div className="slbl" id="heat-h">🗓 Mapa do mês</div>
      <div className="heat-row">{grid('g')}{grid('s')}</div>
      <div className="heat-foot">
        <p className="heat-read" aria-live="polite"><b>{dowName(sel.date)} {fmtDate(sel.date)}</b> · {first(names.g)} {sel.g} · {first(names.s)} {sel.s}</p>
        <span className="heat-leg" aria-hidden="true">menos <i className="heat-c l0"/><i className="heat-c l1"/><i className="heat-c l2"/><i className="heat-c l3"/><i className="heat-c l4"/> mais</span>
      </div>
      <p className="row-s">Dia mais cheio: {first(names.g)} em {fmtDate(best('g').date)} ({best('g').g}) · {first(names.s)} em {fmtDate(best('s').date)} ({best('s').s}). Toque num dia para ver.</p>
      <details className="heat-tab">
        <summary>Ver em tabela</summary>
        <table>
          <thead><tr><th scope="col">Semana</th>{DOW.map(d => <th key={d} scope="col">{d}</th>)}</tr></thead>
          <tbody>{weeks.map(wk => (
            <tr key={wk[0].date}><th scope="row">{fmtDate(wk[0].date)}</th>
              {wk.map(d => <td key={d.date}>{d.future ? '–' : `${d.g} · ${d.s}`}</td>)}</tr>
          ))}</tbody>
        </table>
        <p className="row-s">Cada célula: {first(names.g)} · {first(names.s)}.</p>
      </details>
    </section>
  )
}

export function TaskStreaksCard({ tasks, today }: { tasks: Task[], today: string }) {
  const list = useMemo(() => taskStreaks({ tasks, today }), [tasks, today])
  return (
    <section className="card" aria-labelledby="tstk-h">
      <div className="slbl" id="tstk-h">🔥 Sequências das tarefas</div>
      {list.length === 0
        ? <p className="row-s">Quando uma tarefa for feita 3 vezes seguidas (dias, semanas ou meses, conforme a frequência), ela aparece aqui.</p>
        : <ol className="tstk">{list.map(s => (
          <li key={s.task.id}><span className="tstk-t">{s.task.title}</span><b className="mono">{s.n}</b><span className="tstk-u">{s.unit} seguid{/semana|quinzena/.test(s.unit) ? 'as' : 'os'}</span></li>
        ))}</ol>}
    </section>
  )
}
