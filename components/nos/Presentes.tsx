'use client'
// Nós › 🎁 Presentes: ideias do que a outra comentou que queria e as datas especiais, com lembrete.
// Só a dona vê (o banco garante): a outra não enxerga nada daqui, nem com compartilhamento.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Names, Who } from '@/lib/types'
import { logError, toNinhoError } from '@/lib/errors'
import * as api from '@/lib/services/presentes'
import {
  STATUS_LABEL, cleanLink, dateIdeas, ddmm, other, sinceLabel, sortIdeas, upcomingDates, whenLabel,
  type GiftDate, type GiftIdea, type GiftStatus,
} from '@/lib/presentes'

const first = (n: string) => (n || '').split(' ')[0]
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function GiftsView({ householdId, me, names, today, onToast, onError }: {
  householdId: string, me: Who, names: Names, today: string, onToast: (m: string) => void, onError: (m: string) => void
}) {
  const [data, setData] = useState<api.GiftsData | null>(null)
  const [dateForm, setDateForm] = useState<api.DateInput | null>(null)
  const [ideaForm, setIdeaForm] = useState<api.IdeaInput | null>(null)
  const [tab, setTab] = useState<'abertas' | 'dadas'>('abertas')
  const o = other(me)
  const load = useCallback(async () => {
    try { setData(await api.loadGifts(householdId, me)) } catch (e) { logError('carregar presentes', e); setData({ ready: true, dates: [], ideas: [] }); onError(toNinhoError(e, 'carregar presentes').userMessage) }
  }, [householdId, me]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  const run = async (fn: () => Promise<void>, ok: string, ctx: string) => {
    try { await fn(); await load(); onToast(ok); return true } catch (e) { onError(toNinhoError(e, ctx).userMessage); return false }
  }
  const up = useMemo(() => data ? upcomingDates(data.dates, data.ideas, today) : [], [data, today])
  if (!data) return <div className="card"><div className="row-s">Carregando…</div></div>
  if (!data.ready) return <div className="card empty"><span className="empty-icon">🎁</span>As ideias de presente precisam da atualização do banco (migration 036).</div>
  const open = sortIdeas(data.ideas.filter(i => i.status !== 'dado'), data.dates, today)
  const given = data.ideas.filter(i => i.status === 'dado').sort((a, b) => String(b.given_on).localeCompare(String(a.given_on)))
  const dateOf = (id: string | null) => data.dates.find(d => d.id === id) || null
  const newIdea = (date_id: string | null = null): api.IdeaInput => ({ for_who: o, title: '', note: null, link: null, price: null, date_id })
  const sug = dateIdeas(names, me, data.dates)

  return (
    <div className="gf">
      <p className="gf-priv" role="note">🔒 Só você vê esta lista. A {first(names[o])} não enxerga nada daqui.</p>

      <section className="card" aria-labelledby="gf-d">
        <div className="slbl" id="gf-d">📅 Datas especiais{!dateForm && <button className="lnk" onClick={() => setDateForm({ title: '', month: Number(today.slice(5, 7)), day: Number(today.slice(8, 10)), for_who: o })}>+ Data</button>}</div>
        {up.length === 0 && !dateForm && <p className="row-s">Anote os aniversários e as datas de vocês: o Ninho avisa 14 e 3 dias antes, e no dia.</p>}
        {up.map(u => <div key={u.date.id} className="gf-date">
          <span className="gf-when mono" aria-hidden="true"><b>{ddmm(u.date.month, u.date.day)}</b></span>
          <span className="gf-dt"><b>{u.date.title}</b><small>{whenLabel(u.days)}{u.ideas ? ` · ${u.ideas} ideia${u.ideas > 1 ? 's' : ''}` : ' · sem ideia ainda'}</small></span>
          <button className="lnk-inline" onClick={() => { setIdeaForm(newIdea(u.date.id)); setTimeout(() => document.getElementById('gf-i')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }} aria-label={`Anotar ideia para ${u.date.title}`}>+ ideia</button>
          <button className="ib" aria-label={`Editar ${u.date.title}`} onClick={() => setDateForm({ ...u.date })}>✎</button>
        </div>)}
        {!dateForm && sug.length > 0 && <div className="fchips gf-sug" aria-label="Sugestões de datas">
          {sug.map(s => <button key={s.title} className="fc" onClick={() => setDateForm({ title: s.title, month: s.month || Number(today.slice(5, 7)), day: s.day || 1, for_who: s.for_who })}>+ {s.title}</button>)}
        </div>}
        {dateForm && <DateForm value={dateForm} names={names} me={me} onCancel={() => setDateForm(null)}
          onDelete={dateForm.id ? async () => { if (confirm(`Apagar a data "${dateForm.title}"? As ideias ficam, sem data.`) && await run(() => api.deleteDate(dateForm.id!), 'Data apagada', 'apagar data')) setDateForm(null) } : undefined}
          onSave={async v => { if (await run(() => api.saveDate(householdId, me, v), 'Data salva 📅 O Ninho avisa antes', 'salvar data')) setDateForm(null) }}/>}
      </section>

      <section className="card" aria-labelledby="gf-i">
        <div className="slbl" id="gf-i">🎁 Ideias para a {first(names[o])}{!ideaForm && <button className="lnk" onClick={() => setIdeaForm(newIdea())}>+ Ideia</button>}</div>
        {ideaForm && <IdeaForm value={ideaForm} dates={data.dates} onCancel={() => setIdeaForm(null)}
          onSave={async v => { if (await run(() => api.saveIdea(householdId, me, v), v.id ? 'Ideia salva' : 'Ideia anotada 🎁', 'anotar ideia')) setIdeaForm(null) }}/>}
        <div className="fchips" role="tablist" aria-label="Ideias">
          <button role="tab" aria-selected={tab === 'abertas'} className={`fc ${tab === 'abertas' ? 'on' : ''}`} onClick={() => setTab('abertas')}>Ideias e comprados ({open.length})</button>
          <button role="tab" aria-selected={tab === 'dadas'} className={`fc ${tab === 'dadas' ? 'on' : ''}`} onClick={() => setTab('dadas')}>Já dei ({given.length})</button>
        </div>
        {tab === 'abertas' && (open.length === 0 ? <p className="row-s">Ela comentou de algo que queria? Anote aqui na hora, antes de esquecer. Pelo Telegram também: <code>/presente fone azul</code>.</p>
          : <ul className="gf-list">{open.map(i => <IdeaRow key={i.id} i={i} date={dateOf(i.date_id)} today={today}
            onStatus={s => run(() => api.setIdeaStatus(i.id, s, today), s === 'dado' ? 'Marcado como dado 🎁' : s === 'comprado' ? 'Comprado 🛍️' : 'Voltou para ideia', 'atualizar ideia')}
            onEdit={() => setIdeaForm({ id: i.id, for_who: i.for_who, title: i.title, note: i.note, link: i.link, price: i.price, date_id: i.date_id })}
            onDelete={() => { if (confirm(`Apagar a ideia "${i.title}"?`)) run(() => api.deleteIdea(i.id), 'Ideia apagada', 'apagar ideia') }}/>)}</ul>)}
        {tab === 'dadas' && (given.length === 0 ? <p className="row-s">O que você já deu fica aqui, para não repetir.</p>
          : <ul className="gf-list">{given.map(i => <IdeaRow key={i.id} i={i} date={dateOf(i.date_id)} today={today}
            onStatus={s => run(() => api.setIdeaStatus(i.id, s, today), 'Voltou para a lista', 'atualizar ideia')}
            onEdit={() => setIdeaForm({ id: i.id, for_who: i.for_who, title: i.title, note: i.note, link: i.link, price: i.price, date_id: i.date_id })}
            onDelete={() => { if (confirm(`Apagar "${i.title}" do histórico?`)) run(() => api.deleteIdea(i.id), 'Apagado', 'apagar ideia') }}/>)}</ul>)}
      </section>
    </div>
  )
}

function IdeaRow({ i, date, today, onStatus, onEdit, onDelete }: { i: GiftIdea, date: GiftDate | null, today: string, onStatus: (s: GiftStatus) => void, onEdit: () => void, onDelete: () => void }) {
  const meta = [i.status === 'dado' ? `dado ${i.given_on ? sinceLabel(i.given_on, today) : ''}`.trim() : STATUS_LABEL[i.status], date?.title, i.price].filter(Boolean).join(' · ')
  return <li className={`gf-idea ${i.status}`}>
    <div className="gf-it"><b>{i.title}</b><small>{meta}</small>{i.note && <small className="gf-note">{i.note}</small>}
      {i.link && <a className="lnk-inline" href={i.link} target="_blank" rel="noopener noreferrer">abrir o link ↗</a>}</div>
    <div className="gf-acts">
      {i.status === 'ideia' && <button className="btn btn-s" onClick={() => onStatus('comprado')}>Comprei</button>}
      {i.status === 'comprado' && <button className="btn btn-s" onClick={() => onStatus('dado')}>Dei 🎁</button>}
      {i.status === 'dado' && <button className="lnk-inline" onClick={() => onStatus('ideia')}>voltar para a lista</button>}
      {i.status === 'comprado' && <button className="lnk-inline" onClick={() => onStatus('ideia')}>desfazer</button>}
      <button className="ib" aria-label={`Editar ${i.title}`} onClick={onEdit}>✎</button>
      <button className="ib danger" aria-label={`Apagar ${i.title}`} onClick={onDelete}>✕</button>
    </div>
  </li>
}

function DateForm({ value, names, me, onSave, onCancel, onDelete }: { value: api.DateInput, names: Names, me: Who, onSave: (v: api.DateInput) => void, onCancel: () => void, onDelete?: () => void }) {
  const [v, setV] = useState(value), [busy, setBusy] = useState(false)
  const set = (p: Partial<api.DateInput>) => setV(x => { const n = { ...x, ...p }; n.day = Math.min(n.day, MAX_DAY[n.month - 1]); return n })
  const o = other(me)
  return <div className="gf-form">
    <label className="onb-f"><span>Data</span><input className="fi" value={v.title} maxLength={60} autoFocus onChange={e => set({ title: e.target.value })} placeholder={`Ex.: Aniversário da ${first(names[o])}`}/></label>
    <div className="onb-row">
      <label className="onb-f"><span>Dia</span><select className="fi" value={v.day} onChange={e => set({ day: Number(e.target.value) })}>{Array.from({ length: MAX_DAY[v.month - 1] }, (_, k) => k + 1).map(d => <option key={d} value={d}>{d}</option>)}</select></label>
      <label className="onb-f"><span>Mês</span><select className="fi" value={v.month} onChange={e => set({ month: Number(e.target.value) })}>{MONTHS.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}</select></label>
    </div>
    <div className="onb-q">É de quem</div>
    <div className="onb-days wrap" role="radiogroup" aria-label="É de quem">
      {([[o, `Da ${first(names[o])}`], ['both', 'Das duas'], [null, 'Outra (Natal…)']] as Array<[Who | 'both' | null, string]>).map(([k, l]) =>
        <button key={String(k)} role="radio" aria-checked={v.for_who === k} className={`onb-day wide ${v.for_who === k ? 'on' : ''}`} onClick={() => set({ for_who: k })}>{l}</button>)}
    </div>
    <div className="md-acts">
      <button className="btn btn-p" disabled={!v.title.trim() || busy} onClick={async () => { setBusy(true); await onSave(v); setBusy(false) }}>{busy ? 'Salvando…' : 'Salvar data'}</button>
      <button className="btn btn-g" onClick={onCancel}>Cancelar</button>
      {onDelete && <button className="btn btn-g" onClick={onDelete}>Apagar</button>}
    </div>
  </div>
}

function IdeaForm({ value, dates, onSave, onCancel }: { value: api.IdeaInput, dates: GiftDate[], onSave: (v: api.IdeaInput) => void, onCancel: () => void }) {
  const [v, setV] = useState(value), [busy, setBusy] = useState(false)
  const set = (p: Partial<api.IdeaInput>) => setV(x => ({ ...x, ...p }))
  const linkBad = !!v.link?.trim() && !cleanLink(v.link)
  return <div className="gf-form">
    <label className="onb-f"><span>O que ela comentou que queria?</span><input className="fi" value={v.title} maxLength={120} autoFocus onChange={e => set({ title: e.target.value })} placeholder="Ex.: fone sem fio azul"/></label>
    <label className="onb-f"><span>Detalhes</span><input className="fi" value={v.note || ''} maxLength={500} onChange={e => set({ note: e.target.value })} placeholder="opcional: tamanho, cor, onde viu"/></label>
    <div className="onb-row">
      <label className="onb-f"><span>Link</span><input className="fi" type="url" value={v.link || ''} maxLength={500} onChange={e => set({ link: e.target.value })} placeholder="opcional: https://…" aria-invalid={linkBad}/></label>
      <label className="onb-f"><span>Faixa de preço</span><input className="fi" value={v.price || ''} maxLength={40} onChange={e => set({ price: e.target.value })} placeholder="opcional: até R$ 200"/></label>
    </div>
    {linkBad && <small className="al-warn">O link precisa começar com https://</small>}
    {dates.length > 0 && <label className="onb-f"><span>Para qual data</span><select className="fi" value={v.date_id || ''} onChange={e => set({ date_id: e.target.value || null })}>
      <option value="">Sem data (quando surgir a ocasião)</option>{dates.map(d => <option key={d.id} value={d.id}>{d.title} · {ddmm(d.month, d.day)}</option>)}</select></label>}
    <div className="md-acts">
      <button className="btn btn-p" disabled={!v.title.trim() || linkBad || busy} onClick={async () => { setBusy(true); await onSave(v); setBusy(false) }}>{busy ? 'Salvando…' : v.id ? 'Salvar' : 'Anotar ideia'}</button>
      <button className="btn btn-g" onClick={onCancel}>Cancelar</button>
    </div>
  </div>
}
