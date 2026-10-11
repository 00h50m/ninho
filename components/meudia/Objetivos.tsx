'use client'
// Objetivos do Meu dia: meta, prazo e progresso ("perder 12 kg até 24/12").
// Peso, treinos e água se atualizam sozinhos; "outro" tem o "Somar progresso".
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { fmtDate } from '@/lib/dates'
import { bodySeries } from '@/lib/meudia'
import { GOAL_KINDS, goalLine, goalProgress, type GoalKind, type PGoal } from '@/lib/goals'
import type { MeuDiaProps } from './MeuDia'

const N = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
const full = (d: string) => `${fmtDate(d)}/${d.slice(2, 4)}`

export function GoalsCard(p: MeuDiaProps & { waterGoal: number }) {
  const [edit, setEdit] = useState<PGoal | 'new' | null>(null)
  if (p.goalsReady === false) return null
  const mine = p.goals.filter(g => g.who === p.me && g.status !== 'arquivado')
  return (
    <section className="card md-card md-wide" aria-labelledby="md-obj">
      <div className="slbl" id="md-obj">🎯 Objetivos <button className="lnk" onClick={() => setEdit('new')}>+ Novo</button></div>
      {mine.length === 0 ? <p className="row-s">Um objetivo com prazo ajuda a ver o caminho: "perder 12 kg até dezembro", "40 treinos até o fim do ano", "30 dias batendo a água".</p>
        : <div className="gl-list">{mine.map(g => <GoalRow key={g.id} {...p} g={g} onEdit={() => setEdit(g)}/>)}</div>}
      {edit && <GoalSheet {...p} goal={edit === 'new' ? null : edit} onClose={() => setEdit(null)}/>}
    </section>
  )
}

function GoalRow(p: MeuDiaProps & { g: PGoal, waterGoal: number, onEdit: () => void }) {
  const { g } = p
  const pr = goalProgress(g, p.logs, p.today, p.waterGoal)
  const [add, setAdd] = useState('')
  const k = GOAL_KINDS.find(x => x[0] === g.kind)!
  const chip = g.status === 'concluido' || pr.state === 'feito' ? ['green', 'Concluído 🎉'] : pr.state === 'atras' ? ['amber', 'Um pouco atrás do ritmo'] : pr.state === 'sem_dado' ? ['', 'Registre o peso'] : ['', 'Em andamento']
  return (
    <div className="gl">
      <div className="gl-h"><span className="gl-ic" aria-hidden="true">{k[1]}</span><b>{g.title}</b><span className={`chip ${chip[0]}`}>{chip[1]}</span>
        <button className="lnk-inline" onClick={p.onEdit} aria-label={`Editar objetivo ${g.title}`}>editar</button></div>
      <div className="gl-meta">{goalLine(g, pr)}{g.due_date ? ` até ${full(g.due_date)}` : ''}</div>
      <div className="gl-bar" role="progressbar" aria-valuenow={pr.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${g.title}`}><div style={{ width: `${pr.pct}%` }}/></div>
      <div className="gl-sub"><b className="mono">{pr.pct}%</b> · {N(pr.done)} de {N(pr.total)} {pr.unit}{pr.left > 0 ? ` · faltam ${N(pr.left)}` : ''}</div>
      <dl className="sl-stats gl-tiles">
        {g.kind === 'peso' && pr.current != null && <div><dt>Peso agora</dt><dd><b className="mono">{N(pr.current)} kg</b></dd></div>}
        {pr.daysLeft != null && <div><dt>Prazo</dt><dd><b className="mono">{pr.daysLeft >= 0 ? `${pr.daysLeft} dias` : 'passou'}</b><small>{pr.daysLeft >= 0 ? 'restantes' : `era ${full(g.due_date!)}`}</small></dd></div>}
        {pr.perWeek != null && <div><dt>Ritmo necessário</dt><dd><b className="mono">{N(pr.perWeek)}</b><small>{pr.unit} por semana</small></dd></div>}
        {pr.expectedPct != null && pr.expectedPct > 0 && pr.state !== 'feito' && <div><dt>Pelo prazo, hoje</dt><dd><b className="mono">{pr.expectedPct}%</b><small>esperado</small></dd></div>}
      </dl>
      {g.kind === 'manual' && pr.state !== 'feito' && <div className="tk-add">
        <input className="fi" inputMode="decimal" value={add} placeholder={`Somar progresso${g.unit ? ` (${g.unit})` : ''}`} aria-label={`Somar progresso em ${g.title}`} onChange={e => setAdd(e.target.value)}/>
        <button className="btn btn-s" disabled={!(Number(add.replace(',', '.')) > 0)} onClick={() => p.onAdd('objetivo', Number(add.replace(',', '.')), { goal_id: g.id }).then(() => setAdd('')).catch(() => {})}>+ Somar</button>
      </div>}
      {pr.state === 'feito' && g.status === 'ativo' && <button className="btn btn-s" onClick={() => p.onGoalStatus(g, 'concluido').catch(() => {})}>Marcar como concluído</button>}
    </div>
  )
}

function GoalSheet(p: MeuDiaProps & { goal: PGoal | null, onClose: () => void }) {
  const g = p.goal
  const ws = bodySeries(p.logs, p.me, 'weight'), w = ws.length ? ws[ws.length - 1].v : null
  const [kind, setKind] = useState<GoalKind>(g?.kind || 'peso')
  const [title, setTitle] = useState(g?.title || '')
  const [target, setTarget] = useState(g ? N(g.target) : ''), [unit, setUnit] = useState(g?.unit || '')
  const [start, setStart] = useState(g?.start_value != null ? N(g.start_value) : w != null ? N(w) : '')
  const [due, setDue] = useState(g?.due_date || ''), [busy, setBusy] = useState(false)
  const num = (v: string) => Number(v.replace(',', '.'))
  const defTitle: Record<GoalKind, string> = { peso: 'Chegar ao meu peso', treinos: 'Treinar com constância', agua: 'Beber água todo dia', manual: '' }
  const ok = num(target) > 0 && (kind !== 'peso' || num(start) > 0) && (title.trim() || defTitle[kind]) && (!due || due >= (g?.start_date || p.today))
  async function save() {
    setBusy(true)
    try {
      await p.onSaveGoal({ id: g?.id, title: title.trim() || defTitle[kind], kind, unit: kind === 'manual' ? unit : null, start_value: kind === 'peso' ? num(start) : null, target: num(target), start_date: g?.start_date || p.today, due_date: due || null })
      p.onClose()
    } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  return (
    <Sheet title={g ? 'Editar objetivo' : 'Novo objetivo'} onClose={p.onClose} footer={<div className="md-acts" style={{ marginTop: 0 }}>
      <button className="btn btn-p" disabled={!ok || busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</button>
      {g && <button className="btn btn-g" onClick={() => { if (confirm('Arquivar este objetivo? O histórico fica.')) p.onGoalStatus(g, 'arquivado').then(p.onClose).catch(() => {}) }}>Arquivar</button>}
    </div>}>
      {!g && <div className="al-opts" role="radiogroup" aria-label="Tipo de objetivo">
        {GOAL_KINDS.map(([k, ic, l, d]) => <button key={k} role="radio" aria-checked={kind === k} className={`opt ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}><span className="opt-t">{ic} {l}</span><span className="opt-s">{d}</span></button>)}
      </div>}
      <label className="onb-f" style={{ marginTop: 10 }}><span>Nome</span><input className="fi" value={title} maxLength={80} placeholder={defTitle[kind] || 'Ex.: ler 12 livros'} onChange={e => setTitle(e.target.value)}/></label>
      <div className="onb-row">
        {kind === 'peso' && <label className="onb-f"><span>Peso no começo (kg)</span><input className="fi" inputMode="decimal" value={start} onChange={e => setStart(e.target.value)}/></label>}
        <label className="onb-f"><span>{kind === 'peso' ? 'Peso desejado (kg)' : kind === 'treinos' ? 'Quantos treinos' : kind === 'agua' ? 'Quantos dias' : 'Meta (número)'}</span><input className="fi" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)}/></label>
        {kind === 'manual' && <label className="onb-f"><span>Unidade</span><input className="fi" value={unit} maxLength={20} placeholder="livros, km, R$…" onChange={e => setUnit(e.target.value)}/></label>}
        <label className="onb-f"><span>Prazo (opcional)</span><input className="fi" type="date" value={due} min={g?.start_date || p.today} onChange={e => setDue(e.target.value)}/></label>
      </div>
      {kind === 'peso' && <p className="row-s">O progresso usa os pesos que você registra na Evolução (ou que vêm da bioimpedância).</p>}
    </Sheet>
  )
}
