'use client'
// Minhas rotinas: o checklist de hoje (com quem marcou cada passo), as outras rotinas e o histórico curto.
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Names, Who } from '@/lib/types'
import { hhmm, fmtDate } from '@/lib/dates'
import { daysLabel } from '@/lib/onboarding'
import { routineHistory, routineOnDay, runProgress, stepsFor, type Routine, type Run } from '@/lib/rotinas'

const first = (n: string) => (n || '').split(' ')[0]

export function RoutinesView({ routines, runs, checklistOk, today, me, names, survival, turnOf, onStep, onFinish, onEdit, onNew, onTemplates, footer }: {
  routines: Routine[], runs: Run[], checklistOk: boolean, today: string, me: Who | null, names: Names, survival: boolean
  turnOf: (r: Routine) => Who
  onStep: (r: Routine, stepId: string, done: boolean) => void
  onFinish: (r: Routine, done: boolean) => void
  onEdit: (r: Routine) => void, onNew: () => void, onTemplates: () => void
  footer?: ReactNode
}) {
  const todays = routines.filter(r => routineOnDay(r, today))
  const others = routines.filter(r => !routineOnDay(r, today))
  const who = (r: Routine) => r.assign_mode === 'shared' ? 'As duas' : r.assign_mode === 'rotation' ? `Rodízio · hoje: ${first(names[turnOf(r)])}` : first(names[r.assign_mode as Who])
  return (
    <>
      <div className="rt-actions">
        <button className="btn btn-p" onClick={onNew} disabled={!checklistOk}>+ Nova rotina</button>
        <button className="btn btn-g" onClick={onTemplates} disabled={!checklistOk}>Modelos</button>
      </div>
      {!checklistOk && routines.length > 0 && <div className="banner low">ℹ️ <span>Para marcar os passos, falta atualizar o banco (migration 016).</span></div>}
      {survival && todays.length > 0 && <div className="banner surv">🛡 <span>Modo sobrevivência: cada rotina mostra só os passos essenciais (🛡).</span></div>}

      <div className="slbl rt-sec">Hoje <span className="mono" style={{ color: 'var(--faint)' }}>{todays.length}</span></div>
      {todays.length === 0 && <div className="card empty"><span className="empty-icon">🔁</span>Nenhuma rotina para hoje.</div>}
      <div className="rt-grid">
        {todays.map(r => {
          const run = runs.find(x => x.routine_id === r.id && x.date === today)
          const steps = stepsFor(r, survival)
          const pr = runProgress(r, run, survival)
          const byStep = new Map((run?.checks || []).map(c => [c.step_id, c.done_by]))
          const hist = routineHistory(r, runs, today)
          return (
            <section key={r.id} className={`rt-card rt-live ${pr.complete ? 'done' : ''}`} aria-labelledby={`rt-${r.id}`} data-routine={r.title}>
              <div className="rt-card-h">
                <div style={{ minWidth: 0 }}><b id={`rt-${r.id}`}>{r.title}</b>
                  <div className="rt-card-m">{r.scheduled_time ? hhmm(r.scheduled_time) : 'Qualquer hora'}{r.duration_min ? ` · ${r.duration_min} min` : ''} · {who(r)}</div></div>
                <div className="rt-card-a">
                  {r.essential && <span className="chip coral">essencial</span>}
                  <button className="rt-edit" onClick={() => onEdit(r)} aria-label={`Editar ${r.title}`} disabled={!checklistOk}>✎</button>
                </div>
              </div>
              <div className="rt-prog" aria-label={`${pr.done} de ${pr.total} passos`}>
                <span className="bar"><span className="barf" style={{ display: 'block', width: `${pr.total ? pr.done / pr.total * 100 : pr.complete ? 100 : 0}%`, background: 'var(--green)' }}/></span>
                <span className="mono">{pr.done}/{pr.total}{survival && steps.length < r.routine_steps.length ? ' 🛡' : ''}</span>
              </div>
              <ul className="rt-check">
                {steps.map(s => {
                  const by = byStep.get(s.id)
                  const on = byStep.has(s.id)
                  return (
                    <li key={s.id}>
                      <button className={`rt-step ${on ? 'on' : ''}`} role="checkbox" aria-checked={on} disabled={!checklistOk || !me} onClick={() => onStep(r, s.id, !on)}>
                        <span className="rt-box" aria-hidden="true">{on ? '✓' : ''}</span>
                        <span className="rt-step-t">{s.title}{s.survival && !survival && <span className="rt-sv" title="Continua no modo sobrevivência"> 🛡</span>}</span>
                        {on && by && <span className={`mini av-${by}`} title={`Feito por ${first(names[by])}`} aria-label={`feito por ${first(names[by])}`}>{names[by].slice(0, 1).toUpperCase()}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="rt-foot">
                {pr.complete
                  ? <><span className="rt-done">✓ Concluída{run?.completed_by ? ` por ${first(names[run.completed_by])}` : ''}</span><button className="lnk-inline" onClick={() => onFinish(r, false)} disabled={!checklistOk || !me}>Reabrir</button></>
                  : <button className="btn btn-s" onClick={() => onFinish(r, true)} disabled={!checklistOk || !me}>Concluir rotina</button>}
                <span className="rt-hist" aria-label="Últimos 7 dias">
                  {hist.map(h => <i key={h.date} className={h.state} title={`${fmtDate(h.date)}: ${h.state === 'done' ? 'concluída' : h.state === 'partial' ? 'em parte' : h.state === 'none' ? 'não feita' : 'não era dia'}`}/>)}
                </span>
              </div>
            </section>
          )
        })}
      </div>

      {others.length > 0 && <>
        <div className="slbl rt-sec">Outros dias e pausadas <span className="mono" style={{ color: 'var(--faint)' }}>{others.length}</span></div>
        <div className="card">
          {others.map(r => (
            <button key={r.id} className="row rt-other" onClick={() => onEdit(r)} disabled={!checklistOk}>
              <span className="rt-time mono">{hhmm(r.scheduled_time) || '—'}</span>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}><span className="row-t">{r.title}</span>
                <span className="row-s">{r.paused_until && r.paused_until >= today ? `⏸ Pausada até ${fmtDate(r.paused_until)}` : r.start_date && r.start_date > today ? `Começa em ${fmtDate(r.start_date)}` : daysLabel(r.weekdays || [0, 1, 2, 3, 4, 5, 6])} · {r.routine_steps.length} passos</span></span>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      </>}
      {footer}
    </>
  )
}
