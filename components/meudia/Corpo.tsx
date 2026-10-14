'use client'
// Evolução do corpo no Meu dia: medição (digitada ou lida de um exame pela IA, com
// data), gráfico de cada medida e fotos de evolução para comparar lado a lado.
// As fotos são privadas e têm compartilhamento próprio ("Fotos de evolução").
import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtDate } from '@/lib/dates'
import { BODY_FIELDS, bodySeries, change, photoCompare } from '@/lib/meudia'
import * as api from '@/lib/services/meudia'
import { readBodyFile, shrink } from '@/lib/services/aiFiles'
import { Sheet } from '@/components/ui/Sheet'
import { LineChart } from './LineChart'
import type { MeuDiaProps } from './MeuDia'

const fmtN = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
const POSES: Array<[api.PPhoto['pose'], string]> = [['frente', 'Frente'], ['lado', 'Lado'], ['costas', 'Costas'], ['outra', 'Outra']]
const poseLabel = (p: string) => POSES.find(x => x[0] === p)?.[1] || p
const fullDate = (d: string) => `${fmtDate(d)}/${d.slice(2, 4)}`

export function Body(p: MeuDiaProps) {
  useEffect(() => {
    const w = p.focus?.what
    if (w !== 'peso' && w !== 'foto') return
    const t = setTimeout(() => {
      document.getElementById(w === 'peso' ? 'md-medir' : 'md-fotos')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (w === 'peso') (document.querySelector('.md-body-f input') as HTMLInputElement | null)?.focus({ preventScroll: true })
    }, 300)
    return () => clearTimeout(t)
  }, [p.focus?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState<Record<string, string>>({}), [notes, setNotes] = useState(''), [field, setField] = useState('weight')
  const [date, setDate] = useState(p.today), [scan, setScan] = useState<'idle' | 'busy'>('idle'), [scanMsg, setScanMsg] = useState<{ ok: boolean, text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const num = (v?: string) => v && v.trim() ? Number(v.replace(',', '.')) : null
  const series = bodySeries(p.logs, p.me, field)
  const info = BODY_FIELDS.find(b => b[0] === field)!
  const ch = change(series)
  const canSave = BODY_FIELDS.some(([k]) => num(f[k]) && num(f[k])! > 0) && date <= p.today
  async function readExam(file: File | undefined) {
    if (!file) return
    setScan('busy'); setScanMsg(null)
    const r = await readBodyFile(p.householdId, file)
    setScan('idle')
    if (fileRef.current) fileRef.current.value = ''
    if (r.ok === false) { setScanMsg({ ok: false, text: r.error }); return }
    setF(Object.fromEntries(Object.entries(r.data.values).map(([k, v]) => [k, fmtN(v)])))
    if (r.data.date) setDate(r.data.date)
    if (r.data.note) setNotes(r.data.note)
    setScanMsg({ ok: true, text: `Li ${Object.keys(r.data.values).length} medida(s)${r.data.date ? ` de ${fullDate(r.data.date)}` : ''}. Confira e corrija antes de salvar.` })
  }
  async function save() {
    const data: Record<string, any> = {}
    for (const [k] of BODY_FIELDS) if (k !== 'weight' && num(f[k])) data[k] = num(f[k])
    if (notes.trim()) data.notes = notes.trim()
    try { await p.onAdd('corpo', num(f.weight), data, date); setF({}); setNotes(''); setDate(p.today); setScanMsg(null) } catch { /* aviso já mostrado */ }
  }
  return (
    <>
      <section className="card" aria-labelledby="md-medir">
        <div className="slbl" id="md-medir">Nova medição</div>
        <div className="md-acts" style={{ marginTop: 0, marginBottom: 10 }}>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={e => readExam(e.target.files?.[0])}/>
          <button className="btn btn-g" disabled={scan === 'busy'} onClick={() => fileRef.current?.click()}>{scan === 'busy' ? 'Lendo o exame…' : '📄 Ler bioimpedância ou avaliação (PDF ou foto)'}</button>
        </div>
        {scanMsg && <p className={`row-s ${scanMsg.ok ? '' : 'al-warn'}`} role={scanMsg.ok ? 'status' : 'alert'} style={{ marginBottom: 8 }}>{scanMsg.text}</p>}
        <label className="onb-f co-date"><span>Data da medição</span><input className="fi" type="date" value={date} max={p.today} onChange={e => setDate(e.target.value || p.today)}/></label>
        <div className="md-body-f">{BODY_FIELDS.map(([k, l, u]) => <label key={k} className="onb-f"><span>{l} ({u})</span><input className="fi" inputMode="decimal" value={f[k] || ''} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))}/></label>)}</div>
        <label className="onb-f"><span>Observação</span><input className="fi" value={notes} maxLength={200} onChange={e => setNotes(e.target.value)}/></label>
        <button className="btn btn-p" disabled={!canSave} onClick={save}>Salvar medição</button>
        <p className="row-s" style={{ marginTop: 8 }}>O arquivo do exame vai só para a leitura e não fica guardado.</p>
      </section>
      <section className="card" aria-labelledby="md-evo">
        <div className="slbl" id="md-evo">Evolução {ch != null && <span className="chip">{ch > 0 ? '+' : ''}{fmtN(ch)} {info[2]} desde {fmtDate(series[0].date)}</span>}</div>
        <div className="md-tabs" role="tablist" aria-label="Medida">{BODY_FIELDS.map(([k, l]) => <button key={k} role="tab" aria-selected={field === k} className={`fc ${field === k ? 'on' : ''}`} onClick={() => setField(k)}>{l}</button>)}</div>
        <LineChart title={info[1]} unit={info[2]} data={series}/>
      </section>
      <Photos {...p}/>
    </>
  )
}

function Photos(p: MeuDiaProps) {
  const [list, setList] = useState<api.PPhoto[] | null | undefined>(undefined)
  const [pose, setPose] = useState<api.PPhoto['pose']>('frente'), [date, setDate] = useState(p.today)
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<api.PPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const reload = useCallback(() => api.listPhotos(p.householdId).then(setList).catch(() => setList([])), [p.householdId])
  useEffect(() => { reload() }, [reload])
  if (list === null) return null // sem a migration 028
  const mine = (list || []).filter(x => x.who === p.me)
  const dates = Array.from(new Set(mine.map(x => x.date)))
  async function add(file: File | undefined) {
    if (!file) return
    setBusy(true); setErr(null)
    try {
      const [full, thumb] = await Promise.all([shrink(file, 1280, 0.82), shrink(file, 320, 0.7)])
      if (full.data.length > 2_000_000) throw new Error('grande')
      await api.addPhoto(p.householdId, p.me, { date, pose, note: null, thumb: thumb.data, data: full.data })
      await reload()
    } catch (e: any) { setErr(e?.message === 'grande' ? 'Essa foto ficou grande demais. Tente outra.' : 'Não foi possível guardar a foto. Confira a internet e tente de novo.') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  return (
    <section className="card" aria-labelledby="md-fotos">
      <div className="slbl" id="md-fotos">📸 Fotos de evolução <span className="mono" style={{ color: 'var(--faint)' }}>{mine.length}</span></div>
      <p className="row-s" style={{ marginBottom: 8 }}>Mesma pose, mesma luz e mesmo lugar ajudam a comparar. Só você vê, a não ser que ligue "Fotos de evolução" em Metas e privacidade.</p>
      <div className="onb-days wrap" role="radiogroup" aria-label="Pose">{POSES.map(([k, l]) => <button key={k} role="radio" aria-checked={pose === k} className={`onb-day wide ${pose === k ? 'on' : ''}`} onClick={() => setPose(k)}>{l}</button>)}</div>
      <div className="co-add">
        <label className="onb-f co-date"><span>Data da foto</span><input className="fi" type="date" value={date} max={p.today} onChange={e => setDate(e.target.value || p.today)}/></label>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={e => add(e.target.files?.[0])}/>
        <button className="btn btn-s" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Guardando…' : '📷 Adicionar foto'}</button>
      </div>
      {err && <p className="row-s al-warn" role="alert">{err}</p>}
      {dates.length >= 2 && <Compare {...p} mine={mine} dates={dates}/>}
      {list === undefined ? <div className="row-s">Carregando…</div> : !mine.length ? <div className="lc-empty">Nenhuma foto ainda.</div> :
        <div className="co-days">{dates.map(d => <div key={d} className="co-day">
          <b className="mono">{fullDate(d)}</b>
          <div className="co-thumbs">{mine.filter(x => x.date === d).map(x => <button key={x.id} className="co-th" onClick={() => setView(x)} aria-label={`Ver foto: ${poseLabel(x.pose)}, ${fullDate(d)}`}>
            <img src={`data:image/jpeg;base64,${x.thumb}`} alt=""/><span>{poseLabel(x.pose)}</span></button>)}</div>
        </div>)}</div>}
      {(list || []).some(x => x.who !== p.me) && <div className="co-day">
        <b>Fotos que {(p.names[p.me === 'g' ? 's' : 'g'] || '').split(' ')[0]} compartilhou</b>
        <div className="co-thumbs">{(list || []).filter(x => x.who !== p.me).slice(0, 24).map(x => <button key={x.id} className="co-th" onClick={() => setView(x)} aria-label={`Ver foto: ${poseLabel(x.pose)}, ${fullDate(x.date)}`}>
          <img src={`data:image/jpeg;base64,${x.thumb}`} alt=""/><span>{poseLabel(x.pose)} · {fmtDate(x.date)}</span></button>)}</div>
      </div>}
      {view && <PhotoSheet photo={view} mine={view.who === p.me} onClose={() => setView(null)} onDelete={async () => { await api.deletePhoto(view.id).catch(() => {}); setView(null); reload() }}/>}
    </section>
  )
}

/** Antes × depois na mesma pose (a foto inteira só é buscada aqui). */
function Compare(p: MeuDiaProps & { mine: api.PPhoto[], dates: string[] }) {
  const poses = POSES.filter(([k]) => p.mine.some(x => x.pose === k))
  const [pose, setPose] = useState<api.PPhoto['pose']>(poses[0]?.[0] || 'frente')
  const withPose = p.dates.filter(d => p.mine.some(x => x.date === d && x.pose === pose))
  const [a, setA] = useState<string>(''), [b, setB] = useState<string>('')
  const before = a && withPose.includes(a) ? a : withPose[withPose.length - 1], after = b && withPose.includes(b) ? b : withPose[0]
  return (
    <div className="co-cmp">
      <div className="co-cmp-h">
        <b>Comparar</b>
        <label className="onb-f"><span>Pose</span><select className="fi" value={pose} onChange={e => setPose(e.target.value as api.PPhoto['pose'])}>{poses.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="onb-f"><span>Antes</span><select className="fi" value={before || ''} onChange={e => setA(e.target.value)}>{withPose.map(d => <option key={d} value={d}>{fullDate(d)}</option>)}</select></label>
        <label className="onb-f"><span>Depois</span><select className="fi" value={after || ''} onChange={e => setB(e.target.value)}>{withPose.map(d => <option key={d} value={d}>{fullDate(d)}</option>)}</select></label>
      </div>
      {withPose.length < 2 ? <p className="row-s">Precisa de fotos em duas datas nessa pose.</p> :
        <div className="co-pair">
          {[before, after].map((d, i) => { const ph = p.mine.find(x => x.date === d && x.pose === pose)!; return <figure key={i}><FullPhoto id={ph.id} thumb={ph.thumb} alt={`${i ? 'Depois' : 'Antes'}: ${poseLabel(pose)}, ${fullDate(d)}`}/><figcaption>{i ? 'Depois' : 'Antes'} · {fullDate(d)}</figcaption></figure> })}
        </div>}
      {withPose.length >= 2 && before && after && before !== after && <CompareNumbers {...p} before={before < after ? before : after} after={before < after ? after : before}/>}
    </div>
  )
}

const N1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
/** Peso e medidas perto de cada foto (até 14 dias) e a diferença, sem julgar se subir ou descer é bom. */
function CompareNumbers(p: MeuDiaProps & { before: string, after: string }) {
  const c = photoCompare(p.logs, p.me, p.before, p.after)
  if (!c.rows.length) return <p className="row-s co-nums-empty">Registre peso ou medidas perto das datas das fotos para ver os números aqui.</p>
  return <table className="co-nums">
    <caption>Em {c.days} dia{c.days === 1 ? '' : 's'} · valores registrados perto de cada foto</caption>
    <thead><tr><th scope="col">Medida</th><th scope="col">Antes</th><th scope="col">Depois</th><th scope="col">Diferença</th></tr></thead>
    <tbody>{c.rows.map(r => <tr key={r.key}><th scope="row">{r.label}</th><td className="mono">{N1(r.a)}</td><td className="mono">{N1(r.b)}</td>
      <td className="mono">{r.diff === 0 ? 'igual' : `${r.diff > 0 ? '+' : '−'}${N1(Math.abs(r.diff))} ${r.unit}`}</td></tr>)}</tbody>
  </table>
}

function FullPhoto({ id, thumb, alt }: { id: string, thumb: string, alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => { let on = true; api.photoData(id).then(d => { if (on) setSrc(d) }).catch(() => {}); return () => { on = false } }, [id])
  return <img className="co-full" src={`data:image/jpeg;base64,${src || thumb}`} alt={alt}/>
}

function PhotoSheet({ photo, mine, onClose, onDelete }: { photo: api.PPhoto, mine: boolean, onClose: () => void, onDelete: () => void }) {
  return (
    <Sheet title={`${poseLabel(photo.pose)} · ${fullDate(photo.date)}`} onClose={onClose} footer={mine ? <button className="btn btn-g" onClick={() => { if (confirm('Apagar esta foto?')) onDelete() }}>Apagar foto</button> : undefined}>
      <FullPhoto id={photo.id} thumb={photo.thumb} alt={`${poseLabel(photo.pose)}, ${fullDate(photo.date)}`}/>
    </Sheet>
  )
}
