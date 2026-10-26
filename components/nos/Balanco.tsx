'use client'
// Nós › Semana: ⚖️ Balanço — quanto cada uma fez (esforço), quem cozinhou e as horas de compromisso,
// nesta semana e na passada. Sem placar: é para combinar. O rodízio já compensa sozinho.
import type { Names } from '@/lib/types'
import { balanceLine, type WeekBalance } from '@/lib/balanco'

const first = (n: string) => (n || '').split(' ')[0]
const H = (min: number) => min >= 60 ? `${Math.round(min / 6) / 10} h`.replace('.', ',') : min ? `${min} min` : '—'

export function BalanceCard({ thisWeek, lastWeek, names }: { thisWeek: WeekBalance, lastWeek: WeekBalance, names: Names }) {
  const row = (b: WeekBalance, label: string, now: boolean) => <div className="bl-w">
    <div className="bl-h"><b>{label}</b></div>
    {b.pctG != null && <div className="bl-bar" role="img" aria-label={`${first(names.g)} ${b.pctG}%, ${first(names.s)} ${100 - b.pctG}%`}>
      <span className="bl-g" style={{ width: `${b.pctG}%` }}/><span className="bl-s" style={{ width: `${100 - b.pctG}%` }}/>
    </div>}
    <table className="bl-t">
      <thead><tr><th scope="col"><span className="sr-only">Pessoa</span></th><th scope="col">Esforço</th><th scope="col">Feitas</th><th scope="col">Cozinhou</th><th scope="col">Compromissos</th></tr></thead>
      <tbody>{(['g', 's'] as const).map(w => <tr key={w}><th scope="row"><span className={`bl-dot bl-${w}`} aria-hidden="true"/>{first(names[w])}</th>
        <td className="mono">{b[w].points}</td><td className="mono">{b[w].done}</td><td className="mono">{b[w].cooked ? String(b[w].cooked).replace('.', ',') : '—'}</td><td className="mono">{H(b[w].busyMin)}</td></tr>)}</tbody>
    </table>
    <p className="row-s">{balanceLine(b, names, now)}</p>
  </div>
  return (
    <section className="card bl" aria-labelledby="bl-t">
      <div className="slbl" id="bl-t">⚖️ Balanço da semana</div>
      {row(thisWeek, 'Esta semana (até hoje)', true)}
      {row(lastWeek, 'Semana passada', false)}
      <p className="row-s bl-how">Esforço: tarefa leve 1, média 2, pesada 3; rotina dos cães 1; cozinhar o jantar 2. Quem fez mais na semana passada recebe um pouco menos do rodízio nesta.</p>
    </section>
  )
}
