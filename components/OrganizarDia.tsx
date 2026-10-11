'use client'
// "Organize meu dia": despejar as pendências (escrevendo ou falando), a IA monta
// o dia em ordem encaixado no que já existe, a pessoa confere e cria tudo de uma vez.
import { useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { Sheet } from '@/components/ui/Sheet'
import { useSpeech } from '@/hooks/useSpeech'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/dates'
import { endOf, fallbackDay, type DayItem, type DayPlan } from '@/lib/organizar'

const first = (n: string) => (n || '').split(' ')[0]
const KIND_IC: Record<DayItem['kind'], string> = { tarefa: '✓', compromisso: '📅', compra: '🛒' }

async function askDay(householdId: string, me: Who, text: string): Promise<{ ok: true, plan: DayPlan } | { ok: false, error: string }> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { ok: false, error: 'Sessão não encontrada. Recarregue o app.' }
    const r = await fetch('/api/ai/dia', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ householdId, text, who: me }) })
    const j = await r.json().catch(() => ({}))
    return r.ok ? { ok: true, plan: j.plan } : { ok: false, error: j.error || 'Não foi possível organizar agora.' }
  } catch { return { ok: false, error: 'Sem conexão com o servidor. Confira a internet e tente de novo.' } }
}

export function OrganizarDiaSheet(p: { householdId: string, me: Who, names: Names, today: string, onClose: () => void, onCreate: (items: DayItem[]) => Promise<void> }) {
  const [text, setText] = useState(''), [plan, setPlan] = useState<DayPlan | null>(null)
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null)
  const sp = useSpeech(t => setText(x => x.trim() ? `${x.trim().replace(/[,;]$/, '')}, ${t.trim()}` : t.trim()))
  const tomorrow = addDays(p.today, 1)
  const set = (i: number, patch: Partial<DayItem>) => setPlan(pl => pl && { ...pl, items: pl.items.map((x, j) => j === i ? { ...x, ...patch } : x) })
  async function organize() {
    setBusy(true); setErr(null)
    const r = await askDay(p.householdId, p.me, text)
    setBusy(false)
    if (r.ok === true) setPlan(r.plan); else setErr(r.error)
  }
  async function create() {
    if (!plan) return
    setBusy(true)
    try { await p.onCreate(plan.items); p.onClose() } catch { /* aviso já mostrado */ } finally { setBusy(false) }
  }
  const counts = plan ? (['tarefa', 'compromisso', 'compra'] as const).map(k => plan.items.filter(i => i.kind === k).length) : [0, 0, 0]
  return (
    <Sheet title="🗓️ Organizar meu dia" size="lg" onClose={p.onClose} footer={plan
      ? <div className="md-acts" style={{ marginTop: 0 }}><button className="btn btn-p" disabled={busy || !plan.items.length} onClick={create}>{busy ? 'Criando…' : `Criar no app (${plan.items.length})`}</button><button className="btn btn-g" onClick={() => setPlan(null)}>Voltar ao texto</button></div>
      : <button className="btn btn-p" disabled={busy || text.trim().length < 3} onClick={organize}>{busy ? 'Organizando…' : '✨ Organizar'}</button>}>
      {!plan ? <>
        <p className="row-s" style={{ marginBottom: 8 }}>Despeje tudo o que precisa fazer, do seu jeito. A IA monta o dia em ordem, encaixado no que já está no app (compromissos, tarefas e rotinas de hoje), e você confere antes de criar.</p>
        <label className="onb-f"><span>O que você precisa fazer?</span>
          <textarea className="fi fx-text" rows={4} value={text} maxLength={2000} onChange={e => setText(e.target.value)} placeholder="dentista 14h30, pagar o boleto da luz, responder a Ana, mercado, ração das meninas, academia…"/></label>
        {sp.supported && <button className={`btn ${sp.on ? 'btn-p' : 'btn-g'} fx-mic`} onClick={sp.toggle} aria-pressed={sp.on}>{sp.on ? '⏺ Ouvindo… toque para parar' : '🎤 Falar'}</button>}
        {err && <div className="fx-err" role="alert"><p className="row-s al-warn">{err}</p>
          <button className="btn btn-g" onClick={() => { const f = fallbackDay(text, p.me, p.today); if (f) setPlan(f) }}>Criar como tarefas de hoje, sem ordem</button></div>}
      </> : <>
        <p className="fx-sum">{counts[0]} tarefa(s) · {counts[1]} compromisso(s) · {counts[2]} compra(s)</p>
        {plan.tips.length > 0 && <ul className="fx-tips">{plan.tips.map(t => <li key={t}>💡 {t}</li>)}</ul>}
        <ol className="od-list">{plan.items.map((it, i) => <li key={it.id} className={`od ${it.priority === 'alta' ? 'hi' : ''}`}>
          <span className="od-ic" aria-hidden="true">{KIND_IC[it.kind]}</span>
          <span className="od-main">
            <input className="fi fx-st" value={it.title} maxLength={90} aria-label={`Item ${i + 1}`} onChange={e => set(i, { title: e.target.value })}/>
            <small>{it.kind === 'compra' ? 'lista de compras' : it.kind === 'compromisso' ? 'agenda' : 'tarefa'}{it.priority === 'alta' ? ' · importante' : it.priority === 'baixa' ? ' · pode esperar' : ''}{it.time ? ` · até ${endOf(it)}` : ''}{it.note ? ` · ${it.note}` : ''}</small>
          </span>
          <span className="fx-ctl">
            {it.kind !== 'compra' && <input className="fi od-time" type="time" value={it.time || ''} aria-label={`Horário: ${it.title}`} onChange={e => set(i, { time: e.target.value || null })}/>}
            {it.kind !== 'compra' && <span className="fx-who" role="radiogroup" aria-label={`Dia: ${it.title}`}>
              {([[p.today, 'Hoje'], [tomorrow, 'Amanhã']] as Array<[string, string]>).map(([d, l]) => <button key={l} role="radio" aria-checked={it.date === d} className={`fx-wb ${it.date === d ? 'on' : ''}`} onClick={() => set(i, { date: d })}>{l}</button>)}
            </span>}
            <span className="fx-who" role="radiogroup" aria-label={`Quem: ${it.title}`}>
              {([['g', first(p.names.g).slice(0, 1)], ['s', first(p.names.s).slice(0, 1)], ['both', '2']] as Array<[DayItem['who'], string]>).map(([k, l]) =>
                <button key={k} role="radio" aria-checked={it.who === k} aria-label={k === 'both' ? 'As duas' : first(p.names[k as Who])} className={`fx-wb ${it.who === k ? 'on' : ''}`} onClick={() => set(i, { who: k })}>{l}</button>)}
            </span>
            <button className="ib" aria-label={`Tirar ${it.title}`} onClick={() => setPlan(pl => pl && { ...pl, items: pl.items.filter((_, j) => j !== i) })}>✕</button>
          </span>
        </li>)}</ol>
      </>}
    </Sheet>
  )
}
