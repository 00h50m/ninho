'use client'
// Faxinão: despejar tudo (escrevendo ou falando) → a IA organiza na ordem que
// rende mais e divide entre as duas → conferir → modo ao vivo, com o "agora"
// de cada uma, cronômetro e resumo. Modelos para repetir.
import { useEffect, useRef, useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { fallbackFax, faxSummary, faxTotals, fmtMin, nextFor, resetSteps, type FaxStep, type FaxWho, type Faxinao } from '@/lib/faxinao'
import * as api from '@/lib/services/faxinao'
import { useSpeech } from '@/hooks/useSpeech'

const first = (n: string) => (n || '').split(' ')[0]
const ROOMS: Array<[string, string]> = [['🛁', 'banheiro'], ['🍳', 'cozinha'], ['🛏️', 'quartos e roupa de cama'], ['🛋️', 'sala'], ['🧺', 'lavar roupa'], ['🌳', 'quintal'], ['🗑️', 'tirar o lixo'], ['🐶', 'banho e caminha das cachorras']]
const clock = (ms: number) => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}` }

export interface FaxProps {
  householdId: string, me: Who | null, names: Names, list: Faxinao[], available: boolean, ready: boolean
  reload: () => Promise<void>, setList: (f: (l: Faxinao[] | null | undefined) => Faxinao[] | null | undefined) => void
  onToast: (m: string) => void, onError: (e: unknown, ctx: string) => void
}

export function FaxinaoView(p: FaxProps) {
  const [openDraft, setOpenDraft] = useState<string | null>(null)
  if (!p.available) return <div className="card empty"><span className="empty-icon">🧹</span>O Faxinão precisa da atualização do banco (migration 030) no Supabase.</div>
  const live = p.list.find(f => f.status === 'andamento')
  if (live) return <LiveFax {...p} f={live}/>
  const drafts = p.list.filter(f => f.status === 'rascunho')
  const draft = drafts.find(d => d.id === openDraft) || drafts[0]
  if (draft && openDraft !== 'novo') return <DraftFax {...p} f={draft} others={drafts.length - 1} onNew={() => setOpenDraft('novo')}/>
  return <NewFax {...p} onCreated={id => setOpenDraft(id)}/>
}

function NewFax(p: FaxProps & { onCreated: (id: string) => void }) {
  const [text, setText] = useState(''), [who, setWho] = useState<FaxWho>('both'), [minutes, setMinutes] = useState<number | null>(null)
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null)
  const add = (t: string) => setText(x => x.trim() ? `${x.trim().replace(/[,;]$/, '')}, ${t}` : t)
  const sp = useSpeech(t => add(t.trim()))
  const models = p.list.filter(f => f.status === 'modelo')
  const done = p.list.filter(f => f.status === 'feito')
  async function create(plan: Parameters<typeof api.createFax>[2]) {
    const f = await api.createFax(p.householdId, p.me, plan)
    p.setList(l => [f, ...(l || [])]); p.onCreated(f.id)
  }
  async function organize() {
    setBusy(true); setErr(null)
    const r = await api.planWithAi(p.householdId, text, who, minutes)
    try { if (r.ok === true) await create(r.plan); else setErr(r.error) } catch (e) { p.onError(e, 'guardar faxinão') }
    setBusy(false)
  }
  return (
    <>
      <section className="card" aria-labelledby="fx-novo">
        <div className="slbl" id="fx-novo">🧹 Faxinão com IA</div>
        <p className="row-s" style={{ marginBottom: 8 }}>Despeje tudo o que precisa ser feito, do seu jeito. A IA organiza na ordem que rende mais (o que demora sozinho primeiro, de cima para baixo, chão por último) e divide entre vocês.</p>
        <div className="fx-in">
          <label className="onb-f" style={{ margin: 0 }}><span>O que precisa ser feito?</span>
            <textarea className="fi fx-text" rows={3} value={text} maxLength={2000} onChange={e => setText(e.target.value)} placeholder="banheiro, cozinha, trocar roupa de cama, lavar o quintal, tirar o lixo, aspirar a sala…"/></label>
          {sp.supported && <button className={`btn ${sp.on ? 'btn-p' : 'btn-g'} fx-mic`} onClick={sp.toggle} aria-pressed={sp.on}>{sp.on ? '⏺ Ouvindo… toque para parar' : '🎤 Falar'}</button>}
        </div>
        <div className="fx-chips" aria-label="Adicionar rápido">{ROOMS.map(([ic, t]) => <button key={t} className="fc" onClick={() => add(t)}>{ic} {t}</button>)}</div>
        <div className="onb-q">Quem participa</div>
        <div className="onb-days" role="radiogroup" aria-label="Quem participa">
          {([['both', 'As duas'], ['g', first(p.names.g)], ['s', first(p.names.s)]] as Array<[FaxWho, string]>).map(([k, l]) => <button key={k} role="radio" aria-checked={who === k} className={`onb-day wide ${who === k ? 'on' : ''}`} onClick={() => setWho(k)}>{l}</button>)}
        </div>
        <div className="onb-q">Tempo disponível</div>
        <div className="onb-days wrap" role="radiogroup" aria-label="Tempo disponível">
          {([[null, 'Sem limite'], [60, '1 h'], [120, '2 h'], [180, '3 h'], [240, '4 h']] as Array<[number | null, string]>).map(([k, l]) => <button key={l} role="radio" aria-checked={minutes === k} className={`onb-day wide ${minutes === k ? 'on' : ''}`} onClick={() => setMinutes(k)}>{l}</button>)}
        </div>
        <div className="md-acts">
          <button className="btn btn-p" disabled={busy || text.trim().length < 3} onClick={organize}>{busy ? 'Organizando…' : '✨ Organizar com IA'}</button>
        </div>
        {err && <div className="fx-err" role="alert"><p className="row-s al-warn">{err}</p>
          <button className="btn btn-g" onClick={() => { const f = fallbackFax(text, who); if (f) create(f).catch(e => p.onError(e, 'guardar faxinão')) }}>Usar na ordem que escrevi</button></div>}
      </section>
      {models.length > 0 && <section className="card" aria-labelledby="fx-mod">
        <div className="slbl" id="fx-mod">Modelos</div>
        {models.map(m => { const t = faxTotals(m.steps); return <div key={m.id} className="md-row"><span className="md-t"><b>{m.title}</b><small>{m.steps.length} passos · cerca de {fmtMin(t.total)}</small></span>
          <button className="btn btn-s" onClick={() => create({ title: m.title, steps: resetSteps(m.steps), tips: m.tips }).catch(e => p.onError(e, 'usar modelo'))}>▶ Usar</button>
          <button className="ib" aria-label={`Apagar modelo ${m.title}`} onClick={() => { if (confirm(`Apagar o modelo "${m.title}"?`)) api.deleteFax(m.id).then(p.reload).catch(e => p.onError(e, 'apagar modelo')) }}>✕</button></div> })}
      </section>}
      {done.length > 0 && <section className="card" aria-labelledby="fx-feitos">
        <div className="slbl" id="fx-feitos">Últimos faxinões</div>
        {done.map(f => { const s = faxSummary(f); return <div key={f.id} className="md-row"><span className="md-t"><b>✅ {f.title}</b>
          <small>{f.finished_at ? new Date(f.finished_at).toLocaleDateString('pt-BR') : ''}{s.minutes != null ? ` · ${fmtMin(s.minutes)}` : ''} · {first(p.names.g)} {s.g} · {first(p.names.s)} {s.s}{s.skipped ? ` · ${s.skipped} pulado(s)` : ''}</small></span>
          <button className="ib" aria-label={`Apagar ${f.title} do histórico`} onClick={() => { if (confirm(`Apagar "${f.title}" do histórico?`)) api.deleteFax(f.id).then(p.reload).then(() => p.onToast('Faxinão apagado')).catch(e => p.onError(e, 'apagar faxinão')) }}>✕</button></div> })}
        <div className="md-acts"><button className="btn btn-g" onClick={() => {
          const ids = p.list.filter(f => f.status === 'feito' || f.status === 'rascunho').map(f => f.id)
          if (confirm(`Zerar o Faxinão? Apaga ${ids.length} faxinão(ões) do histórico e os rascunhos. Os modelos ficam.`)) api.deleteFaxMany(ids).then(p.reload).then(() => p.onToast('Faxinão zerado · os modelos ficaram')).catch(e => p.onError(e, 'zerar faxinão'))
        }}>Zerar Faxinão</button></div>
      </section>}
    </>
  )
}

function DraftFax(p: FaxProps & { f: Faxinao, others: number, onNew: () => void }) {
  const [title, setTitle] = useState(p.f.title), [steps, setSteps] = useState<FaxStep[]>(p.f.steps), [newStep, setNewStep] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setTitle(p.f.title); setSteps(p.f.steps) }, [p.f.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const t = faxTotals(steps)
  const set = (i: number, patch: Partial<FaxStep>) => setSteps(l => l.map((x, j) => j === i ? { ...x, ...patch } : x))
  const move = (i: number, d: number) => setSteps(l => { const c = [...l], j = i + d; if (j < 0 || j >= c.length) return l; [c[i], c[j]] = [c[j], c[i]]; return c })
  async function start() {
    setBusy(true)
    try { await api.saveDraft(p.f.id, title, steps); await api.startFax(p.f.id); await p.reload(); p.onToast('Bora! Faxinão começou 🧹') } catch (e) { p.onError(e, 'começar faxinão') } finally { setBusy(false) }
  }
  async function asModel() {
    try { await api.saveDraft(p.f.id, title, steps); await api.createFax(p.householdId, p.me, { title, steps, tips: p.f.tips }, 'modelo'); await p.reload(); p.onToast('Guardado como modelo') } catch (e) { p.onError(e, 'guardar modelo') }
  }
  const whoBtn = (i: number, s: FaxStep) => <span className="fx-who" role="radiogroup" aria-label={`Quem faz: ${s.title}`}>
    {([['g', first(p.names.g).slice(0, 1)], ['s', first(p.names.s).slice(0, 1)], ['both', '2']] as Array<[FaxWho, string]>).map(([k, l]) =>
      <button key={k} role="radio" aria-checked={s.who === k} aria-label={k === 'both' ? 'As duas' : first(p.names[k as Who])} className={`fx-wb ${s.who === k ? 'on' : ''} ${k}`} onClick={() => set(i, { who: k })}>{l}</button>)}
  </span>
  return (
    <section className="card" aria-labelledby="fx-conf">
      <div className="slbl" id="fx-conf">🧹 Confira o faxinão {p.others > 0 && <span className="chip">+{p.others} rascunho(s)</span>}</div>
      <input className="fi fx-title" value={title} maxLength={80} aria-label="Nome do faxinão" onChange={e => setTitle(e.target.value)}/>
      <div className="fx-sum">Cerca de <b>{fmtMin(t.total)}</b> · {first(p.names.g)}: {fmtMin(t.g)} · {first(p.names.s)}: {fmtMin(t.s)} · {steps.length} passos</div>
      {p.f.tips.length > 0 && <ul className="fx-tips">{p.f.tips.map(x => <li key={x}>💡 {x}</li>)}</ul>}
      <ol className="fx-steps">{steps.map((s, i) => <li key={s.id} className={s.wait ? 'wait' : ''}>
        <span className="fx-n mono">{i + 1}</span>
        <span className="fx-main">
          <input className="fi fx-st" value={s.title} maxLength={90} aria-label={`Passo ${i + 1}`} onChange={e => set(i, { title: e.target.value })}/>
          <small>{s.room}{s.wait ? ' · ⏳ roda sozinho' : ''}{s.note ? ` · ${s.note}` : ''}</small>
        </span>
        <span className="fx-ctl">
          {whoBtn(i, s)}
          <input className="fi fx-min" inputMode="numeric" value={String(s.min)} aria-label={`Minutos: ${s.title}`} onChange={e => set(i, { min: Math.max(1, Math.min(240, Number(e.target.value.replace(/\D/g, '')) || 1)) })}/>
          <span className="fx-u" aria-hidden="true">min</span>
          <button className="ib" aria-label={`Subir ${s.title}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
          <button className="ib" aria-label={`Descer ${s.title}`} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button className="ib" aria-label={`Tirar ${s.title}`} onClick={() => setSteps(l => l.filter((_, j) => j !== i))}>✕</button>
        </span>
      </li>)}</ol>
      <div className="tk-add">
        <input className="fi" value={newStep} maxLength={90} placeholder="Adicionar passo" aria-label="Adicionar passo" onChange={e => setNewStep(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newStep.trim()) { setSteps(l => [...l, { id: `n${Date.now()}`, title: newStep.trim(), room: 'Casa toda', who: 'both', min: 10, wait: false, note: null }]); setNewStep('') } }}/>
        <button className="btn btn-g" disabled={!newStep.trim()} onClick={() => { setSteps(l => [...l, { id: `n${Date.now()}`, title: newStep.trim(), room: 'Casa toda', who: 'both', min: 10, wait: false, note: null }]); setNewStep('') }}>+</button>
      </div>
      <div className="md-acts">
        <button className="btn btn-p" disabled={busy || !steps.length} onClick={start}>{busy ? 'Começando…' : '▶ Começar agora'}</button>
        <button className="btn btn-g" onClick={asModel}>Salvar como modelo</button>
        <button className="btn btn-g" onClick={() => api.saveDraft(p.f.id, title, steps).then(() => p.onToast('Rascunho salvo')).catch(e => p.onError(e, 'salvar'))}>Salvar rascunho</button>
        <button className="lnk-inline" onClick={() => { if (confirm('Descartar este faxinão?')) api.deleteFax(p.f.id).then(p.reload).catch(e => p.onError(e, 'descartar')) }}>Descartar</button>
        <button className="lnk-inline" onClick={p.onNew}>Novo faxinão</button>
      </div>
    </section>
  )
}

function LiveFax(p: FaxProps & { f: Faxinao }) {
  const { f } = p
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const t = faxTotals(f.steps), elapsed = f.started_at ? now - Date.parse(f.started_at) : 0
  const pct = t.count ? Math.round(t.done / t.count * 100) : 0
  const people = (['g', 's'] as Who[]).filter(w => f.steps.some(s => s.who === w || s.who === 'both'))
  async function act(step: FaxStep, action: 'done' | 'skip' | 'undo' | 'later', who: Who | null) {
    try {
      const steps = await api.stepFax(f.id, step.id, action, who)
      p.setList(l => (l || []).map(x => x.id === f.id ? { ...x, steps } : x))
    } catch (e) { p.onError(e, 'marcar passo') }
  }
  async function finish() {
    try { await api.finishFax(f.id); await p.reload(); const s = faxSummary({ ...f, finished_at: new Date().toISOString() }); p.onToast(`Faxinão concluído${s.minutes != null ? ` em ${fmtMin(s.minutes)}` : ''}! 🎉`) } catch (e) { p.onError(e, 'encerrar faxinão') }
  }
  return (
    <>
      <section className="card fx-live" aria-labelledby="fx-live">
        <div className="slbl" id="fx-live">🧹 {f.title} · ao vivo</div>
        <div className="fx-head">
          <div className="fx-clock"><b className="mono" aria-label={`Tempo: ${clock(elapsed)}`}>{clock(elapsed)}</b><small>de ~{fmtMin(t.total)}</small></div>
          <div className="fx-prog"><div className="gl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Passos feitos"><div style={{ width: `${pct}%` }}/></div>
            <small>{t.done} de {t.count} passos · faltam {t.left}</small></div>
        </div>
        <div className="fx-now">{people.map(w => {
          const n = nextFor(f.steps, w)
          return <div key={w} className={`fx-card ${w === p.me ? 'me' : ''}`}>
            <span className="fx-pn">{first(p.names[w])}{w === p.me ? ' (você)' : ''}</span>
            {n.now ? <>
              <b className="fx-nt">{n.now.title}</b>
              <small>{n.now.room} · {n.now.min} min{n.now.who === 'both' ? ' · juntas' : ''}{n.now.wait ? ' · ⏳ começa e segue' : ''}</small>
              {n.now.note && <small className="fx-note">{n.now.note}</small>}
              <div className="fx-btns">
                <button className="btn btn-p" onClick={() => act(n.now!, 'done', w)}>✓ Feito</button>
                <button className="btn btn-g" onClick={() => act(n.now!, 'later', null)}>Depois</button>
                <button className="lnk-inline" onClick={() => act(n.now!, 'skip', null)}>pular</button>
              </div>
              {n.then && <small className="fx-then">Em seguida: {n.then.title}</small>}
            </> : <b className="fx-nt">Tudo feito por aqui 🎉</b>}
          </div>
        })}</div>
        <details className="pl-more"><summary>Todos os passos ({t.done}/{t.count})</summary>
          <ul className="fx-all">{f.steps.map(s => {
            const ok = !!s.done_at
            return <li key={s.id} className={`${ok ? 'ok' : ''} ${s.skipped ? 'skip' : ''}`}>
              <button className={`rt-step ${ok ? 'on' : ''}`} role="checkbox" aria-checked={ok} onClick={() => act(s, ok || s.skipped ? 'undo' : 'done', s.who === 'both' ? p.me : s.who as Who)}>
                <span className="rt-box" aria-hidden="true">{ok ? '✓' : s.skipped ? '–' : ''}</span>
                <span className="rt-step-t">{s.title}<small> · {s.who === 'both' ? 'as duas' : first(p.names[s.who as Who])} · {s.min} min{s.skipped ? ' · pulado' : ''}</small></span>
              </button>
            </li>
          })}</ul>
        </details>
        <div className="md-acts"><button className="btn btn-s" onClick={() => { if (t.left === 0 || confirm(`Ainda faltam ${t.left} passo(s). Encerrar mesmo assim?`)) finish() }}>Encerrar faxinão</button>
          <button className="btn btn-g" onClick={() => { if (confirm('Cancelar este faxinão? Ele some e não vai para o histórico.')) api.deleteFax(f.id).then(p.reload).then(() => p.onToast('Faxinão cancelado')).catch(e => p.onError(e, 'cancelar faxinão')) }}>Cancelar faxinão</button></div>
      </section>
    </>
  )
}

/** Cartão do Início enquanto um faxinão está em andamento. */
export function FaxinaoHomeCard({ f, me, names, onOpen }: { f: Faxinao, me: Who | null, names: Names, onOpen: () => void }) {
  const t = faxTotals(f.steps), n = me ? nextFor(f.steps, me).now : null
  return (
    <section className="card fx-home" aria-labelledby="fx-home">
      <div className="slbl" id="fx-home">🧹 Faxinão em andamento<button className="lnk" onClick={onOpen}>Abrir →</button></div>
      <div className="gl-bar" aria-hidden="true"><div style={{ width: `${t.count ? Math.round(t.done / t.count * 100) : 0}%` }}/></div>
      <p className="row-s" style={{ marginTop: 6 }}>{t.done} de {t.count} passos{n ? ` · agora, ${first(names[me!])}: ${n.title}` : ''}</p>
    </section>
  )
}
