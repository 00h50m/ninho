'use client'
// Nós › Histórico: resumo do mês do casal, com mês anterior/seguinte e "Compartilhar".
import { useEffect, useState } from 'react'
import type { Names } from '@/lib/types'
import { coupleMonth, coupleMonthText, shiftMonth, type CoupleMonth } from '@/lib/casalMes'
import { loadCoupleMonth } from '@/lib/services/nos'
import { logError } from '@/lib/errors'

const first = (n: string) => (n || '').split(' ')[0]

export function CoupleMonthCard({ householdId, today, names, onToast }: { householdId: string, today: string, names: Names, onToast: (m: string) => void }) {
  const cur = today.slice(0, 7)
  const [month, setMonth] = useState(cur)
  const [r, setR] = useState<CoupleMonth | null>(null), [err, setErr] = useState(false)
  useEffect(() => {
    let on = true
    setR(null); setErr(false)
    loadCoupleMonth(householdId, month, today).then(d => { if (on) setR(coupleMonth(d)) }).catch(e => { logError('resumo do mês', e); if (on) setErr(true) })
    return () => { on = false }
  }, [householdId, month, today])
  async function share() {
    if (!r) return
    const text = coupleMonthText(r, names)
    try {
      if (navigator.share) { await navigator.share({ text }); return }
      await navigator.clipboard.writeText(text); onToast('Resumo copiado')
    } catch { /* cancelou */ }
  }
  const g = first(names.g), s = first(names.s)
  const box = (n: number, l: string, sub?: string) => <div className="tg-b"><b>{n}</b><small>{l}</small>{sub && <small className="cm-sub">{sub}</small>}</div>
  return (
    <section className="card cm" aria-labelledby="cm-h">
      <div className="slbl" id="cm-h">🏡 Nosso mês</div>
      <div className="cm-nav">
        <button className="ib" aria-label="Mês anterior" onClick={() => setMonth(m => shiftMonth(m, -1))}>‹</button>
        <b className="cm-m">{r?.label || '…'}{month === cur ? ' (até hoje)' : ''}</b>
        <button className="ib" aria-label="Mês seguinte" disabled={month >= cur} onClick={() => setMonth(m => shiftMonth(m, 1))}>›</button>
      </div>
      {err ? <div className="inline-err">Não foi possível montar o resumo agora.</div>
        : !r ? <div className="row-s">Carregando…</div>
        : r.empty ? <div className="row-s">Nada registrado neste mês.</div>
        : <>
          <div className="tg-grid">
            {box(r.tasks.total, 'tarefas', `${g} ${r.tasks.g} · ${s} ${r.tasks.s}`)}
            {box(r.dogs.total, 'cuidados com os cães', `${g} ${r.dogs.g} · ${s} ${r.dogs.s}`)}
            {box(r.runs, 'rotinas')}
            {box(r.checkins.both, 'dias de check-in das duas')}
          </div>
          <ul className="cm-l">
            {r.sprints.n > 0 && <li>⏱ {r.sprints.n} sprint{r.sprints.n > 1 ? 's' : ''} · {r.sprints.done} tarefas no mutirão</li>}
            {r.meetings.n > 0 && <li>📋 {r.meetings.n} reunião(ões){r.meetings.agreements > 0 ? ` · ${r.meetings.kept} de ${r.meetings.agreements} combinados cumpridos` : ''}</li>}
            {r.challenges.length > 0 && <li>🤝 Desafios cumpridos: {r.challenges.join(', ')}</li>}
            {(r.checkins.mood.g || r.checkins.mood.s) && <li>💬 Humor mais comum: {r.checkins.mood.g ? `${g} ${r.checkins.mood.g.emoji} ${r.checkins.mood.g.label.toLowerCase()}` : ''}{r.checkins.mood.g && r.checkins.mood.s ? ' · ' : ''}{r.checkins.mood.s ? `${s} ${r.checkins.mood.s.emoji} ${r.checkins.mood.s.label.toLowerCase()}` : ''}</li>}
            {r.bestDay && <li>🌟 Dia mais produtivo: {r.bestDay.date.slice(8, 10)}/{r.bestDay.date.slice(5, 7)} ({r.bestDay.n} coisas feitas)</li>}
          </ul>
          <button className="btn btn-s" onClick={share}>Compartilhar resumo</button>
        </>}
    </section>
  )
}
