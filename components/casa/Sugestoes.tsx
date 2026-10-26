'use client'
// Casa › 💡 Sugestões: o que costuma faltar para manter a casa organizada e limpa, e os cuidados
// com os pets. "+ Adicionar" cria alternando entre vocês (dá para ajustar depois); ✎ abre antes de criar.
import { useState } from 'react'
import { FREQ_LABEL, norm, suggestionView, type Sug } from '@/lib/sugestoes'

export interface ArchivedTask { id: string, title: string, frequency: string, assigned_to: string | null, weekdays?: number[] | null }
const FREQ_ANY: Record<string, string> = { daily: 'todo dia', weekly: 'toda semana', biweekly: 'a cada 15 dias', monthly: 'todo mês', once: 'uma vez' }
const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function SuggestionsView({ taskTitles, petTitles, hasDogs, archived = [], names, onAdd, onCustomize, onRestore }: {
  taskTitles: string[], petTitles: string[], hasDogs: boolean
  /** tarefas que vocês já tiveram (arquivadas): voltam como eram */
  archived?: ArchivedTask[], names?: Record<'g' | 's', string>
  onAdd: (s: Sug) => Promise<void>, onCustomize: (s: Sug) => void, onRestore?: (t: ArchivedTask) => Promise<void>
}) {
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [area, setArea] = useState<string>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const view = suggestionView(taskTitles, petTitles, onlyMissing).filter(a => hasDogs || a.key !== 'pets')
  const missing = view.reduce((n, a) => n + a.missing, 0)
  // arquivadas que não têm uma ativa com o mesmo nome; a do catálogo com o mesmo nome volta "como era"
  const active = new Set(taskTitles.map(norm))
  const old = archived.filter(t => !active.has(norm(t.title)))
  const oldOf = (s: Sug) => s.kind === 'pet' ? null : old.find(t => norm(t.title) === norm(s.t)) || null
  const inCatalog = new Set(view.flatMap(a => a.items.map(s => norm(s.t))))
  const onlyOld = old.filter(t => !inCatalog.has(norm(t.title)))
  const who = (w: string | null) => w === 'g' || w === 's' ? (names?.[w] || '').split(' ')[0] || w : 'alternando'
  const desc = (t: ArchivedTask) => [FREQ_ANY[t.frequency] || t.frequency, t.weekdays?.length ? t.weekdays.map(d => DOW[d]).join(', ') : '', who(t.assigned_to)].filter(Boolean).join(' · ')
  async function restore(t: ArchivedTask) { setBusy(t.id); try { await onRestore?.(t) } catch { /* aviso já mostrado */ } finally { setBusy(null) } }
  const shown = area === 'all' ? view : view.filter(a => a.key === area)
  async function add(s: Sug) {
    setBusy(s.t)
    try { await onAdd(s) } catch { /* aviso já mostrado */ } finally { setBusy(null) }
  }
  return (
    <div className="narrow sg">
      <div className="sh"><div><h2>Sugestões</h2><p>Ideias para manter a casa organizada e limpa{hasDogs ? ' e os cães bem cuidados' : ''} · {missing} que vocês ainda não têm</p></div></div>
      <div className="fchips sg-areas" role="tablist" aria-label="Área">
        <button role="tab" aria-selected={area === 'all'} className={`fc ${area === 'all' ? 'on' : ''}`} onClick={() => setArea('all')}>Todas</button>
        {view.map(a => <button key={a.key} role="tab" aria-selected={area === a.key} className={`fc ${area === a.key ? 'on' : ''}`} onClick={() => setArea(a.key)}>{a.icon} {a.label}{a.missing ? ` · ${a.missing}` : ''}</button>)}
      </div>
      <label className="rt-toggle sg-only"><input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)}/><span><b>Só o que falta</b><small>Esconde o que vocês já têm (pelo nome)</small></span></label>
      {onlyOld.length > 0 && area === 'all' && <section className="card sg-area" aria-labelledby="sg-old">
        <div className="slbl" id="sg-old">📦 Vocês já tiveram <span className="mono" style={{ color: 'var(--faint)' }}>{onlyOld.length}</span></div>
        <p className="row-s sg-note">Saíram da rotina, mas voltam como eram (dias e quem faz).</p>
        <ul className="sg-list">{onlyOld.map(t => <li key={t.id} className="sg-i">
          <div className="sg-t"><b>{t.title}</b><small>{desc(t)}</small></div>
          <div className="sg-acts"><button className="btn btn-s" disabled={busy === t.id} onClick={() => restore(t)} aria-label={`Trazer de volta ${t.title}`}>{busy === t.id ? '…' : '↩ Trazer de volta'}</button></div>
        </li>)}</ul>
      </section>}
      {shown.map(a => (a.shown.length > 0 || !onlyMissing) && <section key={a.key} className="card sg-area" aria-labelledby={`sg-${a.key}`}>
        <div className="slbl" id={`sg-${a.key}`}>{a.icon} {a.label} <span className="mono" style={{ color: 'var(--faint)' }}>{a.total - a.missing}/{a.total}</span></div>
        {a.key === 'pets' && <p className="row-s sg-note">Entram como rotina dos cães (aba Cães), uma para cada cão, alternando entre vocês. Vacina, vermífugo e antipulgas ficam em Cães › Saúde.</p>}
        {a.shown.length === 0 && <p className="row-s">Tudo daqui vocês já têm. 🎉</p>}
        <ul className="sg-list">{a.shown.map(({ s, has }) => <li key={s.t} className={`sg-i ${has ? 'has' : ''}`}>
          <div className="sg-t"><b>{s.t}</b><small>{FREQ_LABEL[s.f]} · {s.why}</small></div>
          {has ? <span className="sg-has">✓ já tem</span> : oldOf(s) ? <div className="sg-acts">
            <button className="btn btn-s" disabled={busy === oldOf(s)!.id} onClick={() => restore(oldOf(s)!)} aria-label={`Trazer de volta ${s.t}`} title={`Como era: ${desc(oldOf(s)!)}`}>{busy === oldOf(s)!.id ? '…' : '↩ Trazer de volta'}</button>
          </div> : <div className="sg-acts">
            <button className="btn btn-s" disabled={busy === s.t} onClick={() => add(s)} aria-label={`Adicionar ${s.t}`}>{busy === s.t ? '…' : '+ Adicionar'}</button>
            {s.kind !== 'pet' && <button className="ib" onClick={() => onCustomize(s)} aria-label={`Ajustar ${s.t} antes de adicionar`} title="Ajustar antes (dias, quem faz)">✎</button>}
          </div>}
        </li>)}</ul>
      </section>)}
      <p className="row-s" style={{ textAlign: 'center' }}>Tudo entra alternando entre vocês. Depois dá para mudar dias e quem faz na própria tarefa.</p>
    </div>
  )
}
