'use client'
// Manutenção recorrente: lista (aba Tarefas › Manutenção), cartão em Hoje,
// formulário e modelos prontos.
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import type { Names, Who } from '@/lib/types'
import { toNinhoError, type NinhoError } from '@/lib/errors'
import { addDays, fmtDate } from '@/lib/dates'
import * as casa from '@/lib/services/casa'
import {
  MAINT_CATS, MAINT_CAT_LABEL, MAINT_TEMPLATES, MAINT_XP, dueLabel, everyLabel, nextDue, statusOf, upcoming,
  type MaintCat, type MaintenanceItem, type MaintenanceLog, type MaintTemplate,
} from '@/lib/maintenance'

const first = (n: string) => (n || '').split(' ')[0]

export interface MaintActions {
  busy: Set<string>
  complete: (it: MaintenanceItem) => Promise<void>
}

/** Concluir manutenção (com XP e Desfazer). Usado pela lista e pelo cartão em Hoje. */
export function useMaintActions(o: {
  today: string, me: Who | null, requireMe: () => Who | null
  setItems: (f: (l: MaintenanceItem[]) => MaintenanceItem[]) => void
  reload: () => Promise<void>, onXp: () => void
  toast: (m: string, undo?: () => void) => void, fail: (e: NinhoError, retry?: () => void) => void
}): MaintActions {
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const mark = (id: string, on: boolean) => setBusy(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })
  async function complete(it: MaintenanceItem) {
    const by = o.me ?? o.requireMe()
    if (!by || busy.has(it.id)) return
    mark(it.id, true)
    const optimistic = nextDue(o.today, it.every_months, it.every_days)
    o.setItems(l => l.map(x => x.id === it.id ? { ...x, last_done: o.today, next_due: optimistic } : x))
    try {
      const r = await casa.completeMaintenance(it.id, o.today, by)
      if (r.created) {
        o.toast(`+${r.xp} XP · ${it.title} · próxima ${fmtDate(r.next_due)}`, async () => {
          try { await casa.undoMaintenance(r.log_id); await o.reload(); o.onXp(); o.toast('Desfeito') }
          catch (e) { o.fail(toNinhoError(e, 'desfazer manutenção')) }
        })
      } else o.toast('Já estava registrada hoje')
      await o.reload()
      o.onXp()
    } catch (e) {
      o.setItems(l => l.map(x => x.id === it.id ? it : x))
      o.fail(toNinhoError(e, 'concluir manutenção'), () => complete(it))
    } finally { mark(it.id, false) }
  }
  return { busy, complete }
}

function MaintRow({ it, today, names, actions, onEdit, compact }: { it: MaintenanceItem, today: string, names: Names, actions: MaintActions, onEdit?: () => void, compact?: boolean }) {
  const st = statusOf(it, today)
  const busy = actions.busy.has(it.id)
  return (
    <div className={`tr mt-row st-${st.status}`}>
      <div className="trb" onClick={onEdit}>
        <div className="trt">{it.title}</div>
        <div className="trm">
          <span className={`mt-due ${st.status}`}>{dueLabel(it, today)}</span>
          {!compact && <span>{MAINT_CAT_LABEL[it.category]}</span>}
          {!compact && <span>{everyLabel(it)}</span>}
          {it.assigned_to && <span className="tag-by">{first(names[it.assigned_to])}</span>}
          {!compact && it.last_done && <span className="tag-by">última: {fmtDate(it.last_done)}</span>}
        </div>
      </div>
      <span className="xp xp-h" title={`Vale ${MAINT_XP} XP`}>+{MAINT_XP}</span>
      <button className={`btn btn-s mt-done ${busy ? 'busy' : ''}`} disabled={busy} onClick={() => actions.complete(it)} aria-label={`Marcar ${it.title} como feita`}>✓ Feita</button>
    </div>
  )
}

/** Cartão em Hoje: o que está atrasado ou vence nos próximos dias. */
export function MaintTodayCard({ items, today, names, actions, onOpen }: { items: MaintenanceItem[], today: string, names: Names, actions: MaintActions, onOpen: () => void }) {
  const list = upcoming(items, today, 3)
  if (!list.length) return null
  return (
    <div className="card">
      <div className="slbl">🔧 Manutenção <span className="mono" style={{ color: 'var(--faint)' }}>{list.length}</span><button className="lnk" onClick={onOpen}>Ver →</button></div>
      {list.slice(0, 4).map(it => <MaintRow key={it.id} it={it} today={today} names={names} actions={actions} compact/>)}
      {list.length > 4 && <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 6 }}>e mais {list.length - 4}</div>}
    </div>
  )
}

/** Lista completa (aba Tarefas › Manutenção). */
export function MaintenanceSection({ items, log, today, names, state, error, actions, onReload, onNew, onEdit, onTemplates }: {
  items: MaintenanceItem[], log: MaintenanceLog[], today: string, names: Names
  state: 'loading' | 'ready' | 'error', error: NinhoError | null, actions: MaintActions
  onReload: () => void, onNew: () => void, onEdit: (it: MaintenanceItem) => void, onTemplates: () => void
}) {
  if (state === 'error') return (
    <div className="card loaderr" role="alert">
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Não foi possível abrir as manutenções</div>
      <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 14 }}>{error?.userMessage}</div>
      <button className="btn btn-p" onClick={onReload}>Tentar novamente</button>
    </div>
  )
  const sorted = [...items].sort((a, b) => a.next_due.localeCompare(b.next_due))
  const late = sorted.filter(i => statusOf(i, today).status === 'late')
  const soon = sorted.filter(i => ['today', 'soon'].includes(statusOf(i, today).status))
  const later = sorted.filter(i => statusOf(i, today).status === 'ok')
  const recent = log.slice(0, 5)
  const titleOf = (id: string) => items.find(i => i.id === id)?.title || 'Manutenção removida'
  const group = (label: string, list: MaintenanceItem[], cls = '') => list.length > 0 && (
    <div>
      <div className={`cdiv ${cls}`}>{label}<span className="n">{list.length}</span></div>
      {list.map(it => <MaintRow key={it.id} it={it} today={today} names={names} actions={actions} onEdit={() => onEdit(it)}/>)}
    </div>
  )
  return (
    <>
      <div className="sh-a" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-s" onClick={onTemplates}>✦ Modelos prontos</button>
        <button className="btn btn-p" onClick={onNew}>+ Nova manutenção</button>
      </div>
      {state === 'loading' && !items.length ? <div className="loadscr" role="status"><span className="spin" aria-hidden="true"/>Carregando…</div>
      : !items.length ? <div className="card empty"><span className="empty-icon">🔧</span>Nenhuma manutenção ainda.<br/>Filtro do ar, vacina dos cães, revisão do carro…
          <div><button className="btn btn-p" onClick={onTemplates}>✦ Começar com modelos</button></div></div>
      : <div className="card">
          {group('⚠ Atrasadas', late, 'late')}
          {group('Esta semana', soon)}
          {group('Mais para frente', later)}
        </div>}
      {recent.length > 0 && <div className="card" style={{ marginTop: 12 }}>
        <div className="slbl">Feitas recentemente</div>
        {recent.map(l => <div key={l.id} className="row"><span className="row-t" style={{ minWidth: 0 }}>{titleOf(l.item_id)}</span>
          <span className="row-s" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmtDate(l.done_on)}{l.done_by ? ` · ${first(names[l.done_by])}` : ''}</span></div>)}
      </div>}
      <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 12, textAlign: 'center' }}>
        Ao marcar como feita, a próxima data é calculada sozinha (+{MAINT_XP} XP). Aparece em Hoje e no bom dia quando estiver perto.
      </div>
    </>
  )
}

/** Formulário de manutenção. */
export function MaintenanceForm({ item, today, names, saving, onClose, onSave, onDelete }: {
  item: MaintenanceItem | null, today: string, names: Names, saving: boolean
  onClose: () => void, onSave: (d: casa.MaintenanceInput, id?: string) => void, onDelete: (it: MaintenanceItem) => void
}) {
  const editing = !!item
  const [title, setTitle] = useState(item?.title || '')
  const [category, setCategory] = useState<MaintCat>(item?.category || 'casa')
  const [unit, setUnit] = useState<'months' | 'days'>(item?.every_days && !item?.every_months ? 'days' : 'months')
  const [n, setN] = useState(String(item?.every_months || item?.every_days || 3))
  const [last, setLast] = useState(item?.last_done || '')
  const [next, setNext] = useState(item?.next_due || '')
  const [assign, setAssign] = useState<Who | ''>(item?.assigned_to || '')
  const [notes, setNotes] = useState(item?.notes || '')
  const num = Math.max(1, Math.min(unit === 'months' ? 120 : 3650, Number(n) || 0))
  const months = unit === 'months' ? num : null, days = unit === 'days' ? num : null
  // Próxima: a escolhida, senão última + intervalo, senão hoje
  const computed = last ? nextDue(last, months, days) : today
  const due = next || computed
  const valid = title.trim().length > 0 && Number(n) > 0
  const handle = () => {
    if (!valid || saving) return
    onSave({ title: title.trim().slice(0, 80), category, every_months: months, every_days: days, last_done: last || null, next_due: due, assigned_to: assign || null, notes: notes.trim() || null }, item?.id)
  }
  return (
    <Sheet title={editing ? 'Editar manutenção' : 'Nova manutenção'} onClose={onClose} footer={<>
      {editing && <button className="btn btn-danger" disabled={saving} onClick={() => onDelete(item!)}>Remover</button>}
      <button className="btn btn-p" disabled={!valid || saving} onClick={handle}>{saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}</button>
    </>}>
      <label className="fl">Nome</label>
      <input className="fi" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Limpar filtro do ar-condicionado" maxLength={80} autoFocus/>
      <label className="fl">Categoria</label>
      <div className="btng c3">{MAINT_CATS.map(([k, v]) => <button key={k} className={`sbtn ${category === k ? 'on' : ''}`} onClick={() => setCategory(k)}>{v}</button>)}</div>
      <label className="fl">Repetir a cada</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="fi" type="number" inputMode="numeric" min={1} value={n} onChange={e => { setN(e.target.value); setNext('') }} style={{ maxWidth: 100 }} aria-label="Intervalo"/>
        <div className="btng c2" style={{ flex: 1 }}>
          <button className={`sbtn ${unit === 'months' ? 'on' : ''}`} onClick={() => { setUnit('months'); setNext('') }}>meses</button>
          <button className={`sbtn ${unit === 'days' ? 'on' : ''}`} onClick={() => { setUnit('days'); setNext('') }}>dias</button>
        </div>
      </div>
      <label className="fl">Última vez <span className="hint">(opcional)</span></label>
      <input className="fi" type="date" value={last} max={today} onChange={e => { setLast(e.target.value); setNext('') }} style={{ maxWidth: 200 }}/>
      <label className="fl">Próxima vez</label>
      <input className="fi" type="date" value={due} onChange={e => setNext(e.target.value)} style={{ maxWidth: 200 }}/>
      <div className="row-s" style={{ marginTop: 6 }}>{due < today ? 'Já está atrasada — vai aparecer em Hoje.' : due === today ? 'Vence hoje.' : `Vai aparecer em Hoje alguns dias antes (${fmtDate(due)}).`}</div>
      <label className="fl">Quem cuida</label>
      <div className="btng c3">
        <button className={`sbtn ${assign === 'g' ? 'on' : ''}`} onClick={() => setAssign('g')}>{first(names.g)}</button>
        <button className={`sbtn ${assign === 's' ? 'on' : ''}`} onClick={() => setAssign('s')}>{first(names.s)}</button>
        <button className={`sbtn ${!assign ? 'on' : ''}`} onClick={() => setAssign('')}>Qualquer uma</button>
      </div>
      <label className="fl">Observações <span className="hint">(opcional)</span></label>
      <input className="fi" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: telefone do técnico, marca do filtro" maxLength={300}/>
    </Sheet>
  )
}

const AGO: Array<[string, number | null]> = [['Não sei', null], ['Este mês', 0], ['Há 1 mês', 1], ['Há 3 meses', 3], ['Há 6 meses', 6], ['Há 1 ano', 12]]

/** Modelos prontos: escolha várias e diga, se souber, quando foi a última vez. */
export function MaintTemplatesSheet({ existing, today, saving, onClose, onAdd }: {
  existing: MaintenanceItem[], today: string, saving: boolean, onClose: () => void, onAdd: (rows: casa.MaintenanceInput[]) => void
}) {
  const have = new Set(existing.map(i => i.title.toLowerCase()))
  const [sel, setSel] = useState<Record<string, number | null | undefined>>({})
  const chosen = MAINT_TEMPLATES.filter(t => sel[t.title] !== undefined)
  const toggle = (t: MaintTemplate) => setSel(s => { const n = { ...s }; if (n[t.title] !== undefined) delete n[t.title]; else n[t.title] = null; return n })
  const build = (): casa.MaintenanceInput[] => chosen.map(t => {
    const ago = sel[t.title]
    let last: string | null = null
    if (ago !== null && ago !== undefined) last = ago === 0 ? today : nextDue(today, -ago, null)
    // Sem a última data: começa daqui a uma semana, para não chegar tudo de uma vez
    let due = last ? nextDue(last, t.every_months ?? null, t.every_days ?? null) : addDays(today, 7)
    if (due < today) due = today
    return { title: t.title, category: t.category, every_months: t.every_months ?? null, every_days: t.every_days ?? null, last_done: last, next_due: due, assigned_to: null, notes: null }
  })
  return (
    <Sheet size="lg" title="Modelos de manutenção" onClose={onClose} footer={
      <button className="btn btn-p" disabled={!chosen.length || saving} onClick={() => onAdd(build())}>{saving ? 'Salvando…' : `Adicionar ${chosen.length || ''}`}</button>
    }>
      {MAINT_CATS.filter(([k]) => MAINT_TEMPLATES.some(t => t.category === k)).map(([k, label]) => (
        <div key={k}>
          <div className="cdiv">{label}</div>
          {MAINT_TEMPLATES.filter(t => t.category === k).map(t => {
            const on = sel[t.title] !== undefined, dup = have.has(t.title.toLowerCase())
            return (
              <div key={t.title} className={`li ${on ? 'on' : ''} ${dup ? 'off' : ''}`} onClick={() => !dup && toggle(t)}>
                <span className="chk" style={on ? { background: 'var(--gdk)', borderColor: 'var(--gdk)', color: 'var(--on-green)' } : undefined}>✓</span>
                <span className="li-t">{t.title}<br/><small style={{ color: 'var(--sub)' }}>{dup ? 'já cadastrada' : everyLabel({ every_months: t.every_months ?? null, every_days: t.every_days ?? null })}</small></span>
                {on && <select className="fi mt-ago" value={String(sel[t.title])} onClick={e => e.stopPropagation()}
                  onChange={e => setSel(s => ({ ...s, [t.title]: e.target.value === 'null' ? null : Number(e.target.value) }))} aria-label={`Última vez: ${t.title}`}>
                  {AGO.map(([l, v]) => <option key={l} value={String(v)}>{v === null ? 'Última vez?' : l}</option>)}
                </select>}
              </div>
            )
          })}
        </div>
      ))}
      <div className="row-s" style={{ marginTop: 12 }}>Sem a data da última vez, a primeira fica para daqui a uma semana. Dá para ajustar depois tocando no nome.</div>
    </Sheet>
  )
}
