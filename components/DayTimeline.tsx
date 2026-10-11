'use client'
// Linha do tempo do dia (Início › Para agora › "Linha do tempo"): o dia de uma
// pessoa em ordem de horário, por período, com o "▷ agora" e a linha da hora atual.
import type { HItem } from '@/lib/types'
import type { Dose } from '@/lib/meudia'
import type { Timeline, TlEntry } from '@/lib/timeline'

const IC: Record<TlEntry['kind'], string> = { tarefa: '✓', caes: '🐾', rotina: '🔁', agenda: '📅', remedio: '💊' }
const KIND: Record<TlEntry['kind'], string> = { tarefa: 'tarefa', caes: 'cães', rotina: 'rotina', agenda: 'agenda', remedio: 'remédio' }

export function DayTimeline(p: {
  tl: Timeline, nowHM: string, busy: (e: TlEntry) => boolean
  onItem: (i: HItem) => void, onDose: (d: Dose) => void, onRoutine: () => void, onAgenda: () => void
}) {
  const act = (e: TlEntry) => e.item ? p.onItem(e.item) : e.dose ? p.onDose(e.dose) : e.routine ? p.onRoutine() : p.onAgenda()
  const row = (e: TlEntry) => {
    const now = e.key === p.tl.nowKey
    const checkable = !!e.item || !!e.dose
    const state = e.done ? 'feito' : e.late ? 'atrasado' : now ? 'agora' : ''
    return <li key={e.key} className={`tl-e k-${e.kind} ${e.done ? 'done' : ''} ${e.late ? 'late' : ''} ${now ? 'now' : ''}`} aria-current={now ? 'step' : undefined}>
      <span className="tl-t mono">{e.time || '—'}</span>
      {checkable
        ? <button className={`chk tl-chk ${e.done ? 'ok' : ''} ${e.essential ? 'ess' : ''} ${p.busy(e) ? 'busy' : ''}`} disabled={p.busy(e)} aria-busy={p.busy(e)} onClick={() => act(e)}
            aria-label={`${e.done ? 'Desmarcar' : 'Concluir'} ${e.title}`}>{e.kind === 'tarefa' ? '✓' : IC[e.kind]}</button>
        : <span className="tl-ic" aria-hidden="true">{IC[e.kind]}</span>}
      <button className="tl-b" onClick={() => act(e)}>
        <span className="tl-tt">{now && <span className="tl-now-tag">▷ agora</span>}{e.title}</span>
        <span className="tl-s">{KIND[e.kind]}{e.time && e.end && e.kind !== 'tarefa' && e.kind !== 'caes' && e.kind !== 'remedio' ? ` · até ${e.end}` : ''}{e.sub ? ` · ${e.sub}` : ''}{state && state !== 'agora' ? ` · ${state}` : ''}</span>
      </button>
    </li>
  }
  const nowLine = <li key="__now" className="tl-line" aria-hidden="true"><span className="mono">{p.nowHM}</span><span className="tl-line-b"/></li>
  if (!p.tl.periods.length && !p.tl.loose.length) return <div className="alldone">🌤️ Nada no dia ainda<small>Tarefas, rotinas e compromissos com horário aparecem aqui</small></div>
  return <div className="tl" aria-label="Linha do tempo do dia">
    <p className="sr-only">{p.tl.done} de {p.tl.total} feitos. Agora são {p.nowHM}.</p>
    {p.tl.periods.map(per => <section key={per.k} className="tl-per">
      <h3 className="cdiv">{per.label}<span className="n">{per.entries.length}</span></h3>
      <ol className="tl-list">
        {per.entries.flatMap((e, i) => p.tl.nowAt?.period === per.k && p.tl.nowAt.index === i ? [nowLine, row(e)] : [row(e)])}
        {p.tl.nowAt?.period === per.k && p.tl.nowAt.index === per.entries.length && nowLine}
      </ol>
    </section>)}
    {p.tl.loose.length > 0 && <section className="tl-per">
      <h3 className="cdiv">Quando der<span className="n">{p.tl.loose.length}</span></h3>
      <ol className="tl-list">{p.tl.loose.map(row)}</ol>
    </section>}
  </div>
}
