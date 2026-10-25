'use client'
// Cães › Quem cuida: rodízio (alternam sozinhas) ou escala fixa (dona por dia e período).
// As duas da casa veem e editam; a mudança vale na hora para o Hoje, o Telegram e as notificações.
import { useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { DOWS, PERIODS, nextWho, periodOf, scheduleLoad, type DogMode, type DogPlan, type Period } from '@/lib/escala'

const first = (n: string) => (n || '').split(' ')[0]

export function DogScheduleCard({ ready, plan, names, routines, today, onMode, onCell }: {
  ready: boolean, plan: DogPlan, names: Names, today: string
  /** rotinas diárias (títulos e horários) para mostrar o que entra em cada período */
  routines: Array<{ title: string, scheduled_time: string | null }>
  onMode: (m: DogMode) => Promise<void>, onCell: (dow: number, period: Period, who: Who | null) => Promise<void>
}) {
  const [open, setOpen] = useState(plan.mode === 'escala')
  const [busy, setBusy] = useState<string | null>(null)
  if (!ready) return <section className="card ec" aria-labelledby="ec-t">
    <div className="slbl" id="ec-t">📅 Quem cuida dos cães</div>
    <p className="row-s">Hoje as rotinas dos cães alternam sozinhas entre vocês. Para usar uma escala fixa (dona por dia e período), falta rodar a atualização do banco (migration 037).</p>
  </section>
  const load = scheduleLoad(plan.cells)
  const cell = (dow: number, p: Period) => plan.cells.find(c => c.dow === dow && c.period === p)?.who ?? null
  const byPeriod = (p: Period) => Array.from(new Set(routines.filter(r => periodOf(r.scheduled_time) === p).map(r => r.title))).join(', ')
  const untimed = Array.from(new Set(routines.filter(r => !periodOf(r.scheduled_time)).map(r => r.title)))
  const todayDow = new Date(`${today}T12:00:00Z`).getUTCDay()
  async function mode(m: DogMode) {
    if (m === plan.mode) return
    setBusy('mode'); try { await onMode(m); if (m === 'escala') setOpen(true) } catch { /* aviso já mostrado */ } finally { setBusy(null) }
  }
  async function tap(dow: number, p: Period) {
    const k = `${dow}:${p}`; setBusy(k)
    try { await onCell(dow, p, nextWho(cell(dow, p))) } catch { /* aviso já mostrado */ } finally { setBusy(null) }
  }
  return (
    <section className="card ec" aria-labelledby="ec-t">
      <div className="slbl" id="ec-t">📅 Quem cuida dos cães</div>
      <div className="onb-days" role="radiogroup" aria-label="Como dividir as rotinas dos cães">
        <button role="radio" aria-checked={plan.mode === 'rodizio'} disabled={busy === 'mode'} className={`onb-day wide ${plan.mode === 'rodizio' ? 'on' : ''}`} onClick={() => mode('rodizio')}>↻ Alternada</button>
        <button role="radio" aria-checked={plan.mode === 'escala'} disabled={busy === 'mode'} className={`onb-day wide ${plan.mode === 'escala' ? 'on' : ''}`} onClick={() => mode('escala')}>📅 Escala fixa</button>
      </div>
      <p className="row-s ec-help">{plan.mode === 'rodizio'
        ? 'As rotinas alternam sozinhas entre vocês, equilibrando com o resto da semana. A escala abaixo fica guardada para quando quiserem usar.'
        : `Cada turno marcado é sempre da mesma pessoa. Turno em branco continua alternando. Na semana: ${first(names.g)} ${load.g} · ${first(names.s)} ${load.s}${load.free ? ` · ${load.free} alternando` : ''}.`}</p>
      <button className="lnk-inline" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Esconder a escala' : plan.cells.length ? 'Ver e editar a escala' : 'Montar a escala'}</button>
      {open && <>
        <table className="ec-grid">
          <caption className="sr-only">Escala dos cães: toque para trocar (alternando → {first(names.g)} → {first(names.s)})</caption>
          <thead><tr><th scope="col"><span className="sr-only">Dia</span></th>{PERIODS.map(([k, l, h]) => <th key={k} scope="col">{l}<small>{h}</small></th>)}</tr></thead>
          <tbody>{DOWS.map((d, dow) => <tr key={d} className={dow === todayDow ? 'ec-today' : ''}>
            <th scope="row">{d}</th>
            {PERIODS.map(([p, l]) => { const w = cell(dow, p); return <td key={p}>
              <button className={`ec-c ${w ? 'ec-' + w : ''}`} disabled={busy === `${dow}:${p}`} onClick={() => tap(dow, p)}
                aria-label={`${d}, ${l}: ${w ? first(names[w]) : 'alternando'}. Toque para trocar`}>{w ? first(names[w]) : '↻'}</button>
            </td> })}
          </tr>)}</tbody>
        </table>
        <ul className="ec-legend">
          {PERIODS.map(([p, l]) => <li key={p}><b>{l}:</b> {byPeriod(p) || 'nenhuma rotina com horário'}</li>)}
          {untimed.length > 0 && <li><b>Sem horário</b> (sempre alternando): {untimed.join(', ')}</li>}
        </ul>
        <p className="row-s">Toque no turno para trocar: ↻ alternando → {first(names.g)} → {first(names.s)}. Compromisso no horário avisa, mas não troca a dona da escala.</p>
      </>}
    </section>
  )
}
