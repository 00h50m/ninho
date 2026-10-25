'use client'
// Casa › 💡 Sugestões: o que costuma faltar para manter a casa organizada e limpa, e os cuidados
// com os pets. "+ Adicionar" cria alternando entre vocês (dá para ajustar depois); ✎ abre antes de criar.
import { useState } from 'react'
import { FREQ_LABEL, suggestionView, type Sug } from '@/lib/sugestoes'

export function SuggestionsView({ taskTitles, petTitles, hasDogs, onAdd, onCustomize }: {
  taskTitles: string[], petTitles: string[], hasDogs: boolean
  onAdd: (s: Sug) => Promise<void>, onCustomize: (s: Sug) => void
}) {
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [area, setArea] = useState<string>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const view = suggestionView(taskTitles, petTitles, onlyMissing).filter(a => hasDogs || a.key !== 'pets')
  const missing = view.reduce((n, a) => n + a.missing, 0)
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
      {shown.map(a => (a.shown.length > 0 || !onlyMissing) && <section key={a.key} className="card sg-area" aria-labelledby={`sg-${a.key}`}>
        <div className="slbl" id={`sg-${a.key}`}>{a.icon} {a.label} <span className="mono" style={{ color: 'var(--faint)' }}>{a.total - a.missing}/{a.total}</span></div>
        {a.key === 'pets' && <p className="row-s sg-note">Entram como rotina dos cães (aba Cães), uma para cada cão, alternando entre vocês. Vacina, vermífugo e antipulgas ficam em Cães › Saúde.</p>}
        {a.shown.length === 0 && <p className="row-s">Tudo daqui vocês já têm. 🎉</p>}
        <ul className="sg-list">{a.shown.map(({ s, has }) => <li key={s.t} className={`sg-i ${has ? 'has' : ''}`}>
          <div className="sg-t"><b>{s.t}</b><small>{FREQ_LABEL[s.f]} · {s.why}</small></div>
          {has ? <span className="sg-has">✓ já tem</span> : <div className="sg-acts">
            <button className="btn btn-s" disabled={busy === s.t} onClick={() => add(s)} aria-label={`Adicionar ${s.t}`}>{busy === s.t ? '…' : '+ Adicionar'}</button>
            {s.kind !== 'pet' && <button className="ib" onClick={() => onCustomize(s)} aria-label={`Ajustar ${s.t} antes de adicionar`} title="Ajustar antes (dias, quem faz)">✎</button>}
          </div>}
        </li>)}</ul>
      </section>)}
      <p className="row-s" style={{ textAlign: 'center' }}>Tudo entra alternando entre vocês. Depois dá para mudar dias e quem faz na própria tarefa.</p>
    </div>
  )
}
