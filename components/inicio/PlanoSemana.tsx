'use client'
// Plano da semana: a sugestão do Ninho (cada tarefa da semana num dia), para ajustar o dia de
// cada uma e aprovar com um toque. Aparece no Início no domingo (para a próxima semana) e de
// segunda a terça se ainda não houver plano; em Casa › Tarefas, sempre que houver o que planejar.
import { useMemo, useState } from 'react'
import type { Names, Task, Who } from '@/lib/types'
import { addDays, fmtDate } from '@/lib/dates'
import { scheduledOn } from '@/lib/frequency'
import { dowLabel, planWeek, proposePlan } from '@/lib/planoSemana'

const first = (n: string) => (n || '').split(' ')[0]
const KEY = 'ninho.plano.'

/** Mostrar o cartão no Início hoje? (domingo, segunda ou terça; sem plano aprovado; não dispensado) */
export function showPlanToday(today: string, approved: boolean): boolean {
  const dow = new Date(today + 'T12:00:00Z').getUTCDay()
  if (approved || ![0, 1, 2].includes(dow)) return false
  try { return localStorage.getItem(KEY + planWeek(today).start) !== 'x' } catch { return true }
}

export function WeekPlanCard({ tasks, events, today, names, ownerOf, onApprove, compact }: {
  tasks: Task[], events: Array<{ date: string, done_at?: string | null }>, today: string, names: Names,
  ownerOf: (t: Task) => Who, onApprove: (weekStart: string, items: Array<{ task_id: string, date: string }>) => Promise<boolean>, compact?: boolean,
}) {
  const w = planWeek(today)
  const base = useMemo(() => proposePlan(tasks, events.filter(e => !e.done_at), today, ownerOf), [tasks, events, today, ownerOf])
  const saved = useMemo(() => new Map(tasks.flatMap(t => (t.plans || []).filter(p => p.week_start === w.start).map(p => [t.id, p.date] as [string, string]))), [tasks, w.start])
  const [pick, setPick] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(!compact), [busy, setBusy] = useState(false), [hidden, setHidden] = useState(false)
  const approved = saved.size > 0
  if (hidden || (!base.length && !approved)) return null
  const days = Array.from({ length: 7 }, (_, i) => addDays(w.start, i)).filter(d => d >= w.from)
  const items = base.map(i => ({ ...i, date: pick[i.task.id] ?? saved.get(i.task.id) ?? i.date }))
  const label = w.start > today ? `Plano da semana de ${fmtDate(w.start)}` : 'Plano desta semana'

  if (compact && !open) return (
    <button className="btn btn-s plan-open" onClick={() => setOpen(true)}>🗓 {approved ? 'Plano da semana (aprovado)' : `Planejar a semana · ${base.length} tarefa${base.length > 1 ? 's' : ''}`}</button>
  )
  return (
    <section className="card plan" aria-labelledby="plan-h">
      <div className="slbl" id="plan-h">🗓 {label}{approved ? ' · aprovado' : ''}</div>
      <p className="row-s">{approved ? 'Cada tarefa sobe para "Hoje" no dia dela. Dá para trocar o dia e aprovar de novo.' : 'O Ninho pôs cada tarefa num dia com menos agenda e sem acumular as pesadas. Ajuste o que quiser e aprove.'}</p>
      <ul className="plan-l">
        {items.map(i => (
          <li key={i.task.id}>
            <span className="plan-t"><b>{i.task.title}</b><small>{first(names[i.who])}{i.task.weight === 'heavy' ? ' · pesada' : ''}</small></span>
            <select className="fi plan-d" value={i.date} aria-label={`Dia de ${i.task.title}`} onChange={e => setPick(p => ({ ...p, [i.task.id]: e.target.value }))}>
              {days.filter(d => scheduledOn(i.task, d)).map(d => <option key={d} value={d}>{dowLabel(d)} {fmtDate(d)}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <div className="md-acts">
        <button className="btn btn-p" disabled={busy || (approved && !Object.keys(pick).length)} onClick={async () => {
          setBusy(true)
          const ok = await onApprove(w.start, items.map(i => ({ task_id: i.task.id, date: i.date })))
          setBusy(false); if (ok) { setPick({}); if (compact) setOpen(false) }
        }}>{busy ? 'Salvando…' : approved ? '✓ Salvar mudanças' : '✓ Aprovar plano'}</button>
        {!approved && <button className="btn btn-g" onClick={() => { try { localStorage.setItem(KEY + w.start, 'x') } catch { /* ok */ } setHidden(true) }}>Agora não</button>}
        {compact && <button className="btn btn-g" onClick={() => setOpen(false)}>Fechar</button>}
      </div>
    </section>
  )
}
