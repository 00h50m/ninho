'use client'
// Retrospectiva (Nós › Histórico): semana a semana por pessoa, por cômodo e as tarefas mais
// esquecidas. Usa o histórico que o app já tem (sem consulta nova). As cores das duas vêm dos
// tokens; a Sabrina também tem listras, para não depender só da cor (daltonismo, impressão).
import { useMemo, useState } from 'react'
import type { Dog, Names, Task } from '@/lib/types'
import { byRoom, forgotten, weeksByPerson } from '@/lib/retro'
import { fmtDate } from '@/lib/dates'

const first = (n: string) => (n || '').split(' ')[0]
const UNIT: Record<string, [string, string]> = { daily: ['dia', 'dias'], weekly: ['semana', 'semanas'], biweekly: ['quinzena', 'quinzenas'], monthly: ['mês', 'meses'] }
const unit = (freq: string, n: number) => (UNIT[freq] || ['vez', 'vezes'])[n === 1 ? 0 : 1]

// geometria do gráfico (unidades do viewBox)
const W = 320, H = 150, L = 26, R = 4, TOP = 14, BOT = 20
const BW = 13, GAP = 2

/** Barra com os cantos de cima arredondados (4) e a base reta no zero. */
const bar = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, h, w / 2)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}
/** Topo do eixo: par, para a linha do meio também ser um número inteiro. */
const niceMax = (m: number) => Math.max(4, Math.ceil(m / 2) * 2)

export function RetroCard({ tasks, dogs, today, names }: { tasks: Task[], dogs: Dog[], today: string, names: Names }) {
  const weeks = useMemo(() => weeksByPerson({ tasks, dogs, today }), [tasks, dogs, today])
  const rooms = useMemo(() => byRoom({ tasks, dogs, today }), [tasks, dogs, today])
  const forgot = useMemo(() => forgotten({ tasks, today }), [tasks, today])
  const [hover, setHover] = useState<number | null>(null)
  const total = weeks.reduce((a, w) => a + w.g + w.s + w.x, 0)
  const ng = first(names.g), ns = first(names.s)

  const max = niceMax(Math.max(1, ...weeks.flatMap(w => [w.g, w.s])))
  const ih = H - TOP - BOT, slot = (W - L - R) / weeks.length
  const y = (v: number) => TOP + ih - (v / max) * ih
  const shown = hover ?? weeks.length - 1
  const sw = weeks[shown]
  const roomMax = Math.max(1, ...rooms.map(r => r.n))

  return (
    <div className="card retro" id="retro">
      <div className="slbl">📊 Retrospectiva</div>
      {!total ? <p className="row-s">Ainda não há conclusões nas últimas semanas. Conforme vocês forem marcando as tarefas, os gráficos aparecem aqui.</p> : <>
        <div className="rt-h">Semana a semana</div>
        <div className="rt-leg" aria-hidden="true">
          <span><i className="rt-sw rt-g"/>{ng}</span>
          <span><i className="rt-sw rt-s"/>{ns}</span>
        </div>
        <svg className="rt-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Conclusões por semana nas últimas ${weeks.length} semanas. Esta semana: ${ng} ${weeks[weeks.length - 1].g}, ${ns} ${weeks[weeks.length - 1].s}. A tabela abaixo tem todos os números.`}
          onMouseLeave={() => setHover(null)}>
          <defs>
            <pattern id="rt-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2" height="5" className="rt-hl"/>
            </pattern>
          </defs>
          {[0, max / 2, max].map(v => <g key={v}>
            <line className="rt-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)}/>
            <text className="rt-ax" x={L - 5} y={y(v) + 3.5} textAnchor="end">{v}</text>
          </g>)}
          {weeks.map((w, i) => {
            const cx = L + slot * i + slot / 2, xg = cx - BW - GAP / 2, xs = cx + GAP / 2
            const on = i === shown
            return <g key={w.week} className={on ? 'rt-on' : undefined} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect className="rt-hit" x={L + slot * i} y={TOP} width={slot} height={ih + BOT}/>
              {w.g > 0 && <path className="rt-g" d={bar(xg, y(w.g), BW, y(0) - y(w.g))}><title>{`Semana de ${fmtDate(w.week)}: ${ng} ${w.g}`}</title></path>}
              {w.s > 0 && <><path className="rt-s" d={bar(xs, y(w.s), BW, y(0) - y(w.s))}><title>{`Semana de ${fmtDate(w.week)}: ${ns} ${w.s}`}</title></path>
                <path className="rt-hatch" d={bar(xs, y(w.s), BW, y(0) - y(w.s))}/></>}
              {on && w.g > 0 && <text className="rt-val" x={xg + BW / 2} y={y(w.g) - 3} textAnchor="middle">{w.g}</text>}
              {on && w.s > 0 && <text className="rt-val" x={xs + BW / 2} y={y(w.s) - 3} textAnchor="middle">{w.s}</text>}
              {(on || (i % 2 === (weeks.length - 1) % 2 && Math.abs(i - shown) !== 1)) && <text className={`rt-ax ${on ? 'rt-axon' : ''}`} x={cx} y={H - 6} textAnchor="middle">{i === weeks.length - 1 ? 'esta' : fmtDate(w.week)}</text>}
            </g>
          })}
          <line className="rt-base" x1={L} x2={W - R} y1={y(0)} y2={y(0)}/>
        </svg>
        <div className="rt-read" id="rt-read">{shown === weeks.length - 1 ? 'Esta semana' : `Semana de ${fmtDate(sw.week)}`}: <b>{ng} {sw.g}</b> · <b>{ns} {sw.s}</b>{sw.x > 0 ? ` · sem autoria ${sw.x}` : ''}</div>
        <details className="rt-tab">
          <summary>Ver em tabela</summary>
          <table>
            <thead><tr><th scope="col">Semana</th><th scope="col">{ng}</th><th scope="col">{ns}</th>{weeks.some(w => w.x) && <th scope="col">Sem autoria</th>}</tr></thead>
            <tbody>{weeks.slice().reverse().map(w => <tr key={w.week}><th scope="row">{fmtDate(w.week)}</th><td>{w.g}</td><td>{w.s}</td>{weeks.some(v => v.x) && <td>{w.x}</td>}</tr>)}</tbody>
          </table>
        </details>

        {rooms.length > 0 && <>
          <div className="rt-h">Por cômodo <small>últimos 28 dias</small></div>
          <ul className="rt-rooms">{rooms.map(r => <li key={r.cat}>
            <span className="rt-rl">{r.label}</span>
            <span className="rt-rb" aria-hidden="true"><i style={{ width: `${(r.n / roomMax) * 100}%` }}/></span>
            <span className="rt-rn">{r.n}</span>
          </li>)}</ul>
        </>}
      </>}

      <div className="rt-h">Mais esquecidas <small>últimos 28 dias</small></div>
      {!forgot.length ? <p className="row-s">Nenhuma tarefa ficou para trás nas últimas 4 semanas. 👏</p>
        : <ul className="rt-forgot">{forgot.map(f => <li key={f.task.id}>
          <span className="rt-ft">{f.task.title}</span>
          <span className="rt-fs">feita {f.done} de {f.expected} {unit(f.task.frequency, f.expected)} · {f.last ? `última em ${fmtDate(f.last)}` : 'sem registro em 2 meses'}</span>
        </li>)}</ul>}
    </div>
  )
}
