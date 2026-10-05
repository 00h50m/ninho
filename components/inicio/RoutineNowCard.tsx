'use client'
// A rotina deste momento (ou a próxima de hoje), com passos, duração e quem faz.
import type { Names, Who } from '@/lib/types'
import type { RoutineRow } from '@/lib/services/onboarding'
import { daysLabel } from '@/lib/onboarding'
import { hhmm } from '@/lib/dates'

const first = (n: string) => (n || '').split(' ')[0]

export function RoutineNowCard({ now, next, countToday, names, turnOf, onOpen, onSetup }: {
  now: RoutineRow | null, next: RoutineRow | null, countToday: number, names: Names,
  turnOf: (r: RoutineRow) => Who, onOpen: () => void, onSetup: () => void
}) {
  const r = now || next
  const who = (x: RoutineRow) => x.assign_mode === 'shared' ? 'As duas' : x.assign_mode === 'rotation' ? `Rodízio · vez de ${first(names[turnOf(x)])}` : first(names[x.assign_mode as Who])
  return (
    <section className="card rn" aria-labelledby="rn-h">
      <div className="slbl" id="rn-h">🔁 {now ? 'Rotina agora' : 'Próxima rotina'} {countToday > 0 && <span className="mono" style={{ color: 'var(--faint)' }}>{countToday} hoje</span>}<button className="lnk" onClick={onOpen}>Ver →</button></div>
      {!r ? (countToday > 0
        ? <div className="row-s">Nenhuma outra rotina com horário hoje.</div>
        : <div className="row-s">Nenhuma rotina com passos para hoje. <button className="lnk-inline" onClick={onSetup}>Escolher rotinas</button></div>)
        : <>
          <div className="rn-h"><b>{r.title}</b>{r.essential && <span className="chip coral">essencial</span>}</div>
          <div className="rn-m">{hhmm(r.scheduled_time)}{r.duration_min ? ` · ${r.duration_min} min` : ''} · {who(r)} · {daysLabel(r.weekdays || [0, 1, 2, 3, 4, 5, 6]).toLowerCase()}</div>
          {r.routine_steps.length > 0 && <ol className="rn-steps">
            {r.routine_steps.slice(0, 4).map(s => <li key={s.id}>{s.title}</li>)}
            {r.routine_steps.length > 4 && <li className="rn-more">e mais {r.routine_steps.length - 4}</li>}
          </ol>}
          {now && next && next.id !== now.id && <div className="rn-next">Depois: {next.title} · {hhmm(next.scheduled_time)}</div>}
        </>}
    </section>
  )
}
