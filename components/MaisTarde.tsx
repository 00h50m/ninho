'use client'
// No menu ⋯ da tarefa: "⏰ Mais tarde" (outro horário só hoje) e o horário de costume
// (🕰 "costuma às 08:10", com "Fixar esse horário"). Ver lib/maisTarde.ts e lib/horario.ts.
import { useEffect, useState } from 'react'
import type { Task, Who } from '@/lib/types'
import { laterOptions } from '@/lib/maisTarde'
import { usualTime } from '@/lib/horario'
import * as api from '@/lib/services/ninho'

export function LaterButtons({ t, nowHM, onLater, onUndo }: { t: Task, nowHM: string, onLater: (at: string) => void, onUndo: () => void }) {
  const [open, setOpen] = useState(false)
  if (t.completed_today) return null
  if (t.later) return <button className="btn btn-g" onClick={onUndo}>↩ Voltar {t.later.orig ? `para as ${t.later.orig}` : 'para sem horário'}<small className="menu-s">hoje está para as {t.later.at}</small></button>
  const opts = laterOptions(nowHM)
  if (!opts.length) return null
  if (!open) return <button className="btn btn-g" onClick={() => setOpen(true)} aria-expanded="false">⏰ Mais tarde<small className="menu-s">continua na lista, com outro horário só hoje</small></button>
  return (
    <div className="later-opts" role="group" aria-label="Mais tarde: escolha o horário de hoje">
      {opts.map(o => <button key={o.at} className="fc" onClick={() => onLater(o.at)}>⏰ {o.label}</button>)}
    </div>
  )
}

/** "🕰 Você costuma fazer por volta das 08:10" e o botão para fixar (só tarefas sem horário de sempre). */
export function UsualHint({ t, householdId, today, who, onFix }: { t: Task, householdId: string, today: string, who: Who | null, onFix: (at: string) => void }) {
  const fixedTime = t.later ? t.later.orig : t.scheduled_time
  const [usual, setUsual] = useState<string | null>(null)
  useEffect(() => {
    if (fixedTime || !who) return
    let on = true
    api.completionStamps(householdId, t.id, today).then(st => { if (on) setUsual(usualTime(st, who)) }).catch(() => {})
    return () => { on = false }
  }, [t.id, fixedTime, who, householdId, today])
  if (fixedTime || !usual) return null
  return (
    <div className="why usual" role="note">
      <span>🕰 Você costuma fazer por volta das <b>{usual}</b>. O Ninho já lembra nesse horário.</span>
      <button className="lnk-inline" onClick={() => onFix(usual)}>Fixar às {usual}</button>
    </div>
  )
}
