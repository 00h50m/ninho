'use client'
// Cães: perfil (foto, idade, sexo, alimentação), cuidados de saúde com próxima
// aplicação e o painel do filhote. O app registra e lembra; não dá diagnóstico.
import { useMemo, useState } from 'react'
import type { Dog, Names, Who } from '@/lib/types'
import { Sheet } from '@/components/ui/Sheet'
import { fmtDate, timeOfInstant } from '@/lib/dates'
import { HEALTH_KINDS, PERIOD_LABEL, ageLabel, currentWeight, foodDaysLeft, kindInfo, puppyStats, suggestNext, upcomingCare, type AccidentRow, type HealthKind, type HealthRecord } from '@/lib/caes'
import type { HealthInput } from '@/lib/services/caes'

const first = (n: string) => (n || '').split(' ')[0]

/** Reduz a foto para 256 px (JPEG) antes de guardar: leve e funciona offline. */
export async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = url })
    const s = 256, c = document.createElement('canvas'); c.width = s; c.height = s
    const side = Math.min(img.width, img.height)
    c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, s, s)
    return c.toDataURL('image/jpeg', 0.8)
  } finally { URL.revokeObjectURL(url) }
}

export function DogAvatar({ dog, size = 44 }: { dog: Dog, size?: number }) {
  return dog.photo
    ? <img className="dog-ph" src={dog.photo} alt={`Foto de ${dog.name}`} width={size} height={size}/>
    : <span className="dav" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">{dog.is_puppy ? '🐶' : '🐕'}</span>
}

export function DogProfileSheet({ dog, today, saving, onSave, onDelete, onClose }: {
  dog: Dog, today: string, saving: boolean, onSave: (id: string, d: Partial<Dog>) => void, onDelete: (d: Dog) => void, onClose: () => void
}) {
  const [d, setD] = useState<Partial<Dog>>({ name: dog.name, breed: dog.breed, is_puppy: dog.is_puppy, birth_date: dog.birth_date ?? null, sex: dog.sex ?? null, photo: dog.photo ?? null,
    food_brand: dog.food_brand ?? null, food_g_day: dog.food_g_day ?? null, meals_day: dog.meals_day ?? null, food_stock_kg: dog.food_stock_kg ?? null, food_stock_on: dog.food_stock_on ?? null, notes: dog.notes ?? null })
  const [photoErr, setPhotoErr] = useState<string | null>(null)
  const set = (p: Partial<Dog>) => setD(x => ({ ...x, ...p }))
  const num = (v: string) => v.trim() === '' ? null : Number(v.replace(',', '.'))
  return (
    <Sheet title={`Perfil de ${dog.name}`} onClose={onClose} footer={<>
      <button className="btn btn-danger" disabled={saving} onClick={() => onDelete(dog)}>Remover</button>
      <button className="btn btn-p" disabled={!d.name?.trim() || saving} onClick={() => onSave(dog.id, { ...d, name: d.name!.trim(), breed: d.breed?.trim() || null, food_brand: d.food_brand?.trim() || null, notes: d.notes?.trim() || null })}>{saving ? 'Salvando…' : 'Salvar'}</button>
    </>}>
      <div className="dog-ph-row">
        <DogAvatar dog={{ ...dog, photo: d.photo, is_puppy: !!d.is_puppy }} size={72}/>
        <label className="btn btn-g">📷 {d.photo ? 'Trocar foto' : 'Adicionar foto'}
          <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { set({ photo: await shrinkPhoto(f) }); setPhotoErr(null) } catch { setPhotoErr('Não deu para ler essa imagem.') } }}/></label>
        {d.photo && <button className="lnk-inline" onClick={() => set({ photo: null })}>Tirar foto</button>}
      </div>
      {photoErr && <div className="row-s" style={{ color: 'var(--cor-tx)' }}>{photoErr}</div>}
      <div className="onb-row">
        <label className="onb-f"><span>Nome</span><input className="fi" value={d.name || ''} maxLength={40} onChange={e => set({ name: e.target.value })}/></label>
        <label className="onb-f"><span>Raça</span><input className="fi" value={d.breed || ''} maxLength={40} onChange={e => set({ breed: e.target.value })} placeholder="SRD, Golden…"/></label>
      </div>
      <div className="onb-row">
        <label className="onb-f"><span>Nascimento</span><input className="fi" type="date" max={today} value={d.birth_date || ''} onChange={e => set({ birth_date: e.target.value || null })}/></label>
        <div className="onb-f"><span>Sexo</span><div className="onb-days" role="radiogroup" aria-label="Sexo">
          {([['f', 'Fêmea'], ['m', 'Macho']] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={d.sex === k} className={`onb-day wide ${d.sex === k ? 'on' : ''}`} onClick={() => set({ sex: d.sex === k ? null : k })}>{l}</button>)}</div></div>
      </div>
      <div className="onb-q">Fase</div>
      <div className="onb-days" role="radiogroup" aria-label="Fase">
        <button role="radio" aria-checked={!d.is_puppy} className={`onb-day wide ${!d.is_puppy ? 'on' : ''}`} onClick={() => set({ is_puppy: false })}>🐕 Adulto</button>
        <button role="radio" aria-checked={!!d.is_puppy} className={`onb-day wide ${d.is_puppy ? 'on' : ''}`} onClick={() => set({ is_puppy: true })}>🐶 Filhote (registro de acidentes)</button>
      </div>
      <div className="onb-q" style={{ marginTop: 14 }}>Alimentação</div>
      <label className="onb-f"><span>Ração</span><input className="fi" value={d.food_brand || ''} maxLength={60} onChange={e => set({ food_brand: e.target.value })} placeholder="Marca e linha"/></label>
      <div className="onb-row">
        <label className="onb-f"><span>Gramas por dia</span><input className="fi" inputMode="numeric" value={d.food_g_day ?? ''} onChange={e => set({ food_g_day: num(e.target.value) })}/></label>
        <label className="onb-f"><span>Refeições</span><input className="fi" inputMode="numeric" value={d.meals_day ?? ''} onChange={e => set({ meals_day: num(e.target.value) })}/></label>
      </div>
      <label className="onb-f"><span>Estoque agora (kg) — conta a partir de hoje</span><input className="fi" inputMode="decimal" value={d.food_stock_kg ?? ''} onChange={e => set({ food_stock_kg: num(e.target.value), food_stock_on: today })}/></label>
      <label className="onb-f"><span>Observações</span><textarea className="fita" rows={2} maxLength={500} value={d.notes || ''} onChange={e => set({ notes: e.target.value })} placeholder="Medos, alergias, manias…"/></label>
    </Sheet>
  )
}

export function DogHealthBlock({ dog, records, today, names, onRecord, onEdit, onBuyFood }: {
  dog: Dog, records: HealthRecord[], today: string, names: Names
  onRecord: (kind: HealthKind) => void, onEdit: (r: HealthRecord) => void, onBuyFood: (dog: Dog) => void
}) {
  const [open, setOpen] = useState(false)
  const mine = records.filter(r => r.dog_id === dog.id)
  const next = upcomingCare(mine, today, 60)
  const w = currentWeight(records, dog.id)
  const age = ageLabel(dog.birth_date, today)
  const left = foodDaysLeft(dog, today)
  return (
    <div className="dh-health">
      <div className="dh-facts">
        {age && <span>{age}</span>}{dog.sex && <span>{dog.sex === 'f' ? 'fêmea' : 'macho'}</span>}{w && <span>⚖️ {String(w.kg).replace('.', ',')} kg</span>}
      </div>
      {(dog.food_brand || dog.food_g_day) && <div className={`dh-food ${left != null && left <= 7 ? 'low' : ''}`}>
        🍖 {dog.food_brand || 'Ração'}{dog.food_g_day ? ` · ${dog.food_g_day} g/dia` : ''}{dog.meals_day ? ` em ${dog.meals_day} refeições` : ''}
        {left != null && <> · <b>{left === 0 ? 'estoque acabou' : `estoque para ~${left} dia${left === 1 ? '' : 's'}`}</b></>}
        {left != null && left <= 7 && <button className="lnk-inline" onClick={() => onBuyFood(dog)}>🛒 pôr na lista</button>}
      </div>}
      <div className="slbl" style={{ marginTop: 10 }}>Saúde</div>
      {next.length === 0 ? <div className="row-s">Nada previsto para os próximos 60 dias.</div> :
        next.map(r => <button key={r.id} className={`dh-next ${r.late ? 'late' : r.inDays <= 7 ? 'soon' : ''}`} onClick={() => onRecord(r.kind)}>
          <span>{kindInfo(r.kind)[1]} {r.title}</span>
          <span className="mono">{r.late ? `atrasado ${-r.inDays}d` : r.inDays === 0 ? 'hoje' : `em ${r.inDays}d · ${fmtDate(r.next_date!)}`}</span>
        </button>)}
      <div className="dh-acts">
        {HEALTH_KINDS.filter(k => ['vacina', 'vermifugo', 'antipulgas', 'banho', 'peso', 'consulta', 'medicamento'].includes(k[0])).map(([k, ic, l]) =>
          <button key={k} className="fc" onClick={() => onRecord(k)} aria-label={`Registrar ${l.toLowerCase()} de ${dog.name}`}>{ic} {l}</button>)}
      </div>
      {mine.length > 0 && <button className="lnk-inline" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Esconder histórico' : `Histórico (${mine.length})`}</button>}
      {open && <ul className="dh-hist">{mine.slice(0, 30).map(r => (
        <li key={r.id}><button onClick={() => onEdit(r)}>
          <span className="mono">{fmtDate(r.date)}</span><span>{kindInfo(r.kind)[1]} {r.title}{r.kind === 'peso' && r.weight_kg ? ` · ${String(r.weight_kg).replace('.', ',')} kg` : ''}{r.dose ? ` · ${r.dose}` : ''}</span>
          <span className="dh-by">{r.next_date ? `próx. ${fmtDate(r.next_date)}` : ''}{r.done_by ? ` · ${first(names[r.done_by as Who])}` : ''}</span>
        </button></li>))}</ul>}
    </div>
  )
}

export function HealthSheet({ dog, record, kind, today, saving, onSave, onDelete, onClose }: {
  dog: Dog, record: HealthRecord | null, kind: HealthKind, today: string, saving: boolean
  onSave: (d: HealthInput) => void, onDelete: (r: HealthRecord) => void, onClose: () => void
}) {
  const k0 = kindInfo(record?.kind || kind)
  const [d, setD] = useState<HealthInput>(() => record ? { ...record } : { dog_id: dog.id, kind: k0[0], title: k0[4][0] || '', date: today, next_date: suggestNext(today, k0[3]), every_days: k0[3], dose: null, vet: null, weight_kg: null, notes: null, link: null })
  const [nextTouched, setNextTouched] = useState(!!record)
  const set = (p: Partial<HealthInput>) => setD(x => {
    const n = { ...x, ...p }
    if (!nextTouched && ('date' in p || 'every_days' in p)) n.next_date = suggestNext(n.date, n.every_days)
    return n
  })
  const info = kindInfo(d.kind)
  const linkOk = !d.link?.trim() || /^https?:\/\//i.test(d.link.trim())
  const valid = d.title.trim() && d.date && linkOk && (d.kind !== 'peso' || (d.weight_kg && d.weight_kg > 0))
  return (
    <Sheet title={`${record ? 'Editar' : 'Registrar'} · ${dog.name}`} onClose={onClose} footer={<>
      {record && <button className="btn btn-danger" disabled={saving} onClick={() => onDelete(record)}>Apagar</button>}
      <button className="btn btn-p" disabled={!valid || saving} onClick={() => onSave({ ...d, weight_kg: d.kind === 'peso' ? d.weight_kg : null })}>{saving ? 'Salvando…' : 'Salvar'}</button>
    </>}>
      <div className="onb-days wrap" role="radiogroup" aria-label="Tipo de cuidado">
        {HEALTH_KINDS.map(([k, ic, l, every, sug]) => <button key={k} role="radio" aria-checked={d.kind === k} className={`onb-day wide ${d.kind === k ? 'on' : ''}`}
          onClick={() => { setNextTouched(false); set({ kind: k, every_days: every, title: sug.includes(d.title) || !d.title ? (sug[0] || '') : d.title }) }}>{ic} {l}</button>)}
      </div>
      <label className="onb-f" style={{ marginTop: 12 }}><span>Nome</span><input className="fi" list="health-sugg" value={d.title} maxLength={80} onChange={e => set({ title: e.target.value })}/></label>
      <datalist id="health-sugg">{info[4].map(s => <option key={s} value={s}/>)}</datalist>
      <div className="onb-row">
        <label className="onb-f"><span>{d.kind === 'consulta' ? 'Data da consulta' : 'Feito em'}</span><input className="fi" type="date" value={d.date} onChange={e => set({ date: e.target.value })}/></label>
        {d.kind === 'peso'
          ? <label className="onb-f"><span>Peso (kg)</span><input className="fi" inputMode="decimal" value={d.weight_kg ?? ''} onChange={e => set({ weight_kg: e.target.value ? Number(e.target.value.replace(',', '.')) : null })}/></label>
          : <label className="onb-f"><span>Repetir a cada (dias)</span><input className="fi" inputMode="numeric" value={d.every_days ?? ''} onChange={e => set({ every_days: e.target.value ? Math.min(730, Math.max(1, Number(e.target.value) || 0)) || null : null })}/></label>}
      </div>
      {d.kind !== 'peso' && <label className="onb-f"><span>Próxima aplicação (lembrete)</span><input className="fi" type="date" value={d.next_date || ''} onChange={e => { setNextTouched(true); setD(x => ({ ...x, next_date: e.target.value || null })) }}/></label>}
      {['vacina', 'vermifugo', 'antipulgas', 'medicamento'].includes(d.kind) && <label className="onb-f"><span>Dose / produto</span><input className="fi" value={d.dose || ''} maxLength={60} onChange={e => set({ dose: e.target.value })}/></label>}
      <label className="onb-f"><span>Veterinário(a) ou local</span><input className="fi" value={d.vet || ''} maxLength={80} onChange={e => set({ vet: e.target.value })}/></label>
      <label className="onb-f"><span>Observação</span><input className="fi" value={d.notes || ''} maxLength={300} onChange={e => set({ notes: e.target.value })}/></label>
      <label className="onb-f"><span>Anexo ou link (carteirinha, receita)</span><input className="fi" type="url" value={d.link || ''} maxLength={500} placeholder="https://…" onChange={e => set({ link: e.target.value })} aria-invalid={!linkOk}/></label>
      <p className="row-s">O Ninho só registra e lembra. Para sintomas ou dúvidas de saúde, fale com o veterinário.</p>
    </Sheet>
  )
}

const PLACES = ['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Corredor', 'Varanda', 'Outro']

export function PuppyPanel({ dog, accidents, today, busy, onAdd, onSave, onDelete }: {
  dog: Dog, accidents: AccidentRow[], today: string, busy: boolean
  onAdd: (location: string) => void, onSave: (a: AccidentRow, patch: { location: string, occurred_at: string, date: string, notes: string | null }) => void, onDelete: (a: AccidentRow) => void
}) {
  const mine = useMemo(() => accidents.filter(a => a.dog_id === dog.id), [accidents, dog.id])
  const st = puppyStats(mine, today)
  const todayN = mine.filter(a => a.date === today).length
  const [edit, setEdit] = useState<AccidentRow | null>(null)
  const max = Math.max(1, ...st.perWeek.map(w => w.count))
  const total = Object.values(st.periods).reduce((a, b) => a + b, 0)
  return (
    <div className="puppy">
      <div className="slbl" style={{ color: 'var(--amb)' }}>🐶 Modo filhote · {dog.name}</div>
      <div style={{ fontSize: 15, fontWeight: 500 }}>{todayN === 0 ? 'Nenhum acidente hoje 🎉' : `${todayN} acidente${todayN > 1 ? 's' : ''} hoje`}</div>
      <div className="pills">{PLACES.slice(0, 5).map(loc => <button key={loc} className="pill" disabled={busy} onClick={() => onAdd(loc)}>+ {loc}</button>)}</div>
      {mine.length > 0 && <div className="pp-stats">
        <div className="pp-box"><div className="pp-l">Por semana {st.trend === 'down' ? '· melhorando 📉' : st.trend === 'up' ? '· aumentou' : ''}</div>
          <div className="pp-bars" aria-label={`Acidentes por semana: ${st.perWeek.map(w => w.count).join(', ')}`}>{st.perWeek.map(w => <span key={w.start} title={`semana de ${fmtDate(w.start)}: ${w.count}`}><i style={{ height: `${Math.round(w.count / max * 100)}%` }}/><small>{w.count}</small></span>)}</div></div>
        <div className="pp-box"><div className="pp-l">Onde mais</div>{st.topPlaces.map(([l, n]) => <div key={l} className="pp-row"><span>{l}</span><span className="mono">{n}</span></div>)}</div>
        <div className="pp-box"><div className="pp-l">Quando</div>{(Object.keys(st.periods) as Array<keyof typeof st.periods>).map(p => <div key={p} className="pp-row"><span>{PERIOD_LABEL[p]}</span><span className="mono">{total ? Math.round(st.periods[p] / total * 100) : 0}%</span></div>)}</div>
      </div>}
      {mine.slice(0, 6).map(a => (
        <div key={a.id} className="acc">
          <span>💧</span><span>{a.location}{a.notes ? ` · ${a.notes}` : ''}</span>
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--mu)' }}>{a.date !== today && fmtDate(a.date) + ' · '}{timeOfInstant(a.occurred_at)}</span>
          <button className="ib" aria-label={`Corrigir registro de ${a.location}`} onClick={() => setEdit(a)}>✎</button>
        </div>
      ))}
      {edit && <AccidentSheet a={edit} onClose={() => setEdit(null)} onSave={p => { onSave(edit, p); setEdit(null) }} onDelete={() => { if (confirm('Apagar este registro de acidente?')) { onDelete(edit); setEdit(null) } }}/>}
    </div>
  )
}

function AccidentSheet({ a, onClose, onSave, onDelete }: { a: AccidentRow, onClose: () => void, onSave: (p: { location: string, occurred_at: string, date: string, notes: string | null }) => void, onDelete: () => void }) {
  const [loc, setLoc] = useState(a.location)
  const [time, setTime] = useState(timeOfInstant(a.occurred_at))
  const [date, setDate] = useState(a.date)
  const [notes, setNotes] = useState(a.notes || '')
  return (
    <Sheet size="sm" title="Corrigir registro" onClose={onClose} footer={<>
      <button className="btn btn-danger" onClick={onDelete}>Apagar</button>
      <button className="btn btn-p" onClick={() => onSave({ location: loc, date, occurred_at: new Date(`${date}T${time}:00-03:00`).toISOString(), notes: notes.trim() || null })}>Salvar</button>
    </>}>
      <div className="onb-days wrap" role="radiogroup" aria-label="Cômodo">{PLACES.map(p => <button key={p} role="radio" aria-checked={loc === p} className={`onb-day wide ${loc === p ? 'on' : ''}`} onClick={() => setLoc(p)}>{p}</button>)}</div>
      <div className="onb-row" style={{ marginTop: 12 }}>
        <label className="onb-f"><span>Dia</span><input className="fi" type="date" value={date} onChange={e => setDate(e.target.value)}/></label>
        <label className="onb-f"><span>Horário</span><input className="fi" type="time" value={time} onChange={e => setTime(e.target.value)}/></label>
      </div>
      <label className="onb-f"><span>Observação</span><input className="fi" value={notes} maxLength={200} onChange={e => setNotes(e.target.value)} placeholder="Ex.: logo depois de beber água"/></label>
    </Sheet>
  )
}
