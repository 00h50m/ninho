'use client'
// Os sete dias da semana com o que aconteceu de verdade: conclusões, humor,
// energia, modo sobrevivência e dias sem registro.
import type { Names } from '@/lib/types'
import { ENERGY } from '@/lib/constants'
import { moodOf, type DayInfo } from '@/lib/week'

const SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const first = (n: string) => (n || '').split(' ')[0]

export function WeekStrip({ days, names }: { days: DayInfo[], names: Names }) {
  const max = Math.max(1, ...days.map(d => d.done))
  const total = days.reduce((a, d) => a + d.done, 0)
  return (
    <section className="card wk" aria-labelledby="wk-h">
      <div className="slbl" id="wk-h">A semana <span className="mono" style={{ color: 'var(--faint)' }}>{total} conclus{total === 1 ? 'ão' : 'ões'}</span></div>
      <ol className="wk-days">
        {days.map(d => {
          const mg = moodOf(d.moods.g), ms = moodOf(d.moods.s)
          const label = [
            `${SHORT[d.idx]} ${Number(d.date.slice(8))}${d.isToday ? ', hoje' : ''}`,
            d.future ? 'ainda não chegou' : d.empty ? 'sem registro' : `${d.done} conclus${d.done === 1 ? 'ão' : 'ões'}`,
            mg ? `${first(names.g)}: ${mg.label}` : '', ms ? `${first(names.s)}: ${ms.label}` : '',
            d.energy ? ENERGY[d.energy].l : '', d.survival ? 'modo sobrevivência' : '',
          ].filter(Boolean).join(' · ')
          return (
            <li key={d.date} className={`wk-d ${d.isToday ? 'today' : ''} ${d.future ? 'future' : ''} ${d.empty ? 'empty' : ''}`} aria-label={label} title={label}>
              <span className="wk-n">{SHORT[d.idx]}<b>{Number(d.date.slice(8))}</b></span>
              <span className="wk-bar" aria-hidden="true"><i style={{ height: `${d.future ? 0 : Math.max(d.done ? 12 : 0, Math.round(d.done / max * 100))}%` }}/></span>
              <span className="wk-c mono" aria-hidden="true">{d.future ? '' : d.empty ? '—' : d.done}</span>
              <span className="wk-m" aria-hidden="true">{mg ? mg.emoji : <i className="wk-dot g"/>}{ms ? ms.emoji : <i className="wk-dot s"/>}</span>
              <span className="wk-e" aria-hidden="true">{d.survival ? '🛡' : d.energy ? ENERGY[d.energy].ic : ''}</span>
            </li>
          )
        })}
      </ol>
      <div className="wk-leg" aria-hidden="true"><span>barras = conclusões</span><span>rostos = humor</span><span>🛡 = sobrevivência</span><span>— = sem registro</span></div>
    </section>
  )
}
