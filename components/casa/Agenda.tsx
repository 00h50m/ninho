'use client'
// Agenda da casa: compromissos domésticos e manutenções que vencem, mais os
// vencimentos simples (pago/pendente) com atalho para o Sobrou!. Sem módulo financeiro.
import { useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { Sheet } from '@/components/ui/Sheet'
import { fmtDate } from '@/lib/dates'
import { KINDS, agendaEntries, billLink, bills, groupByDay, kindIcon, kindLabel, type EventKind, type HouseEvent } from '@/lib/agenda'
import type { EventInput } from '@/lib/services/agenda'

const first = (n: string) => (n || '').split(' ')[0]

export function AgendaView({ available, events, maint, today, names, sobrouUrl, onNew, onEdit, onDone, onPaid, onOpenMaint, onSaveSobrou }: {
  available: boolean, events: HouseEvent[], maint: Array<{ id: string, title: string, next_due: string, category: string }>
  today: string, names: Names, sobrouUrl: string | null
  onNew: (kind: EventKind) => void, onEdit: (e: HouseEvent) => void, onDone: (e: HouseEvent, done: boolean) => void
  onPaid: (e: HouseEvent, paid: boolean) => void, onOpenMaint: () => void, onSaveSobrou: (url: string | null) => void
}) {
  const [editUrl, setEditUrl] = useState(false)
  const [url, setUrl] = useState(sobrouUrl || '')
  if (!available) return <div className="card empty"><span className="empty-icon">📅</span>A agenda da casa precisa da atualização do banco (migration 019).</div>
  const groups = groupByDay(agendaEntries(events, maint, today), today)
  const b = bills(events, today)
  const who = (w: HouseEvent['who']) => w === 'both' ? 'as duas' : w ? first(names[w as Who]) : null
  const urlOk = !url.trim() || /^https?:\/\//i.test(url.trim())
  return (
    <div className="narrow ag">
      <div className="sh"><div><h2>Agenda da casa</h2><p>Consultas, visitas, entregas, serviços e vencimentos</p></div>
        <div className="sh-a"><button className="btn btn-p" onClick={() => onNew('compromisso')}>+ Evento</button></div></div>

      <div className="slbl">Próximos 60 dias</div>
      {groups.length === 0 && <div className="card empty"><span className="empty-icon">📅</span>Nada marcado. Toque em “+ Evento”.</div>}
      {groups.map(g => (
        <div key={g.label} className="card ag-day">
          <div className={`ag-dl ${g.label === 'Atrasados' ? 'late' : g.label === 'Hoje' ? 'today' : ''}`}>{g.label}</div>
          {g.items.map(it => it.source === 'event' && it.event ? (
            <div key={it.key} className="ag-row">
              <button className="chk" aria-label={`Marcar ${it.title} como feito`} onClick={() => onDone(it.event!, true)}>✓</button>
              <button className="ag-b" onClick={() => onEdit(it.event!)}>
                <span className="ag-t">{it.icon} {it.title}</span>
                <span className="ag-m">{it.time || 'dia todo'} · {kindLabel(it.event.kind)}{who(it.event.who) ? ` · ${who(it.event.who)}` : ''}{it.late ? ` · era ${fmtDate(it.date)}` : ''}</span>
              </button>
            </div>
          ) : (
            <div key={it.key} className="ag-row">
              <span className="ag-ic" aria-hidden="true">{it.icon}</span>
              <button className="ag-b" onClick={onOpenMaint}>
                <span className="ag-t">{it.title}</span>
                <span className="ag-m">Manutenção{it.late ? ` · venceu ${fmtDate(it.date)}` : ''} · abrir em Manutenção</span>
              </button>
            </div>
          ))}
        </div>
      ))}

      <div className="slbl" style={{ marginTop: 18 }}>🧾 Vencimentos {b.overdue > 0 && <span className="chip coral">{b.overdue} atrasado{b.overdue > 1 ? 's' : ''}</span>}
        <button className="lnk" onClick={() => onNew('vencimento')}>+ Vencimento</button></div>
      <div className="card">
        <p className="row-s" style={{ marginBottom: 10 }}>Só para lembrar: nome, data, quem cuida e se já foi pago. Valores e contas ficam no Sobrou!.</p>
        {b.pending.length === 0 && <div className="row-s">Nenhum vencimento pendente.</div>}
        {b.pending.map(e => { const l = billLink(e, sobrouUrl); return (
          <div key={e.id} className={`ag-bill ${e.date < today ? 'late' : ''}`} data-bill={e.title}>
            <button className="ag-b" onClick={() => onEdit(e)}><span className="ag-t">{e.title}</span>
              <span className="ag-m">{e.date < today ? `venceu ${fmtDate(e.date)}` : e.date === today ? 'vence hoje' : `vence ${fmtDate(e.date)}`}{who(e.who) ? ` · ${who(e.who)}` : ''}</span></button>
            {l && <a className="btn btn-g" href={l} target="_blank" rel="noopener noreferrer">Abrir no Sobrou!</a>}
            <button className="btn btn-s" onClick={() => onPaid(e, true)}>✓ Pago</button>
          </div>) })}
        {b.paid.length > 0 && <details className="ag-paid"><summary>Pagos recentes ({b.paid.length})</summary>
          {b.paid.map(e => <div key={e.id} className="ag-bill paid"><span className="ag-b"><span className="ag-t">{e.title}</span><span className="ag-m">{fmtDate(e.date)} · pago</span></span>
            <button className="lnk-inline" onClick={() => onPaid(e, false)}>Voltar para pendente</button></div>)}
        </details>}
        <div className="ag-sobrou">
          {editUrl ? <>
            <input className="fi" type="url" value={url} placeholder="https://… (link do Sobrou!)" onChange={e => setUrl(e.target.value)} aria-label="Link do Sobrou!" aria-invalid={!urlOk}/>
            <button className="btn btn-p" disabled={!urlOk} onClick={() => { onSaveSobrou(url.trim() || null); setEditUrl(false) }}>Salvar</button>
          </> : <button className="lnk-inline" onClick={() => setEditUrl(true)}>{sobrouUrl ? 'Trocar o link do Sobrou!' : 'Configurar o link do Sobrou!'}</button>}
        </div>
      </div>
    </div>
  )
}

export function EventSheet({ event, kind, today, names, saving, onSave, onDelete, onReopen, onClose }: {
  event: HouseEvent | null, kind: EventKind, today: string, names: Names, saving: boolean
  onSave: (d: EventInput) => void, onDelete: (e: HouseEvent) => void, onReopen: (e: HouseEvent) => void, onClose: () => void
}) {
  const [d, setD] = useState<EventInput>(() => event ? { ...event } : { kind, title: '', date: today, time: null, who: null, notes: null, link: null, paid: kind === 'vencimento' ? false : null })
  const set = (p: Partial<EventInput>) => setD(x => ({ ...x, ...p }))
  const bill = d.kind === 'vencimento'
  const linkOk = !d.link?.trim() || /^https?:\/\//i.test(d.link.trim())
  const valid = d.title.trim() && d.date && linkOk
  return (
    <Sheet title={event ? (bill ? 'Editar vencimento' : 'Editar evento') : bill ? 'Novo vencimento' : 'Novo evento'} onClose={onClose} footer={<>
      {event && <button className="btn btn-danger" disabled={saving} onClick={() => onDelete(event)}>Apagar</button>}
      {event?.done_at && <button className="btn btn-g" onClick={() => onReopen(event)}>Reabrir</button>}
      <button className="btn btn-p" disabled={!valid || saving} onClick={() => onSave(d)}>{saving ? 'Salvando…' : 'Salvar'}</button>
    </>}>
      {!event && <><div className="onb-q">Tipo</div>
        <div className="onb-days wrap" role="radiogroup" aria-label="Tipo">{KINDS.map(([k, ic, l]) => <button key={k} role="radio" aria-checked={d.kind === k} className={`onb-day wide ${d.kind === k ? 'on' : ''}`} onClick={() => set({ kind: k, paid: k === 'vencimento' ? false : null })}>{ic} {l}</button>)}</div></>}
      <label className="onb-f" style={{ marginTop: 12 }}><span>{bill ? 'Nome (ex.: conta de luz)' : 'O quê'}</span><input className="fi" value={d.title} maxLength={80} autoFocus onChange={e => set({ title: e.target.value })} placeholder={bill ? 'Conta de luz' : 'Ex.: vacina da Zelda'}/></label>
      <div className="onb-row">
        <label className="onb-f"><span>{bill ? 'Vence em' : 'Data'}</span><input className="fi" type="date" value={d.date} onChange={e => set({ date: e.target.value })}/></label>
        {!bill && <label className="onb-f"><span>Horário</span><input className="fi" type="time" value={d.time || ''} onChange={e => set({ time: e.target.value || null })}/></label>}
      </div>
      <div className="onb-q">{bill ? 'Quem cuida' : 'Quem vai'}</div>
      <div className="onb-days wrap" role="radiogroup" aria-label="Quem">
        {([null, 'g', 's', 'both'] as const).map(w => <button key={String(w)} role="radio" aria-checked={d.who === w} className={`onb-day wide ${d.who === w ? 'on' : ''}`} onClick={() => set({ who: w })}>{w === null ? '—' : w === 'both' ? 'As duas' : first(names[w])}</button>)}
      </div>
      {bill && <label className="rt-toggle"><input type="checkbox" checked={!!d.paid} onChange={e => set({ paid: e.target.checked })}/><span><b>Já foi pago</b><small>Sem valores: as contas ficam no Sobrou!</small></span></label>}
      <label className="onb-f" style={{ marginTop: 8 }}><span>{bill ? 'Link (opcional; senão usa o do Sobrou!)' : 'Link (opcional)'}</span><input className="fi" type="url" value={d.link || ''} maxLength={500} placeholder="https://…" onChange={e => set({ link: e.target.value })} aria-invalid={!linkOk}/></label>
      {!linkOk && <div className="row-s" style={{ color: 'var(--cor-tx)' }}>O link precisa começar com https://</div>}
      <label className="onb-f"><span>Observação</span><input className="fi" value={d.notes || ''} maxLength={300} onChange={e => set({ notes: e.target.value })}/></label>
    </Sheet>
  )
}
export { kindIcon }
